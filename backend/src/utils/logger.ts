import pino from 'pino';

// Sensitive field-lər log obyektlərində görünsə belə avtomatik maskalanır
// (defense in depth — Task 1-dəki manual redaction-ı tamamlayır)
const REDACT_PATHS = [
  'apiToken',
  'aiToken',
  'apiKey',
  '*.apiToken',
  '*.aiToken',
  '*.apiKey',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  // Development-də oxunaqlı rəngli format, production-da xam JSON
  // (JSON formatı log aggregator-lar üçün lazımdır)
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
});
