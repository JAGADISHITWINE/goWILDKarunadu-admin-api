const path = require('path');
const fs = require('fs');

const uploadsRoot = process.env.SHARED_UPLOADS_DIR
  ? path.resolve(process.env.SHARED_UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');

const trekUploadDir = path.join(uploadsRoot, 'treks');
const postUploadDir = path.join(uploadsRoot, 'posts');
const trekUploadPublicBase = '/uploads/treks';
const postUploadPublicBase = '/uploads/posts';

function ensureUploadDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolveTrekUploadPath(file) {
  if (!file) return null;

  if (typeof file === 'string') {
    const trimmed = file.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/uploads/')) {
      return trimmed;
    }
    return `${trekUploadPublicBase}/${path.basename(trimmed)}`;
  }

  const candidate = file.publicPath || file.url || file.path || file.filename;
  if (!candidate) return null;

  if (typeof candidate === 'string') {
    if (/^https?:\/\//i.test(candidate) || candidate.startsWith('/uploads/')) {
      return candidate;
    }
  }

  if (file.filename) {
    return `${trekUploadPublicBase}/${file.filename}`;
  }

  if (file.path) {
    return `${trekUploadPublicBase}/${path.basename(file.path)}`;
  }

  return `${trekUploadPublicBase}/${path.basename(String(candidate))}`;
}

function resolvePostUploadPath(file) {
  if (!file) return null;

  if (typeof file === 'string') {
    const trimmed = file.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/uploads/')) {
      return trimmed;
    }
    return `${postUploadPublicBase}/${path.basename(trimmed)}`;
  }

  const candidate = file.publicPath || file.url || file.path || file.filename;
  if (!candidate) return null;

  if (typeof candidate === 'string') {
    if (/^https?:\/\//i.test(candidate) || candidate.startsWith('/uploads/')) {
      return candidate;
    }
  }

  if (file.filename) {
    return `${postUploadPublicBase}/${file.filename}`;
  }

  if (file.path) {
    return `${postUploadPublicBase}/${path.basename(file.path)}`;
  }

  return `${postUploadPublicBase}/${path.basename(String(candidate))}`;
}

module.exports = {
  ensureUploadDir,
  trekUploadDir,
  postUploadDir,
  trekUploadPublicBase,
  postUploadPublicBase,
  resolveTrekUploadPath,
  resolvePostUploadPath
};
