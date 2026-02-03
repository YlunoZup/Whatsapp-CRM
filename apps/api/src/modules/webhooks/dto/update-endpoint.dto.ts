import { IsString, IsUrl, IsArray, IsOptional, IsBoolean, MinLength, ArrayMinSize } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEndpointDto {
  @ApiPropertyOptional({ example: 'My n8n Webhook' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'https://n8n.example.com/webhook/abc123' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({
    example: ['message.received', 'message.sent'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({ example: 'my-secret-key' })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
