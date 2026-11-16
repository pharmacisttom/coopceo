import { FinancialService } from '../../backend/src/modules/financial/financial.service';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('Phase 6 Financial Calculations & Integrity Tests', () => {
  let financialService: FinancialService;

  beforeEach(() => {
    financialService = new FinancialService();
  });

  // Test 1: Overdraft facility is strictly separated from cash assets
  it('TC-FIN01: Overdraft facility is NOT counted as cooperative cash assets', () => {
    const treasury = financialService.getTreasuryOverview();
    expect(treasury.overdraftFacility).toBe(50000000);
    // Unrestricted liquidity must be Bank Ledger - Restricted
    expect(treasury.unrestrictedLiquidity).toBe(treasury.bankLedgerBalance - treasury.restrictedDeposits);
    // Available balance must NOT add overdraft facility
    expect(treasury.availableBalance).toBe(treasury.unrestrictedLiquidity);
    expect(treasury.availableBalance).not.toBe(treasury.unrestrictedLiquidity + treasury.overdraftFacility);
  });

  // Test 2: Weighted Average Yield calculation is mathematically deterministic
  it('TC-FIN02: Calculate deterministic weighted average bond yield', () => {
    const bondPortfolio = financialService.getBondPortfolio();
    expect(bondPortfolio.holdings.length).toBe(3);
    expect(bondPortfolio.totalCarryingValue).toBe(100400000);
    expect(bondPortfolio.weightedAverageYieldPercent).toBe(3.56);
  });

  // Test 3: Liquidity Coverage Ratio (LCR) satisfies statutory buffer
  it('TC-FIN03: Deterministic LCR calculation against cooperative regulatory threshold', () => {
    const lcr = financialService.evaluateLiquidityCoverage(85000000);
    expect(lcr.liquidityCoverageRatioPercent).toBeGreaterThan(6.0);
    expect(lcr.stressTestResult).toBe('ADEQUATE');
    expect(lcr.liquidityBufferAmount).toBeGreaterThan(0);
  });

  // Test 4: Financial File Import with SHA256 checksum & duplicate rejection
  it('TC-FIN04: Duplicate file import is rejected based on SHA256 checksum', () => {
    const fakePdfContent = Buffer.from('%PDF-1.4 Mock Financial Statement 2026-11');
    const firstImport = financialService.processFileImport('statement_nov2026.pdf', fakePdfContent, 'maker@rycoop.coop');
    expect(firstImport.importId).toBeDefined();
    expect(firstImport.sha256Checksum).toHaveLength(64);
    expect(firstImport.status).toBe('STAGED_FOR_MAKER_CHECKER');

    // Attempting to upload identical file content must be rejected
    expect(() => {
      financialService.processFileImport('copy_statement.pdf', fakePdfContent, 'maker2@rycoop.coop');
    }).toThrow(ConflictException);
  });

  // Test 5: Rejection of unsupported file types
  it('TC-FIN05: Unsupported file types are rejected', () => {
    const fakeExe = Buffer.from('MZ executable binary');
    expect(() => {
      financialService.processFileImport('malicious.exe', fakeExe, 'attacker@rycoop.coop');
    }).toThrow(BadRequestException);
  });
});
