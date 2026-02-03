import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';

export interface TestUser {
  id: string;
  email: string;
  tenantId: string;
  role: string;
}

export const createTestingApp = async (): Promise<INestApplication> => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.init();
  return app;
};

export const generateTestToken = (
  app: INestApplication,
  user: TestUser,
): string => {
  const jwtService = app.get(JwtService);
  return jwtService.sign({
    sub: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
  });
};

export const mockUser: TestUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  tenantId: 'test-tenant-id',
  role: 'admin',
};

export const mockMemberUser: TestUser = {
  id: 'member-user-id',
  email: 'member@example.com',
  tenantId: 'test-tenant-id',
  role: 'member',
};
