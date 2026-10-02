import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validate } from '../src/middleware/validate';

const run = (schema: z.ZodTypeAny, body: unknown) => {
  const req: any = { body };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  validate(schema)(req, res, next);
  return { req, res, next };
};

const schema = z.object({
  name: z.string().min(1, 'name is required').transform((s) => s.trim()),
  nested: z.object({ count: z.number() }).optional(),
});

describe('validate middleware', () => {
  it('calls next and replaces req.body with the parsed data', () => {
    const { req, res, next } = run(schema, { name: '  Ann ', extra: 'dropped' });

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Ann' });
  });

  it('responds 400 with field-level details and does not call next', () => {
    const { res, next } = run(schema, { name: '' });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      details: ['name: name is required'],
    });
  });

  it('joins nested paths with dots', () => {
    const { res } = run(schema, { name: 'Ann', nested: { count: 'x' } });
    const { details } = res.json.mock.calls[0][0];

    expect(details).toHaveLength(1);
    expect(details[0]).toMatch(/^nested\.count: /);
  });

  it('reports every failing field', () => {
    const { res } = run(schema, { nested: { count: 'x' } });
    expect(res.json.mock.calls[0][0].details).toHaveLength(2);
  });

  it('labels root-level errors as "body"', () => {
    const { res } = run(schema, undefined);
    expect(res.json.mock.calls[0][0].details[0]).toMatch(/^body: /);
  });
});
