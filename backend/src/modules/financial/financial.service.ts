import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface TreasuryOverview {
  reportingDate: string;
  source: string;
  bankLedgerBalance: number;
  availableBalance: number;
  overdraftFacility: number;
  unrestrictedLiquidity: number;
  restrictedDeposits: number;
  dataCompleteness: 'VERIFIED' | 'PENDING_DATA';
}

export interface BondHolding {
  id: string;
  symbol: string;
  issuer: string;
  creditRating: string;
  faceValue: number;
  carryingValue: number;
  marketValue: number;
  accruedInterest: number;
  couponRatePercent: number;
  maturityDate: string;
  daysToMaturity: number;
  status: 'ACTIVE' | 'PENDING_DATA';
}

export interface LiquidityAnalysis {
  liquidAssetsTotal: number;
  netCashOutflows30d: number;
  liquidityCoverageRatioPercent: number;
  regulatoryMinimumPercent: number;
  liquidityBufferAmount: number;
  stressTestResult: 'ADEQUATE' | 'DEFICIT';
}

export interface FileImportRecord {
  importId: string;
  filename: string;
  sha256Checksum: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  status: 'STAGED_FOR_MAKER_CHECKER' | 'VERIFIED' | 'REJECTED';
}

@Injectable()
export class FinancialService {
  private readonly logger = new Logger(FinancialService.name);

  // In-memory imports checksum cache to prevent duplicate file uploads
  private readonly importedChecksums = new Map<string, FileImportRecord>();

  /**
   * 1. Deterministic Treasury Overview
   * Explicit Rule: Overdraft facility is strictly separated from cash assets.
   */
  public getTreasuryOverview(): TreasuryOverview {
    const bankLedgerBalance = 145820000.5; // THB
    const restrictedDeposits = 20000000.0;  // Pledged collateral / legal reserves
    const overdraftFacility = 50000000.0;   // Available OD line (NOT cash assets)
    
    // Unrestricted liquidity = Ledger balance - Restricted
    const unrestrictedLiquidity = bankLedgerBalance - restrictedDeposits;
    const availableBalance = unrestrictedLiquidity;

    return {
      reportingDate: new Date().toISOString().split('T')[0],
      source: 'KTB & GSB Core Banking Open API (TEST Feed)',
      bankLedgerBalance,
      availableBalance,
      overdraftFacility,
      unrestrictedLiquidity,
      restrictedDeposits,
      dataCompleteness: 'VERIFIED',
    };
  }

  /**
   * 2. Bond Portfolio & Maturity Ladder
   */
  public getBondPortfolio(): { holdings: BondHolding[]; weightedAverageYieldPercent: number; totalCarryingValue: number } {
    const today = new Date();

    const holdings: BondHolding[] = [
      {
        id: 'BOND-001',
        symbol: 'LB28DA',
        issuer: 'กระทรวงการคลัง (Ministry of Finance)',
        creditRating: 'AAA',
        faceValue: 50000000,
        carryingValue: 50250000,
        marketValue: 50400000,
        accruedInterest: 412500,
        couponRatePercent: 3.25,
        maturityDate: '2028-12-17',
        daysToMaturity: Math.ceil((new Date('2028-12-17').getTime() - today.getTime()) / (1000 * 3600 * 24)),
        status: 'ACTIVE',
      },
      {
        id: 'BOND-002',
        symbol: 'PTT275A',
        issuer: 'บมจ. ปตท. (PTT Public Co., Ltd.)',
        creditRating: 'AAA',
        faceValue: 30000000,
        carryingValue: 30100000,
        marketValue: 30250000,
        accruedInterest: 288750,
        couponRatePercent: 3.85,
        maturityDate: '2027-05-20',
        daysToMaturity: Math.ceil((new Date('2027-05-20').getTime() - today.getTime()) / (1000 * 3600 * 24)),
        status: 'ACTIVE',
      },
      {
        id: 'BOND-003',
        symbol: 'SCC26DA',
        issuer: 'บมจ. ปูนซิเมนต์ไทย (SCG)',
        creditRating: 'A+',
        faceValue: 20000000,
        carryingValue: 20050000,
        marketValue: 20120000,
        accruedInterest: 195000,
        couponRatePercent: 3.90,
        maturityDate: '2026-11-30',
        daysToMaturity: Math.max(0, Math.ceil((new Date('2026-11-30').getTime() - today.getTime()) / (1000 * 3600 * 24))),
        status: 'ACTIVE',
      },
    ];

    const totalCarryingValue = holdings.reduce((sum, h) => sum + h.carryingValue, 0);
    const weightedYieldSum = holdings.reduce((sum, h) => sum + h.couponRatePercent * h.carryingValue, 0);
    const weightedAverageYieldPercent = Number((weightedYieldSum / totalCarryingValue).toFixed(2));

    return {
      holdings,
      weightedAverageYieldPercent,
      totalCarryingValue,
    };
  }

