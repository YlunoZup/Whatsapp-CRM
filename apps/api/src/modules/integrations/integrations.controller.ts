import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IntegrationsService } from './integrations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get available integrations' })
  async getIntegrations(@CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.getIntegrations(user.tenantId);
  }

  @Get(':type/docs')
  @ApiOperation({ summary: 'Get integration documentation' })
  async getIntegrationDocs(@Param('type') type: string) {
    return this.integrationsService.getIntegrationDocs(type);
  }
}
