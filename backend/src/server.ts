// İlk import olmalıdır: digər modullar (logger, app) process.env-i import zamanı oxuyur
import 'dotenv/config';
import mongoose from 'mongoose';
import { logger } from './utils/logger';
import connectDB from './config/database';
import { createApp } from './app';

// Connect to MongoDB
connectDB();

const app = createApp();
const PORT = process.env.PORT || 7001;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Language Learning API is running');
});

// Graceful shutdown: yeni connection-ları dayandır,
// aktiv request-lərin bitməsini gözlə, DB-ni təmiz bağla
const FORCE_EXIT_TIMEOUT_MS = 10_000;

const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received, closing gracefully');

  server.close(async () => {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (err) {
      logger.error({ err }, 'Error closing MongoDB connection');
    }
    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Aktiv request-lər timeout müddətində bitməsə, məcburi çıx
  setTimeout(() => {
    logger.error('Forced shutdown: connections did not close in time');
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
