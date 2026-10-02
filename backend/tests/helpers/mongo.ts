import { execSync } from 'child_process';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setStorageMode } from '../../src/config/storage';

let server: MongoMemoryServer | undefined;

// Sistemdə mongod varsa onu işlət — binary yükləməyə ehtiyac qalmır.
// MONGOMS_SYSTEM_BINARY verilibsə mongodb-memory-server onu özü oxuyur.
// Versiyanı da ötürürük ki, "Possible version conflict" xəbərdarlığı çıxmasın
const findSystemMongod = () => {
  if (process.env.MONGOMS_SYSTEM_BINARY) return undefined;
  try {
    const systemBinary = execSync('command -v mongod', { encoding: 'utf8' }).trim();
    const version = execSync(`"${systemBinary}" --version`, { encoding: 'utf8' }).match(/db version v(\S+)/)?.[1];
    return systemBinary ? { systemBinary, version } : undefined;
  } catch {
    return undefined;
  }
};

// Müvəqqəti MongoDB qaldırır, mongoose-u qoşmur (qoşulmadan əvvəl data hazırlamaq üçün)
export const createMongoServer = () => {
  const binary = findSystemMongod();
  return MongoMemoryServer.create(binary ? { binary } : undefined);
};

const TEST_DB_NAME = 'language_learning_test';

// Müvəqqəti, təmiz MongoDB qaldırır, mongoose-u ona qoşur və saxlama rejimini 'mongodb' edir
// (connectDB-nin uğurlu qoşulmada etdiyi kimi)
export const startMongo = async () => {
  server = await createMongoServer();
  await mongoose.connect(server.getUri(), { dbName: TEST_DB_NAME });
  setStorageMode('mongodb');
};

export const stopMongo = async () => {
  await mongoose.disconnect();
  await server?.stop();
  server = undefined;
  setStorageMode('in-memory');
};

// İş zamanı bağlantının qopub-qayıtmasını simulyasiya etmək üçün (server işləməyə davam edir)
export const reconnectMongo = () => mongoose.connect(server!.getUri(), { dbName: TEST_DB_NAME });

export const clearMongo = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};
