import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.resolve(__dirname, '..', process.argv[2] || 'baseline');
await fs.mkdir(outDir, { recursive: true });

const indexUrl = pathToFileURL(path.join(repoRoot, 'index.html')).href;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});

async function shot(name, setup) {
  const page = await context.newPage();
  await page.goto(indexUrl);
  await page.waitForLoadState('networkidle');
  // Freeze CSS animations + transitions for deterministic captures, hide live time.
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
    #timeDisplay { visibility: hidden !important; }
    /* hide animated GIFs (their frame timing is non-deterministic across runs) */
    img[src$=".gif"] { visibility: hidden !important; }
  `});
  if (setup) await setup(page);
  await page.waitForTimeout(150);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  await page.close();
  console.log(`✓ ${name}`);
}

// Helper: power on directly (skip loading overlay), select desktop source.
const setupPowerOnDesktop = `
  togglePower(document.querySelectorAll('.power-btn')[0], true);
  document.getElementById('loadingOverlay').classList.remove('active');
  selectSource(document.querySelectorAll('.source-btn')[0], 'desktop');
`;

await shot('01-initial');

await shot('02-source-desktop-selected', async (page) => {
  await page.evaluate(`selectSource(document.querySelectorAll('.source-btn')[0], 'desktop');`);
});

await shot('03-power-on-source-selected', async (page) => {
  await page.evaluate(setupPowerOnDesktop);
});

await shot('04-loading-overlay', async (page) => {
  await page.evaluate(`document.getElementById('loadingOverlay').classList.add('active');`);
});

await shot('05-project-menu-open', async (page) => {
  await page.evaluate(setupPowerOnDesktop + `
    const projectBtn = [...document.querySelectorAll('.controls-grid .control-btn')]
      .find(b => b.textContent.trim().startsWith('PROJECT'));
    openProjectControls(projectBtn);
  `);
});

await shot('06-hide-menu-open', async (page) => {
  await page.evaluate(setupPowerOnDesktop + `
    const hideBtn = [...document.querySelectorAll('.controls-grid .control-btn')]
      .find(b => b.textContent.includes('HIDE'));
    openHideControls(hideBtn);
  `);
});

await shot('07-freeze-menu-open', async (page) => {
  // Freeze requires something to be projecting. Project to left first.
  await page.evaluate(setupPowerOnDesktop + `
    leftProjecting = true; leftProjectSource = 'desktop';
    updateScreenDisplay('left'); updateRoomView('left');
    const freezeBtn = [...document.querySelectorAll('.controls-grid .control-btn')]
      .find(b => b.textContent.trim().startsWith('FREEZE'));
    openFreezeControls(freezeBtn);
  `);
});

await shot('08-doccam-menu-open', async (page) => {
  await page.evaluate(setupPowerOnDesktop + `
    const docBtn = [...document.querySelectorAll('.source-btn')]
      .find(b => b.textContent.includes('DOC CAM'));
    selectSource(docBtn, 'doccam');
  `);
});

await shot('09-bluray-menu-open', async (page) => {
  await page.evaluate(setupPowerOnDesktop + `
    const blurayBtn = [...document.querySelectorAll('.source-btn')]
      .find(b => b.textContent.includes('BLU-RAY'));
    selectSource(blurayBtn, 'bluray');
  `);
});

await shot('10-power-off-modal', async (page) => {
  await page.evaluate(`document.getElementById('powerOffModal').classList.add('active');`);
});

await shot('11-help-main', async (page) => {
  await page.evaluate(`showHelp();`);
});

await shot('12-help-task-detail', async (page) => {
  await page.evaluate(`showHelp(); showTaskDetail('project');`);
});

await shot('13-help-guidebook', async (page) => {
  await page.evaluate(`showHelp(); showGuidebook();`);
});

await shot('14-technical-setup', async (page) => {
  await page.evaluate(`openTechnicalSetup();`);
});

await shot('15-demo-view', async (page) => {
  await page.evaluate(`document.querySelector('.student-view-demo').classList.remove('hidden');`);
});

await shot('16-volume-warning', async (page) => {
  await page.evaluate(`
    const s = document.getElementById('mainSlider');
    s.value = '92';
    s.dispatchEvent(new Event('input'));
  `);
});

await shot('17-fullscreen-overlay', async (page) => {
  await page.evaluate(`
    const ov = document.getElementById('fullscreenOverlay');
    ov.classList.add('active');
    const txt = document.getElementById('fullscreenText');
    txt.textContent = 'Preview: DESKTOP PC';
    txt.style.display = 'block';
    document.getElementById('fullscreenImage').style.display = 'none';
  `);
});

await browser.close();
console.log(`\nWrote captures to ${outDir}`);
