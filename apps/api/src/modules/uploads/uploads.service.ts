import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export type MediaType = 'image' | 'video' | 'audio' | 'document';

interface UploadResult {
  url: string;
  type: MediaType;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
}

const MIME_TYPE_MAP: Record<string, MediaType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'text/plain': 'document',
};

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.baseUrl = this.configService.get<string>('API_URL') || 'http://localhost:3000';
  }

  async upload(
    file: Express.Multer.File,
    tenantId: string,
  ): Promise<UploadResult> {
    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 16MB limit');
    }

    const mediaType = MIME_TYPE_MAP[file.mimetype];
    if (!mediaType) {
      throw new BadRequestException('File type not supported');
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const hash = crypto.randomBytes(16).toString('hex');
    const filename = `${hash}${ext}`;

    // Create tenant-specific upload directory
    const tenantUploadDir = path.join(this.uploadDir, tenantId, mediaType);
    await fs.mkdir(tenantUploadDir, { recursive: true });

    // Save file
    const filePath = path.join(tenantUploadDir, filename);
    await fs.writeFile(filePath, file.buffer);

    // Generate URL
    const url = `${this.baseUrl}/uploads/${tenantId}/${mediaType}/${filename}`;

    return {
      url,
      type: mediaType,
      filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async delete(tenantId: string, type: MediaType, filename: string): Promise<void> {
    // Sanitize filename to prevent path traversal attacks
    const sanitizedFilename = path.basename(filename);
    if (!sanitizedFilename || sanitizedFilename !== filename) {
      throw new BadRequestException('Invalid filename');
    }

    const filePath = path.join(this.uploadDir, tenantId, type, sanitizedFilename);

    // Ensure the resolved path is within the upload directory
    const resolvedPath = path.resolve(filePath);
    const baseDir = path.resolve(this.uploadDir);
    if (!resolvedPath.startsWith(baseDir)) {
      throw new BadRequestException('Invalid file path');
    }

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Only ignore ENOENT (file not found) errors
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist - this is fine for delete operations
        return;
      }
      // Log and rethrow other errors (permission denied, etc.)
      this.logger.error(`Failed to delete file ${filePath}:`, error);
      throw error;
    }
  }

  getMediaType(mimeType: string): MediaType | null {
    return MIME_TYPE_MAP[mimeType] || null;
  }
}
