import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConversationDto {
  @ApiPropertyOptional({ example: 'open', enum: ['open', 'closed', 'pending'] })
  @IsOptional()
  @IsString()
  @IsIn(['open', 'closed', 'pending'])
  status?: string;

  @ApiPropertyOptional({ example: { priority: 'high' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
