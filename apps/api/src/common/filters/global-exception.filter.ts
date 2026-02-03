import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import {
  BusinessException,
  ErrorResponse,
} from '../exceptions/business.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // Log the error
    this.logError(exception, errorResponse, request);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Handle BusinessException
    if (exception instanceof BusinessException) {
      return {
        statusCode: exception.getStatus(),
        message: exception.message,
        error: HttpStatus[exception.getStatus()] || 'Error',
        code: exception.code,
        details: exception.details,
        timestamp,
        path,
      };
    }

    // Handle standard HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message = exception.message;
      let details: Record<string, any> | undefined;

      if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message || exception.message;
        if (Array.isArray(resp.message)) {
          details = { validationErrors: resp.message };
          message = 'Validation failed';
        }
      }

      return {
        statusCode: status,
        message,
        error: HttpStatus[status] || 'Error',
        details,
        timestamp,
        path,
      };
    }

    // Handle Prisma errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, timestamp, path);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data provided',
        error: 'Bad Request',
        code: 'PRISMA_VALIDATION_ERROR',
        timestamp,
        path,
      };
    }

    // Handle unknown errors
    const errorMessage =
      exception instanceof Error ? exception.message : 'Unknown error occurred';

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : errorMessage,
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      timestamp,
      path,
    };
  }

  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    timestamp: string,
    path: string,
  ): ErrorResponse {
    switch (exception.code) {
      case 'P2002': // Unique constraint violation
        const target = exception.meta?.target as string[];
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${target?.join(', ') || 'value'} already exists`,
          error: 'Conflict',
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          details: { fields: target },
          timestamp,
          path,
        };

      case 'P2025': // Record not found
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'The requested record was not found',
          error: 'Not Found',
          code: 'RECORD_NOT_FOUND',
          timestamp,
          path,
        };

      case 'P2003': // Foreign key constraint violation
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid reference to related record',
          error: 'Bad Request',
          code: 'FOREIGN_KEY_VIOLATION',
          details: { field: exception.meta?.field_name },
          timestamp,
          path,
        };

      case 'P2014': // Required relation violation
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Required related record is missing',
          error: 'Bad Request',
          code: 'REQUIRED_RELATION_MISSING',
          timestamp,
          path,
        };

      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database operation failed',
          error: 'Internal Server Error',
          code: `PRISMA_${exception.code}`,
          timestamp,
          path,
        };
    }
  }

  private logError(
    exception: unknown,
    errorResponse: ErrorResponse,
    request: Request,
  ): void {
    const logData = {
      statusCode: errorResponse.statusCode,
      message: errorResponse.message,
      code: errorResponse.code,
      path: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.get('user-agent'),
      userId: (request as any).user?.id,
      tenantId: (request as any).user?.tenantId,
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${errorResponse.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
        logData,
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} - ${errorResponse.statusCode}`,
        logData,
      );
    }
  }
}
