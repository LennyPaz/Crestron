// Wires the whole mockup together: spec -> renderer, join bus, program, Pearl
// sim, formatter, room content, and the tester chrome (room variant, sim clock).
"use strict";

const VARIANTS = {
  bluray: { spec: "spec_212.json", deckRoom: true, twoProj: false, listenRoom: false },
  twoproj: { spec: "spec_standard.json", deckRoom: false, twoProj: true, listenRoom: true },
  twodoc: { spec: "spec_201.json", deckRoom: false, twoProj: false, listenRoom: false },
  standard: { spec: "spec_standard.json", deckRoom: false, twoProj: false, listenRoom: false },
};

let app = null;

// Panel fixes the owner has agreed and handed to the panel side, shown here BEFORE a round carries
// them. The spec files stay exactly what the compiled panel says (their hashes are pinned in
// source_manifest.json); these are applied on top at load. Take an entry out the day a round that
// carries it is regenerated into the spec: the "ahead" check in verify_tasks.js fails until you do.
const SPEC_AHEAD = [
  // LISTEN TO's source name sat on the button's baked caption (rows 70 to 83 of the face, layout
  // 78 to 91). Owner 2026-10-01 (1B, then A): move it down, no font change. Sent to the touch-panel
  // session for its next round.
  { spec: "spec_standard.json", name: "P1_126_listenSrc", was: 82, top: 87 },
];
function applySpecAhead(file, spec) {
  const want = SPEC_AHEAD.filter(a => a.spec === file);
  const walk = o => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== "object") return;
    for (const a of want) {
      // only move it from where the panel had it: a round that already moved it is left alone
      if (o.name === a.name && o.geo && o.geo.top === a.was) {
        o.geo.top = a.top;
        if (o.props) o.props["PositionAndSize/Top"] = String(a.top);
      }
    }
    for (const k in o) if (o[k] && typeof o[k] === "object") walk(o[k]);
  };
  walk(spec);
}

