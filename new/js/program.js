// The SIMPL program port, transcribed symbol-by-symbol from Rev 34
// (test-scripts/_rev34_symbols.txt). Every block cites the symbol(s) it
// implements so a reviewer can diff against the wiring dump. The Pearl module
// itself lives in pearl.js; the formatter in formatter.js. This file owns:
//   power + warm-up + the power-off confirm subpage      H=83..91, 179..191
//   the source interlock and the DMPS routes             H=67..81, 200..204
//   previews, PROJECT, listen                            H=74..76, 87
//   lights, camera presets, volume, mutes                H=96..108
//   the flash machinery (rev34 semantics)                H=200..242
//   the LC page latch, popups, walkup gate               H=128..165, 167..198
//   band/deck arbitration + the preview handoff          H=161..178, 230..233
// Room capability flags (deck room, projector count) are compile-time constants
// in the real program (I54/I58 tied high); here they are config inputs.
"use strict";

const TICK_MS = 100;

class Program {
  constructor(bus, pearl, formatter, opts) {
    this.bus = bus;
    this.pearl = pearl;
    this.fmt = formatter;
    this.opts = opts || {};   // {deckRoom, twoProj, listenRoom, onRoute}

    // ---- state ----
    this.powerOn = false;          // Epson Power_On_Fb
    this.warmMs = 0;               // Please_Wait one-shot remaining (H=86, 30 s)
    this.spPending = false;        // H=181 SP_Power_Pending latch
    this.projQueued = false;       // H=187 Projection_Queued latch
    this.source = 0;               // interlock H=80: latched DMPS input 1..6, 0 = none
    this.clearLatched = false;     // interlock O1 (clear selected)
    this.routes = { prevL: 0, prevR: 0, projL: 0, projR: 0, kaltura: 0, audio: 0 };
    this.listenPulse = 0;          // Listen_To_Audio is momentary; see listenPress()
    this.lights = 0;               // interlock-toggle H=98: 0 none, 60..64
    this.preset = 0;               // H=96: 22 or 23
    this.volMain = 32768; this.volMic = 32768;   // a2/a3
    this.muteMain = false; this.muteMic = false; // absolute pairs (Rev 56) or toggles (older glass); see the mute handlers
    // Ceiling mic. In a real room it answers, so the meter is shown (D167) and the
    // grey "dead" bar is not (D168); those are the two joins the glass switches on.
    // A8 is what the MicPeak module puts on the gauge: 0 is the silent floor and
    // 65535 is full scale. The sim breathes a speech-like level so the meter looks
    // lived-in rather than pinned or flat, and it sits flat while the mic is muted
    // (the Rev 45 rule). Nothing here was driven before, which is why the mic
    // column rendered empty.
    this.micReachable = true;
    this.micLevel = 0;         // 0..1, what A8 carries
    this.hideGuardMs = 0;      // Rev 56 H=299 VIDEO MUTE 0.5 s window
    this.micTarget = 0;
    this.micHoldMs = 0;
    // PER SIDE. A two-projector room has VIDEO MUTE LEFT and RIGHT (d87/d88) with
    // their own absolute shows (d89/d97), so one screen can be hidden while the
    // other is not. A single global flag could not represent that, which meant the
    // per-side buttons silently acted on both. (Fable, cold review 2026-09-01.)
    // `hidden` stays readable and writable as the combined view: reading it means
    // "some screen is hidden", writing it moves both, so every existing caller and
    // the one-projector room behave exactly as before.
    this.hiddenL = false;
    this.hiddenR = false;
    this.lcOpen = false;           // Pearl_Controls_il latch H=136
    this.pop = { stop: false, next: false, help: false };  // SR latches H=133..135
    this.walkup = false;           // SR latch H=141
    this.customArm = false;        // SR latch H=157
    this.handoff = false;          // H=170 preview handoff latch
    // flash machinery
    this.flashSrcMs = 0; this.flashPwrMs = 0;    // retriggerable 1 s windows H=210/211
    this.flashStep = -1; this.flashStepMs = 0;   // stepper H=228 (16 x 60 ms)
    this.flashOscMs = 0;                         // oscillator H=213 (0.25 s phases)

    this.wire();
    this.publishStatics();
    // Chrome throttles timers in unfocused tabs to ~1 Hz; the pump self-corrects
    // against the wall clock and catches up in 100 ms steps so tick-counted
    // timings (start lag, teardown, ended pulse, countdowns) stay honest.
    this._lastTick = performance.now();
    this.interval = setInterval(() => {
      const nowMs = performance.now();
      let due = Math.min(50, Math.floor((nowMs - this._lastTick) / TICK_MS));
      if (due <= 0) return;
      this._lastTick += due * TICK_MS;
      while (due-- > 0) this.tick(TICK_MS);
    }, TICK_MS);
  }

