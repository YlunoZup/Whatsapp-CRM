import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionLogsService } from './session-logs.service';
import { SessionHealthService } from './session-health.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, SessionLogsService, SessionHealthService],
  exports: [SessionsService, SessionLogsService, SessionHealthService],
})
export class SessionsModule {}
