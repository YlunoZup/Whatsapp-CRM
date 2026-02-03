import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'My Company' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: { theme: 'dark', language: 'en' } })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