  // ---------------------------------------------------------------- helpers
  D(j, v) { this.bus.setD(j, v); }

  publishStatics() {
    // Room capability flags: compile-time in the real program (I54/I58 = constant).
    this.D(54, this.opts.deckRoom ? 1 : 0);          // Blu-ray source button visible
    this.D(58, this.opts.twoProj ? 0 : 1);           // one-projector layout
    this.D(59, this.opts.twoProj ? 1 : 0);           // two-projector layout
    this.D(56, this.opts.listenRoom ? 1 : 0);        // LISTEN button (one room only)
    this.refreshAll();
  }

  // ---------------------------------------------------------------- wiring
  wire() {
    const B = this.bus;

    // ---- power (H=83 Epson, H=85/84 confirm subpage, H=86 warm-up) ----
    B.onPress(5, e => { if (e) this.firePowerOn("button"); });
    B.onPress(6, e => { if (e) { this.D(2, 1); } });          // open confirm (H=84 latch)
    B.onPress(8, e => { if (e) { this.D(2, 0); } });          // cancel (AYS clear, H=85)
    B.onPress(7, e => { if (e) this.powerOff(); });           // YES, POWER OFF

    // ---- sources (interlock H=80; routes H=69..76) ----
    // 16 -> input 7: Rev 56's DGE O16 selects DMPS_300_Input_7 through the same interlock. Only
    // the two-doc-cam glass (room 201, RIGHT DOC CAM) carries a d16 button.
    const srcMap = { 10: 1, 11: 2, 12: 3, 13: 4, 14: 5, 15: 6, 16: 7 };
    for (const [join, input] of Object.entries(srcMap)) {
      B.onPress(+join, e => { if (e) this.selectSource(input); });
    }
    B.onPress(9, e => { if (e) this.clearSource(); });

    // ---- previews and project ----
    B.onPress(18, e => { if (e) this.previewPress("prevL", true); });
    B.onPress(19, e => { if (e) this.previewPress("prevR", true); });
    B.onPress(21, e => { if (e) this.projectPress(true); });
    B.onPress(33, e => { if (e) this.projectPress(true, "L"); });
    B.onPress(34, e => { if (e) this.projectPress(true, "R"); });
    B.onPress(29, e => { if (e) this.listenPress(); });

    // ---- START PRESENTING d24 (H=179..191) ----
    B.onPress(24, e => { if (e) this.startPresenting(); });

    // ---- HIDE d31 (Epson A/V mute; rev34: with power off it flashes power) ----
    B.onPress(31, e => { if (e) this.hidePress(); });
    B.onPress(26, e => { if (e) this.showPress(); });      // absolute SHOW, see showPress
    B.onPress(89, e => { if (e) this.showPress("L"); });   // d89 SHOW LEFT, absolute off
    B.onPress(97, e => { if (e) this.showPress("R"); });   // d97 SHOW RIGHT, absolute off
    B.onPress(87, e => { if (e) this.hidePress("L"); });
    B.onPress(88, e => { if (e) this.hidePress("R"); });

    // ---- lights (H=98 interlock-toggle) ----
    for (const j of [60, 61, 62, 63, 64]) {
      B.onPress(j, e => { if (e) this.lightPress(j); });
    }

    // ---- camera presets (H=96 interlock; d120..122 are the Pearl layouts) ----
    B.onPress(22, e => { if (e) { this.preset = 22; this.refreshAll(); } });
    B.onPress(23, e => { if (e) { this.preset = 23; this.refreshAll(); } });

    // ---- volume + mutes (H=101..108) ----
    // H=104/108: the mute reset fires on a volume-feedback CHANGE, not the command
    B.onSendA(2, v => { if (v !== this.volMain) { this.volMain = v; this.muteMain = false; } this.refreshAll(); });
    B.onSendA(3, v => { if (v !== this.volMic) { this.volMic = v; this.muteMic = false; } this.refreshAll(); });
    // Rev 56: the mutes are ABSOLUTE pairs, not toggles. d30/d32 are Main_/Mic_Mute_On_Press,
    // d35/d37 are Mic_/Main_Mute_Off_Press (DGE O30/O32/O35/O37). The sim used to toggle on
    // 30/32, which is exactly what a DGE double-fire turns into a wrong answer, and never
    // handled 35/37 at all, so a muted mic could not be unmuted from the panel.
    // OFF wins: MUTE is AND(Mute_On_Press, NOT <Mic|Main>_Live_Press_Or_Boot) (H=265, H=262),
    // where that signal is the UNMUTE press while it is HELD (OR the startup edge, which this
    // sim has no equivalent for: it boots unmuted). So a MUTE that arrives while UNMUTE is held
    // is blocked, and releasing UNMUTE while MUTE is still held lets the AND rise and mutes.
    const mutePair = (onJ, offJ, set) => {
      B.onPress(onJ, e => { if (e && !B.isHeld(offJ)) { set(true); this.refreshAll(); } });
      B.onPress(offJ, e => {
        if (e) { set(false); this.refreshAll(); }
        else if (B.isHeld(onJ)) { set(true); this.refreshAll(); }
      });
    };
    if (this.opts.absoluteMutes) {
      mutePair(30, 37, v => { this.muteMain = v; });
      mutePair(32, 35, v => { this.muteMic = v; });
    } else {
      // An older glass (the Blu-ray build) has ONE mute button per channel and no UNMUTE, the
      // toggle design its own program generation used. Making those absolute left that room
      // unable to unmute at all (Fable cold review, 2026-09-17), so it keeps the toggle.
      B.onPress(30, e => { if (e) { this.muteMain = !this.muteMain; this.refreshAll(); } });
      B.onPress(32, e => { if (e) { this.muteMic = !this.muteMic; this.refreshAll(); } });
    }

    // ---- LC page latch (H=128/136) + popups + walkup ----
    B.onPress(69, e => { if (e) this.setLcOpen(true); });
    B.onPress(171, e => { if (e) this.setLcOpen(false); });   // BACK TO CONTROLS
    B.onPress(172, e => { if (e) { this.pop.stop = true; this.refreshAll(); } });
    B.onPress(173, e => { if (e) { this.pop.next = true; this.refreshAll(); } });
    B.onPress(174, e => { if (e) { this.pop.help = true; this.refreshAll(); } });
    B.onPress(86, e => { if (e) this.popupClose(); });        // scrim/cancel family
    B.onPress(77, e => { if (e) { this.pearl.recordStop(); this.pop.stop = false; this.refreshAll(); } });
    B.onPress(90, e => { if (e) { this.pearl.confirm(); this.pop.next = false; this.refreshAll(); } });
    B.onPress(175, e => { if (e) { this.walkup = true; this.customArm = true; this.pearl.walkupOpen(); this.refreshAll(); } });
    B.onPress(176, e => { if (e) { this.walkup = false; this.closeKeyboard(); this.refreshAll(); } });

    // walk-up form
    B.onPress(130, e => { if (e) this.pearl.adhocVerify(); });
    B.onPress(132, e => { if (e) this.pearl.adhocCreate(); });
    B.onPress(134, e => { if (e) { this.customArm = false; this.pearl.adhocDur(30); } });
    B.onPress(135, e => { if (e) { this.customArm = false; this.pearl.adhocDur(60); } });
    B.onPress(136, e => { if (e) { this.customArm = false; this.pearl.adhocDur(90); } });
    B.onPress(138, e => { if (e) { this.pearl.customArm(); this.refreshAll(); } });   // H=157 CustomArm latch
    B.onSendS(40, v => this.pearl.setAdhocFsuid(v));
    B.onSendS(42, v => this.pearl.setAdhocTitle(v));
    B.onSendS(44, v => this.pearl.setAdhocDurMin(v));
    // any touch on the walk-up form keeps its verification alive (PearlRest v10.15 idle clear)
    for (const j of [130, 132, 134, 135, 136, 138, 175]) B.onPress(j, e => { if (e) this.pearl.walkupTouch(); });
    for (const j of [40, 42, 44]) B.onSendS(j, () => this.pearl.walkupTouch());

    // LC state machine presses that route straight to the module
    B.onPress(93, e => { if (e) this.pearl.confirmStart(); });
    B.onPress(94, e => { if (e) this.pearl.startNow(); });
    B.onPress(82, e => { if (e) this.pearl.extend5(); });
    B.onPress(178, e => { if (e) this.pearl.holdOn(); });
    B.onPress(179, e => { if (e) this.pearl.holdOff(); });
    B.onPress(155, e => { if (e) this.pearl.endedDismiss(); });
    // camera views (d120 Instructor / d122 Both / d121 Students) -> module layouts
    B.onPress(120, e => { if (e) this.layoutPress(1); });
    B.onPress(121, e => { if (e) this.layoutPress(2); });
    B.onPress(122, e => { if (e) this.layoutPress(3); });

    // ---- recorder preview band (H=170..175, 230..233) ----
    B.onPress(67, e => { if (e) this.previewOpenReq(); });    // CHECK RECORDER
    B.onPress(117, e => { if (e) this.pearl.previewCmd(2); });// CLOSE
    // The LC page's SHOW/HIDE PREVIEW pair, ABSOLUTE since panel round 28 + Rev 56:
    // d180 PearlPreviewOpenPress ORs into the same open request as CHECK RECORDER (H=233),
    // d181 PearlPreviewClosePress ORs into the same close request as CLOSE (H=174).
    B.onPress(180, e => { if (e) this.previewOpenReq(); });
    B.onPress(181, e => { if (e) this.pearl.previewCmd(2); });
    // d150 PearlPreviewShow is still wired in Rev 56, but round 28 no longer presses it.
    // Kept so an older spec (the Blu-ray build) still works; remove when that is rebuilt.
    B.onPress(150, e => { if (e) this.pearl.previewToggle(); });

    // Blu-ray transport: momentary IR; the deck sim reacts
    const deck = this.opts.deck;
    if (deck) {
      const map = { 40: "down", 41: "enter", 42: "left", 43: "menu", 44: "pause", 45: "play",
                    46: "right", 47: "stop", 48: "up", 49: "ff", 50: "rew", 51: "skipb", 52: "skipf", 53: "eject" };
      for (const [j, cmd] of Object.entries(map)) B.onPress(+j, e => { if (e) deck.command(cmd); });
    }
  }

