// The room content simulation: what each routed source SHOWS. The panel's
// preview windows are real HDMI windows on the device; here each route renders
// a small DOM scene so a tester can tell desktop / doc cam / laptop / Blu-ray
// apart at a glance, and so "preview the desktop" is a completable task.
// Route numbers are the DMPS input numbers the program latches (H=73):
//   1 Blu-ray, 2 Document Camera, 3 Desktop PC, 4 Wireless, 5 Laptop HDMI, 6 Laptop USB-C
"use strict";

// What a source's own picture looks like, drawn as SVG so it stays sharp at every pane size (the
// panel previews, the recorder's content window, IN THE ROOM). No source names on them: the real
// preview is the source's video and nothing else (owner 2026-10-01).
const SCENE_SVG = (() => {
  const svg = body => '<svg class="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + body + "</svg>";
  const t = (x, y, size, fill, weight, text) =>
    '<text x="' + x + '" y="' + y + '" font-family="Arial, Helvetica, sans-serif" font-size="' + size + '" fill="' + fill +
    '" font-weight="' + (weight || "normal") + '">' + text + "</text>";
  // a hand-written line on paper: a gentle wave, so it reads as writing rather than a bar
  const ink = (x, y, w, col) => {
    let d = "M" + x + " " + y;
    for (let i = 1; i <= Math.floor(w / 18); i++) d += " q 9 " + (i % 2 ? -7 : 7) + " 18 0";
    return '<path d="' + d + '" fill="none" stroke="' + (col || "#24324a") + '" stroke-width="4" stroke-linecap="round"/>';
  };
  // a lecture slide, full screen: what a laptop that is presenting sends
  const slide = svg(
    '<rect width="1600" height="900" fill="#ffffff"/>' +
    '<rect width="1600" height="150" fill="#782F40"/>' +
    t(80, 100, 64, "#ffffff", "bold", "Week 6: Supply and Demand") +
    '<circle cx="104" cy="262" r="10" fill="#782F40"/>' + t(132, 276, 44, "#1d2733", "", "Demand falls as price rises") +
    '<circle cx="104" cy="362" r="10" fill="#782F40"/>' + t(132, 376, 44, "#1d2733", "", "Supply rises as price rises") +
    '<circle cx="104" cy="462" r="10" fill="#782F40"/>' + t(132, 476, 44, "#1d2733", "", "Equilibrium: where they meet") +
    '<circle cx="104" cy="562" r="10" fill="#782F40"/>' + t(132, 576, 44, "#1d2733", "", "Shifts move the equilibrium") +
    // the chart: two axes, a falling demand line, a rising supply line, the point where they cross
    '<path d="M960 220 V760 H1500" fill="none" stroke="#1d2733" stroke-width="6"/>' +
    '<path d="M1000 280 L1450 720" stroke="#2b6cb0" stroke-width="10" stroke-linecap="round"/>' +
    '<path d="M1000 720 L1450 280" stroke="#c05621" stroke-width="10" stroke-linecap="round"/>' +
    '<circle cx="1225" cy="500" r="18" fill="#1d2733"/>' +
    t(1460, 300, 40, "#c05621", "bold", "S") + t(1460, 730, 40, "#2b6cb0", "bold", "D") +
    t(920, 230, 34, "#1d2733", "", "P") + t(1480, 810, 34, "#1d2733", "", "Q") +
    t(1520, 870, 30, "#8a94a0", "", "6"));
  // the laptop's own desktop with a browser playing a video
  const browser = svg(
    // plain fills, no gradient ids: the same drawing sits in several panes at once, some hidden, and
    // an id shared between them resolves to the first copy, which paints nothing if it is hidden
    '<rect width="1600" height="900" fill="#2c6b52"/><circle cx="1500" cy="880" r="760" fill="#5d8f4e" opacity="0.45"/>' +
    '<circle cx="0" cy="0" r="700" fill="#1f4d43" opacity="0.6"/>' +
    '<rect x="170" y="80" width="1260" height="700" rx="14" fill="#f3f4f6"/>' +
    '<rect x="170" y="80" width="1260" height="64" rx="14" fill="#dfe3e8"/>' +
    '<circle cx="214" cy="112" r="11" fill="#e0605a"/><circle cx="250" cy="112" r="11" fill="#e8b84a"/><circle cx="286" cy="112" r="11" fill="#5cb85c"/>' +
    '<rect x="340" y="94" width="600" height="36" rx="18" fill="#ffffff"/>' + t(366, 122, 24, "#6b7480", "", "lecture-video.example.edu") +
    '<rect x="210" y="170" width="1180" height="520" fill="#0d1117"/>' +
    '<circle cx="800" cy="430" r="78" fill="rgba(255,255,255,0.18)"/>' +
    '<path d="M774 386 L774 474 L850 430 Z" fill="#ffffff"/>' +
    '<rect x="230" y="660" width="1140" height="8" rx="4" fill="#3a4250"/><rect x="230" y="660" width="380" height="8" rx="4" fill="#e0605a"/>' +
    t(210, 735, 30, "#1d2733", "bold", "Lab demonstration, part 2") +
    '<rect x="560" y="820" width="480" height="58" rx="18" fill="rgba(255,255,255,0.22)"/>' +
    '<rect x="590" y="832" width="34" height="34" rx="8" fill="#e8b84a"/><rect x="644" y="832" width="34" height="34" rx="8" fill="#5b9bd5"/>' +
    '<rect x="698" y="832" width="34" height="34" rx="8" fill="#e0605a"/><rect x="752" y="832" width="34" height="34" rx="8" fill="#ffffff"/>');
  // the document camera looking straight down at a worksheet on a desk, with a pen
  const desk = '<rect width="1600" height="900" fill="#5d432c"/><circle cx="200" cy="120" r="700" fill="#6f5137" opacity="0.7"/>';
  const pen = '<g transform="rotate(-28 1330 700)"><rect x="1150" y="690" width="360" height="22" rx="10" fill="#1f3c88"/>' +
    '<path d="M1510 690 l40 11 l-40 11 z" fill="#d8c9a3"/></g>';
  const doccam = svg(desk +
    '<g transform="rotate(-3 800 450)"><rect x="330" y="40" width="940" height="840" fill="#fbf8f1"/>' +
    t(400, 130, 40, "#1d2733", "bold", "Problem Set 4") + '<rect x="400" y="150" width="800" height="3" fill="#b9b2a4"/>' +
    t(400, 220, 30, "#1d2733", "", "1. Solve for x:   3x + 7 = 22") +
    ink(440, 285, 300) + ink(440, 345, 220) + ink(440, 405, 260, "#a12b2b") +
    t(400, 500, 30, "#1d2733", "", "2. Sketch y = x² for -3 ≤ x ≤ 3") +
    '<path d="M560 580 Q 760 1020 960 580" fill="none" stroke="#24324a" stroke-width="5"/>' +   // y = x squared: opens upward, lowest on the axis
    '<path d="M520 800 H1000 M760 560 V820" stroke="#8f867a" stroke-width="3"/></g>' + pen);
  const doccam2 = svg(desk +
    '<g transform="rotate(2 800 450)"><rect x="300" y="50" width="1000" height="800" fill="#f7f4ec"/>' +
    t(370, 140, 38, "#1d2733", "bold", "Chapter 7  Cell Structure") +
    '<rect x="370" y="180" width="380" height="16" rx="3" fill="#b9b2a4"/><rect x="370" y="220" width="420" height="16" rx="3" fill="#b9b2a4"/>' +
    '<rect x="370" y="260" width="360" height="16" rx="3" fill="#b9b2a4"/><rect x="370" y="300" width="400" height="16" rx="3" fill="#b9b2a4"/>' +
    '<ellipse cx="1040" cy="420" rx="200" ry="150" fill="#e7f0d8" stroke="#6b8f4e" stroke-width="6"/>' +
    '<circle cx="1000" cy="400" r="52" fill="#c9b3d9" stroke="#7a5a96" stroke-width="5"/>' +
    '<rect x="370" y="520" width="860" height="16" rx="3" fill="#b9b2a4"/><rect x="370" y="560" width="800" height="16" rx="3" fill="#b9b2a4"/>' +
    '<rect x="370" y="600" width="840" height="16" rx="3" fill="#b9b2a4"/><rect x="370" y="640" width="600" height="16" rx="3" fill="#b9b2a4"/></g>' + pen);
  return { slide, browser, doccam, doccam2 };
})();