  /**
   * 3. Deterministic Liquidity Coverage Ratio (LCR)
   * Formula: (Unrestricted Liquid Assets / Total Projected Net 30-day Cash Outflows) * 100
   */
  public evaluateLiquidityCoverage(projectedOutflows30d: number = 85000000): LiquidityAnalysis {
    const treasury = this.getTreasuryOverview();
    const bondPortfolio = this.getBondPortfolio();

    // High Quality Liquid Assets (Cash + Sovereign Bonds)
    const liquidAssetsTotal = treasury.unrestrictedLiquidity + 50250000; // Unrestricted cash + LB28DA
    const lcrPercent = Number(((liquidAssetsTotal / projectedOutflows30d) * 100).toFixed(2));
    const regulatoryMinimumPercent = 6.0; // Cooperative statutory requirement
    const liquidityBufferAmount = liquidAssetsTotal - (projectedOutflows30d * regulatoryMinimumPercent) / 100;

    return {
      liquidAssetsTotal,
      netCashOutflows30d: projectedOutflows30d,
      liquidityCoverageRatioPercent: lcrPercent,
      regulatoryMinimumPercent,
      liquidityBufferAmount,
      stressTestResult: lcrPercent >= regulatoryMinimumPercent ? 'ADEQUATE' : 'DEFICIT',
    };
  }

  /**
   * 4. Financial File Import Processor with SHA256 Checksum Verification
   */
  public processFileImport(
    filename: string,
    fileBuffer: Buffer,
    uploaderEmail: string
  ): FileImportRecord {
    const allowedMimeExtensions = ['.pdf', '.xlsx', '.csv'];
    const lowerFilename = filename.toLowerCase();
    const isExtensionValid = allowedMimeExtensions.some((ext) => lowerFilename.endsWith(ext));

    if (!isExtensionValid) {
      throw new BadRequestException('Unsupported file format. Supported formats: PDF, XLSX, CSV.');
    }

    if (fileBuffer.length > 25 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds the 25MB safety limit.');
    }

    // Calculate SHA256 Checksum
    const sha256Checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Duplicate Import Detection
    if (this.importedChecksums.has(sha256Checksum)) {
      const existing = this.importedChecksums.get(sha256Checksum)!;
      throw new ConflictException(
        `Duplicate file import rejected! This exact file was already imported on ${existing.uploadedAt} by ${existing.uploadedBy}`
      );
    }

    const record: FileImportRecord = {
      importId: `IMP-${Date.now()}`,
      filename,
      sha256Checksum,
      fileSizeBytes: fileBuffer.length,
      mimeType: lowerFilename.endsWith('.pdf') ? 'application/pdf' : lowerFilename.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
      uploadedBy: uploaderEmail,
      uploadedAt: new Date().toISOString(),
      status: 'STAGED_FOR_MAKER_CHECKER',
    };

    this.importedChecksums.set(sha256Checksum, record);
    this.logger.log(`Financial statement imported and staged: ${filename} (SHA256: ${sha256Checksum})`);

    return record;
  }
}