  // ---------------------------------------------------------------- power
  firePowerOn(via) {
    // H=183/184: START's gate = power off AND not pending; a re-press cannot
    // restart warm-up through START. The POWER ON button refires the command
    // (section 7: warm-up runs on every POWER ON), but H=86 is a plain One Shot:
    // edges DURING the active 30 s window are ignored, never extended.
    if (via === "start" && (this.powerOn || this.spPending)) return;
    this.powerOn = true;                         // Epson ACKs; Power_On_Fb rises
    if (this.warmMs <= 0) this.warmMs = 30000;   // H=86 one-shot, P1=30s, non-retriggerable
    if (this.opts.onPower) this.opts.onPower(true);
    this.refreshAll();
  }
  powerOff() {
    this.powerOn = false;
    this.hidden = false;                         // an Epson powers on unmuted; off clears mute
    this.D(2, 0);                                // AYS subpage closes (H=85)
    this.warmMs = 0; this.projQueued = false;    // H=189 queue dies on power off
    // H=81 -> interlock clear; H=87 button presser applies the cleared route everywhere
    this.source = 0; this.clearLatched = false;
    this.routes = { prevL: 0, prevR: 0, projL: 0, projR: 0, kaltura: 0, audio: 0 };
    this.listenPulse = 0;
    this.pearl.previewCmd(2);                    // H=193 yield: power off closes the preview
    // H=87's button presser re-buffers the CLEARED route through H=76 into the
    // capture output, so the status card must stop naming the old source
    this.routeChanged();
    if (this.opts.onPower) this.opts.onPower(false);
    this.refreshAll();
  }

