// middlewares/upload.js  (ESM)
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureDir = dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

// public/uploads/... paths
export const PUBLIC_UPLOADS = path.join(process.cwd(), 'public', 'uploads');
export const PRODUCTS_DIR = path.join(PUBLIC_UPLOADS, 'products');
export const VARIANTS_DIR = path.join(PUBLIC_UPLOADS, 'variants');

ensureDir(PRODUCTS_DIR);
ensureDir(VARIANTS_DIR);

// multer memory storage (buffers)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 100 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

// helpers
function makeFilename(prefix = 'img', ext = '.jpeg') {
  const rnd = crypto.randomBytes(6).toString('hex');
  return `${Date.now()}-${prefix}-${rnd}${ext}`;
}
function dbPathForProduct(filename) {
  return path.posix.join('uploads', 'products', filename);
}
function dbPathForVariant(filename) {
  return path.posix.join('uploads', 'variants', filename);
}

/**
 * Process an array of product images.
 * Returns array of relative DB paths like 'uploads/products/xxx.jpg'
 * Throws error if files.length < minCount (unless minCount === 0).
 */
export async function processProductImages(files = [], minCount = 3) {
  if (!Array.isArray(files)) files = [];
  if (minCount > 0 && files.length < minCount) {
    const e = new Error(`At least ${minCount} product images are required`);
    e.code = 'MIN_IMAGES';
    throw e;
  }

  const tasks = files.map(async (file, i) => {
    const filename = makeFilename('product', '.jpeg');
    const filepath = path.join(PRODUCTS_DIR, filename);
    try {
      await sharp(file.buffer)
        .resize(1200, 1200, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toFile(filepath);
      return dbPathForProduct(filename);
    } catch (err) {
      err.message = `processProductImages failed #${i}: ${err.message}`;
      throw err;
    }
  });

  // run all; caller can catch
  return Promise.all(tasks);
}

/**
 * Process multiple variant images for a single variant.
 * Returns array of relative DB paths like 'uploads/variants/xxx.jpg'
 */
export async function processVariantImages(files = [], minCount = 3) {
  if (!Array.isArray(files)) files = [];
  if (minCount > 0 && files.length < minCount) {
    const e = new Error(`Each variant requires at least ${minCount} images`);
    e.code = 'MIN_VARIANT_IMAGES';
    throw e;
  }

  const tasks = files.map(async (file, i) => {
    const filename = makeFilename('variant', '.jpeg');
    const filepath = path.join(VARIANTS_DIR, filename);
    try {
      await sharp(file.buffer)
        .resize(800, 800, { fit: 'cover' })
        .jpeg({ quality: 82 })
        .toFile(filepath);
      return dbPathForVariant(filename);
    } catch (err) {
      err.message = `processVariantImages failed #${i}: ${err.message}`;
      throw err;
    }
  });

  return Promise.all(tasks);
}

/**
 * Process a single variant file (kept for backward compatibility).
 * Returns a single relative DB path string or null on falsy input.
 */
export async function processVariantImage(file) {
  if (!file) return null;
  const filename = makeFilename('variant', '.jpeg');
  const filepath = path.join(VARIANTS_DIR, filename);
  await sharp(file.buffer)
    .resize(800, 800, { fit: 'cover' })
    .jpeg({ quality: 82 })
    .toFile(filepath);
  return dbPathForVariant(filename);
}
