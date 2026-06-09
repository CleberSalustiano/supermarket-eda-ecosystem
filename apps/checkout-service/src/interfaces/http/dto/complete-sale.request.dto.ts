import { IsUUID } from 'class-validator';

export class CompleteSaleRequestDto {
  @IsUUID('4')
  tenantId!: string;
}
