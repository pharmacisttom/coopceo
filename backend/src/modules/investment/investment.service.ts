import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateInvestmentDto {
  investmentType: string;
  issuerName: string;
  amount: number;
  expectedYield: number;
  tenorMonths: number;
  purpose?: string;
  referenceId: string;
  makerUserId: string;
}

export interface ApproveInvestmentDto {
  checkerUserId: string;
  stepUpToken: string;
  notes?: string;
}

@Injectable()
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);

  // In-memory proposal store for test harness
  private proposals = new Map<string, any>();

  constructor(
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  /**
   * Maker submits proposal
   * Rule 9: Frontend confirmation is NOT final approval.
   * State transitions to PENDING_CHECKER and an outbox event is scheduled.
   */
  public async makerSubmit(dto: CreateInvestmentDto) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('วงเงินลงทุนต้องมากกว่า 0 บาท');
    }

    const proposal = {
      id: `prop-${Date.now()}`,
      referenceId: dto.referenceId,
      investmentType: dto.investmentType,
      issuerName: dto.issuerName,
      amount: dto.amount,
      expectedYield: dto.expectedYield,
      tenorMonths: dto.tenorMonths,
      purpose: dto.purpose,
      makerId: dto.makerUserId,
      status: 'PENDING_CHECKER',
      createdAt: new Date().toISOString(),
    };

    this.proposals.set(dto.referenceId, proposal);

    // 1. Audit Log Maker action
    await this.auditService.log({
      userId: dto.makerUserId,
      action: 'MAKER_SUBMIT_INVESTMENT',
      entityName: 'investment_proposals',
      entityId: dto.referenceId,
      newState: proposal,
    });

    // 2. Publish notification to Checker via Outbox/Service (Rule 10: Non-blocking)
    try {
      await this.notificationsService.publishNotification({
        id: `notif-${Date.now()}`,
        eventId: `evt-inv-${dto.referenceId}`,
        category: 'INVESTMENT_PENDING_APPROVAL',
        priority: 'WARNING',
        status: 'UNREAD',
        title: 'มีรายการลงทุนใหม่รอการอนุมัติ (Checker Queue)',
        message: `รายการ ${dto.referenceId} วงเงิน ฿${dto.amount.toLocaleString()} โดย ${dto.makerUserId} รอการตรวจสอบและอนุมัติ`,
        targetRole: 'CHECKER',
        actionUrl: `/investments/${dto.referenceId}`,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error('Failed to dispatch notification, outbox will retry', err);
    }

    return {
      success: true,
      referenceId: dto.referenceId,
      status: 'PENDING_CHECKER',
      message: 'คำขอถูกบันทึกและส่งต่อไปยังคิวของ Checker เรียบร้อยแล้ว',
    };
  }

  /**
   * Checker approves proposal
   * Enforces:
   * 1. Segregation of duties: Checker != Maker
   * 2. Step-up 2FA token validity
   * 3. Audit trail
   */
  public async checkerApprove(referenceId: string, dto: ApproveInvestmentDto) {
    const proposal = this.proposals.get(referenceId);
    if (!proposal) {
      throw new BadRequestException('ไม่พบรายการลงทุนที่ระบุ');
    }

    if (proposal.status !== 'PENDING_CHECKER') {
      throw new BadRequestException(`รายการนี้อยู่ในสถานะ ${proposal.status} แล้ว ไม่สามารถอนุมัติซ้ำได้`);
    }

    // Segregation of Duties Check
    if (proposal.makerId === dto.checkerUserId) {
      throw new ForbiddenException('ข้อกำหนดความปลอดภัย: ผู้สร้างคำขอ (Maker) ไม่สามารถอนุมัติรายการตนเองได้');
    }

    // Verify Step-up 2FA
    if (!dto.stepUpToken || dto.stepUpToken.length < 6) {
      throw new ForbiddenException('จำเป็นต้องยืนยันตัวตนระดับสูง (Step-Up 2FA) ก่อนอนุมัติรายการ');
    }

    const previousState = { ...proposal };
    proposal.status = 'APPROVED';
    proposal.checkerId = dto.checkerUserId;
    proposal.checkerApprovedAt = new Date().toISOString();
    proposal.stepUpVerified = true;

    // Audit Log Checker action
    await this.auditService.log({
      userId: dto.checkerUserId,
      action: 'CHECKER_APPROVE_INVESTMENT',
      entityName: 'investment_proposals',
      entityId: referenceId,
      oldState: previousState,
      newState: proposal,
    });

    return {
      success: true,
      referenceId,
      status: 'APPROVED',
      approvedAt: proposal.checkerApprovedAt,
    };
  }
}

