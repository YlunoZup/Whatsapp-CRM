import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantsService } from './tenants.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateTenantDto } from './dto/update-tenant.dto';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant' })
  async getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.findOne(user.tenantId);
  }

  @Put('current')
  @ApiOperation({ summary: 'Update current tenant' })
  async updateCurrent(@Body() dto: UpdateTenantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.update(user.tenantId, dto);
  }

  @Get('current/settings')
  @ApiOperation({ summary: 'Get current tenant settings' })
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.getSettings(user.tenantId);
  }
}
