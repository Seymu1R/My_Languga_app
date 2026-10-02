import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

export const uploadPath = path.join(__dirname, '../../uploads');

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// İcazəli tiplər və onların uzantısı — uzantı müştərinin fayl adından götürülmür.
// SVG bilərəkdən yoxdur: içində skript ola bilər
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// mimetype-ı müştəri bildirir — faylın ilk baytları (magic bytes) onu təsdiqləməlidir
const hasImageSignature = (header: Buffer, mimetype: string) => {
  switch (mimetype) {
    case 'image/jpeg':
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case 'image/png':
      return header.subarray(0, 8).equals(PNG_SIGNATURE);
    case 'image/gif':
      return ['GIF87a', 'GIF89a'].includes(header.toString('ascii', 0, 6));
    case 'image/webp':
      return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
    default:
      return false;
  }
};

const readFileHeader = async (filePath: string) => {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    await handle.read(header, 0, header.length, 0);
    return header;
  } finally {
    await handle.close();
  }
};

class UnsupportedImageTypeError extends Error {
  constructor() {
    super('Only JPEG, PNG, WebP and GIF images are allowed');
    this.name = 'UnsupportedImageTypeError';
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // fileFilter artıq tipi yoxlayıb, ona görə uzantı həmişə mövcuddur
    cb(null, uniqueSuffix + ALLOWED_IMAGE_TYPES[file.mimetype]);
  },
});

const singleImage = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype in ALLOWED_IMAGE_TYPES) {
      cb(null, true);
    } else {
      cb(new UnsupportedImageTypeError());
    }
  },
}).single('image');

/**
 * `image` sahəsindəki şəkli qəbul edir və yoxlayır.
 *
 * Multer xətaları global handler-ə (500) düşmür, burada status-a çevrilir:
 * ölçü → 413, tip / sahə adı → 400. Məzmunu tipinə uyğun olmayan fayl silinir → 400.
 * Fayl göndərilməyibsə handler-ə ötürülür (orada 400 qaytarılır).
 */
export const uploadImage = (req: Request, res: Response, next: NextFunction) => {
  singleImage(req, res, async (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, error: 'Image must be 5MB or smaller' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }

    if (err instanceof UnsupportedImageTypeError) {
      return res.status(400).json({ success: false, error: err.message });
    }

    if (err) return next(err);
    if (!req.file) return next();

    const { path: filePath, mimetype, originalname } = req.file;

    try {
      const header = await readFileHeader(filePath);
      if (!hasImageSignature(header, mimetype)) {
        await fs.promises.unlink(filePath);
        logger.warn({ mimetype, originalname }, 'Rejected upload: content does not match declared image type');
        return res.status(400).json({ success: false, error: 'File content is not a valid image of the declared type' });
      }
      return next();
    } catch (checkErr) {
      await fs.promises.unlink(filePath).catch(() => {});
      return next(checkErr);
    }
  });
};
