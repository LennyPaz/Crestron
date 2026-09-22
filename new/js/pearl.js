// PearlRest module simulation: the user-visible state machine of
// panel-project/PearlRest.usp (v10.45), driven by a simulated schedule and
// recorder instead of HTTP. The kiosk state compute mirrors
// PearlRest.usp:3747-3779; string formats follow the module's own formatters
// (FmtClockFull "2:35 PM" user-facing, FmtClockPad "02:35p" TODAY rail,
// FmtDurMin "1 hr 5 min", CountdownText pure durations). Bindings are
// INDEPENDENT the way the parser's are (PearlRest.usp:2432-2438): the confirm
// binding is the earliest window-open unconfirmed opt-in event regardless of a
// running recording, which is what lights the mid-recording confirm strip.
// Event plane leads recorder truth: starts show STARTING for ~2 s, stops keep
// the RECORDING story through a ~1.5 s teardown before ENDED arms.
// Corrected against the Codex round-2 review 2026-08-28.
"use strict";

function fmtClockFull(ep) {
  const d = new Date(ep * 1000);
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? " PM" : " AM";
  h = h % 12; if (h === 0) h = 12;
  return h + ":" + String(m).padStart(2, "0") + ap;
}
function fmtClock(ep) {           // compact "2:35p"
  const d = new Date(ep * 1000);
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "p" : "a";
  h = h % 12; if (h === 0) h = 12;
  return h + ":" + String(m).padStart(2, "0") + ap;
}
function fmtClockPad(ep) {        // "02:35p", fixed 6 chars for the TODAY rail
  let r = fmtClock(ep);
  if (r.length < 6) r = "0" + r;
  return r;
}
function fmtDurMin(mins) {        // "23 min" / "1 hr" / "5 hr 25 min"
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h <= 0) return m + " min";
  if (m === 0) return h + " hr";
  return h + " hr " + m + " min";
}
function sanitizeTitle(s, cap) {
  // PearlRest:4492-4496: JSON-safe, markup-safe, capped at 40 (a typed title); the dated
  // default is built wider (72) so its date survives to the device
  cap = cap || 40;
  let out = "";
  for (const ch of String(s)) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) out += " ";
    else if ('"\\<>'.includes(ch)) out += "'";
    else out += ch;
    if (out.length >= cap) break;
  }
  return out;
}
// What the panel SHOWS for a device title (PearlRest.usp:2525-2540, v10.21): a trailing
// " - YYYY-MM-DD" is stripped (every surface is today), then capped at 56 with "..".
function displayTitle(t) {
  let s = String(t);
  if (/ - \d{4}-\d{2}-\d{2}$/.test(s)) s = s.slice(0, -13);
  if (s.length > 56) s = s.slice(0, 54) + "..";
  return s;
}

const START_LAG_TICKS = 20;   // recorder truth follows the event plane by ~2 s
const STOP_TEARDOWN_TICKS = 15;

class PearlSim {
  constructor(bus, opts) {
    this.bus = bus;
    this.opts = opts || {};
    this.now = () => Math.floor((this.opts.now ? this.opts.now() : Date.now()) / 1000);

    // schedule: [{id,title,start,end,optIn,confirmed,started,ended,walkup}]
    this.schedule = [];
    this.health = { recorderValid: true, scheduleValid: true, transportDown: false };

    // recorder plane
    this.recording = false;       // recorder truth
    this.recStartEp = 0;
    this.startLag = 0;            // ticks until recorder truth follows a started event
    this.teardown = 0;            // ticks the stop dispatch is in flight
    this.teardownEvent = null;
    this.paused = false;
    this.pausePending = 0;
    this.pauseDirection = 0;      // 1 engaging, 2 resuming
    this.layoutN = 1;             // View1 Instructor / View2 Students / View3 Both

    // preview: ONE timer (v10.12)
    this.previewOn = false;
    this.previewSec = 0;

    // ended story: 300 ticks ~= 30 s (v10.7)
    this.endedTicks = 0;
    this.endedTitle = "";

    // walk-up form
    this.adhoc = { fsuid: "", title: "", durMin: 0, custom: false, verified: false, verifiedId: "", name: "", error: "" };

    this.statusTransient = ""; this.statusTtl = 0;
    this.extendNote = ""; this.extendTtl = 0;

    this.out = {};
    this._msAcc = 0;
    this._nextId = 100;
    this.extendGuard = 0;         // ticks: ~500 ms drop-only guard on +5 (PearlRest.usp:3174)
    this.verifyTicks = 0;         // ticks until a verify "reply" lands; "Checking..." meanwhile
    this.verAge = 0;              // ticks verified without a walk-up touch; 1800 (~3 min) clears
    this.publish();
  }

