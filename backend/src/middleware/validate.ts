import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodIssue } from 'zod';

/**
 * Route validation middleware factory.
 *
 * İstifadəsi:
 *   router.post('/words', validate(addWordSchema), handler)
 *
 * Schema keçməsə → 400 + field-level xətalar qaytarır.
 * Keçsə → req.body parsed + coerced data ilə əvəz olunur,
 * növbəti middleware/handler-ə ötürülür.
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map(
        (e: ZodIssue) =>
          `${(e.path as (string | number)[]).join('.') || 'body'}: ${e.message}`,
      );
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details,
      });
    }

    req.body = result.data; // trim + coerce tətbiq edilmiş data
    return next();
  };
