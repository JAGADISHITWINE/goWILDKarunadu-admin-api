const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const STORAGE_MODE = (process.env.STORAGE_MODE || 'local').toLowerCase();

let s3Client;
if (STORAGE_MODE === 's3') {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.ADMIN_AWS_ACCESS_KEY,
      secretAccessKey: process.env.ADMIN_AWS_SECRET_KEY,
    },
  });
}

// Always read into memory first — needed so sharp can process before saving anywhere
const memoryUpload = multer.storage
  ? null
  : null; // placeholder, real one below

function buildMemoryMulter(fileFilter, maxSizeMb = 5) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter,
  });
}

/**
 * Resize + compress a single image buffer.
 * maxWidth: caps resolution (upscale never happens, only downscale if larger)
 * quality: JPEG/WebP quality (1-100)
 */
async function processImage(buffer, { maxWidth = 1600, quality = 75 } = {}) {
  return sharp(buffer)
    .rotate() // auto-orient based on EXIF, then strips EXIF (smaller file, fixes sideways photos)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality }) // convert everything to webp — smallest format for photos at equal quality
    .toBuffer();
}

/**
 * Saves a processed buffer to disk (local mode) or S3 (s3 mode).
 * Returns the unified storedUrl.
 */
async function saveProcessedFile({ buffer, localDir, s3Prefix, filenameBase }) {
  const filename = `${filenameBase}.webp`;

  if (STORAGE_MODE === 's3') {
    const key = `${s3Prefix}/${filename}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'image/webp',
    }));
    const storedUrl = process.env.CLOUDFRONT_URL
      ? `${process.env.CLOUDFRONT_URL}/${key}`
      : `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
    return { filename, storedUrl, key };
  }

  // local mode
  const fullPath = path.join(localDir, filename);
  fs.writeFileSync(fullPath, buffer);
  return { filename, storedUrl: `/uploads/${filename}`, path: fullPath };
}

module.exports = {
  buildMemoryMulter,
  processImage,
  saveProcessedFile,
  STORAGE_MODE,
};