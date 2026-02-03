import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService, AuditActions } from '../../common/audit/audit.service';

interface LoginDto {
  email: string;
  password: string;
}

interface RegisterDto {
  email: string;
  password: string;
  name: string;
  tenantName: string;
}

interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create tenant and user in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          slug: this.generateSlug(dto.tenantName),
          settings: {},
          plan: 'free',
        },
      });

      // Hash password (10 rounds = ~100ms, good security/performance balance)
      const passwordHash = await bcrypt.hash(dto.password, 10);

      // Create user
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: 'admin', // First user is admin
          tenantId: tenant.id,
          isActive: true,
        },
      });

      return { tenant, user };
    });

    // Log user registration
    await this.auditService.log({
      tenantId: result.tenant.id,
      userId: result.user.id,
      action: AuditActions.USER_CREATED,
      resource: 'user',
      resourceId: result.user.id,
      metadata: { email: result.user.email },
    });

    return this.generateTokens(result.user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      // Log failed login attempt - user not found or inactive
      if (user) {
        await this.auditService.log({
          tenantId: user.tenantId,
          userId: user.id,
          action: AuditActions.LOGIN_FAILED,
          resource: 'auth',
          metadata: { email: dto.email, reason: 'user_inactive' },
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      // Log failed login attempt - invalid password
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: AuditActions.LOGIN_FAILED,
        resource: 'auth',
        metadata: { email: dto.email, reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log successful login
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditActions.LOGIN,
      resource: 'auth',
      metadata: { email: user.email },
    });

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateApiKey(apiKey: string): Promise<{ userId: string; tenantId: string } | null> {
    // Get all non-expired API keys (we need to compare with bcrypt)
    // Note: For better performance with many API keys, consider using a prefix lookup strategy
    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        keyHash: true,
        tenantId: true,
      },
    });

    // Compare the provided API key against each stored hash
    // bcrypt.compare() properly handles the salt embedded in the hash
    for (const apiKeyRecord of apiKeys) {
      const isMatch = await bcrypt.compare(apiKey, apiKeyRecord.keyHash);
      if (isMatch) {
        // Update last used
        await this.prisma.apiKey.update({
          where: { id: apiKeyRecord.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          userId: apiKeyRecord.id,
          tenantId: apiKeyRecord.tenantId,
        };
      }
    }

    return null;
  }

  private async generateTokens(user: { id: string; email: string; name: string; role: string; tenantId: string }): Promise<AuthResponse> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50) + '-' + Date.now().toString(36);
  }

  private async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, 10);
  }
}
