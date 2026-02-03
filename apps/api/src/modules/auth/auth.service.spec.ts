import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
    role: 'admin',
    tenantId: 'tenant-123',
    isActive: true,
    avatarUrl: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Tenant',
    slug: 'test-tenant-123',
    settings: {},
    plan: 'free',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        create: jest.fn(),
      },
      apiKey: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.refreshExpiresIn': '7d',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.$transaction as jest.Mock).mockImplementation(async (fn) => {
        return fn({
          tenant: { create: jest.fn().mockResolvedValue(mockTenant) },
          user: { create: jest.fn().mockResolvedValue(mockUser) },
        });
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        tenantName: 'New Tenant',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          tenantName: 'Test Tenant',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        tenant: mockTenant,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        tenant: mockTenant,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
        tenant: mockTenant,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens for valid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        tenantId: 'tenant-123',
        role: 'admin',
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.refreshToken('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