  postStatus(msg) { this.statusTransient = msg; this.statusTtl = 200; }   // ~20 s

  // ------------------------------------------------------------ schedule + bindings
  setSchedule(evts) { this.schedule = evts.slice().sort((a, b) => a.start - b.start); }
  terminal(e) { return e.ended || (!e.started && e.end <= this.now()); }
  runEvent() { return this.schedule.find(e => e.started && !e.ended) || null; }
  displayHead() {
    return this.schedule.find(e => !this.terminal(e)) || null;
  }
  confirmBinding() {
    // earliest window-open unconfirmed opt-in event, independent of any recording
    const now = this.now();
    return this.schedule.find(e =>
      !this.terminal(e) && e.optIn && !e.confirmed && now >= e.start - 1800) || null;
  }
  confirmedWindow() {
    return this.schedule.find(e => e.confirmed && !this.terminal(e)) || null;
  }
  nextEvent() {
    const now = this.now();
    return this.schedule.find(e => !e.started && !e.ended && e.start > now) || null;
  }
  // The BOOKED window (PearlRest.usp:2671-2691): a not-running, not-finished event
  // whose window covers now. This is the ordinary opt-in case -- a class whose start
  // has passed and nobody confirmed -- and without it the always-visible status line
  // tells the instructor the room is free while the walk-up gate refuses them.
  bookedUntil() {
    const now = this.now();
    let fin = 0;
    for (const e of this.schedule) {
      if (this.terminal(e) || (e.started && !e.ended)) continue;
      if (e.start <= now && e.end > now && e.end > fin) fin = e.end;
    }
    return fin;
  }
  // naming the end is only honest when the room is genuinely free at that moment
  bookedNamed() {
    const fin = this.bookedUntil();
    if (!fin) return false;
    const nx = this.nextEvent();
    return !(nx && nx.start <= fin);
  }

  // ------------------------------------------------------------ presses
  confirm() {
    const e = this.confirmBinding();
    if (e) e.confirmed = true;
  }
  confirmStart() {
    const e = this.confirmBinding();
    if (e) { e.confirmed = true; this.startEvent(e); }
  }
  startNow() {
    const e = this.confirmedWindow();
    if (e && !e.started) this.startEvent(e);
  }
  startEvent(e, immediate) {
    if (this.runEvent()) return;               // one event records at a time
    e.started = true;
    this.endedTicks = 0;                       // a new recording cancels the ended story
    if (immediate) { this._recorderRose(); this.startLag = 0; }
    else this.startLag = START_LAG_TICKS;      // STARTING window: StateRec without truth
  }
  // "Recording started" belongs to the RECORDER's rising edge, not the event
  // plane (PearlRest.usp:3567): during the STARTING window nothing is recording yet
  _recorderRose() {
    this.recording = true; this.recStartEp = this.now();
    this.postStatus("Recording started");
  }
  recordStop() {
    if (this.teardown > 0) return;               // a stop is already in flight
    const run = this.runEvent();
    if (!run && !this.recording) return;
    this.postStatus("Ending the recording");
    this.teardown = STOP_TEARDOWN_TICKS;       // REC story holds while the stop lands
    this.teardownEvent = run;
  }
  _finishStop(run) {
    if (run) run.ended = true;
    this.recording = false; this.startLag = 0;
    this.paused = false; this.pausePending = 0; this.pauseDirection = 0;
    this.previewOn = false; this.previewSec = 0;   // recorder falling closes preview
    this.endedTicks = 300;
    this.endedTitle = run ? run.title : this.endedTitle;
    this.postStatus("Recording ended");
  }
  extend5() {
    if (this.extendGuard > 0) return;            // a second press inside ~500 ms is dropped
    this.extendGuard = 5;
    const run = this.runEvent();
    if (run && this._extendOk()) {
      run.end += 300;
      this.extendNote = "Extended to " + fmtClockFull(run.end);   // v10.17
      this.extendTtl = 60;
      this.postStatus("Extended +5 min");
    }
  }
  _extendOk() {
    const run = this.runEvent(); if (!run) return false;
    const nx = this.nextEvent();
    return !nx || nx.start > run.end + 300;
  }
  holdOn() {
    if (!this.recording || this.paused || this.pauseDirection === 1) return;
    this.pauseDirection = 1; this.pausePending = 15;
  }
  holdOff() {
    if (!this.paused && this.pauseDirection !== 1) return;
    this.pauseDirection = 2; this.pausePending = 20;   // RESUMING (v10.36)
  }
  setLayout(n) { this.layoutN = n; }
  layout(n) { this.setLayout(n); }

