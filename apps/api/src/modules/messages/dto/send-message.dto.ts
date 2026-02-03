import { IsString, IsOptional, IsIn, IsUUID, IsUrl, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'session-uuid' })
  @IsUUID('4')
  sessionId!: string;

  @ApiProperty({ example: '+5511999999999' })
  @IsString()
  to!: string;

  @ApiProperty({ example: 'text', enum: ['text', 'image', 'video', 'audio', 'document'] })
  @IsIn(['text', 'image', 'video', 'audio', 'document'])
  type!: 'text' | 'image' | 'video' | 'audio' | 'document';

  @ApiPropertyOptional({ example: 'Hello, how can I help you?' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @ApiPropertyOptional({ example: { templateId: 'welcome' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