  // ---------------------------------------------------------------- sources
  selectSource(input) {
    this.source = input; this.clearLatched = false;
    this.setLcOpen(false);                       // H=128 Pearl_Page_Exit on any source press
    this.refreshAll();
  }
  clearSource() {
    this.source = 0; this.clearLatched = true;
    this.setLcOpen(false);
    this.refreshAll();
  }

  // H=74/75: a preview press applies the CURRENT source to that preview route.
  previewPress(which, manual) {
    // The route ALWAYS applies (H=74/75 buffer the current source, including the
    // cleared value); the flash is a parallel explanation, never a cancel. Like
    // every flash it is gated on Not_Warming (H=206).
    if (manual && this.source === 0 && this.warmMs <= 0) { this.flashPwrMs = 0; this.flashSrc(); }
    this.routes[which] = this.source;
    this.pearl.previewYield();                   // H=192/193: preview press closes the band preview
    this.routeChanged();
  }
  // H=76: PROJECT applies the source to the projector AND the capture card.
  projectPress(manual, side) {
    if (manual) {
      // H=206: no source -> sources flash; H=207 (rev34): power off -> power flash too.
      // Both may open on one press; a single-deficiency press swaps away the other
      // window (H=238..242 guarded cross-resets). The ROUTE STILL APPLIES below:
      // H=76 buffers unconditionally, the flash only explains why nothing showed.
      const srcSet = this.source === 0 && this.warmMs <= 0;
      const pwrSet = !this.powerOn && this.warmMs <= 0;
      if (srcSet && !pwrSet) this.flashPwrMs = 0;
      if (pwrSet && !srcSet) this.flashSrcMs = 0;
      if (srcSet) this.flashSrc();
      if (pwrSet) this.flashPwr();
    }
    // H=76 buffers the source into the projector output. A two-projector room
    // routes each screen separately (d33/d34); the single PROJECT button drives
    // both. One value cannot hold that, so the sides are tracked separately.
    if (side === "L") this.routes.projL = this.source;
    else if (side === "R") this.routes.projR = this.source;
    else { this.routes.projL = this.source; this.routes.projR = this.source; }
    if (this.source !== 1) this.routes.kaltura = this.source;  // H=72: Blu-ray never reaches capture
    this.routes.audio = this.source === 0 ? 0 : this.source + 5;   // H=69/70 via project press
    this.routeChanged();
  }
  listenPress() {
    // H=68 -> H=67/70: LISTEN is a MOMENTARY trigger into the audio buffer, not a
    // mode. d29's press and feedback are the same signal (H=120 I29 == O29), so
    // the button pulses and never latches; what persists is the routed audio.
    this.routes.audio = this.source === 0 ? 0 : this.source + 5;
    this.listenPulse = 3;                       // ticks the echoed press stays high
    this.routeChanged();
  }
  routeChanged() {
    if (this.opts.onRoute) this.opts.onRoute({ ...this.routes, source: this.source });
    // formatter analog inputs (H=166 I23 = capture route; I24 = zero-gated audio route)
    this.fmt.in.CaptureRoute = this.routes.kaltura;
    this.fmt.in.AudioRoute = this.routes.audio;
    this.refreshAll();
  }

