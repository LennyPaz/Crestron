// Main-page help, iteration 6. MULTI-PAGE, EVERY STEP CARRIES A PICTURE.
//
// Owner direction so far:
//   2026-09-01a  match the LC page's colours; the first page is how to use the
//                system, POWER ON > SELECT INPUT > PREVIEW > PROJECT, at the top,
//                centred, with icons; then the specific things people ring up
//                about, each with its own steps
//   2026-09-01b  "I want icons/imagery for everything"
//
// So every single step on every page carries art. Where the step is about a
// control that exists on the glass, the art is that control's REAL face image
// out of the compiled panel, which is the strongest kind of picture there is:
// the person is looking for the thing they are about to press. Only three ideas
// have no control to photograph, and those are drawn here:
//
//   drawKeys       the laptop's own Windows-key-and-P, which is not on the panel
//   drawLaptopVol  the laptop's own volume, likewise
//   drawMirror     display mirroring, which no panel button does
//
// Each of those bakes to one flat Image Object when this goes on the panel, the
// same way LC_PopHelp bakes help_confirm_v3.png and its three siblings.
//
// COPY comes from help-concepts/CONTENT_PLAN.md, whose rule is that a step says
// what you should SEE if it worked, not just what to press, and that each page
// ends either with reassurance or with an exit line worded to shorten the call.
//
// CAPTIONS are the real ones, checked against spec_bluray.json and
// docs/main_page_join_allocation.md. Three the first cut had wrong:
//   "HDMI or USB-C"  -> LAPTOP HDMI, LAPTOP USB-C
//   "WIRELESS"       -> WIRELESS STREAM
//   "MUTE MAIN is red, press it to unmute" -> while muted it reads UNMUTE MAIN
//
// COLOURS measured off panel-ui/dif/styles.css, not guessed:
//   card --bg-app #782f40 -> #572932 · border --c-gold-500 #ceb888
//   scrim --surface-overlay rgba(16,24,32,.85) · tiles --surface-card rgba(16,24,32,.5)
// GEOMETRY is LC_PopHelp's: scrim 0,0 1920x1080 · card 336,79 1248x921 ·
// content column 376..1544 · CLOSE 796,864 328x96.
//
// On the real panel HELP (d25) presses and lands nowhere. Wiring it here is a
// declared divergence: this popup is the design under consideration.
"use strict";

// NO ROOM NUMBER anywhere in this file. Owner ruling 2026-09-02: the same code is
// stamped into every room, so a room name in the copy is one more thing to update per
// room and easy to miss. Support asks which room; the panel does not answer for them.
const HELP_PHONE = "(555) 555-0100";

const H_GOLD = "#ceb888";
const H_INK = "#101820";
const H_DIM = "rgba(255,255,255,.72)";
const H_TILE = "rgba(16,24,32,.5)";        // --surface-card
const H_TILE_HOT = "rgba(206,184,136,.18)";

const HG = {
  card: [336, 79, 1248, 921],
  x: 376, w: 1168,
  // BACK bottom-left and CLOSE bottom-right, same size, same face size, so the two
  // nav buttons mirror each other (owner 2026-09-02). 1544 - 328 = 1216.
  close: [1216, 864, 328, 96],
  back: [376, 864, 328, 96],
};

// real faces, by the name they carry on the glass
const F = {
  powerOn:  { img: "images/icpwron_white_186x130.png", w: 186, h: 130 },
  powerOff: { img: "images/icpwroff_white_186x130.png", w: 186, h: 130 },
  pc:       { img: "images/icsrcpc_white_176x100.png", w: 176, h: 100 },
  hdmi:     { img: "images/icsrchdmi_white_176x100.png", w: 176, h: 100 },
  usbc:     { img: "images/icsrcusbc_white_176x100.png", w: 176, h: 100 },
  wireless: { img: "images/icsrcwifi_white_176x100.png", w: 176, h: 100 },
  // The screen controls come in TWO families and the captions are NOT the same.
  // Read off the artwork 2026-09-01: a one-projector room says PROJECT, VIDEO MUTE
  // and UNMUTE VIDEO; a two-projector room says PROJECT LEFT + RIGHT, VIDEO MUTE
  // LEFT + RIGHT and UNMUTE LEFT + RIGHT, on differently shaped 150x114 faces.
  // Stamping the one-projector art into a two-projector room would name three
  // buttons that do not exist there. LEFT PREVIEW is the same in both.
  preview:  { img: "images/ic1prevl_white_190x114.png", w: 190, h: 114,
              two: { img: "images/ic2prevl_white_150x114.png", w: 150, h: 114 } },
  project:  { img: "images/ic1proj_white_190x114.png", w: 190, h: 114,
              two: { img: "images/ic2projb_white_150x114.png", w: 150, h: 114 } },
  hide:     { img: "images/ic1hide_white_190x114.png", w: 190, h: 114,
              two: { img: "images/ic2hideb_white_150x114.png", w: 150, h: 114 } },
  hideRed:  { img: "images/ic1hide_red_190x114.png", w: 190, h: 114,
              two: { img: "images/ic2hideb_red_150x114.png", w: 150, h: 114 } },
  // These four faces are BLANK plates on their own: the panel draws the caption
  // as a text label over the image rather than baking it in, so the help art has
  // to draw it too or the person sees an empty white box. Size and colour are the
  // real ones out of spec_bluray.json.
  muteRed:  { img: "images/mute_red_86x60.png", w: 86, h: 60,
              label: "UNMUTE MAIN", size: 15, colour: "#ffffff" },
  mute:     { img: "images/mute_white_86x60.png", w: 86, h: 60,
              label: "MUTE MIC", size: 15, colour: "#101820" },
  checkRec: { img: "images/screenctl9_white_150x114.png", w: 150, h: 114,
              label: "CHECK RECORDER", size: 21, colour: "#101820" },
  preset1:  { img: "images/icpre1_white_186x100.png", w: 186, h: 100 },
  preset2:  { img: "images/icpre2_white_186x100.png", w: 186, h: 100 },
  camView:  { img: "images/camview_white_121x96.png", w: 121, h: 96,
              label: "INSTRUCTOR", size: 13, colour: "#101820" },
  // The cluster drawings used to name these files as raw strings with their
  // captions typed inline, which put them OUTSIDE check_help_faces.py: deleting a
  // caption there would have shipped a blank plate green, on exactly the images
  // the guard exists for. They live in F now so the guard covers them.
  muteMain: { img: "images/mute_white_86x60.png", w: 86, h: 60,
              label: "MUTE MAIN", size: 15, colour: "#101820" },
  viewBoth: { img: "images/camview_white_121x96.png", w: 121, h: 96,
              label: "BOTH", size: 13, colour: "#101820" },
  viewStud: { img: "images/camview_r_white_122x96.png", w: 122, h: 96,
              label: "STUDENTS", size: 13, colour: "#101820" },
  lc:       { img: "images/iclc_white_130x84.png", w: 130, h: 84 },
  // caption baked into the art; the live source name under it is serial 17
  listen:   { img: "images/ic2audio_white_150x114.png", w: 150, h: 114 },
  confirm:  { img: "images/confirm_gold_400x136.png", w: 400, h: 136,
              label: "CONFIRM", size: 36, colour: "#101820" },
  done:     { img: "images/check_teal_96.png", w: 96, h: 96, icon: true },
  // CLOSE and BACK are captioned buttons like any other: the panel draws their
  // text over the plate. They sat outside this table until the guard's stray
  // sweep pointed at them, which is the sweep doing its job.
  closeBtn: { img: "images/close_gold_400x96.png", w: 400, h: 96,
              label: "CLOSE", size: 40, colour: "#101820" },
  backBtn:  { img: "images/hatch_ghost_240x64.png", w: 240, h: 64,
              label: "BACK", size: 40, colour: "#ceb888" },
};