class BlurayDeck {
  constructor(onChange) {
    this.state = "menu";       // menu | playing | paused | stopped | ejected
    this.onChange = onChange || (() => {});
  }
  command(cmd) {
    const s = this.state;
    if (cmd === "play") this.state = "playing";
    else if (cmd === "pause") this.state = s === "playing" ? "paused" : s;
    else if (cmd === "stop") this.state = "stopped";
    else if (cmd === "menu") this.state = "menu";
    else if (cmd === "eject") this.state = this.state === "ejected" ? "menu" : "ejected";
    else if (["up", "down", "left", "right", "enter", "ff", "rew", "skipb", "skipf"].includes(cmd)) {
      if (s === "menu" && cmd === "enter") this.state = "playing";
    }
    if (this.state !== s) this.onChange(this.state);
  }
}

class Room {
  constructor() {
    this.deck = new BlurayDeck(() => this.repaintAll());
    this.laptopConnected = { hdmi: true, usbc: true };
    this._panes = [];   // {el, kind, getRoute}
  }

  sceneFor(route) {
    // returns HTML for the routed content, or null for "no source"
    if (!route) return null;
    if (route === 1) {
      const st = this.deck.state;
      const body = {
        menu: "<div class='bd-menu'><div class='bd-title'>BLU-RAY</div><div class='bd-item sel'>▶ Play Movie</div><div class='bd-item'>Scenes</div><div class='bd-item'>Settings</div></div>",
        playing: "<div class='bd-movie'><div class='bd-film'></div><div class='bd-osd'>▶ 0:42:17</div></div>",
        paused: "<div class='bd-movie'><div class='bd-film dim'></div><div class='bd-osd'>❚❚ PAUSED</div></div>",
        stopped: "<div class='bd-black'><div class='bd-osd'>■ STOPPED</div></div>",
        ejected: "<div class='bd-black'><div class='bd-osd'>NO DISC</div></div>",
      }[st];
      return "<div class='scene scene-bd'>" + body + "</div>";
    }
    // Owner 2026-10-01: a preview window shows the source's own picture and nothing else. The real
    // system puts no source name on it, so these scenes carry none (they used to, bottom right).
    if (route === 2) return "<div class='scene scene-doccam'>" + SCENE_SVG.doccam + "</div>";
    // DMPS input 7: the second doc cam in the two-doc-cam room: a different page under it
    if (route === 7) return "<div class='scene scene-doccam'>" + SCENE_SVG.doccam2 + "</div>";
    // The desktop preview is the same lock-screen wallpaper the first HTML mockup used
    // (panel-ui/dif/Wallpapers/DesktopLockScreen.png, cover-cropped to the 928x522 pane).
    // The drawn slide it replaced read as fake; owner 2026-09-14.
    if (route === 3) return "<div class='scene scene-pc'><img src='" + imgUrl("images/wall_desktop_928x522.png") + "' style='position:absolute;inset:0;width:100%;height:100%;object-fit:cover' draggable='false'></div>";
    if (route === 4) return "<div class='scene scene-air'><div class='air-head'>Share your screen</div><div class='air-code'>Code <b>4821</b></div><div class='air-sub'>practice copy, not a real room</div></div>";
    // the laptop on HDMI is presenting (a full-screen lecture slide); the one on USB-C shows its
    // desktop with a video in a browser, so the two laptops never look alike
    // A laptop with no cable is plain black, as the panel's preview window is with nothing on it
    // (InactiveState black, no text). Nothing in the room can tell which cable is missing, so the
    // mockup does not say either (owner, 2026-10-01; the old "Connect the USB-C cable" gave the
    // laptop task's answer away). The recorder's content view uses this too, where a real Pearl
    // shows its own per-input No-signal picture (DEVICE_FACTS.md, the slate row of 2026-10-01);
    // that picture is not modelled.
    if (route === 5) return this.laptopConnected.hdmi
      ? "<div class='scene scene-laptop'>" + SCENE_SVG.slide + "</div>"
      : "<div class='scene scene-nosig'></div>";
    if (route === 6) return this.laptopConnected.usbc
      ? "<div class='scene scene-laptop usbc'>" + SCENE_SVG.browser + "</div>"
      : "<div class='scene scene-nosig'></div>";
    return null;
  }

