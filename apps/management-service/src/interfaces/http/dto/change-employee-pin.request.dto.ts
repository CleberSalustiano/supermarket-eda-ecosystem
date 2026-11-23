import { IsUUID, Matches } from 'class-validator';

export class ChangeEmployeePinRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @Matches(/^\d{4,12}$/)
  pin!: string;
}