// ---------------------------------------------------------------- home flow
const HELP_FLOW = [
  { n: 1, name: "POWER ON",     face: F.powerOn, cap: "Turns the {PROJECTOR} on." },
  { n: 2, name: "INPUT SOURCES", face: F.pc,     cap: "Pick what to show." },
  { n: 3, name: "LEFT PREVIEW",  face: F.preview, cap: "See it here before the class does." },
  { n: 4, name: "{PROJECT}",    face: F.project, cap: "Show it on the {PROJECTOR}." },
];

// ------------------------------------------------------------- topic pages
// `art` is either { faces: [...] } (real control art, up to two side by side)
// or { draw: "..." } for the three ideas the panel has no button for.
// `exit` is the honest last row: the symptom in our words, so the call is short.
const HELP_TOPICS = [
  {
    id: "noscreen", tile: "Nothing on the projector",
    title: "NOTHING ON THE PROJECTOR",
    hot: p => p.powerOn && !p.hidden && !p.routes.projL && !p.routes.projR,
    steps: [
      { art: { faces: [F.powerOn] },
        t: "{Projector} not on? Press POWER ON. Warm-up takes about half a minute." },
      { art: { faces: [F.pc] },
        t: "Pick what you want to show under INPUT SOURCES." },
      { art: { faces: [F.project] },
        t: "Press {PROJECT}." },
      { art: { faces: [F.hide, F.hideRed] },
        t: "Under SCREEN CONTROLS, a button reading {UNMUTE} means the picture is hidden. Press {UNMUTE}." },
    ],
    exit: true,
  },
  {
    id: "laptop", tile: "My laptop is not showing up",
    title: "MY LAPTOP IS NOT SHOWING UP",
    steps: [
      { art: { faces: [F.hdmi, F.usbc] },
        t: "Press the button for the cable you used: LAPTOP HDMI or LAPTOP USB-C." },
      { art: { faces: [F.preview] },
        t: "Press LEFT PREVIEW. If the laptop shows in the preview window on this panel, press {PROJECT}. If the preview stays black, the laptop is not sending a picture: keep going." },
      { art: { draw: "keys" },
        t: "On Windows, press the Windows key and P together, then choose Duplicate." },
      { art: { draw: "mirror" },
        t: "On a Mac: System Settings, then Displays, click the second display, set Use as to Mirror." },
      { art: { faces: [F.wireless] },
        t: "Still nothing? Push the cable firmly in at both ends. Or press WIRELESS STREAM, then LEFT PREVIEW, and follow the instructions shown in the preview." },
    ],
    exit: true,
  },
  {
    // CLUSTER, not rows. Every one of these points is about the SAME thing: the
    // audio card on the right of the panel. Drawing it four times down a column,
    // once per row, was the layout fighting the content. It is drawn once, whole,
    // at the size it really is, and the points sit beside it.
    //
    // The meter step that used to lead this page has been DELETED, not moved here.
    // It said "watch the green MAIN meter, if it moves the room has your sound",
    // and that is wrong: the meter is on analog 6, fed by PearlRest AudioLevel_Fb
    // and preview-gated (main_page_join_allocation.md section 11, d141 to d144).
    // It reports what the RECORDER hears, never the room speakers, and it is
    // invisible unless a preview is open. It was DELETED outright, not moved: an
    // earlier version of this comment said the fact now lives on the recording
    // page, and it does not. (Fable, cold review 2026-09-01.)
    id: "nosound", tile: "There is no sound",
    title: "THERE IS NO SOUND",
    layout: "cluster", cluster: "audio",
    points: [
      { t: "Drag the MAIN slider up. MAIN is the room speakers." },
      { t: "If the button under MAIN reads UNMUTE MAIN, press UNMUTE MAIN." },
      { t: "Use MAIN, not MIC. MIC is the microphones the recording hears." },
      { art: { faces: [F.project] },
        // one {PROJECT} only: in a two-projector room the token expands to
        // "PROJECT LEFT + RIGHT", and twice in one sentence ran it to three lines
        t: "Sound plays only for what you pressed {PROJECT} on. Previewing is silent. If you switched sources, press {PROJECT} again." },
      { art: { faces: [F.listen] }, when: () => HELP_LISTEN,
        t: "LISTEN TO plays the sound of the selected source without putting it on the {PROJECTOR}. The name under the button shows which source is playing." },
      { art: { draw: "laptopvol" },
        t: "Still nothing? Turn the laptop volume up and set its sound output to the HDMI or USB-C connection, not the laptop speakers." },
    ],
    exit: true,
  },
  {
    id: "dark", tile: "The projector went black",
    title: "THE PROJECTOR WENT BLACK",
    hot: p => p.hidden,
    // NOT a pulse on join 31. d31 is the hide TOGGLE (program.js hidePress,
    // "this.hidden = !this.hidden"), and this hardware double-fires taps: one tap
    // would unhide and immediately re-hide, close the popup, and leave the screen
    // black with no sign anything happened. Same failure that already bit the LC
    // pause button and the END popup, and this file guards its own HELP press for
    // exactly that reason. So the button drives an ABSOLUTE show.
    //
    // TRANSFER NOTE, corrected 2026-09-01: an earlier version of this comment said
    // the panel has no absolute unhide join and that one must be added to the
    // module. Both halves were wrong. The allocation already carries d89 SHOW LEFT
    // and d97 SHOW RIGHT as absolute-off presses (section 5.3), and names d26/d28
    // as the free neighbours for the combined pair; this uses d26. And "module"
    // means PearlRest.usp in house language, which is the recorder: hiding the
    // picture is Epson and program logic, nothing to do with it.
    act: { label: "SHOW PICTURE NOW", join: 26, when: p => p.hidden },
    steps: [
      { art: { faces: [F.hideRed] },
        t: "Under SCREEN CONTROLS, a button reading {UNMUTE} means the picture is hidden. Press {UNMUTE}." },
      { art: { faces: [F.powerOn] },
        t: "{Projector} not on? Press POWER ON. Warm-up takes about half a minute." },
      { art: { faces: [F.project] },
        t: "Still black and no button reads {UNMUTE}? Wake the laptop or room PC by pressing a key, check its button is still selected under INPUT SOURCES, then press {PROJECT} again." },
      { art: { faces: [F.lc] },
        t: "Hiding the picture does not stop a recording." },
    ],
    exit: true,
  },
  {
    // CLUSTER: the presets and the three view buttons are one card on the glass,
    // and the whole page is about telling them apart. Showing the card once, laid
    // out as it really is, does that better than three rows of loose faces.
    id: "camera", tile: "I cannot see the camera",
    title: "I CANNOT SEE THE CAMERA",
    layout: "cluster", cluster: "camera",
    // Owner correction 2026-09-01: "screen can see camera with check recorder".
    // He is right and the old point 1 contradicted the old point 4. CHECK RECORDER
    // is d67, which calls previewOpenReq(), and d68 then shows the preview band on
    // the panel (program.js H=175 Band_Preview_Visible). So the camera IS viewable,
    // just never on the projector. Leading with that answers the tile's question
    // instead of denying it.
    points: [
      { art: { faces: [F.checkRec] },
        t: "To see the camera, press CHECK RECORDER. What the recorder sees appears on this panel for one minute." },
      { t: "The camera never goes to the {PROJECTOR} on its own. The class sees it only through the room PC, for example in a Zoom call." },
      { t: "PRESET 1 and PRESET 2 move the camera to a saved position." },
      { t: "INSTRUCTOR, BOTH and STUDENTS choose the camera view for the recording and for Zoom on the room PC." },
    ],
    exit: true,
  },
  {
    id: "recording", tile: "Is my class being recorded?",
    title: "IS MY CLASS BEING RECORDED?",
    // SAFETY. This page used to end "Your recording uploads to My Media on its own.
    // You do not have to do anything", and never mentioned CONFIRM. That is the
    // silent-lecture-loss failure stated in reverse: an opt-in event that expires
    // UNCONFIRMED becomes "skipped", never "finished", and records NOTHING
    // (DEVICE_FACTS.md section 9). The panel's own LC page already says "They start
    // only after you press CONFIRM"; the main-page help contradicted it.
    // "START" was also not a caption on any control. The real ones are CONFIRM,
    // START NOW, NEW RECORDING, PAUSE, ADD 5 MINUTES and END RECORDING.
    steps: [
      { art: { faces: [F.lc] },
        t: "The LECTURE CAPTURE card at the bottom left says what the recorder is doing. If it says RECORDING, you are being recorded. Press the card to open Lecture Capture." },
      { art: { faces: [F.confirm] },
        // Codex, 2026-09-01: the first wording said a scheduled class starts ONLY
        // after CONFIRM, which is too absolute. pearl.js pumpTick starts an event
        // when "!e.optIn || e.confirmed", so a room without opt-in records on its
        // own. Codex's fix said "an opt-in scheduled class", but opt-in is OUR
        // word and an instructor has no idea whether their room has it. Wording it
        // off what the card actually shows is true either way: a room without
        // opt-in never asks, so the sentence never applies there.
        t: "If the card says NEEDS YOUR OK, press the card, then press CONFIRM on the page that opens. Until someone does, that class is not recorded." },
      { art: { faces: [F.powerOff, F.lc] },
        t: "Turning the room off does not stop a recording. To end one early, press the card, press END RECORDING, then press END RECORDING again when it asks." },
      { art: { faces: [F.done] },
        t: "Once a recording ends it uploads to My Media in Canvas on its own." },
    ],
    // no phone here: the card's states are finite and the Lecture Capture page
    // explains every one of them (Codex, 2026-09-02)
    exit: "Card says something not covered here? Press the card. Lecture Capture explains what it means.",
  },
];

