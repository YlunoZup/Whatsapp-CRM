import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'member', enum: ['admin', 'member', 'viewer'] })
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'member', 'viewer'])
  role?: string;
}
