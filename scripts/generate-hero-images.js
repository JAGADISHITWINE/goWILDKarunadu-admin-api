/*
Simple script to download hero images and generate HD + @2x variants.
Requires Node 18+ (global fetch) and `sharp` installed in the workspace:

  npm install --workspace=./goWILDKarunadu-user-ui sharp

Run from repo root:

  node scripts/generate-hero-images.js

Edit the `sources` array below to use your preferred image URLs.
Outputs to: goWILDKarunadu-user-ui/src/assets/images/
*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(__dirname, '..', 'goWILDKarunadu-user-ui', 'src', 'assets', 'images');
fs.mkdirSync(outDir, { recursive: true });

// Replace these with your HD source URLs
const sources = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=3000&q=90',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=3000&q=90',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=3000&q=90',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=3000&q=90'
];

async function downloadBuffer(url) {
  console.log('Fetching', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function process() {
  for (let i = 0; i < sources.length; i++) {
    const idx = i + 1;
    try {
      const buf = await downloadBuffer(sources[i]);

      // Standard HD width (adjust if you want larger)
      const baseWidth = 1920;
      const doubleWidth = baseWidth * 2;

      const jpgOut = path.join(outDir, `hero-slide-${idx}.jpg`);
      const jpgOut2x = path.join(outDir, `hero-slide-${idx}@2x.jpg`);
      const webpOut = path.join(outDir, `hero-slide-${idx}.webP`);
      const webpOut2x = path.join(outDir, `hero-slide-${idx}@2x.webP`);

      // Produce JPG HD
      await sharp(buf)
        .resize({ width: baseWidth })
        .jpeg({ quality: 84 })
        .toFile(jpgOut);

      // Produce JPG 2x
      await sharp(buf)
        .resize({ width: doubleWidth })
        .jpeg({ quality: 82 })
        .toFile(jpgOut2x);

      // Produce WebP HD
      await sharp(buf)
        .resize({ width: baseWidth })
        .webp({ quality: 80 })
        .toFile(webpOut);

      // Produce WebP 2x
      await sharp(buf)
        .resize({ width: doubleWidth })
        .webp({ quality: 78 })
        .toFile(webpOut2x);

      console.log(`Wrote hero-slide-${idx} (jpg + webp, 1x + 2x)`);
    } catch (err) {
      console.error(`Error processing source ${idx}:`, err.message);
    }
  }
}

process().catch(err => {
  console.error('Fatal', err);
  process.exit(1);
});