// hpx() names itself so it cannot collide with renderer.js's px(); imgUrl() is
// renderer.js's, reused so asset lookup has exactly one implementation.
// Control names written in the copy as tokens, resolved per room at render time
// for the same reason the faces are: the caption on the glass is what the person
// is hunting for, and it differs between the two families.
const NAMES = {
  one: { PROJECT: "PROJECT", VIDEOMUTE: "VIDEO MUTE", UNMUTE: "UNMUTE VIDEO",
         PROJECTOR: "projector", Projector: "Projector" },
  two: { PROJECT: "PROJECT LEFT + RIGHT", VIDEOMUTE: "VIDEO MUTE LEFT + RIGHT",
         UNMUTE: "UNMUTE LEFT + RIGHT", PROJECTOR: "projectors", Projector: "Projectors" },
};
let HELP_TWO = false;                       // set from the room variant on open
// LISTEN is gated by its OWN flag, d56 "one room only" (program.js), NOT by the
// projector count. Assuming it rode with two-projector rooms was wrong.
let HELP_LISTEN = false;
const nameOf = () => NAMES[HELP_TWO ? "two" : "one"];
const say = t => t.replace(/\{(\w+)\}/g, (m, k) => nameOf()[k] || m);   // {Projector} too
const faceOf = f => (HELP_TWO && f.two) ? Object.assign({}, f, f.two) : f;

