import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_TENANT_CHECK = 'skipTenantCheck';
export const SkipTenantCheck = () => Reflect.metadata(SKIP_TENANT_CHECK, true);

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if we should skip tenant check (for public routes)
    const skipTenantCheck = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTenantCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated and have a tenantId
    if (!user || !user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    // Attach tenantId to request for easy access
    request.tenantId = user.tenantId;

    return true;
  }
}