  // ---------------------------------------------------------------- start presenting
  startPresenting() {
    // Rev 56 H=295: Start_Presenting_Press is one of the inputs of Video_Unblank_Any, so it
    // un-blanks the projector as well (Astra parity review 2026-09-17)
    this.hidden = false;
    // H=185: press DESKTOP PC + LEFT PREVIEW + RIGHT PREVIEW (automatic, never flashes)
    this.selectSource(3);
    this.previewPress("prevL", false);
    this.previewPress("prevR", false);
    if (!this.powerOn) {
      this.firePowerOn("start");                 // H=184 through the gate
      this.projQueued = true;                    // H=186/187: pressed while warming
    } else if (this.warmMs > 0) {
      this.projQueued = true;
    } else {
      this.projectPress(false);                  // H=190: room already hot
    }
    this.refreshAll();
  }

  get hidden() { return this.hiddenL || this.hiddenR; }
  set hidden(v) { this.hiddenL = this.hiddenR = !!v; }

  closeKeyboard() { if (this.opts.closeKeyboard) this.opts.closeKeyboard(); }

  hidePress(side) {
    // rev34 H=238: a mute press with the power off flashes POWER (it lands nowhere)
    if (!this.powerOn) { this.flashSrcMs = 0; this.flashPwr(); return; }
    if (side === "L" || side === "R") {
      // d87 / d88: "HIDE LEFT press, absolute on" and its right-hand twin
      // (allocation 5.3). Absolute, not a toggle, and it moves ONE side.
      if (side === "L") this.hiddenL = true; else this.hiddenR = true;
    } else {
      // Rev 56 H=299: a 0.5 s One Shot on VIDEO MUTE, so a second press (or the panel's
      // double-fire) inside the window does nothing, rather than un-blanking again
      if (this.hideGuardMs > 0) return;
      this.hideGuardMs = 500;
      this.hidden = !this.hidden;                // d31, the combined toggle
    }
    if (this.opts.onHide) this.opts.onHide(this.hidden, side);
    this.refreshAll();
  }

