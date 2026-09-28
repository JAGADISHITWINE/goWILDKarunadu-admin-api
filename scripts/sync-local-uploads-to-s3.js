/**
 * Sync Local Uploads to AWS S3 & Custom CDN
 *
 * This utility:
 * 1. Reads local files in uploads/treks and uploads/posts
 * 2. Uploads them to AWS S3 under their respective prefixes with proper Content-Type
 * 3. Supports --dry-run to preview what will be uploaded
 * 4. Supports --update-db to update MySQL database rows from /uploads/... to https://<custom_domain>/...
 *
 * Usage:
 *   node scripts/sync-local-uploads-to-s3.js --dry-run
 *   node scripts/sync-local-uploads-to-s3.js
 *   node scripts/sync-local-uploads-to-s3.js --update-db
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldUpdateDb = args.includes('--update-db');

const BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const ACCESS_KEY = process.env.ADMIN_AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.ADMIN_AWS_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const CUSTOM_DOMAIN = (process.env.CUSTOM_CDN_URL || process.env.CLOUDFRONT_URL || process.env.S3_CUSTOM_DOMAIN || '').trim().replace(/\/+$/, '');

if (!BUCKET) {
  console.error('ERROR: S3_BUCKET is not set in .env');
  process.exit(1);
}

if (!isDryRun && (!ACCESS_KEY || !SECRET_KEY || ACCESS_KEY === 'your_key')) {
  console.error('ERROR: AWS credentials (ADMIN_AWS_ACCESS_KEY / ADMIN_AWS_SECRET_KEY) are missing or placeholder in .env');
  process.exit(1);
}

const s3Client = new S3Client({
  region: REGION,
  credentials: (ACCESS_KEY && SECRET_KEY && ACCESS_KEY !== 'your_key')
    ? { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY }
    : undefined,
});

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.webp': return 'image/webp';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

async function fileExistsInS3(key) {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    return false;
  }
}

async function uploadFile(filePath, s3Key) {
  const fileBuffer = fs.readFileSync(filePath);
  const contentType = getMimeType(filePath);

  if (isDryRun) {
    console.log(`  [DRY-RUN] Would upload ${filePath} -> s3://${BUCKET}/${s3Key} (${contentType})`);
    return;
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  console.log(`  [UPLOADED] s3://${BUCKET}/${s3Key}`);
}

async function syncDirectory(localDir, s3Prefix) {
  if (!fs.existsSync(localDir)) {
    console.log(`Directory does not exist, skipping: ${localDir}`);
    return [];
  }

  const entries = fs.readdirSync(localDir);
  const uploadedKeys = [];

  for (const entry of entries) {
    const fullPath = path.join(localDir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isFile()) {
      const s3Key = `${s3Prefix}/${entry}`.replace(/^\/+/, '');
      const exists = !isDryRun ? await fileExistsInS3(s3Key) : false;
      if (exists) {
        console.log(`  [EXISTS] Skipping already uploaded: ${s3Key}`);
      } else {
        await uploadFile(fullPath, s3Key);
      }
      uploadedKeys.push({ entry, s3Key, localPath: fullPath });
    }
  }

  return uploadedKeys;
}

async function updateDatabase(uploadedMap) {
  if (!shouldUpdateDb) {
    console.log('\nTip: To update existing database paths from /uploads/... to CDN URLs, run with --update-db');
    return;
  }

  const baseUrl = CUSTOM_DOMAIN || `https://${BUCKET}.s3.${REGION}.amazonaws.com`;
  console.log(`\nConnecting to MySQL to rewrite local image URLs with base: ${baseUrl}...`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'goWILDKarunadu',
  });

  try {
    // 1. Update treks cover_image
    const [treks] = await connection.execute("SELECT id, cover_image FROM treks WHERE cover_image LIKE '/uploads/%'");
    let trekCount = 0;
    for (const trek of treks) {
      const oldUrl = trek.cover_image;
      const cleanPath = oldUrl.replace(/^\/uploads\//, '');
      const newUrl = `${baseUrl}/${cleanPath}`;
      await connection.execute("UPDATE treks SET cover_image = ? WHERE id = ?", [newUrl, trek.id]);
      trekCount++;
    }
    console.log(`Updated ${trekCount} trek cover images in database.`);

    // 2. Update trek_gallery image_url
    const [gallery] = await connection.execute("SELECT id, image_url FROM trek_gallery WHERE image_url LIKE '/uploads/%'");
    let galleryCount = 0;
    for (const item of gallery) {
      const oldUrl = item.image_url;
      const cleanPath = oldUrl.replace(/^\/uploads\//, '');
      const newUrl = `${baseUrl}/${cleanPath}`;
      await connection.execute("UPDATE trek_gallery SET image_url = ? WHERE id = ?", [newUrl, item.id]);
      galleryCount++;
    }
    console.log(`Updated ${galleryCount} gallery images in database.`);

  } finally {
    await connection.end();
  }
}

async function main() {
  console.log('=====================================================');
  console.log('goWILD Karunadu - S3 Upload & Route 53 Migration Tool');
  console.log('=====================================================');
  console.log(`Target Bucket: ${BUCKET}`);
  console.log(`AWS Region:    ${REGION}`);
  console.log(`Custom Domain: ${CUSTOM_DOMAIN || '(Direct S3 bucket URL)'}`);
  console.log(`Mode:          ${isDryRun ? 'DRY-RUN (Preview only)' : 'LIVE'}`);
  console.log('-----------------------------------------------------\n');

  const adminUploads = path.resolve(__dirname, '../uploads');
  const userUploads = path.resolve(__dirname, '../../goWILDKarunadu-user-api/uploads');

  console.log('1. Syncing Treks Uploads...');
  const treks = await syncDirectory(path.join(adminUploads, 'treks'), 'treks');

  console.log('\n2. Syncing Posts Uploads (Admin)...');
  const postsAdmin = await syncDirectory(path.join(adminUploads, 'posts'), 'posts');

  console.log('\n3. Syncing Posts Uploads (User)...');
  const postsUser = await syncDirectory(userUploads, 'posts');

  console.log('\nS3 synchronization complete!');

  if (shouldUpdateDb) {
    await updateDatabase();
  } else {
    console.log('\nRun "node scripts/sync-local-uploads-to-s3.js --update-db" when you want database records updated.');
  }
}

main().catch((err) => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
