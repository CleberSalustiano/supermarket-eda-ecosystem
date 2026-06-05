import { Body, Controller, Post } from '@nestjs/common';

import type { RegisterEmployeeOutputDto } from '../../application/dto/register-employee.dto';
import { RegisterEmployeeUseCase } from '../../application/use-cases/register-employee.use-case';
import { RegisterEmployeeRequestDto } from './dto/register-employee.request.dto';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly registerEmployeeUseCase: RegisterEmployeeUseCase) {}

  @Post()
  async registerEmployee(
    @Body() request: RegisterEmployeeRequestDto
  ): Promise<RegisterEmployeeOutputDto> {
    return this.registerEmployeeUseCase.execute({
      tenantId: request.tenantId,
      employeeCode: request.employeeCode,
      fullName: request.fullName,
      role: request.role,
      pin: request.pin
    });
  }
}
