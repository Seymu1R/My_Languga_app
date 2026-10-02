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

// transport-dan ayrı saxlanılır ki, testlər eyni ayarlarla öz stream-inə yaza bilsin
export const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
};

export const logger = pino({
  ...loggerOptions,
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
