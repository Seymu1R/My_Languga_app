import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { Word } from '../models/Word';
import { setStorageMode } from './storage';

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    logger.warn('MONGODB_URI is not set. Server will continue with in-memory storage. Add MONGODB_URI to backend/.env to enable MongoDB');
    return;
  }

  try {
    await mongoose.connect(mongoURI, {
      dbName: 'language_learning',
      // Server bu qoşulmanı gözləyib sonra port açır (#3) — MongoDB əlçatan deyilsə,
      // default 30 san əvəzinə 5 san sonra in-memory rejimə keçirik
      serverSelectionTimeoutMS: 5000,
    });

    setStorageMode('mongodb');
    logger.info({ database: mongoose.connection.name }, 'MongoDB connected successfully');
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection error — continuing with in-memory storage');
    return;
  }

  // Unique index (#10) bazada artıq hərf böyüklüyü ilə fərqlənən dublikatlar varsa qurula bilmir.
  // Server işləməyə davam edir (servis dublikatları yenə yoxlayır), amma nə etmək lazım olduğunu yazırıq
  try {
    await Word.init();
  } catch (error) {
    logger.error(
      { err: error },
      'Word indexes could not be built. If this is a duplicate key error, delete words that differ only in letter case and restart the server',
    );
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error({ err }, 'MongoDB error');
});

export default connectDB;
