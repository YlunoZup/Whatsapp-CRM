import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WebhooksService } from './webhooks.service';
import { WebhookProcessor } from './webhook.processor';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('webhooks/endpoints')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly webhookProcessor: WebhookProcessor,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all webhook endpoints' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.webhooksService.findAllEndpoints(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook endpoint by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.webhooksService.findOneEndpoint(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new webhook endpoint' })
  async create(@Body() dto: CreateEndpointDto, @CurrentUser() user: AuthenticatedUser) {
    return this.webhooksService.createEndpoint(user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a webhook endpoint' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEndpointDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.webhooksService.updateEndpoint(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.webhooksService.deleteEndpoint(id, user.tenantId);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get webhook delivery logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLogs(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.webhooksService.getEndpointLogs(id, user.tenantId, page, limit);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send a test webhook to an endpoint' })
  async testEndpoint(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const endpoint = await this.webhooksService.findOneEndpoint(id, user.tenantId);

    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from WhatsApp CRM',
        endpointId: endpoint.id,
        endpointName: endpoint.name,
      },
    };

    await this.webhooksService.triggerWebhooks(user.tenantId, 'test', testPayload);

    return {
      success: true,
      message: 'Test webhook queued for delivery',
    };
  }

  @Post('logs/:logId/retry')
  @ApiOperation({ summary: 'Retry a failed webhook delivery' })
  async retryDelivery(@Param('logId') logId: string, @CurrentUser() user: AuthenticatedUser) {
    // Verify the log belongs to this tenant's endpoint before retrying
    await this.webhooksService.verifyWebhookLogOwnership(logId, user.tenantId);
    await this.webhookProcessor.retryFailedWebhook(logId);

    return {
      success: true,
      message: 'Webhook retry queued',
    };
  }
}
