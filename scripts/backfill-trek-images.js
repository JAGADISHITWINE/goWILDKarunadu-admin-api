require('dotenv').config();

const fs = require('fs');
const path = require('path');
const https = require('https');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const targetRoot = path.join(repoRoot, 'uploads', 'treks');
const sharedTreksRoot = path.resolve(repoRoot, '..', 'shared-uploads', 'treks');
const publicBase = '/uploads/treks';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function copyIfNeeded(sourceFile, targetFile) {
  if (!fs.existsSync(targetFile)) {
    ensureDir(path.dirname(targetFile));
    fs.copyFileSync(sourceFile, targetFile);
    return true;
  }
  return false;
}

function contentTypeToExt(contentType = '') {
  const normalized = String(contentType).toLowerCase();
  if (normalized.includes('image/jpeg')) return '.jpg';
  if (normalized.includes('image/png')) return '.png';
  if (normalized.includes('image/webp')) return '.webp';
  if (normalized.includes('image/gif')) return '.gif';
  if (normalized.includes('image/avif')) return '.avif';
  return '.jpg';
}

function collectFilesByPrefix(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => path.join(dir, entry))
    .filter((entry) => fs.statSync(entry).isFile())
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

async function main() {
  ensureDir(targetRoot);

  const db = mysql.createPool({
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'goWILDKarunadu',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  });

  const conn = await db.getConnection();
  try {
    const [treks] = await conn.query(
      `SELECT id, cover_image FROM treks WHERE cover_image IS NOT NULL AND cover_image <> '' ORDER BY created_at ASC, id ASC`
    );
    const [images] = await conn.query(
      `SELECT id, trek_id, image_url FROM trek_images WHERE image_url IS NOT NULL AND image_url <> '' ORDER BY trek_id ASC, id ASC`
    );

    const updates = [];
    let copiedFiles = 0;
    let normalizedRows = 0;
    let skippedMissing = 0;
    const coverSources = collectFilesByPrefix(sharedTreksRoot, 'coverImage-');
    const gallerySources = collectFilesByPrefix(sharedTreksRoot, 'gallery-');

    if (coverSources.length < treks.length) {
      throw new Error(`Not enough cover images in shared uploads: need ${treks.length}, found ${coverSources.length}`);
    }
    if (gallerySources.length < images.length) {
      throw new Error(`Not enough gallery images in shared uploads: need ${images.length}, found ${gallerySources.length}`);
    }

    for (let i = 0; i < treks.length; i++) {
      const row = treks[i];
      const source = coverSources[i];
      if (!source) {
        skippedMissing += 1;
        continue;
      }

      const target = path.join(targetRoot, path.basename(source));
      if (copyIfNeeded(source, target)) {
        copiedFiles += 1;
      }

      const normalized = `${publicBase}/${path.basename(target)}`;
      if (normalized !== String(row.cover_image || '').trim()) {
        updates.push({
          table: 'treks',
          id: row.id,
          column: 'cover_image',
          value: normalized
        });
        normalizedRows += 1;
      }
    }

    for (let i = 0; i < images.length; i++) {
      const row = images[i];
      const source = gallerySources[i];
      if (!source) {
        skippedMissing += 1;
        continue;
      }

      const target = path.join(targetRoot, path.basename(source));
      if (copyIfNeeded(source, target)) {
        copiedFiles += 1;
      }

      const normalized = `${publicBase}/${path.basename(target)}`;
      if (normalized !== String(row.image_url || '').trim()) {
        updates.push({
          table: 'trek_images',
          id: row.id,
          column: 'image_url',
          value: normalized
        });
        normalizedRows += 1;
      }
    }

    await conn.beginTransaction();
    try {
      for (const update of updates) {
        await conn.query(
          `UPDATE ${update.table} SET ${update.column} = ? WHERE id = ?`,
          [update.value, update.id]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }

    console.log(
      JSON.stringify(
        {
          copiedFiles,
          normalizedRows,
          skippedMissing,
          targetRoot
        },
        null,
        2
      )
    );
  } finally {
    conn.release();
    await db.end();
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exitCode = 1;
});
