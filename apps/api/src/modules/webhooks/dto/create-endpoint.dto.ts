import { IsString, IsUrl, IsArray, IsOptional, MinLength, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEndpointDto {
  @ApiProperty({ example: 'My n8n Webhook' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'https://n8n.example.com/webhook/abc123' })
  @IsUrl()
  url!: string;

  @ApiProperty({
    example: ['message.received', 'message.sent'],
    description: 'Events to subscribe to',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events!: string[];

  @ApiPropertyOptional({
    example: 'my-secret-key',
    description: 'Secret for HMAC signature (auto-generated if not provided)',
  })
  @IsOptional()
  @IsString()
  secret?: string;
}