const hpx = v => v + "px";
function hbox(parent, x, y, w, h, css, text) {
  const d = document.createElement("div");
  Object.assign(d.style, { position: "absolute", left: hpx(x), top: hpx(y), width: hpx(w) },
                h == null ? {} : { height: hpx(h) }, css || {});
  if (text != null) d.textContent = text;
  parent.appendChild(d);
  return d;
}
function himg(parent, x, y, w, h, key) {
  const i = document.createElement("img");
  i.src = imgUrl(key);
  Object.assign(i.style, { position: "absolute", left: hpx(x), top: hpx(y),
                           width: hpx(w), height: hpx(h) });
  parent.appendChild(i);
  return i;
}

// ------------------------------------------------------------------- art
// EVERY FACE IS DRAWN AT THE SAME WIDTH. That is the owner's own ruling from the
// LC help popup, where four faces of two different widths were replaced by four
// at a uniform 240px ("All four faces are UNIFORM 15rem", dif.html, 2026-07-23).
// Width is the axis that reads as "size" in a stacked column, so the buttons line
// up down the page and no step looks more important than another. Height then
// follows each face's own aspect, because stretching a real control's artwork to
// a common box would make the picture a lie about the button.
//
// Two-face rows are how a step names a pair (LAPTOP HDMI with LAPTOP USB-C) or a
// consequence (POWER OFF does not touch LECTURE CAPTURE) without inventing a
// diagram. Those two share the same width as each other.
const FACE_W = 136;              // single-face rows
const FACE_W2 = 98;              // each of a pair
function drawFaces(parent, x, y, w, h, faces) {
  // resolve each face to this room's control family BEFORE measuring, or a
  // two-projector room gets two-projector words over one-projector artwork
  faces = faces.map(faceOf);
  const GAP = 12;
  const targetW = faces.length > 1 ? FACE_W2 : FACE_W;
  let total = targetW * faces.length + GAP * (faces.length - 1);
  if (total > w) total = w;      // never overrun the slot
  const unit = (total - GAP * (faces.length - 1)) / faces.length;
  let cx = x + (w - total) / 2;
  for (const f of faces) {
    // An icon is not a control, so it is not held to the button width: forcing a
    // square tick to 136 wide would make it the biggest thing on the page.
    let fw = f.icon ? Math.round(h * 0.9) : Math.round(unit);
    let fh = Math.round(f.h * (fw / f.w));
    if (fh > h) { fh = Math.round(h); fw = Math.round(f.w * (fh / f.h)); }
    const fx = Math.round(cx + (unit - fw) / 2), fy = Math.round(y + (h - fh) / 2);
    himg(parent, fx, fy, fw, fh, f.img);
    if (f.label) {
      hbox(parent, fx, fy, fw, fh, {
        color: f.colour, font: "bold " + Math.max(11, Math.round(f.size * (fw / f.w))) + "px Arial",
        display: "flex", alignItems: "center", justifyContent: "center",
        textAlign: "center", lineHeight: "1.15", padding: "0 4px", boxSizing: "border-box",
      }, f.label);
    }
    cx += unit + GAP;
  }
}

// The laptop's own display shortcut. Nothing on the panel does this, so it is
// drawn as two keycaps rather than pointed at a control that does not exist.
function drawKeys(parent, x, y, w, h) {
  const K = 62, GAP = 26, total = K * 2 + GAP, top = Math.round(y + (h - K) / 2);
  let cx = Math.round(x + (w - total) / 2);
  const keycap = () => hbox(parent, cx, top, K, K, {
    background: "#fff", borderRadius: "8px", boxShadow: "0 3px 0 rgba(0,0,0,.45)",
  });

  // The Windows mark, drawn as its four panes rather than borrowed from a font.
  // The glyph this used to use (U+229E) is a maths symbol, renders differently on
  // every machine, and on the panel would be whatever Arial happens to carry.
  // Four divs are exact, and they bake to one flat image like the rest of the art.
  keycap();
  const P = 12, PANE = (K - P * 2 - 4) / 2;
  for (let i = 0; i < 4; i++) {
    hbox(parent, cx + P + (i % 2) * (PANE + 4), top + P + ((i / 2) | 0) * (PANE + 4),
         Math.round(PANE), Math.round(PANE), { background: H_INK, borderRadius: "1px" });
  }
  cx += K;

  hbox(parent, cx, top, GAP, K, {
    color: H_GOLD, font: "bold 26px Arial", textAlign: "center", lineHeight: hpx(K),
  }, "+");
  cx += GAP;

  keycap();
  hbox(parent, cx, top, K, K, {
    color: H_INK, font: "bold 30px Arial", textAlign: "center", lineHeight: hpx(K),
  }, "P");
}

// The laptop's own volume. Like the keycaps, this is deliberately NOT a panel
// button: pointing at one would tell somebody to press a control that cannot fix
// their problem.
function drawLaptopVol(parent, x, y, w, h) {
  const SW = 128, SH = 72, X = Math.round(x + (w - SW) / 2), Y = Math.round(y + (h - SH - 10) / 2);
  hbox(parent, X, Y, SW, SH, {
    background: "#fff", border: "3px solid " + H_INK, borderRadius: "6px", boxSizing: "border-box",
  });
  hbox(parent, X - 12, Y + SH + 2, SW + 24, 8, { background: "#fff", borderRadius: "0 0 5px 5px" });
  // speaker cone
  hbox(parent, X + 34, Y + 26, 14, 20, { background: H_INK });
  hbox(parent, X + 44, Y + 16, 20, 40, {
    background: H_INK, clipPath: "polygon(100% 0, 100% 100%, 0 75%, 0 25%)",
  });
  // two sound arcs
  [0, 1].forEach(i => hbox(parent, X + 70 + i * 12, Y + 24 - i * 5, 12 + i * 6, 24 + i * 10, {
    border: "3px solid " + H_INK, borderRadius: "50%",
    clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)", boxSizing: "border-box",
  }));
}

