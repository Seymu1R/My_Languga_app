import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    logger.warn('MONGODB_URI is not set. Server will continue with in-memory storage. Add MONGODB_URI to backend/.env to enable MongoDB');
    return;
  }

  try {
    await mongoose.connect(mongoURI, {
      dbName: 'language_learning'
    });

    logger.info({ database: mongoose.connection.name }, 'MongoDB connected successfully');
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection error — continuing with in-memory storage');
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
