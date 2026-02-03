import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3001;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '1d';

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsUrl()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:3000';

  @IsUrl()
  @IsOptional()
  EVOLUTION_API_URL?: string;

  @IsString()
  @IsOptional()
  EVOLUTION_API_KEY?: string;

  @IsString()
  @IsOptional()
  MINIO_ENDPOINT: string = 'localhost';

  @IsNumber()
  @IsOptional()
  MINIO_PORT: number = 9000;

  @IsString()
  @IsOptional()
  MINIO_ACCESS_KEY: string = 'minioadmin';

  @IsString()
  @IsOptional()
  MINIO_SECRET_KEY: string = 'minioadmin';

  @IsString()
  @IsOptional()
  MINIO_BUCKET: string = 'whatsapp-crm';

  @IsNumber()
  @Min(1000)
  @IsOptional()
  RATE_LIMIT_TTL: number = 60000;

  @IsNumber()
  @Min(1)
  @IsOptional()
  RATE_LIMIT_MAX: number = 100;

  @IsString()
  @MinLength(32)
  @IsOptional()
  ENCRYPTION_KEY: string = 'change-this-32-character-secret!';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = error.constraints || {};
        return `${error.property}: ${Object.values(constraints).join(', ')}`;
      })
      .join('\n');

    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  return validatedConfig;
}

export function validateProductionConfig(
  config: EnvironmentVariables,
): string[] {
  const warnings: string[] = [];

  if (config.NODE_ENV === Environment.Production) {
    // Check for insecure defaults
    if (config.JWT_SECRET.includes('change') || config.JWT_SECRET.includes('secret')) {
      warnings.push('JWT_SECRET appears to be using a default value. Please set a secure secret.');
    }

    if (config.JWT_REFRESH_SECRET.includes('change') || config.JWT_REFRESH_SECRET.includes('secret')) {
      warnings.push('JWT_REFRESH_SECRET appears to be using a default value. Please set a secure secret.');
    }

    if (config.ENCRYPTION_KEY.includes('change') || config.ENCRYPTION_KEY.includes('secret')) {
      warnings.push('ENCRYPTION_KEY appears to be using a default value. Please set a secure key.');
    }

    if (config.MINIO_ACCESS_KEY === 'minioadmin') {
      warnings.push('MINIO_ACCESS_KEY is using default credentials.');
    }
  }

  return warnings;
}
