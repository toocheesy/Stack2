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
  // Browser-tab favicons — flatten to tan to enforce "no alpha" per the
  // brand spec (master is fully opaque so flatten is effectively a no-op,
  // but the flatten call documents the no-alpha contract for downstream
  // tooling and asserts it on regeneration).
  { name: 'favicon-32.png', size: 32, flatten: true },
  { name: 'favicon-16.png', size: 16, flatten: true },
];

for (const { name, size, flatten } of SIZES) {
  const out = resolve(OUT_DIR, name);
  let pipeline = sharp(MASTER).resize(size, size, { fit: 'cover' });
  if (flatten) pipeline = pipeline.flatten({ background: '#E8C577' });
  await pipeline.png({ compressionLevel: 9 }).toFile(out);
  console.log(`  ${name} (${size}×${size})`);
}
console.log('Icon set written to public/icons/');