  // Absolute SHOW, the counterpart of the d31 toggle. The allocation ALREADY has
  // per-side absolute shows: d89 SHOW LEFT and d97 SHOW RIGHT, both "absolute off"
  // (section 5.3), with d26/d28 named as the free neighbours if the combined pair
  // ever gets the same treatment. This uses d26 for the combined case.
  //
  // It has to be absolute rather than a toggle pulse because this hardware
  // double-fires taps: a pulse would undo itself and leave the screen black. So
  // this is deliberately IDEMPOTENT, and pressing it twice shows the picture once.
  showPress(side) {
    if (!this.powerOn) { this.flashSrcMs = 0; this.flashPwr(); return; }
    const was = this.hidden;
    if (side === "L") this.hiddenL = false;
    else if (side === "R") this.hiddenR = false;
    else this.hidden = false;                    // combined
    if (!was) return;                            // nothing was hidden: a true no-op
    if (this.opts.onHide) this.opts.onHide(this.hidden, side);
    this.refreshAll();
  }

  lightPress(j) {
    // H=98 is an Interlock-TOGGLE: a second press on the selected scene turns it OFF
    this.lights = this.lights === j ? 0 : j;
    this.refreshAll();
  }

  layoutPress(n) {
    this.pearl.layout(n);
    // H=230..233: a view press rearms the preview only on the LC page or while open
    if (this.lcOpen || this.pearl.out.PreviewOn) this.previewOpenReq();
  }

  // ---------------------------------------------------------------- LC page + popups
  setLcOpen(v) {
    if (this.lcOpen === v) return;
    // H=192/193/174: the page-transition presses (LC open, BACK) close the one preview.
    // The reopen-blocking handoff latch (H=169..173) is a DEAD branch in Rev 34:
    // Preview_Open_Gated has no consumer, so no blocking is modeled here.
    if (this.pearl.out.PreviewOn) { this.pearl.previewCmd(2); }
    this.lcOpen = v;
    if (!v || v) {
      // EdgePageOff (H=153/147..150): popups and walkup die on the page leaving
      if (!v) { this.pop = { stop: false, next: false, help: false }; this.walkup = false; this.closeKeyboard(); }
    }
    if (this.opts.onLcPage) this.opts.onLcPage(v);
    this.refreshAll();
  }
  popupClose() {
    this.pop = { stop: false, next: false, help: false };
    this.refreshAll();
  }
  previewOpenReq() {
    this.pearl.previewCmd(1);
  }

  // ---------------------------------------------------------------- flash
  flashSrc() {
    // H=234..237 (rev31): a press while the SAME window is open is ignored entirely,
    // so windows are FIXED one-second, never extended. The cross-kill (H=241/242)
    // fires only when the other deficiency is not also being flagged this press.
    if (this.flashSrcMs > 0) return;
    this.startSwell();
    this.flashSrcMs = 1000;
    this.refreshAll();
  }
  flashPwr() {
    if (this.flashPwrMs > 0) return;
    this.startSwell();
    this.flashPwrMs = 1000;
    this.refreshAll();
  }
  startSwell() {
    // H=228 stepper: triggers while a sequence is active are IGNORED
    if (this.flashStep >= 0) return;
    this.flashStep = 0; this.flashStepMs = 0;
  }

