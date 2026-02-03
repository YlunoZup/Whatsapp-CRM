import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    // Use tenant ID + IP for rate limiting key
    // This means each tenant has their own rate limit bucket
    const user = req.user as { tenantId?: string } | undefined;
    const tenantId = user?.tenantId || 'anonymous';
    const ip = this.getRequestIP(req);

    return `${tenantId}:${ip}`;
  }

  private getRequestIP(req: Record<string, unknown>): string {
    const xForwardedFor = (req.headers as Record<string, string>)?.['x-forwarded-for'];
    if (xForwardedFor) {
      const forwardedIp = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0];
      return forwardedIp || 'unknown';
    }
    return (req.ip as string) || (req.connection as { remoteAddress?: string })?.remoteAddress || 'unknown';
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    throttlerLimitDetail: { limit: number; ttl: number; key: string; tracker: string; totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number },
  ): Promise<void> {
    throw new ThrottlerException(
      `Rate limit exceeded. Please wait ${Math.ceil(throttlerLimitDetail.timeToExpire / 1000)} seconds before retrying.`,
    );
  }
}
