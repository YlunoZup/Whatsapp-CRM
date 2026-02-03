import { IsString, IsOptional, IsIn, IsUrl, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiPropertyOptional({ example: 'whatsapp-message-id' })
  @IsOptional()
  @IsString()
  whatsappMessageId?: string;

  @ApiPropertyOptional({ example: 'outbound', enum: ['inbound', 'outbound'], default: 'outbound' })
  @IsOptional()
  @IsIn(['inbound', 'outbound'])
  direction?: 'inbound' | 'outbound';

  @ApiProperty({ example: 'text' })
  @IsString()
  type!: string;

  @ApiPropertyOptional({ example: 'Hello!' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: 'https://example.com/media.jpg' })
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ example: false, description: 'Force send even if there is a session conflict' })
  @IsOptional()
  @IsBoolean()
  forceSessionOverride?: boolean;
}