  // ---------------------------------------------------------------- tick
  tick(ms) {
    if (this.hideGuardMs > 0) this.hideGuardMs -= ms;
    // warm-up one-shot
    if (this.warmMs > 0) {
      this.warmMs -= ms;
      if (this.warmMs <= 0) {
        this.warmMs = 0;
        if (this.projQueued) { this.projQueued = false; this.projectPress(false); }  // H=188/191
      }
    }
    // flash windows + stepper + oscillator
    let flashChanged = false;
    if (this.flashSrcMs > 0) { this.flashSrcMs -= ms; if (this.flashSrcMs <= 0) { this.flashSrcMs = 0; } flashChanged = true; }
    if (this.flashPwrMs > 0) { this.flashPwrMs -= ms; if (this.flashPwrMs <= 0) { this.flashPwrMs = 0; } flashChanged = true; }
    const anyWin = this.flashSrcMs > 0 || this.flashPwrMs > 0;
    if (this.flashStep >= 0) {
      this.flashStepMs += ms;
      while (this.flashStepMs >= 60 && this.flashStep >= 0) {
        this.flashStepMs -= 60;
        this.flashStep += 1;
        if (this.flashStep >= 16) this.flashStep = -1;
      }
      // H=229's frame walk, read off the .smw parameter record: P1..P16 =
      // 1,3,5,7 repeated four times (frames 2/4/6 exist as assets but are unused),
      // P17=0 on window close.
      let frame = 0;
      if (this.flashStep >= 0) frame = [1, 3, 5, 7][this.flashStep % 4];
      this.bus.setA(9, anyWin ? frame : 0);
    }
    if (!anyWin && this.flashStep < 0 && this.bus.getA(9) !== 0) this.bus.setA(9, 0);
    if (flashChanged) this.refreshAll();

    // H=153 one-shots -> H=150: a RISING raw state edge cancels the walk-up page
    const P0 = this.pearl.out;
    const e = this._edges || (this._edges = { conf: 0, confd: 0, rec: 0, ended: 0 });
    const rose = (k, v) => { const r = v && !e[k]; e[k] = v ? 1 : 0; return r; };
    const anyEdge = [rose("conf", P0.StateConfirmRaw), rose("confd", P0.StateConfirmedRaw),
                     rose("rec", P0.StateRec), rose("ended", P0.EndedPulse)].some(Boolean);
    if (anyEdge && this.walkup) { this.walkup = false; this.closeKeyboard(); }

    if (this.listenPulse > 0) this.listenPulse -= 1;

    // mic meter: a new syllable-sized target every so often, fast attack, slow decay.
    // Speech sits mostly in the green with the odd push into yellow; a lecturer does
    // not peg a meter. Muted or unreachable, the goal is the floor.
    this.micHoldMs -= ms;
    if (this.micHoldMs <= 0) {
      this.micHoldMs = 90 + Math.random() * 220;
      const r = Math.random();
      this.micTarget = r < 0.75 ? 0.30 + Math.random() * 0.28
                    : r < 0.95 ? 0.58 + Math.random() * 0.18
                    : 0.76 + Math.random() * 0.14;
    }
    const micGoal = (this.muteMic || !this.micReachable) ? 0 : this.micTarget;
    this.micLevel += (micGoal - this.micLevel) * (micGoal > this.micLevel ? 0.55 : 0.12);
    // the real meter follows the mic's measurement, which is zero the moment it is muted (no decay)
    if (this.muteMic || !this.micReachable) this.micLevel = 0;

    // pump the module and the formatter (shared oscillator)
    this.pearl.pumpTick(ms);
    this.syncFormatter();
    this.fmt.pumpTick();
    this.refreshAll();
  }

  syncFormatter() {
    const P = this.pearl.out, I = this.fmt.in;
    I.ConfirmReady = P.ConfirmReady; I.Confirmed = P.Confirmed;
    I.StateIdle = P.StateIdle; I.StateUpNext = P.StateUpNext;
    I.StateRec = P.StateRec; I.StatePaused = P.StatePaused;
    I.EndedPulse = P.EndedPulse; I.RecordingTruth = P.Recording;
    I.EventRun = P.EventRun; I.PreviewOn = P.PreviewOn;
    I.NowTitle = P.NowTitle; I.UpNextTitle = P.UpNextTitle;
    I.UpNextTime = P.UpNextTime; I.NowUntil = P.NowUntil;
    I.ConfirmTitle = P.ConfirmTitle; I.ConfirmSub = P.ConfirmSub;
    I.RemainingSeconds = P.RemainingSeconds; I.RecorderHealth = P.RecorderHealth;
    I.PreviewSeconds = P.PreviewSeconds;
  }

