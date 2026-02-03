import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IntegrationsService } from './integrations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all API keys' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.findAllApiKeys(user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  async create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.createApiKey(user.tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an API key' })
  async update(
    @Param('id') id: string,
    @Body() dto: { name?: string; permissions?: string[]; expiresAt?: Date | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.updateApiKey(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an API key' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.deleteApiKey(id, user.tenantId);
  }
}