  // What a recorded channel puts out while its class is paused at the Pearl: the device's built-in
  // slate, "EVENT PAUSED" in white on blue (C:\vtlab\pearl_pause_slate_ch2_2026-09-29.png). It cannot be
  // changed on a Kaltura Pearl (DEVICE_FACTS), so this replaces the old soft hold's own slate.
  slateScene() {
    return "<div class='scene scene-evpaused'><span>EVENT PAUSED</span></div>";
  }

  // Nothing routed to the recorder. Owner 2026-09-17: the CONTENT artwork was fine as it was, so
  // this is a plain panel and NOT the camera art it used to borrow.
  noContentScene() {
    return "<div class='scene scene-splash'><span class='splash-text'>NO CONTENT</span></div>";
  }

  // The camera channel. The artwork is the owner's, ported VERBATIM from the earlier mock
  // (panel-ui/dif/dif.html lines 2568-2612: lcSceneInstructorArt, lcSceneStudentsArt, and the
  // BOTH layout as the two of them at half scale either side of a divider).
  cameraScene(label, layoutN) {
    const instructor =
      '<rect x="0" y="0" width="360" height="202" fill="#141b22"/>' +
      '<rect x="0" y="150" width="360" height="52" fill="#0e1319"/>' +
      '<rect x="28" y="22" width="148" height="90" rx="4" fill="#1d2731" stroke="rgba(255,255,255,0.12)"/>' +
      '<rect x="44" y="38" width="72" height="9" rx="3" fill="rgba(206,184,136,0.4)"/>' +
      '<rect x="44" y="58" width="104" height="6" rx="3" fill="rgba(255,255,255,0.18)"/>' +
      '<rect x="44" y="72" width="88" height="6" rx="3" fill="rgba(255,255,255,0.13)"/>' +
      '<circle cx="250" cy="68" r="16" fill="#d8c9a3"/>' +
      '<path d="M218 124 c6 -38 58 -38 64 0 z" fill="#3f4d5c"/>' +
      '<path d="M212 127 h78 l9 62 h-96 z" fill="#2a2216"/>' +
      '<rect x="204" y="118" width="94" height="9" rx="3" fill="#4a3b26"/>';
    const students =
      '<rect x="0" y="0" width="360" height="202" fill="#141b22"/>' +
      '<rect x="0" y="150" width="360" height="52" fill="#0e1319"/>' +
      '<path d="M51 112 c2 -11 28 -11 30 0 z" fill="#38424d"/>' +
      '<circle cx="66" cy="98" r="10" fill="#c9b892"/>' +
      '<path d="M133 112 c2 -11 28 -11 30 0 z" fill="#333c46"/>' +
      '<circle cx="148" cy="98" r="10" fill="#b7a98c"/>' +
      '<path d="M215 112 c2 -11 28 -11 30 0 z" fill="#3b4550"/>' +
      '<circle cx="230" cy="98" r="10" fill="#d0c1a0"/>' +
      '<path d="M297 112 c2 -11 28 -11 30 0 z" fill="#353e49"/>' +
      '<circle cx="312" cy="98" r="10" fill="#c2b394"/>' +
      '<rect x="26" y="112" width="308" height="7" rx="3" fill="#222b34"/>' +
      '<path d="M79 164 c3 -15 39 -15 42 0 z" fill="#3d4854"/>' +
      '<circle cx="100" cy="144" r="14" fill="#cdbc96"/>' +
      '<path d="M174 164 c3 -15 39 -15 42 0 z" fill="#37414c"/>' +
      '<circle cx="195" cy="144" r="14" fill="#baa88a"/>' +
      '<path d="M269 164 c3 -15 39 -15 42 0 z" fill="#404b58"/>' +
      '<circle cx="290" cy="144" r="14" fill="#d3c4a2"/>' +
      '<rect x="10" y="164" width="340" height="8" rx="3" fill="#26303a"/>';
    const both =
      '<g transform="translate(0 50.5) scale(0.5)">' + instructor + '</g>' +
      '<g transform="translate(180 50.5) scale(0.5)">' + students + '</g>' +
      '<rect x="179" y="0" width="2" height="202" fill="rgba(255,255,255,0.28)"/>';
    const art = layoutN === 2 ? students : layoutN === 3 ? both : instructor;
    return "<div class='scene scene-cam'>" +
      '<svg class="cam-scene" viewBox="0 0 360 202" preserveAspectRatio="none" aria-hidden="true">' +
      '<rect x="0" y="0" width="360" height="202" fill="#10161c"/>' + art + "</svg></div>";
    // no caption: the recorder's camera stream carries none, as the content pictures carry no source
    // name (owner 2026-10-01; audit 2026-10-01). `label` is kept for callers.
  }

  // register a pane; getContent returns {html} or null -> inactive black
  bind(el, getContent) {
    this._panes.push({ el, getContent });
    this.paint({ el, getContent });
  }
  paint(p) {
    const c = p.getContent();
    p.el.innerHTML = c || "";
    p.el.classList.toggle("inactive", !c);
  }
  repaintAll() { this._panes.forEach(p => this.paint(p)); }
}

window.Room = Room;