  previewCmd(c) {
    if (c === 1) { this.previewOn = true; this.previewSec = 60; }
    else if (c === 2) { this.previewOn = false; this.previewSec = 0; }
  }
  // the legacy PreviewShow pin (module I20, panel d150): pressing the LIT button
  // always CLOSES; one timer either way (PearlRest.usp:4532-4538)
  previewToggle() {
    if (this.previewOn) { this.previewOn = false; this.previewSec = 0; }
    else { this.previewOn = true; this.previewSec = 60; }
  }
  previewYield() { this.previewCmd(2); }
  walkupOpen() {
    // Opening the form ends any check still in flight, even if the SAME id is typed back within
    // the second (Astra, 2026-09-18, after this line was wrongly removed as redundant). With the
    // edit-cancel in setAdhocFsuid, these two are the only ways an answer can go stale.
    this.verifyTicks = 0; this._verifyId = "";
    this.adhoc = { fsuid: "", title: "", durMin: 0, custom: true, verified: false, verifiedId: "", name: "", error: "" };
    this.bus.setS(41, "", true); this.bus.setS(43, "", true); this.bus.setS(45, "", true);
  }
  _sanId(v) { return String(v || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 20); }
  setAdhocFsuid(v) {
    this.adhoc.fsuid = v;
    // an edit while "Checking..." cancels that check: its answer is for an id no longer typed
    if (this.verifyTicks > 0 && this._sanId(v) !== this._verifyId) {
      this.verifyTicks = 0; this.adhoc.name = "";
    }
    // an edit clears verification only when the SANITIZED id actually changed
    if (this.adhoc.verified && this._sanId(v) !== this.adhoc.verifiedId) {
      this.adhoc.verified = false; this.adhoc.verifiedId = ""; this.adhoc.name = "";
    }
  }
  setAdhocTitle(v) { this.adhoc.title = v; }
  setAdhocDurMin(v) {
    const rawFull = String(v);
    this.adhoc.custom = true;
    if (rawFull.length > 8) { this._badDur(); return; }
    const raw = rawFull.replace(/ /g, "");
    if (raw === "") { this.adhoc.durMin = 0; this.adhoc.error = ""; return; }
    if (!/^\d{1,4}$/.test(raw)) { this._badDur(); return; }
    const n = parseInt(raw, 10);
    if (n < 1 || n > 480) { this._badDur(); return; }
    this.adhoc.durMin = n; this.adhoc.error = "";
  }
  _badDur() {
    this.adhoc.durMin = 0;
    this.adhoc.error = "Whole minutes 1-480 only";
    if (!this.adhoc.verified) this.adhoc.name = "Whole minutes 1-480 only";
  }
  adhocDur(n) { this.adhoc.durMin = n; this.adhoc.custom = false; this.adhoc.error = ""; this.bus.setS(45, "", true); }
  customArm() { this.adhoc.custom = true; this.adhoc.durMin = 0; }
  // PearlRest.usp:3147-3150: any verify starts unverified and shows "Checking..." until the
  // device answers; the answer is simulated a second later (_verifyReply). There is no directory
  // here, so any plausible id gets an invented name.
  adhocVerify() {
    const id = this._sanId(this.adhoc.fsuid);
    this.adhoc.verified = false; this.adhoc.verifiedId = ""; this.verifyTicks = 0;
    if (id.length === 0) { this.adhoc.name = "Type your FSUID first"; return; }
    this.adhoc.name = "Checking...";
    this._verifyId = id;
    this.verifyTicks = 10;
  }
  _verifyReply() {
    const id = this._verifyId;
    if (id.length < 3) { this.adhoc.name = "ID not found"; return; }
    const cap = id[0].toUpperCase() + id.slice(1).replace(/[0-9]/g, "");
    this.adhoc.verified = true;
    this.adhoc.verifiedId = id;
    this.adhoc.name = this.opts.verifyName ? this.opts.verifyName(id) : (cap + " Seminole");
    this.adhoc.error = "";
    this.verAge = 0;
  }
  // any touch on the walk-up page keeps a verification alive (PearlRest.usp:4244-4256)
  walkupTouch() { this.verAge = 0; }
  _walkupTitle() {
    const d = new Date(this.now() * 1000);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const typed = sanitizeTitle(this.adhoc.title).trim();
    if (typed) return typed;
    if (this.adhoc.name) return sanitizeTitle("New Recording - " + this.adhoc.name + " - " + iso, 72);   // v10.13
    return "New Recording - " + iso;
  }
  adhocCreate() {
    if (!this._adhocReady()) return;
    const now = this.now(), dur = this.adhoc.durMin * 60;
    // an open booking refuses before the gap arithmetic is even reached: the
    // device would 409 anything (PearlRest.usp:4453-4466)
    const bookFin = this.bookedUntil();
    if (bookFin) {
      this.adhoc.error = this.bookedNamed()
        ? "The room is booked until " + fmtClockFull(bookFin)
        : "The room is booked right now";
      this.postStatus(this.adhoc.error);
      return;
    }
    const nx = this.nextEvent();
    if (nx) {
      const gap = nx.start - now;
      if (dur + 13 >= gap) {                       // GAP_SKEW_S 13
        const freeMin = Math.floor((gap - 1 - 45 - 13) / 60);   // GAP_TYPING_S 45
        if (freeMin > 0) this.adhoc.error = "Only " + fmtDurMin(freeMin) + " free before the next scheduled recording";
        else this.adhoc.error = "Too close to the next scheduled recording";
        this.postStatus(this.adhoc.error);
        return;
      }
    }
    // a walk-up creates a REAL event on the device: it lands in TODAY, owns
    // EventRun/RemainingSeconds, and stops/extends through the event path
    const ev = {
      // the device keeps the dated title; the panel only ever sees it as parsed back
      id: "walkup" + (this._nextId++), title: displayTitle(this._walkupTitle()),
      start: now, end: now + dur, optIn: false, confirmed: true,
      started: false, ended: false, walkup: true,
    };
    this.schedule.push(ev);
    this.setSchedule(this.schedule);
    this.startEvent(ev, true);                     // create 200 = recording now
    this.adhoc = { fsuid: "", title: "", durMin: 0, custom: true, verified: false, verifiedId: "", name: "", error: "" };
    this.bus.setS(41, "", true); this.bus.setS(43, "", true); this.bus.setS(45, "", true);
  }
  _adhocReady() {
    return this.adhoc.verified && this.adhoc.durMin > 0 && !this.runEvent() && !this.recording;
  }
  endedDismiss() { this.endedTicks = 0; }

