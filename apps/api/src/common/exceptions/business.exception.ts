import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
  path?: string;
}

export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly code?: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message, statusCode);
  }
}

export class EntityNotFoundException extends BusinessException {
  constructor(entity: string, identifier?: string) {
    super(
      identifier
        ? `${entity} with identifier '${identifier}' not found`
        : `${entity} not found`,
      HttpStatus.NOT_FOUND,
      'ENTITY_NOT_FOUND',
      { entity, identifier },
    );
  }
}

export class DuplicateEntityException extends BusinessException {
  constructor(entity: string, field: string, value?: string) {
    super(
      value
        ? `${entity} with ${field} '${value}' already exists`
        : `${entity} with this ${field} already exists`,
      HttpStatus.CONFLICT,
      'DUPLICATE_ENTITY',
      { entity, field, value },
    );
  }
}

export class UnauthorizedAccessException extends BusinessException {
  constructor(resource?: string) {
    super(
      resource
        ? `You are not authorized to access this ${resource}`
        : 'You are not authorized to perform this action',
      HttpStatus.FORBIDDEN,
      'UNAUTHORIZED_ACCESS',
      { resource },
    );
  }
}

export class InvalidOperationException extends BusinessException {
  constructor(message: string, details?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'INVALID_OPERATION', details);
  }
}

export class RateLimitExceededException extends BusinessException {
  constructor(retryAfter?: number) {
    super(
      'Rate limit exceeded. Please try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
      'RATE_LIMIT_EXCEEDED',
      { retryAfter },
    );
  }
}

export class ExternalServiceException extends BusinessException {
  constructor(service: string, message?: string) {
    super(
      message || `External service '${service}' is unavailable`,
      HttpStatus.SERVICE_UNAVAILABLE,
      'EXTERNAL_SERVICE_ERROR',
      { service },
    );
  }
}

export class ValidationException extends BusinessException {
  constructor(errors: Record<string, string[]>) {
    super(
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      { errors },
    );
  }
}

export class FileUploadException extends BusinessException {
  constructor(message: string, details?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'FILE_UPLOAD_ERROR', details);
  }
}

export class WhatsAppException extends BusinessException {
  constructor(message: string, details?: Record<string, any>) {
    super(message, HttpStatus.BAD_GATEWAY, 'WHATSAPP_ERROR', details);
  }
}
