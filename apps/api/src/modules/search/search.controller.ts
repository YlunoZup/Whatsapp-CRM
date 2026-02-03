import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { SearchService } from './search.service';
import { Throttle } from '@nestjs/throttler';

const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS = 50;
const DEFAULT_LIMIT = 5;

@Controller('search')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Throttle({ default: { ttl: 60000, limit: 60 } }) // 60 searches per minute (1 per second average)
  async search(
    @CurrentTenant() tenantId: string,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    // Validate query parameter
    if (!query || query.length < 2) {
      return {
        conversations: [],
        contacts: [],
        messages: [],
      };
    }

    // Limit query length to prevent DoS
    if (query.length > MAX_QUERY_LENGTH) {
      throw new BadRequestException(`Search query cannot exceed ${MAX_QUERY_LENGTH} characters`);
    }

    // Parse and validate limit
    let parsedLimit = DEFAULT_LIMIT;
    if (limit) {
      parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        parsedLimit = DEFAULT_LIMIT;
      } else if (parsedLimit > MAX_RESULTS) {
        parsedLimit = MAX_RESULTS;
      }
    }

    return this.searchService.search(tenantId, query, parsedLimit);
  }
}
