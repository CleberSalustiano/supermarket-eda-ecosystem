import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { MANAGER_APPROVAL_VERIFICATION_PATH } from '@supermarket/shared-domain';
import { InternalApiTokenGuard } from '@supermarket/shared-infra';

import type { VerifyManagerApprovalOutputDto } from '#/application/dto/verify-manager-approval.dto';
import { VerifyManagerApprovalUseCase } from '#/application/use-cases/verify-manager-approval.use-case';
import { VerifyManagerApprovalRequestDto } from './dto/verify-manager-approval.request.dto';

/**
 * Service-to-service route used by checkout-service. Business outcomes are
 * always 200 so the status code never reveals which check failed.
 */
@Controller()
@UseGuards(InternalApiTokenGuard)
export class InternalManagerApprovalsController {
  constructor(private readonly verifyManagerApprovalUseCase: VerifyManagerApprovalUseCase) {}

  @Post(MANAGER_APPROVAL_VERIFICATION_PATH)
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() request: VerifyManagerApprovalRequestDto
  ): Promise<VerifyManagerApprovalOutputDto> {
    return this.verifyManagerApprovalUseCase.execute({
      tenantId: request.tenantId,
      approverCode: request.approverCode,
      pin: request.pin,
      registerId: request.registerId,
      saleId: request.saleId
    });
  }
}
