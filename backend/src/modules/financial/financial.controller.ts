import {
  Controller,
  Get,
  Post,
  UseGuards,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FinancialService } from './financial.service';
import { SessionAuthGuard, RolesGuard, Roles, CurrentUser } from '../auth/auth.guard';
import { AuthenticatedUser } from '../auth/auth.service';

@Controller('api/v1/financial')
@UseGuards(SessionAuthGuard, RolesGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get('treasury')
  @Roles('MAKER', 'CHECKER', 'AUDITOR', 'EXECUTIVE')
  getTreasuryOverview() {
    return this.financialService.getTreasuryOverview();
  }

  @Get('bonds')
  @Roles('MAKER', 'CHECKER', 'AUDITOR', 'EXECUTIVE')
  getBondPortfolio() {
    return this.financialService.getBondPortfolio();
  }

  @Get('liquidity')
  @Roles('MAKER', 'CHECKER', 'AUDITOR', 'EXECUTIVE')
  getLiquidityAnalysis() {
    return this.financialService.evaluateLiquidityCoverage();
  }

  @Post('import')
  @Roles('MAKER')
  importFinancialFile(
    @Body('filename') filename: string,
    @Body('base64Content') base64Content: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (!filename || !base64Content) {
      throw new BadRequestException('Filename and base64Content are required.');
    }

    const buffer = Buffer.from(base64Content, 'base64');
    return this.financialService.processFileImport(filename, buffer, user.email);
  }
}