  // ------------------------------------------------------------ tick
  pumpTick(ms) {
    this._msAcc += ms;
    if (this.extendGuard > 0) this.extendGuard -= 1;
    if (this.verifyTicks > 0) { this.verifyTicks -= 1; if (this.verifyTicks === 0) this._verifyReply(); }
    // v10.15: a verification with no walk-up touch for ~3 min clears, fields and all
    if (this.adhoc.verified) {
      this.verAge += 1;
      if (this.verAge >= 1800) {
        this.adhoc = { fsuid: "", title: "", durMin: 0, custom: this.adhoc.custom, verified: false, verifiedId: "", name: "", error: "" };
        this.bus.setS(41, "", true); this.bus.setS(43, "", true); this.bus.setS(45, "", true);
        this.verAge = 0;
      }
    } else this.verAge = 0;
    const now = this.now();

    // schedule plane: auto-start at the boundary (confirmed or not opt-in)
    for (const e of this.schedule) {
      if (!e.started && !e.ended && now >= e.start && now < e.end) {
        if (!e.optIn || e.confirmed) this.startEvent(e);
      }
      if (e.started && !e.ended && now >= e.end && !this.teardown) {
        this.postStatus("Ending the recording");
        this.teardown = STOP_TEARDOWN_TICKS;
        this.teardownEvent = e;
      }
    }

    // recorder follows the event plane
    if (this.startLag > 0) {
      this.startLag -= 1;
      if (this.startLag <= 0 && this.runEvent()) this._recorderRose();
    }
    if (this.teardown > 0) {
      this.teardown -= 1;
      if (this.teardown <= 0) { this._finishStop(this.teardownEvent); this.teardownEvent = null; }
    }

    if (this.pausePending > 0) {
      this.pausePending -= 1;
      if (this.pausePending <= 0) {
        if (this.pauseDirection === 1) {
          this.paused = true;
          this.previewOn = true; this.previewSec = 60;   // hold-confirmed auto-preview (v10.10)
        }
        if (this.pauseDirection === 2) this.paused = false;
        this.pauseDirection = 0;
      }
    }

    if (this._msAcc >= 1000) {
      this._msAcc -= 1000;
      if (this.previewOn) {
        this.previewSec -= 1;
        if (this.previewSec <= 0) { this.previewOn = false; this.previewSec = 0; }
      }
    }

    if (this.endedTicks > 0 && !this.recording) this.endedTicks -= 1;   // output is gated, not the counter
    if (this.extendTtl > 0) this.extendTtl -= 1;
    if (this.statusTtl > 0) { this.statusTtl -= 1; if (this.statusTtl === 0) this.statusTransient = ""; }

    this.publish();
  }

