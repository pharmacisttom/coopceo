import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService, AuthenticatedUser } from '../auth/auth.service';

export interface CreateProposalInput {
  investmentType: string;
  issuerName: string;
  amount: number;
  expectedYield: number;
  tenorMonths: number;
  purpose?: string;
  referenceId: string;
}

export interface ApproveProposalInput {
  challengeId: string;
  stepUpToken: string;
  mfaType: 'PASSKEY' | 'TOTP';
  notes?: string;
}

export interface InvestmentProposalEntity {
  id: string;
  referenceId: string;
  investmentType: string;
  issuerName: string;
  amount: number;
  expectedYield: number;
  tenorMonths: number;
  purpose?: string;
  status: 'PENDING_CHECKER' | 'APPROVED' | 'REJECTED';
  makerId: string;
  makerEmail: string;
  makerSubmittedAt: string;
  checkerId?: string;
  checkerEmail?: string;
  checkerApprovedAt?: string;
  stepUpVerified?: boolean;
  version: number; // Optimistic Concurrency Control lock
}

@Injectable()
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);

  // In-memory relational simulation with atomic locking for test environment
  // (mirrors PostgreSQL SELECT ... FOR UPDATE transaction semantics)
  private readonly proposals = new Map<string, InvestmentProposalEntity>();
  private readonly activeLocks = new Set<string>(); // Mutex per referenceId

  constructor(
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService
  ) {
    // Seed initial test proposals
    this.proposals.set('INV-889102', {
      id: 'd0000000-0000-0000-0000-000000000001',
      referenceId: 'INV-889102',
      investmentType: 'พันธบัตรรัฐบาล (LB28DA)',
      issuerName: 'กระทรวงการคลัง / ธนาคารแห่งประเทศไทย',
      amount: 15000000,
      expectedYield: 3.25,
      tenorMonths: 36,
      purpose: 'บริหารสภาพคล่องเงินกองทุนสหกรณ์',
      status: 'PENDING_CHECKER',
      makerId: 'a0000000-0000-0000-0000-000000000001',
      makerEmail: 'maker.finance@rycoop.coop',
      makerSubmittedAt: new Date().toISOString(),
      version: 1,
    });
  }

  /**
   * Phase 1: Secure Maker Submission
   * Identity derived exclusively from authenticated server session (makerUser)
   */
  public async makerSubmit(
    input: CreateProposalInput,
    makerUser: AuthenticatedUser
  ): Promise<{ success: boolean; referenceId: string; status: string }> {
    if (!makerUser || makerUser.role !== 'MAKER') {
      throw new ForbiddenException('Only authorized Maker users can create investment proposals.');
    }

    if (!input.amount || input.amount <= 0) {
      throw new BadRequestException('Investment amount must be greater than 0 THB.');
    }

    if (this.proposals.has(input.referenceId)) {
      throw new ConflictException(`Proposal with Reference ID ${input.referenceId} already exists.`);
    }

    const proposal: InvestmentProposalEntity = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      referenceId: input.referenceId,
      investmentType: input.investmentType,
      issuerName: input.issuerName,
      amount: input.amount,
      expectedYield: input.expectedYield,
      tenorMonths: input.tenorMonths,
      purpose: input.purpose,
      makerId: makerUser.id, // Strictly from session
      makerEmail: makerUser.email,
      makerSubmittedAt: new Date().toISOString(),
      status: 'PENDING_CHECKER',
      version: 1,
    };

    // 1. Transactional State Store
    this.proposals.set(input.referenceId, proposal);

    // 2. Insert Immutable Audit Log
    await this.auditService.log({
      userId: makerUser.id,
      action: 'MAKER_SUBMIT_INVESTMENT',
      entityName: 'investment_proposals',
      entityId: input.referenceId,
      newState: {
        referenceId: proposal.referenceId,
        amount: proposal.amount,
        makerId: proposal.makerId,
      },
    });

    // 3. Dispatch Notification to Checkers (Transactional Outbox)
    await this.notificationsService.publishNotification({
      id: `notif-${Date.now()}`,
      eventId: `evt-inv-submit-${input.referenceId}`,
      category: 'INVESTMENT_PENDING_APPROVAL',
      priority: 'WARNING',
      status: 'UNREAD',
      title: 'มีรายการลงทุนใหม่รอการอนุมัติ (Checker Queue)',
      message: `รายการ ${input.referenceId} วงเงิน ฿${input.amount.toLocaleString()} สร้างโดย ${makerUser.fullName}`,
      targetRole: 'CHECKER',
      actionUrl: `/dashboard#checker-queue`,
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      referenceId: input.referenceId,
      status: 'PENDING_CHECKER',
    };
  }

  /**
   * Phase 1: Secure Checker Approval with Row-Level Lock & Step-Up MFA
   * Enforces:
   * 1. Checker identity strictly derived from server session (checkerUser)
   * 2. Maker != Checker segregation of duties
   * 3. Row lock to prevent concurrent double-approvals (Race Condition Protection)
   * 4. Step-Up challenge cryptographic validation bound to transaction
   * 5. Atomic state update & audit logging
   */
  public async checkerApprove(
    referenceId: string,
    input: ApproveProposalInput,
    checkerUser: AuthenticatedUser
  ): Promise<{ success: boolean; referenceId: string; status: string; approvedAt: string }> {
    if (!checkerUser || checkerUser.role !== 'CHECKER') {
      throw new ForbiddenException('Only authorized Checker users can approve investment proposals.');
    }

    // Acquire Row Lock (SELECT ... FOR UPDATE equivalent)
    if (this.activeLocks.has(referenceId)) {
      throw new ConflictException(`Transaction on proposal ${referenceId} is currently being processed by another lock.`);
    }

    this.activeLocks.add(referenceId);

    try {
      const proposal = this.proposals.get(referenceId);
      if (!proposal) {
        throw new BadRequestException(`Investment proposal ${referenceId} not found.`);
      }

      // Check current state
      if (proposal.status !== 'PENDING_CHECKER') {
        throw new BadRequestException(`Proposal is already in status '${proposal.status}'. Cannot approve again.`);
      }

      // Segregation of Duties Check: Maker and Checker MUST be distinct individuals
      if (proposal.makerId === checkerUser.id || proposal.makerEmail.toLowerCase() === checkerUser.email.toLowerCase()) {
        this.logger.warn(`Security alert: Maker ${checkerUser.email} attempted to self-approve proposal ${referenceId}`);
        throw new ForbiddenException('Segregation of duties violation: Maker cannot approve their own investment proposal.');
      }

      // Verify Transaction-Bound Step-Up MFA (Passkey or TOTP)
      this.authService.verifyStepUpAssertion(
        input.challengeId,
        referenceId,
        proposal.amount,
        checkerUser.id,
        input.stepUpToken,
        input.mfaType
      );

      // Mutate state atomically
      const previousState = { ...proposal };
      proposal.status = 'APPROVED';
      proposal.checkerId = checkerUser.id;
      proposal.checkerEmail = checkerUser.email;
      proposal.checkerApprovedAt = new Date().toISOString();
      proposal.stepUpVerified = true;
      proposal.version += 1;

      // Insert Immutable Audit Log
      await this.auditService.log({
        userId: checkerUser.id,
        action: 'CHECKER_APPROVE_INVESTMENT',
        entityName: 'investment_proposals',
        entityId: referenceId,
        oldState: previousState,
        newState: proposal,
      });

      // Insert Transactional Outbox Event for Notification
      await this.notificationsService.publishNotification({
        id: `notif-${Date.now()}`,
        eventId: `evt-inv-approved-${referenceId}`,
        category: 'SYSTEM',
        priority: 'INFORMATION',
        status: 'UNREAD',
        title: `อนุมัติรายการลงทุน ${referenceId} เรียบร้อย`,
        message: `รายการวงเงิน ฿${proposal.amount.toLocaleString()} ได้รับการอนุมัติโดย ${checkerUser.fullName} (Step-Up Verified)`,
        targetRole: 'MAKER',
        actionUrl: `/dashboard#investments`,
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        referenceId,
        status: 'APPROVED',
        approvedAt: proposal.checkerApprovedAt,
      };
    } finally {
      // Release Row Lock
      this.activeLocks.delete(referenceId);
    }
  }

  public getProposal(referenceId: string): InvestmentProposalEntity | undefined {
    return this.proposals.get(referenceId);
  }

  public getAllProposals(): InvestmentProposalEntity[] {
    return Array.from(this.proposals.values());
  }
}
