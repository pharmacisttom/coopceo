import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvestmentService, CreateProposalInput, ApproveProposalInput } from './investment.service';
import { SessionAuthGuard, RolesGuard, Roles, CurrentUser } from '../auth/auth.guard';
import { AuthenticatedUser } from '../auth/auth.service';

@Controller('api/v1/investments')
@UseGuards(SessionAuthGuard, RolesGuard)
export class InvestmentController {
  constructor(private readonly investmentService: InvestmentService) {}

  /**
   * List all proposals
   */
  @Get()
  @Roles('MAKER', 'CHECKER', 'AUDITOR', 'EXECUTIVE')
  getAllProposals() {
    return this.investmentService.getAllProposals();
  }

  /**
   * Get single proposal by reference ID
   */
  @Get(':referenceId')
  @Roles('MAKER', 'CHECKER', 'AUDITOR', 'EXECUTIVE')
  getProposal(@Param('referenceId') referenceId: string) {
    return this.investmentService.getProposal(referenceId);
  }

  /**
   * Phase 1: Maker submits investment proposal
   * Maker identity derived exclusively from server session
   */
  @Post('maker-submit')
  @Roles('MAKER')
  @HttpCode(HttpStatus.CREATED)
  async makerSubmit(
    @Body() input: CreateProposalInput,
    @CurrentUser() makerUser: AuthenticatedUser
  ) {
    return this.investmentService.makerSubmit(input, makerUser);
  }

  /**
   * Phase 1: Checker approves investment proposal with Step-Up MFA
   * Checker identity derived exclusively from server session
   */
  @Post(':referenceId/checker-approve')
  @Roles('CHECKER')
  @HttpCode(HttpStatus.OK)
  async checkerApprove(
    @Param('referenceId') referenceId: string,
    @Body() input: ApproveProposalInput,
    @CurrentUser() checkerUser: AuthenticatedUser
  ) {
    return this.investmentService.checkerApprove(referenceId, input, checkerUser);
  }
}
