import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    WhatsAppModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [SocketGateway, SocketService],
  exports: [SocketService],
})
export class SocketModule {}
