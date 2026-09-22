// The room content simulation: what each routed source SHOWS. The panel's
// preview windows are real HDMI windows on the device; here each route renders
// a small DOM scene so a tester can tell desktop / doc cam / laptop / Blu-ray
// apart at a glance, and so "preview the desktop" is a completable task.
// Route numbers are the DMPS input numbers the program latches (H=73):
//   1 Blu-ray, 2 Document Camera, 3 Desktop PC, 4 Wireless, 5 Laptop HDMI, 6 Laptop USB-C
"use strict";

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
    if (route === 2) return "<div class='scene scene-doccam'><div class='dc-paper'><div class='dc-line w80'></div><div class='dc-line w60'></div><div class='dc-line w70'></div><div class='dc-fig'></div><div class='dc-line w50'></div></div><div class='dc-tag'>DOC CAM</div></div>";
    // DMPS input 7: the second doc cam in the two-doc-cam room. Same art, its own tag.
    if (route === 7) return "<div class='scene scene-doccam'><div class='dc-paper'><div class='dc-line w80'></div><div class='dc-line w60'></div><div class='dc-line w70'></div><div class='dc-fig'></div><div class='dc-line w50'></div></div><div class='dc-tag'>DOC CAM 2</div></div>";
    // The desktop preview is the same lock-screen wallpaper the first HTML mockup used
    // (panel-ui/dif/Wallpapers/DesktopLockScreen.png, cover-cropped to the 928x522 pane).
    // The drawn slide it replaced read as fake; owner 2026-09-14.
    if (route === 3) return "<div class='scene scene-pc'><img src='" + imgUrl("images/wall_desktop_928x522.png") + "' style='position:absolute;inset:0;width:100%;height:100%;object-fit:cover' draggable='false'></div>";
    if (route === 4) return "<div class='scene scene-air'><div class='air-logo'>WIRELESS</div><div class='air-code'>Share code: <b>4821</b></div><div class='air-sub'>practice copy, not a real room</div></div>";
    if (route === 5) return this.laptopConnected.hdmi
      ? "<div class='scene scene-laptop'><div class='lt-desktop'><div class='lt-dock'></div><div class='lt-window'>My Presentation</div></div><div class='lt-tag'>LAPTOP HDMI</div></div>"
      : "<div class='scene scene-nosig'>NO SIGNAL<br><span>Connect the HDMI cable</span></div>";
    if (route === 6) return this.laptopConnected.usbc
      ? "<div class='scene scene-laptop usbc'><div class='lt-desktop'><div class='lt-dock'></div><div class='lt-window'>Music Player ▶</div></div><div class='lt-tag'>LAPTOP USB-C</div></div>"
      : "<div class='scene scene-nosig'>NO SIGNAL<br><span>Connect the USB-C cable</span></div>";
    return null;
  }

  // The Pearl's privacy slate while a recording is held. Owner's own design, ported from the
  // earlier mock (panel-ui/dif/dif.html, .lc-preview-splash): the pause glyph over the words.
  slateScene() {
    return "<div class='scene scene-splash'><span class='splash-glyph'>&#9208;</span>" +
           "<span class='splash-text'>RECORDING PAUSED</span></div>";
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
      '<rect x="0" y="0" width="360" height="202" fill="#10161c"/>' + art + "</svg>" +
      "<div class='cam-tag'>" + (label || "CAMERA") + "</div></div>";
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
