import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ description: 'Tag name', example: 'VIP Customer' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Tag color in hex format', example: '#FF5733' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g., #FF5733)' })
  color?: string;
}

export class UpdateTagDto {
  @ApiPropertyOptional({ description: 'Tag name', example: 'Premium Customer' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'Tag color in hex format', example: '#33FF57' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g., #FF5733)' })
  color?: string;
}

export class AssignTagDto {
  @ApiProperty({ description: 'Contact ID to assign tag to' })
  @IsString()
  @IsNotEmpty()
  contactId: string;

  @ApiProperty({ description: 'Tag ID to assign' })
  @IsString()
  @IsNotEmpty()
  tagId: string;
}
