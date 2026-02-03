import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignConversationDto {
  @ApiPropertyOptional({ example: 'uuid-of-user', description: 'User ID to assign, or null to unassign' })
  @IsOptional()
  @IsUUID('4')
  userId?: string | null;
}
