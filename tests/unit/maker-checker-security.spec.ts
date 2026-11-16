import { InvestmentService, CreateProposalInput, ApproveProposalInput } from '../../backend/src/modules/investment/investment.service';
import { AuthService, AuthenticatedUser } from '../../backend/src/modules/auth/auth.service';
import { AuditService } from '../../backend/src/modules/audit/audit.service';
import { NotificationsService } from '../../backend/src/modules/notifications/notifications.service';
import { ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';

describe('Phase 1 Security Tests: Maker-Checker Segregation & Integrity', () => {
  let investmentService: InvestmentService;
  let authService: AuthService;
  let auditService: AuditService;
  let notificationsService: NotificationsService;

  const mockMaker: AuthenticatedUser = {
    id: 'user-maker-001',
    email: 'maker.finance@rycoop.coop',
    fullName: 'สมชาย พัฒนากร',
    role: 'MAKER',
    department: 'การเงิน',
    isActive: true,
    passkeyRegistered: false,
    totpEnabled: true,
  };

  const mockChecker: AuthenticatedUser = {
    id: 'user-checker-002',
    email: 'checker.director@rycoop.coop',
    fullName: 'กมลฉัตร วงศ์วิจิตร',
    role: 'CHECKER',
    department: 'กรรมการ',
    isActive: true,
    passkeyRegistered: true,
    totpEnabled: true,
  };

  beforeEach(() => {
    authService = new AuthService();
    auditService = new AuditService();
    notificationsService = new NotificationsService();
    investmentService = new InvestmentService(auditService, notificationsService, authService);
  });

  // Test 1: Maker successfully creates proposal
  it('TC-MC01: Maker creates valid proposal derived strictly from session', async () => {
    const input: CreateProposalInput = {
      referenceId: 'INV-TEST-001',
      investmentType: 'GOVERNMENT_BOND',
      issuerName: 'ธนาคารแห่งประเทศไทย',
      amount: 10000000,
      expectedYield: 3.1,
      tenorMonths: 24,
    };

    const res = await investmentService.makerSubmit(input, mockMaker);
    expect(res.success).toBe(true);
    expect(res.status).toBe('PENDING_CHECKER');

    const stored = investmentService.getProposal('INV-TEST-001');
    expect(stored).toBeDefined();
    expect(stored?.makerId).toBe(mockMaker.id);
  });

  // Test 2: Segregation of Duties — Maker CANNOT approve their own proposal
  it('TC-MC02: Maker is strictly forbidden from self-approving their proposal', async () => {
    const input: CreateProposalInput = {
      referenceId: 'INV-TEST-SELF',
      investmentType: 'GOVERNMENT_BOND',
      issuerName: 'ธปท.',
      amount: 5000000,
      expectedYield: 3.0,
      tenorMonths: 12,
    };
    await investmentService.makerSubmit(input, mockMaker);

    // Create challenge
    const { challengeId } = authService.createStepUpChallenge('INV-TEST-SELF', 5000000, mockMaker.id);

    // Maker tries to approve with a mock Checker role attached
    const fraudulentCheckerContext: AuthenticatedUser = {
      ...mockMaker,
      role: 'CHECKER', // Even if privilege escalation attempts occur
    };

    const approveInput: ApproveProposalInput = {
      challengeId,
      stepUpToken: '123456',
      mfaType: 'TOTP',
    };

    await expect(
      investmentService.checkerApprove('INV-TEST-SELF', approveInput, fraudulentCheckerContext)
    ).rejects.toThrow(ForbiddenException);
  });

  // Test 3: Checker approves with valid transaction-bound Step-Up MFA
  it('TC-MC03: Checker approves proposal with valid Step-Up challenge', async () => {
    const input: CreateProposalInput = {
      referenceId: 'INV-TEST-002',
      investmentType: 'BOND',
      issuerName: 'ปตท.',
      amount: 20000000,
      expectedYield: 3.8,
      tenorMonths: 36,
    };
    await investmentService.makerSubmit(input, mockMaker);

    // Checker generates step-up challenge bound to referenceId and amount
    const { challengeId } = authService.createStepUpChallenge('INV-TEST-002', 20000000, mockChecker.id);

    const approveInput: ApproveProposalInput = {
      challengeId,
      stepUpToken: '123456',
      mfaType: 'TOTP',
    };

    const result = await investmentService.checkerApprove('INV-TEST-002', approveInput, mockChecker);
    expect(result.success).toBe(true);
    expect(result.status).toBe('APPROVED');

    const updated = investmentService.getProposal('INV-TEST-002');
    expect(updated?.status).toBe('APPROVED');
    expect(updated?.checkerId).toBe(mockChecker.id);
  });

  // Test 4: Cannot approve an already approved proposal (Double-approval protection)
  it('TC-MC04: Reject approval attempt on already approved proposal', async () => {
    const input: CreateProposalInput = {
      referenceId: 'INV-TEST-003',
      investmentType: 'BOND',
      issuerName: 'SCG',
      amount: 15000000,
      expectedYield: 3.5,
      tenorMonths: 18,
    };
    await investmentService.makerSubmit(input, mockMaker);

    const { challengeId } = authService.createStepUpChallenge('INV-TEST-003', 15000000, mockChecker.id);
    await investmentService.checkerApprove(
      'INV-TEST-003',
      { challengeId, stepUpToken: '123456', mfaType: 'TOTP' },
      mockChecker
    );

    // Second approval attempt
    const { challengeId: challengeId2 } = authService.createStepUpChallenge('INV-TEST-003', 15000000, mockChecker.id);
    await expect(
      investmentService.checkerApprove(
        'INV-TEST-003',
        { challengeId: challengeId2, stepUpToken: '654321', mfaType: 'TOTP' },
        mockChecker
      )
    ).rejects.toThrow(BadRequestException);
  });

  // Test 5: Replay of Step-Up Challenge is strictly rejected
  it('TC-MC05: Single-use Step-Up challenge cannot be replayed', async () => {
    const { challengeId } = authService.createStepUpChallenge('INV-REPLAY', 10000000, mockChecker.id);

    // First use passes
    const res1 = authService.verifyStepUpAssertion(
      challengeId,
      'INV-REPLAY',
      10000000,
      mockChecker.id,
      '123456',
      'TOTP'
    );
    expect(res1.success).toBe(true);

    // Replay with same challengeId fails
    expect(() =>
      authService.verifyStepUpAssertion(
        challengeId,
        'INV-REPLAY',
        10000000,
        mockChecker.id,
        '123456',
        'TOTP'
      )
    ).toThrow(ForbiddenException);
  });

  // Test 6: Parameter Tampering (amount altered) invalidates challenge
  it('TC-MC06: Altered transaction amount invalidates step-up challenge', () => {
    const { challengeId } = authService.createStepUpChallenge('INV-TAMPER', 10000000, mockChecker.id);

    // Attempting to use challenge for 15,000,000 instead of 10,000,000
    expect(() =>
      authService.verifyStepUpAssertion(
        challengeId,
        'INV-TAMPER',
        15000000, // Altered
        mockChecker.id,
        '123456',
        'TOTP'
      )
    ).toThrow(ForbiddenException);
  });
});

