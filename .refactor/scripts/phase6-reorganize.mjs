// Phase 6 reorganization: extract all @keyframes and the lone @media query,
// move them to the bottom of the file under "Animations" and "Responsive
// overrides" section headers. Add a top-of-file TOC.
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(process.argv[2] || 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Extract a balanced { ... } block starting at index i (which must point at '{').
function balancedBlock(s, i) {
  if (s[i] !== '{') throw new Error(`expected '{' at ${i}`);
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') {
      depth--;
      if (depth === 0) return j; // index of matching '}'
    }
  }
  throw new Error(`unbalanced braces starting at ${i}`);
}

// Extract one at-rule (e.g. "@keyframes foo { ... }") from the source.
// Returns { extracted: string, source: string after removal } or null if no match.
function extractAtRule(src, prefix) {
  const i = src.indexOf(prefix);
  if (i === -1) return null;
  const open = src.indexOf('{', i);
  if (open === -1) throw new Error(`malformed ${prefix}`);
  const close = balancedBlock(src, open);
  // also include the trailing newline if present
  const end = src[close + 1] === '\n' ? close + 2 : close + 1;
  // and absorb a single leading blank line if there is one
  let start = i;
  if (src.slice(start - 1, start) === '\n' && src.slice(start - 2, start - 1) === '\n') {
    start -= 1;
  }
  const extracted = src.slice(i, close + 1);
  const newSrc = src.slice(0, start) + src.slice(end);
  return { extracted, source: newSrc };
}

// Extract all @keyframes blocks (their names don't matter — we relocate them all).
const keyframes = [];
while (true) {
  const r = extractAtRule(css, '@keyframes ');
  if (!r) break;
  keyframes.push(r.extracted);
  css = r.source;
}

// Extract the @media query (currently only one).
const medias = [];
while (true) {
  const r = extractAtRule(css, '@media ');
  if (!r) break;
  // also pull the preceding "/* Scale down icons on shorter screens */" comment
  // if it sits immediately above the rule
  const tail = css.trimEnd();
  // The extractAtRule already removed the @media block; check for trailing
  // orphan comment by looking for the prior comment that referenced it.
  medias.push(r.extracted);
  css = r.source;
}

// Trim any double-blank-line artifacts left by the removals.
css = css.replace(/\n{3,}/g, '\n\n');

// Add the bottom sections.
const tail = `

/* ============================================================
   Animations
   ============================================================ */

${keyframes.join('\n\n')}

/* ============================================================
   Responsive overrides
   ============================================================ */

${medias.join('\n\n')}
`;

// Add TOC at the very top, immediately after the existing tokens block.
// Locate the closing `}` of the :root block.
const tocBanner = `/* ============================================================
   FSU Crestron Interface — styles.css

   Table of contents
     1. Tokens (custom properties)             :root
     2. Reset & base                           *, body, .interface
     3. Header                                 .header, .fsu-logo, .building-*, .start-class-btn
     4. Demo bar                               .student-view-demo
     5. Middle row                             .middle-row, .screen-*, .lights-*, .light-btn, fullscreen overlay
     6. Bottom row + cards                     .bottom-row, .control-card (+ modifiers), .card-title
     7. Left section: input sources & cameras  .sources-grid, .source-btn, .camera-btn
     8. Middle section: workflow controls      .workflow-*, .controls-grid, .control-btn, .audio-btn
     9. Action menus (shared shell)            .doccam/.bluray/.project/.hide/.freeze-* + close-X
    10. Right section: power, screens, volume  .right-section, .power-btn, .projector-control-btn,
                                               .screen-controls-grid, .volume-*, .mute-btn, .help-btn
    11. Overlays                               .power-off-modal, .loading-overlay, .technical-setup-*, .help-*
    12. Animations                             @keyframes (powerPulse, sourcePulse, freezePulse, slideDown, spin)
    13. Responsive overrides                   @media queries
   ============================================================ */
`;
css = tocBanner + '\n' + css.trimStart();

fs.writeFileSync(cssPath, css + tail);
console.log(`Relocated ${keyframes.length} @keyframes and ${medias.length} @media to the bottom.`);
