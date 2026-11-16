import { Controller, Post, Body, Param } from '@nestjs/common';
import { InvestmentService, CreateInvestmentDto, ApproveInvestmentDto } from './investment.service';

@Controller('api/v1/investments')
export class InvestmentController {
  constructor(private readonly investmentService: InvestmentService) {}

  @Post('maker-submit')
  async makerSubmit(@Body() dto: CreateInvestmentDto) {
    return this.investmentService.makerSubmit(dto);
  }

  @Post(':referenceId/checker-approve')
  async checkerApprove(
    @Param('referenceId') referenceId: string,
    @Body() dto: ApproveInvestmentDto
  ) {
    return this.investmentService.checkerApprove(referenceId, dto);
  }
}
