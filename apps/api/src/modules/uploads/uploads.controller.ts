import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UploadsService, MediaType } from './uploads.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 16 * 1024 * 1024 }), // 16MB
          new FileTypeValidator({
            fileType: /(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|ogg|webm)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)|text\/plain)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.uploadsService.upload(file, user.tenantId);
  }

  @Delete(':type/:filename')
  @ApiOperation({ summary: 'Delete an uploaded file' })
  async delete(
    @Param('type') type: MediaType,
    @Param('filename') filename: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.uploadsService.delete(user.tenantId, type, filename);
    return { success: true };
  }
}