  _countdown(startEp, running) {
    if (running) return "";
    const now = this.now();
    if (startEp > now) {
      const delta = startEp - now;
      if (delta < 60) return "Less than 1 minute";
      return fmtDurMin(Math.floor(delta / 60));
    }
    return fmtClockFull(startEp);
  }

  // ------------------------------------------------------------ publish
  publish() {
    const B = this.bus, now = this.now();
    const run = this.runEvent();
    const head = this.displayHead();
    const cBind = this.confirmBinding();
    const cWin = this.confirmedWindow();
    const nx = this.nextEvent();
    const H = this.health;
    const schedOk = H.scheduleValid;
    const health = (H.recorderValid ? 1 : 0) | (schedOk ? 2 : 0) | (H.transportDown ? 4 : 0);

    // ---- kiosk state machine (PearlRest.usp:3747-3779) ----
    // display recording holds through the stop teardown (the persisted event id)
    const stopOk = this.recording || !!run || this.teardown > 0;
    const confirmReady = schedOk && !!cBind;
    const confirmed = schedOk && head ? (head.confirmed && !head.ended) : false;
    const hasNext = (schedOk && !!head) || !schedOk;
    let stRec = 0, stPau = 0, stConf = 0, stConfd = 0, stUp = 0, stIdle = 0;
    if (stopOk) { if (this.paused) stPau = 1; else stRec = 1; }
    else if (this.endedTicks === 0) {
      if (confirmReady && !confirmed) stConf = 1;
      else if (confirmed) stConfd = 1;
      else if (hasNext) stUp = 1;
      else stIdle = 1;
    }
    const endedPulse = this.endedTicks > 0 && !stopOk ? 1 : 0;

    // ---- strings ----
    const nowTitle = run ? run.title : "";
    const nowUntil = run ? "Recording until " + fmtClockFull(run.end) : "";
    // the confirm-card subject: confirmed head, else the confirm binding (v10.44/45)
    const cardEvent = (head && head.confirmed && !head.ended) ? head : cBind;
    const confirmTitle = cardEvent ? cardEvent.title : "";
    const confirmSub = cardEvent
      ? (now >= cardEvent.start ? "Starts recording now" : "Starts recording at " + fmtClockFull(cardEvent.start)) : "";
    let remaining = 0;
    if (run && this.recording) remaining = Math.min(65000, Math.max(0, run.end - now));

    // status line s1
    let status;
    if (H.transportDown || !H.recorderValid) status = "Offline";
    else if (this.recording && nowUntil) status = "Online · " + nowUntil;
    else if (this.recording) status = "Online · Recording";
    else if (!schedOk) status = "Online · Schedule unavailable";
    // A held run id reads as RECORDING even before recorder truth arrives
    // (PearlRest.usp:3640-3660 sets blRec from gRunEvId$), so the STARTING window
    // says "Recording until X". "Booked" belongs ONLY to a window with nothing
    // running; saying it during a start contradicts the STARTING card.
    else if (run) status = "Online · Recording until " + fmtClockFull(run.end);
    else if (this.bookedUntil()) {
      // an unconfirmed class whose start has passed: the room is NOT free
      status = this.bookedNamed()
        ? "Online · Booked until " + fmtClockFull(this.bookedUntil()) + " · Not recording"
        : "Online · Booked · Not recording";
    }
    else if (nx) status = "Online · Next recording at " + fmtClockFull(nx.start);
    else status = "Online · Ready";
    if (this.statusTtl > 0 && this.statusTransient) status = this.statusTransient;

    // elapsed s2: minutes:SS, not hour-wrapped
    let elapsed = "0:00";
    if (this.recording) {
      const s = Math.max(0, now - this.recStartEp);
      elapsed = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }

    // TODAY rail s21..s28: terminal events are excluded (PearlRest:2391-2417)
    const live = schedOk ? this.schedule.filter(e => !this.terminal(e)) : [];
    const rows = live.slice(0, 8);
    for (let i = 0; i < 8; i++) {
      const e = rows[i];
      const suppressed = this.previewOn && i >= 3;   // frames 4..8 yield to the preview panes
      B.setD(102 + i, e && !suppressed ? 1 : 0);
      B.setD(157 + i, e && run === e && !suppressed ? 1 : 0);
      let txt = "";
      if (e) {
        const t = fmtClockPad(e.start);
        const title = e.title.length > 35 ? e.title.slice(0, 33) + ".." : e.title;
        const timeColor = run === e ? "#FFFFFF" : "#DFD1A7";
        txt = '<FONT color="' + timeColor + '">' + t + '</FONT>  <FONT color="#FFFFFF">' + title + "</FONT>";
      }
      B.setS(21 + i, txt);
    }
    B.setS(30, live.length > 8 ? "+" + (live.length - 8) + " more later today" : "");

    // schedule surfaces degrade honestly when the schedule is unavailable
    if (!schedOk) {
      B.setS(3, "Schedule unavailable"); B.setS(4, ""); B.setS(5, "");
      B.setS(6, ""); B.setS(11, "");
      B.setS(8, "Schedule unavailable"); B.setS(9, ""); B.setS(10, "");
    } else {
      const headTitle = head ? head.title : "No more recordings today";
      B.setS(3, headTitle);
      B.setS(4, head ? (fmtClockFull(head.start) + " - " + fmtClockFull(head.end)) : "");
      B.setS(5, head ? this._countdown(head.start, !!(head.started && !head.ended)) : "");
      // s6 belongs to the CONFIRM BINDING alone (PearlRest:2559-2576)
      const clTitle = cBind ? (cBind.title.length > 42 ? cBind.title.slice(0, 40) + ".." : cBind.title) : "";
      B.setS(6, cBind ? "Confirm: " + clTitle + " " + fmtClockFull(cBind.start) : "");
      B.setS(11, confirmSub);
      B.setS(8, nx ? nx.title : "No more recordings today");
      B.setS(9, nx ? (fmtClockFull(nx.start) + " - " + fmtClockFull(nx.end)) : "");
      B.setS(10, nx ? this._countdown(nx.start, false) : "");
    }

    B.setS(1, status);
    B.setS(2, elapsed);
    B.setS(7, nowTitle);
    B.setS(12, nowUntil);
    B.setS(13, this.adhoc.error);
    B.setS(14, this.extendTtl > 0 ? this.extendNote
      : (run && !this._extendOk() && nx ? "Next class at " + fmtClockFull(nx.start) : ""));
    B.setS(46, this.adhoc.name);
    const url = this.previewOn ? "rtsp://pearl.sim:554/stream.sdp" : "";
    const urlCam = this.previewOn ? "rtsp://pearl.sim:555/stream.sdp" : "";
    B.setS(60, url); B.setS(61, urlCam); B.setS(62, url);

    // ---- digitals the glass consumes directly ----
    B.setD(80, this.pausePending > 0 ? 1 : 0);           // engaging / RESUMING cover
    const extReady = this._extendOk();
    B.setD(83, extReady ? 1 : 0);
    B.setD(152, extReady ? 0 : 1);
    B.setD(91, confirmReady && stopOk ? 1 : 0);          // StripVis (H=143)
    const startBind = cWin && !cWin.started && now >= cWin.start - 1800 ? cWin : null;
    B.setD(95, startBind ? 1 : 0);                       // StartReady
    const nextStarted = cBind && now >= cBind.start;
    B.setD(98, nextStarted ? 1 : 0);                     // NextStarted
    B.setD(100, nextStarted ? 0 : 1);                    // NotStarted
    B.setD(99, stConf && nextStarted ? 1 : 0);           // ConfirmStartedHelp
    B.setD(101, stConf && !nextStarted ? 1 : 0);         // ConfirmPreStart
    B.setD(169, schedOk && nx && nx.confirmed && stopOk ? 1 : 0);   // ChipVis
    // walk-up form lamps. d130 and d138 are press AND feedback joins (the VERIFY
    // and CUSTOM buttons carry their own selected faces); d139/d140 are the
    // bright/dim ready dot beside START RECORDING, both fed by AdhocReady_Fb.
    const ready = this._adhocReady() ? 1 : 0;
    B.setD(130, this.adhoc.verified ? 1 : 0);        // VERIFY -> VERIFIED, teal face
    B.setD(131, this.adhoc.verified ? 1 : 0);
    B.setD(133, ready);
    B.setD(134, !this.adhoc.custom && this.adhoc.durMin === 30 ? 1 : 0);
    B.setD(135, !this.adhoc.custom && this.adhoc.durMin === 60 ? 1 : 0);
    B.setD(136, !this.adhoc.custom && this.adhoc.durMin === 90 ? 1 : 0);
    B.setD(137, this.adhoc.custom ? 1 : 0);
    B.setD(138, this.adhoc.custom ? 1 : 0);          // CustomActive_Fb selected face
    B.setD(139, ready);                              // bright ready dot
    B.setD(140, ready ? 0 : 1);                      // dim not-ready dot
    // camera layout seg buttons (d120 Instructor / d121 Students / d122 Both)
    B.setD(120, this.layoutN === 1 ? 1 : 0);
    B.setD(121, this.layoutN === 2 ? 1 : 0);
    B.setD(122, this.layoutN === 3 ? 1 : 0);

    this.out = {
      Recording: this.recording ? 1 : 0,
      Paused: this.paused ? 1 : 0,
      PausePending: this.pausePending > 0 ? 1 : 0,
      ConfirmReady: confirmReady ? 1 : 0,
      Confirmed: confirmed ? 1 : 0,
      EventRun: run ? 1 : 0,
      StopReady: stopOk ? 1 : 0,
      StateIdleRaw: stIdle, StateUpNextRaw: stUp, StateConfirmRaw: stConf, StateConfirmedRaw: stConfd,
      StateIdle: stIdle, StateUpNext: stUp, StateRec: stRec, StatePaused: stPau,
      EndedPulse: endedPulse,
      HasNext: hasNext ? 1 : 0,
      PreviewOn: this.previewOn ? 1 : 0,
      PreviewSeconds: this.previewSec,
      RemainingSeconds: remaining,
      RecorderHealth: health,
      AudioLevel: this.recording || this.previewOn ? 20000 + Math.floor(Math.random() * 25000) : 8000,
      NowTitle: nowTitle, UpNextTitle: nx ? nx.title : "",
      UpNextTime: nx ? (fmtClockFull(nx.start) + " - " + fmtClockFull(nx.end)) : "",
      NowUntil: nowUntil,
      ConfirmTitle: confirmTitle, ConfirmSub: confirmSub,
    };
  }
}

window.PearlSim = PearlSim;
