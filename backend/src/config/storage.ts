// Saxlama rejimi server açılanda bir dəfə seçilir (connectDB) və iş zamanı dəyişmir (#3):
// - 'mongodb': MongoDB-yə qoşulmaq alındı. Bağlantı sonradan qopsa sorğular 503 alır,
//   yazılar səssizcə in-memory-yə düşmür.
// - 'in-memory': MONGODB_URI yoxdur və ya açılışda qoşulmaq alınmadı. Data restart-da itir.
export type StorageMode = 'mongodb' | 'in-memory';

let storageMode: StorageMode = 'in-memory';

export const getStorageMode = () => storageMode;

export const setStorageMode = (mode: StorageMode) => {
  storageMode = mode;
};
