import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTagsDto {
  @ApiProperty({ example: ['uuid1', 'uuid2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds!: string[];
}
