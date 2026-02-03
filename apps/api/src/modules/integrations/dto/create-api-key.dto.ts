import { IsString, IsOptional, IsArray, IsDateString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'n8n Integration' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: ['messages:read', 'messages:write'],
    description: 'Permissions for this API key. Default is all permissions.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59Z',
    description: 'Expiration date for this API key. Leave empty for no expiration.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;
}
