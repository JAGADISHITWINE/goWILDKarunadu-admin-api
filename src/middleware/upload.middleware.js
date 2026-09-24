const path = require('path');
const { ensureUploadDir, trekUploadDir } = require('../utils/uploadPaths');
const { buildMemoryMulter, processImage, saveProcessedFile } = require('../utils/storageFactory');

ensureUploadDir(trekUploadDir);

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  if (allowed.test(String(file.mimetype || '').toLowerCase())) {
    cb(null, true);
    return;
  }
  cb(new Error('Only images allowed'), false);
};

const memoryMulter = buildMemoryMulter(fileFilter, 5);

// Wraps multer.fields() to also compress + save every uploaded file afterward
function fields(fieldConfigs) {
  const middleware = memoryMulter.fields(fieldConfigs);
  return (req, res, next) => {
    middleware(req, res, async (err) => {
      if (err) return next(err);

      try {
        const allFiles = Object.values(req.files || {}).flat();
        for (const file of allFiles) {
          const base = path.basename(file.originalname || 'trek-image', path.extname(file.originalname || ''))
            .replace(/\s+/g, '_');
          const filenameBase = `${base}-${Date.now()}-${Math.round(Math.random() * 1e5)}`;

          const processedBuffer = await processImage(file.buffer, { maxWidth: 1600, quality: 75 });
          const saved = await saveProcessedFile({
            buffer: processedBuffer,
            localDir: trekUploadDir,
            s3Prefix: 'treks',
            filenameBase,
          });

          // Attach unified fields so controllers can read file.storedUrl either way
          Object.assign(file, saved);
        }
        next();
      } catch (procErr) {
        next(procErr);
      }
    });
  };
}

module.exports = { fields };