async function boot(variantKey) {
  const v = VARIANTS[variantKey];
  const res = await fetch(v.spec + (window.CACHEBUST || ""));
  if (!res.ok) throw new Error("the panel data answered " + res.status);   // shown as plain words by showLoadFailure
  const specText = await res.text();
  const spec = JSON.parse(specText);
  applySpecAhead(v.spec, spec);
  document.getElementById("stage").innerHTML = "";

  const bus = new JoinBus();
  const room = new Room();

  // sim clock: real time + tester offset
  let clockOffsetMs = 0;
  const simNow = () => new Date(Date.now() + clockOffsetMs);

  const pearl = new PearlSim(bus, { now: () => simNow().getTime() });
  // The names the status card shows, as the program gives them to Page1Formatter (Rev 60, H=166
  // parameters P2..P7). "Doc Cam", not "Document Camera" (Astra 2026-09-29). Input 7 exists only in
  // room 201's design, which has no program yet; its name follows the same pattern.
  const sources = { 1: "Blu-ray", 2: "Doc Cam", 3: "Desktop PC", 4: "Wireless Stream", 5: "Laptop HDMI", 6: "Laptop USB-C", 7: "Doc Cam 2" };
  const fmt = new Page1Formatter(bus, sources);

  // default schedule: seeded relative to the sim clock. Titles are in the shape the
  // scheduler really puts on the glass, lc_common.group_summary(): 'COURSE-SECTION -
  // Last, First'. Placeholder people, so a render can go anywhere without carrying a
  // real instructor's name (the live ledger titles do, and one nearly went to print).
  const nowEp = Math.floor(simNow().getTime() / 1000);
  const hour = 3600;
  pearl.setSchedule([
    { id: "e1", title: "BSC 2085-0003 - Smith, Jane", start: nowEp - 3 * hour, end: nowEp - 2 * hour + 900, optIn: false, confirmed: true, started: true, ended: true },
    { id: "e2", title: "CHM 1045-0001 - Doe, John", start: nowEp + 20 * 60, end: nowEp + 20 * 60 + 50 * 60, optIn: true, confirmed: false, started: false, ended: false },
    { id: "e3", title: "PSY 3810-0002 - Smith, Jane", start: nowEp + 2 * hour, end: nowEp + 2 * hour + 75 * 60, optIn: false, confirmed: false, started: false, ended: false },
  ]);

  let program = null;

  const renderer = new Renderer(spec, bus, {
    now: simNow,
    videoContent: (o, el, urlSerial) => bindVideo(o, el, urlSerial),
    onPageFlip: name => {
      // the LC page latch follows the page the glass actually shows
      if (program) program.setLcOpen(name === "LC-Mockup");
    },
  });

  function bindVideo(o, el, urlSerial) {
    const n = o.name;
    const R = () => program ? program.routes : { prevL: 0, prevR: 0, kaltura: 0 };
    // the recorder views follow their URL SERIALS, as the glass does: an empty
    // s60/s61 tears the session down whatever the module state says
    const s60 = () => bus.getS(60) !== "", s61 = () => bus.getS(61) !== "";
    // On hold the recorder's two channels switch to their privacy slates (PearlRest.usp:1392,
    // Content_Splash$ / Camera_Splash$), so that is what the recorder previews show
    const recContent = () => pearl.paused ? room.slateScene() : (room.sceneFor(R().kaltura) || room.noContentScene());
    const recCam = () => pearl.paused ? room.slateScene() : room.cameraScene(null, pearl.layoutN);
    // The recorder's two streams are told apart by the URL serial a window is bound to, as on the
    // glass: s60 is the content channel, s61 the camera. Round 30 (09-28) moved those serials
    // between two windows without renaming them, and binding by NAME showed them the wrong way
    // round (Astra 2026-09-29). Names are only the fallback for a spec with no serial.
    const bySerial = {
      60: () => s60() ? recContent() : null,
      61: () => s61() ? recCam() : null,
    };
    const map = {
      "P1_12_screen_container": () => room.sceneFor(R().prevL),
      "P1_14_screen_container": () => room.sceneFor(R().prevR),
      "P1_160_recViewL": () => s60() ? recContent() : null,
      "P1_161_recViewR": () => s61() ? recCam() : null,
      "Embedded Video_2": () => s60() ? recContent() : null,
      "Embedded Video_4": () => s61() ? recCam() : null,
      "Embedded Video_1": () => room.sceneFor(R().prevL),
      "Embedded Video_5": () => room.sceneFor(R().prevR),
    };
    const get = bySerial[urlSerial] || map[n] || (() => null);
    room.bind(el, get);
  }

  renderer.mount(document.getElementById("stage"));

  // Which mute model the LOADED glass implies. Round 28 has separate UNMUTE buttons (press 35
  // and 37) and goes with Rev 56's absolute pairs; the older Blu-ray build has one MUTE button
  // per channel on 30/32 and goes with the older toggle. Read off the spec rather than the
  // variant name, so a rebuilt Blu-ray panel picks up the pairs on its own.
  const pressesOnGlass = new Set();
  for (const pg of spec.pages) for (const o of pg.objects) {
    const j = parseInt((o.props || {}).DigitalPressJoin || 0, 10);
    if (j) pressesOnGlass.add(j);
  }
  const absoluteMutes = pressesOnGlass.has(35) && pressesOnGlass.has(37);

  program = new Program(bus, pearl, fmt, {
    deckRoom: v.deckRoom, twoProj: v.twoProj, listenRoom: v.listenRoom,
    absoluteMutes,
    deck: room.deck,
    onRoute: () => room.repaintAll(),
    onHide: () => room.repaintAll(),
    onPower: () => room.repaintAll(),
    // the walk-up form going away takes the panel's pop-up keyboard with it
    closeKeyboard: () => renderer.closeKeyboard(),
  });

  renderer.flipTo("SCREENSAVER");

  // periodic repaint so scenes (deck state, preview timeout) stay current
  setInterval(() => room.repaintAll(), 1000);

  app = {
    // which room this instance was booted as, so the parity harness can prove it checked the
    // variant it claims to have checked rather than whatever ?room= happened to boot first
    variant: variantKey,
    // the compiled panel this spec was decoded from, recorded with every test result
    specSource: spec.source || "",
    // the spec's CONTENT, for the test's study version: the source name alone survives an edit
    specText,
    bus, pearl, program, renderer, room,
    nudgeClock: min => { clockOffsetMs += min * 60000; },
  };
  // a top-level `let` is script-scoped, not a window property: anything loaded
  // separately (the task layer, the parity harness) cannot see it otherwise
  window.app = app;

  // ---- chrome ----
  document.getElementById("chrome-time").onclick = e => {
    const min = parseInt(e.target.dataset.min || 0, 10);
    if (min) app.nudgeClock(min);
  };
  document.getElementById("chrome-ss").onclick = () => renderer.flipTo("SCREENSAVER");
}

function scaleStage() {
  const wrap = document.getElementById("stage-wrap");
  // The task panel sits in the LEFT margin and reserves WIDTH, never height, so the
  // glass keeps its full height whenever the window is wide enough. Visibility is
  // read from what is PAINTED (computed display), not from the hidden attribute:
  // the attribute was true for hours this morning while the bar still painted.
  // On a narrow (phone) window the panel is a TOP bar instead (styles.css), and a side panel
  // there left the glass a 112 px sliver: it reserves HEIGHT in that case.
  const bar = document.getElementById("task-bar");
  const shown = bar && getComputedStyle(bar).display !== "none";
  const onTop = shown && bar.offsetWidth >= window.innerWidth * 0.9;
  const reservedW = shown && !onTop ? bar.offsetWidth : 0;
  const reservedH = onTop ? bar.offsetHeight : 0;
  const availW = window.innerWidth - reservedW, availH = window.innerHeight - reservedH;
  const s = Math.min(availW / 1920, availH / 1080);
  wrap.style.transform = "scale(" + s + ")";
  wrap.style.left = (reservedW + Math.max(0, (availW - 1920 * s) / 2)) + "px";
  wrap.style.top = reservedH + "px";
}

window.addEventListener("resize", scaleStage);
// the task bar reserves stage height, so anything that shows or hides it has to
// re-run this or the glass keeps a scale that no longer fits
window.scaleStage = scaleStage;
window.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("variant");
  // ?room=<variant> so a reviewer can be sent straight to the room family under
  // discussion. The picker still wins afterwards; this only sets the first boot.
  const want = new URLSearchParams(location.search).get("room");
  if (want && VARIANTS[want]) sel.value = want;
  sel.onchange = () => boot(sel.value);
  boot(sel.value).then(scaleStage).catch(() => { if (window.showLoadFailure) window.showLoadFailure(); });
});
