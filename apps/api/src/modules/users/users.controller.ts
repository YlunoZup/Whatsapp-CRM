import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users in tenant' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific user' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.create(user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.delete(id, user.tenantId);
  }
}
