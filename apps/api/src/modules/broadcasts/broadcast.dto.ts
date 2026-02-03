import { IsString, IsNotEmpty, IsArray, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBroadcastDto {
  @ApiProperty({ description: 'Broadcast name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Session ID to send from' })
  @IsUUID()
  sessionId: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'Message type', enum: ['text', 'image', 'video', 'document'] })
  @IsEnum(['text', 'image', 'video', 'document'])
  type: 'text' | 'image' | 'video' | 'document';

  @ApiPropertyOptional({ description: 'Media URL for non-text messages' })
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiProperty({ description: 'List of contact IDs to send to' })
  @IsArray()
  @IsUUID('4', { each: true })
  contactIds: string[];

  @ApiPropertyOptional({ description: 'Schedule time (ISO string)' })
  @IsString()
  @IsOptional()
  scheduledAt?: string;
}
