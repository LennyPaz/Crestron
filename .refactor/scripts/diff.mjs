import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [, , aDir, bDir, outDir] = process.argv;
if (!aDir || !bDir) { console.error('usage: diff.mjs <a> <b> [outDir]'); process.exit(1); }
const out = outDir || path.join(path.dirname(aDir), 'diffs');
fs.mkdirSync(out, { recursive: true });

const files = fs.readdirSync(aDir).filter(f => f.endsWith('.png')).sort();
let totalDiffs = 0, totalPixels = 0, anyMismatch = false;
const rows = [];

for (const f of files) {
  const aPath = path.join(aDir, f);
  const bPath = path.join(bDir, f);
  if (!fs.existsSync(bPath)) { console.error(`MISSING in ${bDir}: ${f}`); continue; }

  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  if (a.width !== b.width || a.height !== b.height) {
    console.error(`SIZE MISMATCH ${f}: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
    anyMismatch = true;
    rows.push({ file: f, diff: 'SIZE', pct: 'n/a' });
    continue;
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0.05,           // tolerate sub-pixel AA noise
    includeAA: false,
    alpha: 0.3,
    diffColor: [255, 0, 255],
  });
  const px = a.width * a.height;
  const pct = (n / px) * 100;
  totalDiffs += n;
  totalPixels += px;
  if (n > 0) {
    fs.writeFileSync(path.join(out, f), PNG.sync.write(diff));
    anyMismatch = true;
  }
  rows.push({ file: f, diff: n, pct: pct.toFixed(4) + '%' });
}

console.log('\nfile'.padEnd(40) + 'diff-px'.padStart(10) + '   pct');
console.log('-'.repeat(60));
for (const r of rows) {
  console.log(r.file.padEnd(40) + String(r.diff).padStart(10) + '   ' + r.pct);
}
console.log('-'.repeat(60));
console.log(`TOTAL`.padEnd(40) + String(totalDiffs).padStart(10) + '   ' +
            ((totalDiffs / totalPixels) * 100).toFixed(4) + '%');
console.log(anyMismatch ? `\nDiff PNGs written to ${out}` : '\nNo differences detected.');
process.exit(anyMismatch ? 1 : 0);