// House rule: never tell somebody to call us when the screen could just say what
// happened. The home page used to show the phone number unconditionally, even
// when the program already knew the cause. So when the room's own state explains
// the symptom, that goes first and the number drops to a quieter second line.
// Ordered by what blocks what: a room that is off makes every later question moot.
function homeDiagnosis(p) {
  if (!p.powerOn) return "The room is off. Press POWER ON to start it.";
  if (p.warmMs > 0) return "Still warming up. Give it about half a minute.";
  if (p.hidden) return say("The picture is hidden. Press {UNMUTE} to bring it back.");
  if (!p.source) return "Nothing is selected under INPUT SOURCES. Press the button for what you want to show.";
  if (!p.routes.projL && !p.routes.projR) return say("Nothing is on the {PROJECTOR} yet. Press {PROJECT}.");
  if (p.muteMain) return "The room speakers are muted. Press UNMUTE MAIN.";
  return null;
}

// Mirroring, drawn as the idea rather than as a menu: the same picture on the
// laptop and on the room screen. There is no Mac keyboard shortcut safe enough to
// put on a panel (Command and F1 depends on the function-key setting), and the
// menu itself was renamed between macOS versions, so the art carries the meaning
// and the words carry the path.
function drawMirror(parent, x, y, w, h) {
  const SW = 88, SH = 58, OFF = 20;
  const X = Math.round(x + (w - SW - OFF) / 2), Y = Math.round(y + (h - SH - OFF) / 2);
  const screen = (sx, sy, dim) => {
    hbox(parent, sx, sy, SW, SH, {
      background: dim ? "rgba(255,255,255,.55)" : "#fff",
      border: "3px solid " + H_INK, borderRadius: "6px", boxSizing: "border-box",
    });
    hbox(parent, sx + 14, sy + 16, SW - 28, 9, { background: H_INK, borderRadius: "2px" });
    hbox(parent, sx + 14, sy + 32, SW - 44, 9, { background: H_INK, borderRadius: "2px" });
  };
  screen(X, Y, true);                      // the laptop
  screen(X + OFF, Y + OFF, false);         // the room screen, showing the same thing
}

// ------------------------------------------------------- control clusters
// Some pages are not a sequence of different buttons, they are several things to
// know about ONE card. Those get the card drawn once, whole, at its real internal
// geometry, with the points beside it. Every coordinate below is the object's own
// position read out of the compiled panel, expressed relative to the card, so the
// picture teaches WHERE the control is as well as what it does.

// GEOMETRY COMES FROM THE COMPILED PANEL, not from numbers typed here. The first
// version hardcoded every coordinate, which was correct on the day and would have
// gone quietly wrong the moment a card moved on the glass: the help would have
// drawn a room that no longer exists, and nothing would have failed.
//
// geoOf() finds an object by name in the loaded spec and returns its position and
// size; rel() expresses a child relative to its card. If a name ever disappears
// the lookup throws rather than drawing something invented.
let HELP_SPEC = null;                       // set from the renderer when help opens
function geoOf(name) {
  if (!HELP_SPEC) throw new Error("help: no spec loaded");
  for (const pg of HELP_SPEC.pages) {
    for (const o of pg.objects) if (o.name === name) return o.geo;
  }
  throw new Error("help: object not in the compiled panel: " + name);
}
const rel = (card, name) => {
  const c = geoOf(card), g = geoOf(name);
  return { dx: g.left - c.left, dy: g.top - c.top, w: g.width, h: g.height };
};

// The audio card and its children, read live. The renderer draws a slider as a
// 30-wide track centred in the object with a 50x40 knob, so this matches it.
function drawAudioCard(parent, x, y, k) {
  const CARD = "P1_42_control_card__fill";
  const card = geoOf(CARD);
  const C = (dx, dy, w, h) => [Math.round(x + dx * k), Math.round(y + dy * k),
                               Math.round(w * k), Math.round(h * k)];
  let b = C(0, 0, card.width, card.height);
  hbox(parent, b[0], b[1], b[2], b[3], {
    background: H_TILE, border: "2px solid rgba(206,184,136,.35)",
    borderRadius: hpx(Math.round(10 * k)), boxSizing: "border-box",
  });
  [["MIC", "P1_65_micSlider", "P1_92_muteMic"],
   ["MAIN", "P1_66_mainSlider", "P1_93_muteMain"]].forEach(([name, slider, mute]) => {
    const sl = rel(CARD, slider), mu = rel(CARD, mute), dx = sl.dx;
    hbox(parent, ...C(dx, sl.dy - 26, sl.w, 22).slice(0, 3), Math.round(22 * k), {
      color: H_GOLD, font: "bold " + Math.round(15 * k) + "px Arial",
      textAlign: "center", lineHeight: hpx(Math.round(22 * k)),
    }, name);
    const t = C(dx + (sl.w - 30) / 2, sl.dy, 30, sl.h);      // the 30-wide track
    hbox(parent, t[0], t[1], t[2], t[3], {
      backgroundImage: "url(" + imgUrl("images/slider_track.png") + ")",
      backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
    });
    const lvl = name === "MAIN" ? 0.62 : 0.45;
    hbox(parent, t[0], Math.round(t[1] + t[3] * (1 - lvl)), t[2], Math.round(t[3] * lvl), {
      backgroundImage: "url(" + imgUrl("images/slider_fill.png") + ")",
      backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
    });
    const kw = Math.round(50 * k), kh = Math.round(40 * k);
    himg(parent, Math.round(t[0] + t[2] / 2 - kw / 2),
         Math.round(t[1] + t[3] * (1 - lvl) - kh / 2), kw, kh, "images/slider_knob.png");
    // the mute button under each slider, in its unmuted face, taken from F so the
    // face guard covers it
    const m = C(mu.dx, mu.dy, mu.w, mu.h);
    const mf = name === "MIC" ? F.mute : F.muteMain;
    himg(parent, m[0], m[1], m[2], m[3], mf.img);
    hbox(parent, m[0], m[1], m[2], m[3], {
      color: mf.colour, font: "bold " + Math.round(mf.size * k) + "px Arial",
      display: "flex", alignItems: "center", justifyContent: "center",
    }, mf.label);
  });
}

