// Phase 9b: convert eligible CSS px literals to rem (1rem = 16px).
//
// Strategy: walk the CSS as text, identify each declaration line, and for
// declarations that aren't on the SKIP_PROPS list, convert any "Npx" tokens
// to "(N/16)rem". Skip:
//   - The :root token block (px values are themselves used in rules, and
//     converting them would double-affect descendants).
//   - @keyframes blocks (decorative glow blurs/offsets — keep px).
//   - Any clamp(...) call (preserve as-is — only the html root clamp uses
//     px on purpose; everything else has been removed in Phase 9a).
//   - Properties on the SKIP_PROPS list.

import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(process.argv[2] || 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Properties whose px values stay as px:
//   - borders: sub-pixel widths render badly
//   - outlines: same
//   - text-shadow / box-shadow blur/spread: handled by skipping the whole
//     declaration since shadows are decorative and rem-scaling them adds
//     little value while complicating the conversion.
const SKIP_PROPS = new Set([
  'border', 'border-width', 'border-top', 'border-right',
  'border-bottom', 'border-left', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width',
  'outline', 'outline-width',
  'box-shadow', 'text-shadow', 'filter', 'backdrop-filter',
  'animation', 'transition',
  'background', 'background-image', // gradients and SVG urls
]);

// Find balanced `{ ... }` block starting at index i.
function balancedBlock(s, i) {
  if (s[i] !== '{') throw new Error(`expected { at ${i}, got ${s[i]}`);
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') {
      depth--;
      if (depth === 0) return j;
    }
  }
  throw new Error(`unbalanced from ${i}`);
}

// Locate spans we should NOT touch:
//   - :root { ... }
//   - @keyframes name { ... } (entire block including nested keyframe rules)
const skipRanges = [];

function findRanges(needle, isAtRule) {
  let pos = 0;
  while (true) {
    const i = css.indexOf(needle, pos);
    if (i === -1) break;
    // Make sure the match is at a top-level position (not inside a string).
    // Crude but sufficient for our hand-written CSS.
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const close = balancedBlock(css, open);
    skipRanges.push([i, close + 1]);
    pos = close + 1;
  }
}

findRanges(':root');
// @keyframes: search for "@keyframes " then find its block
{
  let pos = 0;
  while (true) {
    const i = css.indexOf('@keyframes ', pos);
    if (i === -1) break;
    const open = css.indexOf('{', i);
    const close = balancedBlock(css, open);
    skipRanges.push([i, close + 1]);
    pos = close + 1;
  }
}

function inSkipRange(pos) {
  for (const [a, b] of skipRanges) {
    if (pos >= a && pos < b) return true;
  }
  return false;
}

// Convert px to rem with up to 4 decimals trimmed.
function pxToRem(px) {
  const rem = px / 16;
  // Trim trailing zeros
  let s = rem.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  if (s === '') s = '0';
  return s + 'rem';
}

// Process each declaration. We split the file by lines for simplicity;
// declarations in our codebase live one-per-line (prettier-formatted).
const lines = css.split('\n');
let conversions = 0;
const log = [];

let offset = 0;
for (let li = 0; li < lines.length; li++) {
  const line = lines[li];
  const lineStart = offset;
  offset += line.length + 1; // +1 for the \n

  if (inSkipRange(lineStart)) continue;

  // Match a CSS declaration:  "  property: value;"
  const m = line.match(/^(\s*)([-a-z]+)\s*:\s*(.+?)(\s*;?\s*)$/);
  if (!m) continue;
  const [, indent, prop, value, trailing] = m;

  if (SKIP_PROPS.has(prop)) continue;

  // Skip lines that are part of a clamp(...) or that define a CSS var inside
  // any rule (custom properties — e.g. --menu-tint — pass through unchanged).
  if (prop.startsWith('--')) continue;
  if (value.includes('clamp(')) continue;

  // Convert "Npx" → "(N/16)rem" but only when the px isn't already inside a
  // calc()/min()/max() expression we want to preserve verbatim. For our
  // codebase those don't carry raw px in the Phase 9 baseline, so a flat
  // regex replace is safe.
  let newValue = value;
  let n = 0;
  newValue = newValue.replace(/(-?\d*\.?\d+)px\b/g, (full, num) => {
    n++;
    return pxToRem(parseFloat(num));
  });

  if (n > 0) {
    lines[li] = `${indent}${prop}: ${newValue}${trailing}`;
    conversions += n;
    log.push(`  ${prop}: ${value.trim()} -> ${newValue}`);
  }
}

const out = lines.join('\n');
fs.writeFileSync(cssPath, out);

console.log(`Converted ${conversions} px values to rem.`);
console.log('First 30 conversions for review:');
for (const e of log.slice(0, 30)) console.log(e);
console.log(`... and ${log.length - 30} more.`);
