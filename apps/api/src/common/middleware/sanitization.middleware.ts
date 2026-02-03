import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = this.sanitizeObject(req.query) as any;
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = this.sanitizeObject(req.params) as any;
    }

    next();
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Remove keys that could be used for prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  private sanitizeString(str: string): string {
    // Remove null bytes
    let sanitized = str.replace(/\0/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit string length to prevent DoS
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }

    return sanitized;
  }
}