// The camera card: P1_76_r6_cam_card at 1272,770, 412x296, holding preset1/2
// (1288/1482,804, 186x100) and the three view buttons (1288/1417/1546,932,
// 121x96, the last using the right-hand face).
function drawCameraCard(parent, x, y, k) {
  const CARD = "P1_76_r6_cam_card";
  const card = geoOf(CARD);
  const C = (dx, dy, w, h) => [Math.round(x + dx * k), Math.round(y + dy * k),
                               Math.round(w * k), Math.round(h * k)];
  const b = C(0, 0, card.width, card.height);
  hbox(parent, b[0], b[1], b[2], b[3], {
    background: H_TILE, border: "2px solid rgba(206,184,136,.35)",
    borderRadius: hpx(Math.round(10 * k)), boxSizing: "border-box",
  });
  const p1 = rel(CARD, "P1_78_preset1"), p2 = rel(CARD, "P1_79_preset2");
  himg(parent, ...C(p1.dx, p1.dy, p1.w, p1.h), F.preset1.img);
  himg(parent, ...C(p2.dx, p2.dy, p2.w, p2.h), F.preset2.img);
  // faces and captions both out of F, so the guard sees them
  [["P1_94_viewInstructor", F.camView], ["P1_95_viewBoth", F.viewBoth],
   ["P1_96_viewStudents", F.viewStud]].forEach(([name, f]) => {
    const g = rel(CARD, name);
    const v = C(g.dx, g.dy, g.w, g.h);
    himg(parent, v[0], v[1], v[2], v[3], f.img);
    hbox(parent, v[0], v[1], v[2], v[3], {
      color: f.colour, font: "bold " + Math.round(f.size * k) + "px Arial",
      display: "flex", alignItems: "center", justifyContent: "center",
    }, f.label);
  });
}

// sizes read from the panel too, so a resized card rescales instead of clipping
const CLUSTERS = {
  audio:  { draw: drawAudioCard, card: "P1_42_control_card__fill" },
  camera: { draw: drawCameraCard, card: "P1_76_r6_cam_card" },
};

function drawArt(parent, x, y, w, h, art) {
  if (!art) return;
  if (art.faces) return drawFaces(parent, x, y, w, h, art.faces);
  if (art.draw === "keys") return drawKeys(parent, x, y, w, h);
  if (art.draw === "laptopvol") return drawLaptopVol(parent, x, y, w, h);
  if (art.draw === "mirror") return drawMirror(parent, x, y, w, h);
}

class HelpOverlay {
  constructor(app) {
    this.app = app;
    this.el = null;
    this.open = false;
    this.page = "home";
    app.bus.onPress(25, e => { if (e) this.show(); });
  }

  show() {
    if (this.open) return;          // never a toggle: this hardware double-fires taps
    this.open = true;
    // the room this copy is stamped into decides which control family it names
    HELP_SPEC = this.app.renderer.spec;
    const o = this.app.program.opts || {};
    HELP_TWO = !!o.twoProj;
    HELP_LISTEN = !!o.listenRoom;
    this.page = "home";             // always opens on the flow, never where you left it
    this.render();
    this.armIdle();
  }

  goto(page) { this.page = page; this.render(); this.armIdle(); }

  // The popup closes itself so an abandoned panel does not greet the next class
  // with it. But a fixed timer from OPEN yanks the page away from somebody who is
  // still reading, so every interaction restarts it.
  // NO auto-close in the mockup. It used to hide the popup after 90 s of no
  // touches, and the owner experienced that as "the page constantly reloads and the
  // help menu goes away" while he was reading it (2026-09-02). An inactivity close
  // on the real panel is a panel-build decision, not something to rehearse on a
  // reviewer. Kept as a method so the call sites stay put if that decision lands.
  armIdle() {
    clearTimeout(this.timer);
  }

  render() {
    if (this.el) this.el.remove();

    const wrap = document.createElement("div");
    wrap.id = "helpoverlay";
    Object.assign(wrap.style, { position: "absolute", left: 0, top: 0,
                                width: "1920px", height: "1080px", zIndex: 5000 });

    const scrim = himg(wrap, 0, 0, 1920, 1080, "images/scrim_dark.png");
    scrim.style.cursor = "pointer";
    scrim.onclick = () => this.hide();
    himg(wrap, HG.card[0], HG.card[1], HG.card[2], HG.card[3], "images/popup_card_928x864.png");

    // attached BEFORE the page draws, because the home page measures its own
    // flow strip and getBoundingClientRect on a detached node returns zeroes
    document.querySelector("#stage").appendChild(wrap);

    if (this.page === "home") this.renderHome(wrap);
    else this.renderTopic(wrap, HELP_TOPICS.find(t => t.id === this.page));

    const close = himg(wrap, HG.close[0], HG.close[1], HG.close[2], HG.close[3],
                       F.closeBtn.img);
    close.style.cursor = "pointer";
    close.onclick = () => this.hide();
    hbox(wrap, HG.close[0], HG.close[1], HG.close[2], HG.close[3], {
      color: F.closeBtn.colour, font: "bold " + F.closeBtn.size + "px Arial",
      textAlign: "center", lineHeight: hpx(HG.close[3]), cursor: "pointer",
    }, F.closeBtn.label).onclick = () => this.hide();

    wrap.addEventListener("pointerdown", () => this.armIdle(), true);
    this.el = wrap;
  }

