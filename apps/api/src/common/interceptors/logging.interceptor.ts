import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url } = request;
    const userId = (request as any).user?.id;
    const tenantId = (request as any).user?.tenantId;

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log(
            `${method} ${url} ${statusCode} ${duration}ms` +
              (userId ? ` - User: ${userId}` : '') +
              (tenantId ? ` - Tenant: ${tenantId}` : ''),
          );

          // Log slow requests
          if (duration > 3000) {
            this.logger.warn(
              `Slow request detected: ${method} ${url} took ${duration}ms`,
            );
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.error(
            `${method} ${url} ${statusCode} ${duration}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
