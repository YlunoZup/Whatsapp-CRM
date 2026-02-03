import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Use existing request ID from header or generate new one
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