  // ------------------------------------------------------------------ home
  renderHome(wrap) {
    const p = this.app.program;

    hbox(wrap, HG.x, 112, HG.w, 46, {
      color: H_GOLD, font: "bold 32px Arial", letterSpacing: "2px",
      textAlign: "center", lineHeight: "46px",
    }, "HOW TO USE THIS ROOM");

    // 4 * 260 + 3 * 42 = 1166, which centres inside the 1168 content column
    const CELL = 260, GAP = 42, TOP = 178, FACE_H = 104;
    // TWO passes. The step names resolve per room, and "PROJECT LEFT + RIGHT" is
    // two lines where "POWER ON" is one, so the captions cannot sit at a fixed
    // offset: they are placed under the TALLEST label so all four still line up.
    // Label boxes carry no fixed height, because a box that lies about its own
    // content makes every later overflow check lie too.
    const labels = HELP_FLOW.map((s, i) => {
      const x = HG.x + i * (CELL + GAP);
      drawFaces(wrap, x, TOP, CELL, FACE_H, [s.face]);
      if (i < HELP_FLOW.length - 1) {
        hbox(wrap, x + CELL, TOP + FACE_H / 2 - 22, GAP, 44, {
          color: H_GOLD, font: "300 40px Arial", textAlign: "center", lineHeight: "44px",
        }, "›");
      }
      return hbox(wrap, x, TOP + FACE_H + 12, CELL, null, {
        color: H_GOLD, font: "bold 24px/32px Arial", textAlign: "center",
      }, s.n + ". " + say(s.name));
    });
    const capTop = TOP + FACE_H + 12 +
      Math.max(...labels.map(l => l.getBoundingClientRect().height /
        (document.querySelector("#stage").getBoundingClientRect().width / 1920 || 1))) + 8;
    HELP_FLOW.forEach((s, i) => {
      // captions carry {PROJECTOR} now, so they resolve per room like everything else
      hbox(wrap, HG.x + i * (CELL + GAP), Math.round(capTop), CELL, null, {
        color: "#fff", font: "400 22px/28px Arial", textAlign: "center",
      }, say(s.cap));
    });

    // Everything below the flow is placed from where the flow ACTUALLY ended, not
    // from a hardcoded 396. A two-projector room resolves step 4 to "PROJECT LEFT
    // + RIGHT", which wraps to two lines and used to run 26px into the caption
    // under it. Measuring means the next long caption cannot do that again.
    const stage = document.querySelector("#stage").getBoundingClientRect();
    const k = stage.width / 1920 || 1;
    const inkBottom = el => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return (r.getBoundingClientRect().bottom - stage.top) / k;
    };
    const flowEnd = Math.round(Math.max(
      TOP + FACE_H,
      ...[...wrap.querySelectorAll("div")].filter(d => d.firstChild &&
          d.firstChild.nodeType === 3).map(inkBottom)));

    const dividerY = flowEnd + 20;
    himg(wrap, HG.x, dividerY, HG.w, 2, "images/divider_gold_848x2.png");

    hbox(wrap, HG.x, dividerY + 16, HG.w, 34, {
      color: H_GOLD, font: "600 22px Arial", letterSpacing: "2px", lineHeight: "34px",
    }, "SOMETHING WRONG?");

    const TW = 372, TH = 104, TGAP = 26;
    const tilesTop = dividerY + 60;
    HELP_TOPICS.forEach((t, i) => {
      const col = i % 3, row = (i / 3) | 0;
      const x = HG.x + col * (TW + TGAP), y = tilesTop + row * (TH + 20);
      const hot = t.hot ? t.hot(p) : false;
      // These are buttons and should look like it. Flat bordered rectangles read as
      // labels, and a reader under pressure does not try tapping a label. Raised
      // face, real border, a shadow that says pressable, and a chevron because the
      // one thing the reader needs to know is that it goes somewhere.
      const tile = hbox(wrap, x, y, TW, TH, {
        background: hot ? H_TILE_HOT : "rgba(16,24,32,.72)",
        border: "2px solid " + (hot ? H_GOLD : "rgba(206,184,136,.55)"),
        borderRadius: "10px", cursor: "pointer", boxSizing: "border-box",
        boxShadow: "0 3px 0 rgba(0,0,0,.45)",
        color: "#fff", font: (hot ? "600 " : "400 ") + "24px/30px Arial",
        display: "flex", alignItems: "center", padding: "0 44px 0 22px",
      }, t.tile);
      hbox(wrap, x + TW - 34, y + TH / 2 - 18, 24, 36, {
        color: H_GOLD, font: "300 28px Arial", textAlign: "center", lineHeight: "36px",
        pointerEvents: "none",
      }, "›");
      tile.className = "help-tile" + (hot ? " help-tile-hot" : "");
      tile.onclick = () => this.goto(t.id);
    });

