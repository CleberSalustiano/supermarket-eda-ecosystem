import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query
} from '@nestjs/common';

import type {
  ChangeEmployeePinOutputDto,
  EmployeeViewDto,
  ListEmployeesOutputDto
} from '#/application/dto/employee-management.dto';
import type { RegisterEmployeeOutputDto } from '#/application/dto/register-employee.dto';
import { ChangeEmployeePinUseCase } from '#/application/use-cases/change-employee-pin.use-case';
import { DeactivateEmployeeUseCase } from '#/application/use-cases/deactivate-employee.use-case';
import { ListEmployeesUseCase } from '#/application/use-cases/list-employees.use-case';
import { RegisterEmployeeUseCase } from '#/application/use-cases/register-employee.use-case';
import { ChangeEmployeePinRequestDto } from './dto/change-employee-pin.request.dto';
import { EmployeeTenantRequestDto } from './dto/employee-tenant.request.dto';
import { ListEmployeesQueryDto } from './dto/list-employees.query.dto';
import { RegisterEmployeeRequestDto } from './dto/register-employee.request.dto';

@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly registerEmployeeUseCase: RegisterEmployeeUseCase,
    private readonly listEmployeesUseCase: ListEmployeesUseCase,
    private readonly deactivateEmployeeUseCase: DeactivateEmployeeUseCase,
    private readonly changeEmployeePinUseCase: ChangeEmployeePinUseCase
  ) {}

  @Get()
  async listEmployees(@Query() query: ListEmployeesQueryDto): Promise<ListEmployeesOutputDto> {
    return this.listEmployeesUseCase.execute({
      tenantId: query.tenantId,
      status: query.status,
      limit: query.limit,
      offset: query.offset
    });
  }

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

  @Post(':employeeId/deactivation')
  @HttpCode(HttpStatus.OK)
  async deactivateEmployee(
    @Param('employeeId', new ParseUUIDPipe({ version: '4' })) employeeId: string,
    @Body() request: EmployeeTenantRequestDto
  ): Promise<EmployeeViewDto> {
    return this.deactivateEmployeeUseCase.execute({ tenantId: request.tenantId, employeeId });
  }

  @Put(':employeeId/pin')
  async changeEmployeePin(
    @Param('employeeId', new ParseUUIDPipe({ version: '4' })) employeeId: string,
    @Body() request: ChangeEmployeePinRequestDto
  ): Promise<ChangeEmployeePinOutputDto> {
    return this.changeEmployeePinUseCase.execute({
      tenantId: request.tenantId,
      employeeId,
      pin: request.pin
    });
  }
}
