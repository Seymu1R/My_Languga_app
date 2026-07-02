import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/database';
import { aiRouter } from './routes/ai';
import { dictionaryRouter } from './routes/dictionary';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 7001;

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

// Serve uploaded images statically
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api', generalLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/ai', aiRouter);
app.use('/api/dictionary', dictionaryRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Language Learning API is running' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Language Learning API is ready!`);
});

// Graceful shutdown: yeni connection-ları dayandır,
// aktiv request-lərin bitməsini gözlə, DB-ni təmiz bağla
const FORCE_EXIT_TIMEOUT_MS = 10_000;

const shutdown = (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
    }
    console.log('Shutdown complete.');
    process.exit(0);
  });

  // Aktiv request-lər timeout müddətində bitməsə, məcburi çıx
  setTimeout(() => {
    console.error('Forced shutdown: connections did not close in time.');
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));