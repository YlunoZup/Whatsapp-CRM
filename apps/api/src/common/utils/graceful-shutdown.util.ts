import { INestApplication, Logger } from '@nestjs/common';

export class GracefulShutdown {
  private static readonly logger = new Logger('GracefulShutdown');
  private static isShuttingDown = false;

  static setup(app: INestApplication): void {
    // Handle various termination signals
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        await this.shutdown(app, signal);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught Exception:', error);
      await this.shutdown(app, 'uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
      this.logger.error('Unhandled Rejection:', reason);
      await this.shutdown(app, 'unhandledRejection');
    });
  }

  private static async shutdown(
    app: INestApplication,
    signal: string,
  ): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.log(`Shutdown already in progress, ignoring ${signal}`);
      return;
    }

    this.isShuttingDown = true;
    this.logger.log(`Received ${signal}. Starting graceful shutdown...`);

    const shutdownTimeout = 30000; // 30 seconds
    const forceShutdownTimer = setTimeout(() => {
      this.logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, shutdownTimeout);

    try {
      // Stop accepting new connections
      this.logger.log('Stopping new connections...');

      // Close the NestJS application
      this.logger.log('Closing application...');
      await app.close();

      this.logger.log('Application closed successfully');
      clearTimeout(forceShutdownTimer);
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
  }
}