    const footTop = tilesTop + 2 * (TH + 20) + 22;
    const diag = homeDiagnosis(p);
    hbox(wrap, HG.x, footTop, HG.w, 34, {
      color: H_GOLD, font: "600 22px Arial", letterSpacing: "2px", lineHeight: "34px",
      textAlign: "center",
    }, diag ? "TRY THIS FIRST" : "STILL STUCK?");
    hbox(wrap, HG.x, footTop + 36, HG.w, null, {
      color: "#fff", font: "400 26px/34px Arial", textAlign: "center",
    }, diag || ("Call Classroom Support at " + HELP_PHONE + "."));
    if (diag) {
      hbox(wrap, HG.x, footTop + 74, HG.w, null, {
        color: H_DIM, font: "400 22px/28px Arial", textAlign: "center",
      }, "Still stuck after that? Call Classroom Support at " + HELP_PHONE + ".");
    }
  }

  // ----------------------------------------------------------------- topic
  renderTopic(wrap, t) {
    if (!t) { this.page = "home"; return this.renderHome(wrap); }
    const app = this.app, p = app.program;

    hbox(wrap, HG.x, 112, HG.w, 46, {
      color: H_GOLD, font: "bold 32px Arial", letterSpacing: "2px",
      textAlign: "center", lineHeight: "46px",
    }, t.title);
    himg(wrap, HG.x, 176, HG.w, 2, "images/divider_gold_848x2.png");

    // The ONE place help acts rather than explains. It lives on the page for the
    // state it fixes, never on the menu, so nothing on the home page can change
    // the room. A hidden screen is invisible to the person, common, and the fix
    // is harmless and instantly visible.
    let top = 200;
    if (t.act && t.act.when(p)) {
      const b = hbox(wrap, HG.x, top, 300, 64, {
        background: H_GOLD, color: H_INK, borderRadius: "8px", font: "bold 26px Arial",
        textAlign: "center", lineHeight: "64px", cursor: "pointer",
      }, t.act.label);
      b.className = "hs-act";
      b.onclick = () => {
        // Goes through the program on an ABSOLUTE join, not by poking state. The
        // previous version set program.hidden itself and then checked
        // program.hidden, which is the value it had just assigned: it could not
        // fail, while the comment above it called it verification. It also skipped
        // opts.onHide. (Fable, cold review 2026-09-01.)
        //
        // Correction to my own note: I first wrote that skipping onHide left the
        // simulated room black behind a flag saying visible. Checked, and that is
        // not true here. The only panes this mockup paints are the PREVIEW windows
        // and the recorder view, none of which depend on `hidden`; the projection
        // screens are not drawn at all. Going through the program is still right,
        // because that is the contract, but the consequence I claimed was not.
        app.bus.press(26); app.bus.release(26);       // d26, absolute SHOW
        // Verified against the join the GLASS reads, which refreshAll writes from
        // the program's own state. d31 low means the picture is showing.
        if (!app.bus.getD(31)) this.hide();
      };
      hbox(wrap, HG.x + 326, top + 14, HG.w - 326, null, {
        color: H_DIM, font: "400 22px/28px Arial",
      }, say("The {PROJECTOR} picture is hidden right now. This brings it back."));
      top += 88;
    }

    // A cluster page: the card once on the left, the points beside it. Used when
    // every point is about the same control, where a row per point would draw the
    // same card three or four times down the page.
    if (t.layout === "cluster") {
      const C = CLUSTERS[t.cluster];
      const cardGeo = geoOf(C.card);
      C.w = cardGeo.width; C.h = cardGeo.height;
      // The exit line is two lines of 30 on the longest page, so a page that has
      // one has to give that space back or it lands on the BACK row at 864. This
      // is measured, not padded: 776 + 14 + 60 = 850.
      const TOP = 200, BOT = t.exit ? 768 : 812;
      const k = Math.min(1, (BOT - TOP) / C.h);
      const ch = C.h * k, cw = C.w * k;
      const cy = Math.round(TOP + (BOT - TOP - ch) / 2);
      C.draw(wrap, HG.x, cy, k);

      const px0 = Math.round(HG.x + cw + 52);
      const pw = HG.x + HG.w - px0;
      const pts = t.points.filter(pt => !pt.when || pt.when());
      const n = pts.length;
      const pitch = (BOT - TOP) / n;
      pts.forEach((pt, i) => {
        const y = Math.round(TOP + i * pitch);
        hbox(wrap, px0, y + (Math.round(pitch) - 40) / 2, 40, 40, {
          background: H_GOLD, color: H_INK, borderRadius: "50%",
          font: "bold 23px Arial", textAlign: "center", lineHeight: "40px",
        }, String(i + 1));
        let tx = px0 + 56;
        if (pt.art) { drawArt(wrap, tx, y + 6, 120, Math.round(pitch) - 12, pt.art); tx += 140; }
        hbox(wrap, tx, y, HG.x + HG.w - tx, Math.round(pitch), {
          color: "#fff", font: "400 25px/32px Arial",
          display: "flex", alignItems: "center",
        }, say(pt.t));
      });
      this.renderExit(wrap, t, BOT + 16);
      this.renderNav(wrap);
      return;
    }

    // Rows spread to fill the space above the BACK/CLOSE row, so a three-step
    // page does not leave a hole and a five-step page does not crowd. The exit
    // line, where a page has one, takes the last slot.
    // 106 is not arbitrary: the tallest single face is CHECK RECORDER at 150x114,
    // which at the uniform 136 width stands 103 high. A shorter row would cap it and
    // it would silently come out narrower than every other button, which is the very
    // thing the uniform width is there to prevent.
    const ROW_H = 106, NUM = 44, SLOT_X = HG.x + 58, SLOT_W = 216;
    const rows = t.steps.length;
    const BOTTOM = t.exit ? 760 : 828;
    const PITCH = rows < 2 ? 0
      : Math.max(96, Math.min(160, (BOTTOM - top - ROW_H) / (rows - 1)));
    const tx = SLOT_X + SLOT_W + 24;

    t.steps.forEach((s, i) => {
      const y = top + i * PITCH;
      hbox(wrap, HG.x, y + (ROW_H - NUM) / 2, NUM, NUM, {
        background: H_GOLD, color: H_INK, borderRadius: "50%",
        font: "bold 25px Arial", textAlign: "center", lineHeight: hpx(NUM),
      }, String(i + 1));
      drawArt(wrap, SLOT_X, y, SLOT_W, ROW_H, s.art);
      // The text sits on the row's centre line, the same line the number badge and
      // the button face sit on, so a one-line step and a three-line step both read
      // as belonging to their picture instead of hanging off the top of it.
      hbox(wrap, tx, y, HG.x + HG.w - tx, ROW_H, {
        color: "#fff", font: "400 25px/32px Arial",
        display: "flex", alignItems: "center",
      }, say(s.t));
    });

    this.renderExit(wrap, t, 784);
    this.renderNav(wrap);
  }

  // The footer on every subpage. Identical in shape to the home page's STILL STUCK
  // block: a gold caption and one centred line. `exit: true` gets the standard line;
  // a string gets that string instead (the recording page uses this to point at the
  // page that already explains the card rather than at the phone).
  renderExit(wrap, t, y) {
    if (!t.exit) return;
    const line = t.exit === true
      ? "If none of that worked, call Classroom Support at " + HELP_PHONE + "."
      : say(t.exit);
    hbox(wrap, HG.x, y, HG.w, 30, {
      color: H_GOLD, font: "600 20px Arial", letterSpacing: "2px",
      lineHeight: "30px", textAlign: "center",
    }, "STILL STUCK?");
    hbox(wrap, HG.x, y + 32, HG.w, null, {
      color: "#fff", font: "400 24px/30px Arial", textAlign: "center",
    }, line);
  }

  renderNav(wrap) {
    const back = himg(wrap, HG.back[0], HG.back[1], HG.back[2], HG.back[3],
                      F.backBtn.img);
    back.style.cursor = "pointer";
    back.onclick = () => this.goto("home");
    hbox(wrap, HG.back[0], HG.back[1], HG.back[2], HG.back[3], {
      color: F.backBtn.colour, font: "bold " + F.backBtn.size + "px Arial",
      textAlign: "center", lineHeight: hpx(HG.back[3]), cursor: "pointer",
    }, F.backBtn.label).onclick = () => this.goto("home");
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    clearTimeout(this.timer);
    if (this.el) this.el.remove();
    this.el = null;
  }
}

window.HelpOverlay = HelpOverlay;
