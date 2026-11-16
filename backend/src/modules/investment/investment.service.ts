import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService, ITransactionClient } from '../database/database.service';
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

export interface InvestmentProposalRecord {
  id: string;
  reference_id: string;
  investment_type: string;
  issuer_name: string;
  amount: number;
  expected_yield: number;
  tenor_months: number;
  purpose?: string;
  status: 'PENDING_CHECKER' | 'APPROVED' | 'REJECTED';
  maker_id: string;
  checker_id?: string;
  checker_stepup_verified: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authService: AuthService
  ) {
    // Seed initial proposal in database service
    this.databaseService.seedProposal({
      id: 'd0000000-0000-0000-0000-000000000001',
      reference_id: 'INV-889102',
      investment_type: 'พันธบัตรรัฐบาล (LB28DA)',
      issuer_name: 'กระทรวงการคลัง / ธนาคารแห่งประเทศไทย',
      amount: 15000000.0,
      expected_yield: 3.25,
      tenor_months: 36,
      purpose: 'บริหารสภาพคล่องเงินกองทุนสหกรณ์',
      status: 'PENDING_CHECKER',
      maker_id: 'a0000000-0000-0000-0000-000000000001',
      checker_id: null,
      checker_stepup_verified: false,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Phase 3: Maker Submits Proposal using Parameterized PostgreSQL Transactions
   */
  public async makerSubmit(
    input: CreateProposalInput,
    makerUser: AuthenticatedUser
  ): Promise<{ success: boolean; referenceId: string; status: string }> {
    if (!makerUser || makerUser.role !== 'MAKER') {
      throw new ForbiddenException('Only authorized Maker users can create investment proposals.');
    }

    if (!input.amount || input.amount <= 0) {
      throw new BadRequestException('Investment amount must be a positive number greater than 0.');
    }

    return this.databaseService.withTransaction(async (client: ITransactionClient) => {
      // 1. Check if proposal already exists
      const existingCheck = await client.query(
        'SELECT id FROM investment_proposals WHERE reference_id = $1',
        [input.referenceId]
      );

      if (existingCheck.rows.length > 0) {
        throw new ConflictException(`Proposal with Reference ID ${input.referenceId} already exists.`);
      }

      const proposalId = crypto.randomUUID();

      // 2. Insert into investment_proposals
      await client.query(
        `INSERT INTO investment_proposals (
          id, reference_id, investment_type, issuer_name, amount, expected_yield, tenor_months, purpose, status, maker_id, maker_notes, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_CHECKER', $9, $10, 1)`,
        [
          proposalId,
          input.referenceId,
          input.investmentType,
          input.issuerName,
          input.amount,
          input.expectedYield,
          input.tenorMonths,
          input.purpose || null,
          makerUser.id,
          'Submitted via Maker UI',
        ]
      );

      // 3. Atomically Insert Audit Log
      const auditId = crypto.randomUUID();
      await client.query(
        `INSERT INTO audit_logs (id, user_id, action, entity_name, entity_id, old_state, new_state, ip_address)
         VALUES ($1, $2, 'MAKER_SUBMIT_INVESTMENT', 'investment_proposals', $3, NULL, $4, $5)`,
        [
          auditId,
          makerUser.id,
          input.referenceId,
          JSON.stringify({ referenceId: input.referenceId, amount: input.amount, makerId: makerUser.id }),
          '127.0.0.1',
        ]
      );

      // 4. Atomically Insert Outbox Event
      const outboxId = crypto.randomUUID();
      await client.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
         VALUES ($1, 'INVESTMENT', $2, 'INVESTMENT_PENDING_APPROVAL', $3, 'PENDING')`,
        [
          outboxId,
          input.referenceId,
          JSON.stringify({
            referenceId: input.referenceId,
            amount: input.amount,
            makerName: makerUser.fullName,
          }),
        ]
      );

      return {
        success: true,
        referenceId: input.referenceId,
        status: 'PENDING_CHECKER',
      };
    });
  }

  /**
   * Phase 3: Checker Approves Proposal with PostgreSQL Row-Level Lock (SELECT ... FOR UPDATE)
   * Enforces:
   * 1. Row Lock (SELECT ... FOR UPDATE) to serialize concurrent approvals
   * 2. Segregation of Duties (maker_id != checker_id)
   * 3. Step-Up MFA verified against bound parameters
   * 4. Double-approval blocked (status must be PENDING_CHECKER)
   * 5. Atomic write of proposal update, audit log, and outbox event
   * 6. Automatic rollback on error
   */
  public async checkerApprove(
    referenceId: string,
    input: ApproveProposalInput,
    checkerUser: AuthenticatedUser
  ): Promise<{ success: boolean; referenceId: string; status: string; approvedAt: string }> {
    if (!checkerUser || checkerUser.role !== 'CHECKER') {
      throw new ForbiddenException('Only authorized Checker users can approve investment proposals.');
    }

    return this.databaseService.withTransaction(async (client: ITransactionClient) => {
      // 1. SELECT ... FOR UPDATE (Row-level lock in PostgreSQL)
      const selectResult = await client.query(
        `SELECT id, reference_id, amount, status, maker_id, expected_yield, tenor_months, version
         FROM investment_proposals
         WHERE reference_id = $1 FOR UPDATE`,
        [referenceId]
      );

      if (selectResult.rows.length === 0) {
        throw new BadRequestException(`Investment proposal ${referenceId} not found.`);
      }

      const proposal = selectResult.rows[0];

      // 2. Status verification
      if (proposal.status !== 'PENDING_CHECKER') {
        throw new BadRequestException(
          `Proposal is already in status '${proposal.status}'. Cannot approve again (Double-approval blocked).`
        );
      }

      // 3. Segregation of Duties Check: Maker and Checker MUST be different individuals
      if (proposal.maker_id === checkerUser.id) {
        this.logger.warn(`Security alert: Maker ${checkerUser.email} attempted to self-approve proposal ${referenceId}`);
        throw new ForbiddenException('Segregation of duties violation: Maker cannot approve their own investment proposal.');
      }

      // 4. Verify Transaction-Bound Step-Up MFA (Passkey or TOTP)
      await this.authService.verifyStepUpAssertion(
        input.challengeId,
        referenceId,
        Number(proposal.amount),
        checkerUser.id,
        input.stepUpToken,
        input.mfaType
      );

      // 5. Update proposal with optimistic version check
      const updateResult = await client.query(
        `UPDATE investment_proposals
         SET status = 'APPROVED',
             checker_id = $1,
             checker_stepup_verified = true,
             checker_stepup_type = $2,
             checker_decided_at = NOW(),
             version = version + 1,
             updated_at = NOW()
         WHERE reference_id = $3 AND version = $4
         RETURNING *`,
        [checkerUser.id, input.mfaType, referenceId, proposal.version]
      );

      if (updateResult.rows.length === 0) {
        throw new ConflictException('Concurrent modification detected during approval. Transaction aborted.');
      }

      // 6. Insert Immutable Audit Log
      const auditId = crypto.randomUUID();
      await client.query(
        `INSERT INTO audit_logs (id, user_id, action, entity_name, entity_id, old_state, new_state, ip_address)
         VALUES ($1, $2, 'CHECKER_APPROVE_INVESTMENT', 'investment_proposals', $3, $4, $5, '127.0.0.1')`,
        [
          auditId,
          checkerUser.id,
          referenceId,
          JSON.stringify({ status: 'PENDING_CHECKER', version: proposal.version }),
          JSON.stringify({ status: 'APPROVED', checkerId: checkerUser.id, version: proposal.version + 1 }),
        ]
      );

      // 7. Insert Transactional Outbox Event
      const outboxId = crypto.randomUUID();
      await client.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
         VALUES ($1, 'INVESTMENT', $2, 'INVESTMENT_APPROVED', $3, 'PENDING')`,
        [
          outboxId,
          referenceId,
          JSON.stringify({
            referenceId,
            amount: proposal.amount,
            approvedBy: checkerUser.fullName,
            stepUpType: input.mfaType,
          }),
        ]
      );

      this.logger.log(`Proposal ${referenceId} successfully approved by Checker ${checkerUser.id} with Step-Up MFA.`);

      return {
        success: true,
        referenceId,
        status: 'APPROVED',
        approvedAt: new Date().toISOString(),
      };
    });
  }

  public async getProposal(referenceId: string): Promise<any> {
    const res = await this.databaseService.query(
      'SELECT * FROM investment_proposals WHERE reference_id = $1',
      [referenceId]
    );
    return res.rows[0];
  }

  public async getAllProposals(): Promise<any[]> {
    const res = await this.databaseService.query(
      'SELECT * FROM investment_proposals ORDER BY created_at DESC'
    );
    return res.rows;
  }
}
