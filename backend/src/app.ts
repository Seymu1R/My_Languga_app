import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { logger } from './utils/logger';
import { uploadPath } from './middleware/upload';
import { getStorageMode } from './config/storage';
import { aiRouter } from './routes/ai';
import { dictionaryRouter } from './routes/dictionary';

// Health check — DB vəziyyəti, uptime və storage mode daxil
const MONGO_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

// body-parser xəta tipləri üçün oxunaqlı mesajlar; digər klient xətalarında öz mesajı qalır
const BODY_ERROR_MESSAGES: Record<string, string> = {
  'entity.parse.failed': 'Request body is not valid JSON',
  'entity.too.large': 'Request body is too large (max 10kb)',
};

// Express tətbiqini qurur, amma port açmır — server.ts listen edir,
// testlər isə hər dəfə təzə (rate limit sayğacları sıfır olan) tətbiq yaradır
export const createApp = () => {
  const app = express();

  // Rate limiters
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dəqiqə
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  });

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // AI endpoint-ləri baha başa gəlir — ayrıca, daha sıx limit
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests. Please wait and try again.' },
  });

  // Middleware
  app.use(helmet({
    crossOriginResourcePolicy: false, // Required to serve images
  }));
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      process.env.FRONTEND_URL || 'http://localhost:5174'
    ],
    credentials: true
  }));
  app.use(express.json({ limit: '10kb' }));

  // Serve uploaded images statically — multer-in yazdığı eyni qovluqdan
  app.use('/uploads', express.static(uploadPath));

  // Routes
  app.use('/api', generalLimiter);
  app.use('/api/ai', aiLimiter);
  app.use('/api/ai', aiRouter);
  app.use('/api/dictionary', dictionaryRouter);

  app.get('/api/health', (req, res) => {
    const mongoState = mongoose.connection.readyState;
    const dbConnected = mongoState === 1;

    res.json({
      status: 'OK',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: MONGO_STATES[mongoState] ?? 'unknown',
        connected: dbConnected,
        // Açılışda seçilmiş rejim; MongoDB rejimində bağlantı qopsa da 'mongodb' qalır (#3)
        storageMode: getStorageMode(),
      },
    });
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // express.json xətaları (səhv JSON, böyük body, dəstəklənməyən charset) http-errors formatındadır:
    // status 4xx və expose=true — bunlar klient xətasıdır, 500 deyil (#26)
    const status = err?.status ?? err?.statusCode;
    if (err?.expose && Number.isInteger(status) && status >= 400 && status < 500) {
      logger.warn({ status, type: err.type }, 'Rejected request body');
      return res.status(status).json({
        success: false,
        error: BODY_ERROR_MESSAGES[err.type] ?? err.message,
      });
    }

    logger.error({ err }, 'Unhandled error in request pipeline');
    res.status(500).json({
      error: 'Something went wrong!',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  return app;
};
