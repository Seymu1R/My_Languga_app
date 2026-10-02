import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll } from 'vitest';

// Hər test faylından əvvəl işləyir — src modulları import olunmamışdan qabaq,
// çünki logger və upload env-i import zamanı oxuyur
process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;

// Testlər real backend/uploads qovluğuna toxunmasın
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-uploads-'));
process.env.UPLOAD_DIR = uploadDir;

afterAll(() => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
});
