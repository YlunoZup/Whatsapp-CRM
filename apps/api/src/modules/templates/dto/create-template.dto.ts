import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TemplateCategory {
  GREETING = 'greeting',
  FOLLOW_UP = 'follow_up',
  SUPPORT = 'support',
  SALES = 'sales',
  NOTIFICATION = 'notification',
  OTHER = 'other',
}

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Welcome Message' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Template content with variables like {{name}}, {{company}}',
    example: 'Hello {{name}}, welcome to {{company}}! How can we help you today?',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'List of variable names used in the template',
    example: ['name', 'company'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({
    description: 'Template category',
    enum: TemplateCategory,
    example: TemplateCategory.GREETING,
  })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'Template content with variables' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ApiPropertyOptional({ description: 'List of variable names' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({
    description: 'Template category',
    enum: TemplateCategory,
  })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;
}

export class RenderTemplateDto {
  @ApiProperty({ description: 'Template ID to render' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({
    description: 'Variables to substitute in the template',
    example: { name: 'John', company: 'Acme Inc' },
  })
  variables: Record<string, string>;
}
