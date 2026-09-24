const path = require('path');
const { ensureUploadDir, postUploadDir } = require('../utils/uploadPaths');
const { buildMemoryMulter, processImage, saveProcessedFile } = require('../utils/storageFactory');

ensureUploadDir(postUploadDir);

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  if (allowedTypes.test(String(file.mimetype || '').toLowerCase())) {
    cb(null, true);
    return;
  }
  cb(new Error('Only image files are allowed!'));
};

const memoryMulter = buildMemoryMulter(fileFilter, 5);

function single(fieldName) {
  const middleware = memoryMulter.single(fieldName);
  return (req, res, next) => {
    middleware(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) return next();

      try {
        const base = path.basename(req.file.originalname || 'post-image', path.extname(req.file.originalname || ''))
          .replace(/\s+/g, '_');
        const filenameBase = `post-${base}-${Date.now()}`;

        const processedBuffer = await processImage(req.file.buffer, { maxWidth: 1200, quality: 75 });
        const saved = await saveProcessedFile({
          buffer: processedBuffer,
          localDir: postUploadDir,
          s3Prefix: 'posts',
          filenameBase,
        });

        Object.assign(req.file, saved);
        next();
      } catch (procErr) {
        next(procErr);
      }
    });
  };
}

module.exports = { single };