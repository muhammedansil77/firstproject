import multer from 'multer';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import stream from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfpey4ga9',
  api_key: process.env.CLOUDINARY_API_KEY || '915743991263249',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'LntPU9O3S-Fah_KRlbZQ6XYCQM0',
  secure: true,
});

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

// Helper function to upload buffer to Cloudinary
async function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) reject(error);
        else resolve(result); // Return the full result object
      }
    );
    
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    bufferStream.pipe(uploadStream);
  });
}

// OPTION 1: Functions that return STRINGS (for your current model)
export async function processProductImages(files = [], minCount = 3) {
  if (!Array.isArray(files)) files = [];
  if (minCount > 0 && files.length < minCount) {
    const e = new Error(`At least ${minCount} product images are required`);
    e.code = 'MIN_IMAGES';
    throw e;
  }

  const tasks = files.map(async (file, i) => {
    try {
      // Process image with sharp first
      const processedBuffer = await sharp(file.buffer)
        .resize(1200, 1200, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Upload to Cloudinary
      const result = await uploadToCloudinary(processedBuffer, {
        folder: 'products',
        public_id: `product-${Date.now()}-${i}`,
        resource_type: 'image'
      });

      // Return ONLY the URL string (for your current Variant model)
      return result.secure_url;
    } catch (err) {
      err.message = `processProductImages failed #${i}: ${err.message}`;
      throw err;
    }
  });

  return Promise.all(tasks);
}

export async function processVariantImages(files = [], minCount = 3) {
  if (!Array.isArray(files)) files = [];
  if (minCount > 0 && files.length < minCount) {
    const e = new Error(`Each variant requires at least ${minCount} images`);
    e.code = 'MIN_VARIANT_IMAGES';
    throw e;
  }

  const tasks = files.map(async (file, i) => {
    try {
      // Process image with sharp
      const processedBuffer = await sharp(file.buffer)
        .resize(800, 800, { fit: 'cover' })
        .jpeg({ quality: 82 })
        .toBuffer();

      // Upload to Cloudinary
      const result = await uploadToCloudinary(processedBuffer, {
        folder: 'variants',
        public_id: `variant-${Date.now()}-${i}`,
        resource_type: 'image'
      });

      // Return ONLY the URL string
      return result.secure_url;
    } catch (err) {
      err.message = `processVariantImages failed #${i}: ${err.message}`;
      throw err;
    }
  });

  return Promise.all(tasks);
}

export async function processVariantImage(file) {
  if (!file) return null;
  
  try {
    const processedBuffer = await sharp(file.buffer)
      .resize(800, 800, { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toBuffer();

    const result = await uploadToCloudinary(processedBuffer, {
      folder: 'variants',
      public_id: `variant-${Date.now()}`,
      resource_type: 'image'
    });

    // Return ONLY the URL string
    return result.secure_url;
  } catch (err) {
    throw err;
  }
}

// OPTION 2: Alternative functions that return objects (if you update your model later)
export async function processProductImagesWithInfo(files = [], minCount = 3) {
  if (!Array.isArray(files)) files = [];
  if (minCount > 0 && files.length < minCount) {
    const e = new Error(`At least ${minCount} product images are required`);
    e.code = 'MIN_IMAGES';
    throw e;
  }

  const tasks = files.map(async (file, i) => {
    try {
      const processedBuffer = await sharp(file.buffer)
        .resize(1200, 1200, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toBuffer();

      const result = await uploadToCloudinary(processedBuffer, {
        folder: 'products',
        public_id: `product-${Date.now()}-${i}`,
        resource_type: 'image'
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height
      };
    } catch (err) {
      err.message = `processProductImages failed #${i}: ${err.message}`;
      throw err;
    }
  });

  return Promise.all(tasks);
}

// Utility functions
export class CloudinaryService {
  // Upload single image and return full object
  static async uploadImage(buffer, options = {}) {
    return await uploadToCloudinary(buffer, options);
  }

  // Upload single image and return only URL
  static async uploadImageUrl(buffer, options = {}) {
    const result = await uploadToCloudinary(buffer, options);
    return result.secure_url;
  }

  // Delete image from Cloudinary
  static async deleteImage(publicId) {
    return cloudinary.uploader.destroy(publicId);
  }

  // Delete multiple images
  static async deleteImages(publicIds) {
    return cloudinary.api.delete_resources(publicIds);
  }

  // Get image info
  static async getImageInfo(publicId) {
    return cloudinary.api.resource(publicId);
  }

  // Extract public_id from URL
  static extractPublicIdFromUrl(url) {
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      if (uploadIndex !== -1) {
        const pathParts = urlParts.slice(uploadIndex + 2);
        const publicIdWithExtension = pathParts.join('/');
        return publicIdWithExtension.split('.')[0];
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}