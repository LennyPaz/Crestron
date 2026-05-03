// Capture initial state at 1366x768 (typical laptop) for the
// before/after Phase 7 sanity check.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.resolve(__dirname, '..', 'laptop');
await fs.mkdir(outDir, { recursive: true });
const tag = process.argv[2] || 'shot';
const indexUrl = pathToFileURL(path.join(repoRoot, 'index.html')).href;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});

async function shot(name, setup) {
  const page = await context.newPage();
  await page.goto(indexUrl);
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
    #timeDisplay { visibility: hidden !important; }
    img[src$=".gif"] { visibility: hidden !important; }
  `});
  if (setup) await setup(page);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, `${name}-${tag}.png`) });
  await page.close();
  console.log(`✓ ${name}-${tag}`);
}

const setupPowerOnDesktop = `
  togglePower(document.querySelectorAll('.power-btn')[0], true);
  document.getElementById('loadingOverlay').classList.remove('active');
  selectSource(document.querySelectorAll('.source-btn')[0], 'desktop');
`;

await shot('01-initial');
await shot('05-project-menu-open', async (page) => {
  await page.evaluate(setupPowerOnDesktop + `
    const projectBtn = [...document.querySelectorAll('.controls-grid .control-btn')]
      .find(b => b.textContent.trim().startsWith('PROJECT'));
    openProjectControls(projectBtn);
  `);
});

await browser.close();
console.log(`\nDone. Saved to ${outDir}`);
