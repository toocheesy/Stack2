// Regenerate PWA icon set from the 1024×1024 master. Run when the
// master changes:
//   node scripts/generate-icons.mjs
// Outputs to public/icons/ (committed). Sharp is a devDep — installed
// solely for this one-shot generation pipeline, no runtime impact.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MASTER = resolve(__dirname, 'app-icon-1024.png');
const OUT_DIR = resolve(ROOT, 'public/icons');

// 192/512 for Android + general use, maskable-512 for adaptive Android
// icons (master keeps the mark inside the maskable safe zone), 180 for
// apple-touch-icon (iOS Add-to-Home-Screen).
const SIZES = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'apple-touch-icon-180.png', size: 180 },
];

for (const { name, size } of SIZES) {
  const out = resolve(OUT_DIR, name);
  await sharp(MASTER)
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ${name} (${size}×${size})`);
}
console.log('Icon set written to public/icons/');
