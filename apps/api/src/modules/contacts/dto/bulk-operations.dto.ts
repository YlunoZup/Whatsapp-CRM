import { IsArray, IsString, IsOptional, IsEmail, ArrayMaxSize, ArrayMinSize, ValidateNested, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const MAX_BULK_ITEMS = 500;

export class BulkContactIdsDto {
  @ApiProperty({ type: [String], maxItems: MAX_BULK_ITEMS })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one contact ID is required' })
  @ArrayMaxSize(MAX_BULK_ITEMS, { message: `Cannot process more than ${MAX_BULK_ITEMS} contacts at once` })
  contactIds!: string[];
}

export class BulkAddTagsDto extends BulkContactIdsDto {
  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one tag ID is required' })
  @ArrayMaxSize(50, { message: 'Cannot add more than 50 tags at once' })
  tagIds!: string[];
}

export class BulkRemoveTagsDto extends BulkContactIdsDto {
  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one tag ID is required' })
  @ArrayMaxSize(50, { message: 'Cannot remove more than 50 tags at once' })
  tagIds!: string[];
}

export class BulkAssignSessionDto extends BulkContactIdsDto {
  @ApiProperty()
  @IsString()
  sessionId!: string;
}

export class BulkUpdatesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class BulkEditDto extends BulkContactIdsDto {
  @ApiProperty({ type: BulkUpdatesDto })
  @ValidateNested()
  @Type(() => BulkUpdatesDto)
  updates!: BulkUpdatesDto;
}
