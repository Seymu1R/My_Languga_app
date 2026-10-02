import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import net from 'net';
import path from 'path';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { createMongoServer } from './helpers/mongo';

// server.ts ayrıca prosesdə işə salınır: açılış ardıcıllığı (#3), health və graceful shutdown.
// MONGODB_URI həmişə burada verilir — dotenv mövcud dəyişəni üzərinə yazmır, ona görə
// backend/.env-dəki real baza heç vaxt istifadə olunmur.
const BACKEND = path.resolve(__dirname, '..');
const RUNNING = 'Language Learning API is running';

const freePort = () =>
  new Promise<number>((resolve) => {
    const probe = net.createServer();
    probe.listen(0, () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });

const waitFor = async (condition: () => boolean, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

let child: ChildProcessWithoutNullStreams | undefined;

const startServer = async (mongoUri: string) => {
  const port = await freePort();
  child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/server.ts'], {
    cwd: BACKEND,
    // production → pino JSON sətirləri yazır
    env: { ...process.env, MONGODB_URI: mongoUri, PORT: String(port), NODE_ENV: 'production', LOG_LEVEL: 'info' },
  });

  const logs: { msg: string }[] = [];
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try {
        logs.push(JSON.parse(line));
      } catch {
        // JSON olmayan sətirlər (məs. ts-node xəbərdarlıqları) nəzərə alınmır
      }
    }
  });

  await waitFor(() => logs.some((l) => l.msg === RUNNING), 20_000);
  const indexOf = (msg: string) => logs.findIndex((l) => l.msg === msg);
  return { port, logs, indexOf };
};

const health = async (port: number) => (await fetch(`http://127.0.0.1:${port}/api/health`)).json();

const stopServer = () =>
  new Promise<number | null>((resolve) => {
    child!.once('exit', (code) => resolve(code));
    child!.kill('SIGTERM');
  });

afterEach(() => {
  if (child && child.exitCode === null) child.kill('SIGKILL');
  child = undefined;
});

describe('server startup (#3)', () => {
  let mongo: MongoMemoryServer;

  afterAll(async () => {
    await mongo?.stop();
  });

  it('accepts requests only after MongoDB is connected, then shuts down cleanly', async () => {
    mongo = await createMongoServer();

    const { port, logs, indexOf } = await startServer(mongo.getUri());

    expect(indexOf('MongoDB connected successfully')).toBeGreaterThanOrEqual(0);
    expect(indexOf('MongoDB connected successfully')).toBeLessThan(indexOf(RUNNING));
    expect((await health(port)).database).toEqual({ status: 'connected', connected: true, storageMode: 'mongodb' });

    expect(await stopServer()).toBe(0);
    expect(logs.some((l) => l.msg === 'Shutdown complete')).toBe(true);
  }, 30_000);

  it('falls back to in-memory storage when MongoDB is unreachable, before accepting requests', async () => {
    const unusedPort = await freePort();

    const { port, indexOf } = await startServer(`mongodb://127.0.0.1:${unusedPort}`);

    const connectionError = indexOf('MongoDB connection error — continuing with in-memory storage');
    expect(connectionError).toBeGreaterThanOrEqual(0);
    expect(connectionError).toBeLessThan(indexOf(RUNNING));
    expect((await health(port)).database.storageMode).toBe('in-memory');

    expect(await stopServer()).toBe(0);
  }, 30_000);
});