  // ---------------------------------------------------------------- feedback
  refreshAll() {
    const B = this.bus, P = this.pearl.out;
    const warming = this.warmMs > 0;

    // power + warm-up
    B.setD(4, warming ? 1 : 0);
    B.setD(5, this.powerOn ? 1 : 0);
    B.setD(6, this.powerOn ? 0 : 1);
    B.setD(7, this.powerOn ? 0 : 1);
    B.setD(27, warming ? 0 : 1);                     // H=160 Not_Warming -> START caption

    // sources (interlock feedback, selected faces)
    const srcMap = { 1: 10, 2: 11, 3: 12, 4: 13, 5: 14, 6: 15, 7: 16 };
    for (const [input, join] of Object.entries(srcMap)) B.setD(join, this.source === +input ? 1 : 0);
    B.setD(9, this.clearLatched ? 1 : 0);

    // lights, presets, mutes, volume
    for (const j of [60, 61, 62, 63, 64]) B.setD(j, this.lights === j ? 1 : 0);
    B.setD(22, this.preset === 22 ? 1 : 0);
    B.setD(23, this.preset === 23 ? 1 : 0);
    B.setD(30, this.muteMain ? 1 : 0);
    B.setD(32, this.muteMic ? 1 : 0);
    // The MUTE buttons are only VISIBLE on the not-muted joins (P1_92_muteMic vis 36,
    // P1_93_muteMain vis 38); the UNMUTE faces sit on 32/30. Only the muted pair was
    // driven, so with nothing muted the card showed no button at all. Owner photo
    // 2026-09-14 shows MUTE MIC and MUTE MAIN under the meter and the slider.
    B.setD(36, this.muteMic ? 0 : 1);
    B.setD(38, this.muteMain ? 0 : 1);
    B.setD(31, this.hidden ? 1 : 0);
    B.setA(2, this.volMain); B.setA(3, this.volMic);
    B.setD(167, this.micReachable ? 1 : 0);      // segmented meter, while the mic answers
    B.setD(168, this.micReachable ? 0 : 1);      // the grey dead bar, while it does not
    B.setA(8, Math.round(this.micLevel * 65535));
    // The room name over the clock (P1_5_building_name, serial 40). The real program
    // stamps it per room; a glass that says BENCH was not stamped. index.html owns
    // the value for the same reason the help card does: every copy would otherwise
    // claim to be the same room. Nothing set it before, so the render showed a blank.
    B.setS(40, window.PANEL_ROOM || "BENCH");
    B.setD(29, this.listenPulse > 0 ? 1 : 0);   // echoed press, not a mode

    // flash to the glass
    B.setD(145, this.flashPwrMs > 0 ? 1 : 0);        // power glow frames visible
    B.setD(146, this.flashSrcMs > 0 ? 1 : 0);        // sources glow frames visible

    // LC latch, band, deck (H=136, 175, 177, 178)
    const bandPreview = P.PreviewOn && !this.lcOpen;   // H=175 Band_Preview_Visible
    B.setD(68, bandPreview ? 1 : 0);
    B.setD(66, bandPreview ? 0 : 1);                   // H=177 Band_Not_Visible
    B.setD(57, this.source === 1 && !bandPreview ? 1 : 0);  // H=178 deck shows when Blu-ray latched
    B.setD(150, P.PreviewOn && this.lcOpen ? 1 : 0);   // H=176 LC page preview visible
    B.setD(151, P.PreviewOn ? 0 : 1);                  // H=138 PreviewOff

    // popups + walkup (SR latches; WalkupGate H=137, StateQuiet H=139/152)
    B.setD(172, this.pop.stop ? 1 : 0);
    B.setD(173, this.pop.next ? 1 : 0);
    B.setD(174, this.pop.help ? 1 : 0);
    // H=137 masks the quiet states while the walkup latch is up...
    const gIdle = !this.walkup && P.StateIdleRaw;
    const gUpNext = !this.walkup && P.StateUpNextRaw;
    const gConfirm = !this.walkup && P.StateConfirmRaw;
    const gConfirmed = !this.walkup && P.StateConfirmedRaw;
    // ...and H=152 reads those GATED outputs, not the raw ones. That is what lets
    // NEW RECORDING open the form during a confirm window: setting the latch
    // suppresses the confirm state, so StateQuiet goes true and the page shows.
    // Reading raw here blocked the walk-up in the ordinary daily opt-in case.
    const stateActive = gConfirm || gConfirmed || P.StateRec || P.StatePaused || P.EndedPulse;
    const walkupSafe = this.walkup && !stateActive;
    B.setD(175, walkupSafe ? 1 : 0);
    B.setD(110, gIdle ? 1 : 0);
    B.setD(111, gUpNext ? 1 : 0);
    B.setD(112, gConfirm ? 1 : 0);
    B.setD(113, gConfirmed ? 1 : 0);
    B.setD(114, P.StateRec ? 1 : 0);
    B.setD(115, P.StatePaused ? 1 : 0);
    B.setD(116, P.EndedPulse ? 1 : 0);

    // The latch is reset by H=150 from the H=153 one-shots, i.e. on the RISING
    // EDGE of a raw state, never on its level. A level test here wiped the latch
    // in the same pass that set it. Edges are detected in tick().


    // audio meter (H=194..199): enabled while the preview is open and no modal covers it
    const anyModal = this.pop.stop || this.pop.next || this.pop.help || walkupSafe ||
                     this.bus.getD(2) || warming;
    B.setD(141, P.PreviewOn && !anyModal ? 1 : 0);
    // Owner 2026-09-17: while the recording is held the RECORDER's meter sits at zero. The mic
    // still hears the room, but nothing is reaching the recording, and the meter belongs to it.
    B.setA(6, P.PreviewOn && !P.StatePaused ? P.AudioLevel : 0);

    // Needs_Confirm (H=164/165): confirm window open and not yet confirmed
    B.setD(118, P.StateConfirmRaw && !P.Confirmed ? 1 : 0);
  }
}

window.Program = Program;
