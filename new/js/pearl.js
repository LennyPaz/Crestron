// PearlRest module simulation: the user-visible state machine of
// pearl-api-reference/simplplus/PearlRest.usp (v10.65 cut 7, what the room and the bench run; ported
// from v10.45 up, the real pause from v10.60), driven by a simulated schedule and
// recorder instead of HTTP. The kiosk state compute mirrors
// PearlRest.usp:4995-5020 (v10.65); string formats follow the module's own formatters
// (FmtClockFull "2:35 PM" user-facing, FmtClockPad "02:35p" TODAY rail,
// FmtDurMin "1 hr 5 min", CountdownText pure durations). Bindings are
// INDEPENDENT the way the parser's are (PearlRest.usp:2432-2438): the confirm
// binding is the earliest window-open unconfirmed opt-in event regardless of a
// running recording, which is what lights the mid-recording confirm strip.
// Event plane leads recorder truth: starts show STARTING for ~2 s, stops keep
// the RECORDING story through a ~1.5 s teardown before ENDED arms.
// Corrected against the Codex round-2 review 2026-08-28.
"use strict";

// The one ID the walk-up form accepts (owner 2026-09-29): given to testers in the task text, so
// nobody types their real FSUID. FSUID-shaped, with no characters that read alike (no l, I, 1, O,
// 0, S, 5). Any other ID answers "ID not found", as the real panel does for an unknown one.
const PRACTICE_FSUID = "rwp34x";

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
// The real pause (PearlRest v10.60 to v10.65). The event pauses or resumes at once and the recorders
// follow 1 to 3 s later (DEVICE_FACTS, pause measurements); the module believes only the recorders.
const REC_FOLLOW_TICKS = 20;
// A walk-up is bound the moment it is created, before a schedule reading lists its capabilities
// (PearlRest.usp:4477). Until that reading, HOLD has to ask: "One moment".
const CAP_READ_TICKS = 20;
// ComposeDevice's rows (PearlRest.usp:1019-1026). The simulated readings are the recorders' own truth,
// read every tick, so the rows for recorders that disagree or cannot be read never arise here.
const ROW_PLAIN = 0, ROW_ENDING = 2, ROW_PAUSING = 3, ROW_UNPROVEN = 5, ROW_PAUSED = 8;
const OP_PAUSE = 1, OP_RESUME = 2;

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
    this.resetPause();
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

  // PearlRest.usp:1878: a posted sentence stands 20 s (5 s when a change of class posts it). kind 0 is
  // the answer to a press and stays; kind 2 is progress, and the next change of row releases it (:1783).
  postStatus(msg, kind, short) {
    this.statusTransient = msg; this.statusTtl = short ? 50 : 200; this.statusKind = kind || 0;
  }

  // Everything the real pause, the press guards and the preview's owner keep. Also the task reset's.
  resetPause() {
    this.devPaused = false;       // the event at the device: what the recorded channels put out
    this.recPaused = false;       // every recorder paused: the only proof of a pause (gCap PAUSED)
    this.recFollow = 0;           // ticks until the recorders follow the event
    this.pauseInPlay = false;     // a reading has had a recorder paused (gPauseInPlay)
    this.opDir = 0;               // our pause or resume, sent and not yet proven
    this.coverAge = 0;            // ticks the cover has been up; it comes down at ten seconds
    this.holdPark = 0;            // a HOLD waiting for the class's capabilities
    this.capWait = 0;             // ticks until a reading lists the bound class's capabilities
    this.devRow = ROW_PLAIN; this.statusKind = 0;
    this.boundId = "";            // the class the module has bound (gRunEvId$)
    this.classWin = 0; this.endBlock = 0; this.endBlockSc = 0; this.holdBlock = 0; this.resumeBlock = 0;
    this.pvByHold = false;        // the open preview was opened by our proven pause alone
    this.pvCloseAge = 30000;      // ticks since the instructor's last CLOSE
  }
  // A class already recording when a task begins was bound long ago: no change-of-class window, and its
  // capabilities are known (a task does not start inside the second after a class changes).
  settle() {
    const run = this.runEvent();
    this.boundId = run ? run.id : ""; this.capWait = 0;
    this.classWin = 0; this.endBlock = 0; this.endBlockSc = 0; this.holdBlock = 0; this.resumeBlock = 0;
  }

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
    // Started early, the device rewrites the event's start to the actual moment (crestron_control_
    // catalog.md D15, measured), so TODAY and the running class's times show when it really began.
    // The scheduled start stays in e.start: the tasks grade "early" against it. (Audit, Astra and
    // Sol 6.1, 2026-10-02.)
    if (this.now() < e.start) e.actualStart = this.now();
    this.endedTicks = 0;                       // a new recording cancels the ended story
    // A walk-up is bound, and records, before any reading lists what it can do. A class START NOW
    // starts is bound early too (PearlRest.usp:4379), but its recorders take the ~2 s STARTING window to
    // rise and no HOLD is taken before they do; the sim lets the reading land inside that window.
    this.capWait = immediate ? CAP_READ_TICKS : 0;
    if (immediate) { this._recorderRose(); this.startLag = 0; }
    else this.startLag = START_LAG_TICKS;      // STARTING window: StateRec without truth
  }
  // "Recording started" belongs to the RECORDER's rising edge, not the event
  // plane (PearlRest.usp:3567): during the STARTING window nothing is recording yet
  _recorderRose() {
    this.recording = true; this.recStartEp = this.now();
    this.postStatus("Recording started", 2);
  }
  // A change of the class the module has bound (PearlRest.usp:1990 ClassCleared, :1999 SessionChanged).
  // The press guards of cut 7: no END, HOLD or RESUME is taken for one second, so a tap made on the old
  // class's glass cannot reach the new class. Called every tick and ahead of every press.
  _syncBinding() {
    const run = this.runEvent(), id = run ? run.id : "";
    if (id === this.boundId) return;
    const old = this.boundId;
    this.boundId = id;
    // an answer about the class that is going does not stand over the next one
    const dropAnswer = () => { if (this.statusTtl > 0 && this.statusKind === 0) { this.statusTtl = 0; this.statusTransient = ""; } };
    if (id === "") { dropAnswer(); this.endBlockSc = 1; }
    else {
      if (old !== "") dropAnswer();
      this.opDir = 0; this.pauseInPlay = false;
      if (old !== "") { this.holdPark = 0; this.endBlockSc = 1; }   // a pause belongs to the class it was pressed for
      else if (this.endBlock === 0) this.endBlockSc = 0;
    }
    this.classWin = 11; this.endBlock = 11; this.holdBlock = 11; this.resumeBlock = 11;
  }
  recordStop() {
    this._syncBinding();
    // the panel delivers one tap twice: the first delivery arms half a second in which the next is
    // dropped, and inside a change of class the window's drop also takes the tap's second delivery,
    // answered when the class went (PearlRest.usp:3836-3851)
    if (this.endBlock > 0) {
      if (this.classWin > 0 && this.endBlock < 4) this.endBlock = 4;
      if (this.endBlockSc) this.postStatus("That class has already ended", 0, true);
      return;
    }
    this.endBlock = 5; this.endBlockSc = 0;
    if (this.teardown > 0) return;               // a stop is already in flight
    const run = this.runEvent();
    if (!run && !this.recording) return;
    this.postStatus("Ending the recording", 2);
    this.teardown = STOP_TEARDOWN_TICKS;       // REC story holds while the stop lands
    this.teardownEvent = run;
    // the stop's answer ends any pause or resume of ours and a HOLD still waiting (PearlRest.usp:4390, 5486)
    this.opDir = 0; this.coverAge = 0; this.holdPark = 0;
  }
  _finishStop(run) {
    if (run) run.ended = true;
    this.recording = false; this.startLag = 0;
    this.devPaused = false; this.recPaused = false; this.recFollow = 0;
    this.pauseInPlay = false; this.opDir = 0; this.holdPark = 0;
    this.previewOn = false; this.previewSec = 0;   // recorder falling closes preview
    this.endedTicks = 300;
    this.endedTitle = run ? run.title : this.endedTitle;
    this.postStatus("Recording ended", 2);
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
  // HOLD (PearlRest.usp:3897-3916): taken while a recording runs, not ending, with the cover down as the
  // glass had it and no earlier HOLD still waiting. It pauses the class at the Pearl; it never changes a
  // layout.
  holdOn() {
    this._syncBinding();
    if (this.holdBlock > 0) { if (this.classWin > 0 && this.holdBlock < 4) this.holdBlock = 4; return; }
    this.holdBlock = 5;
    const coverWas = this._cover(this._row());   // as the glass shows it at the press
    if (this.recording && this.teardown === 0 && !coverWas && this.holdPark === 0) this._holdDecide(false);
  }
  // HoldDecide (PearlRest.usp:2196): on the room's firmware (4.24.6) a running class that is not paused
  // lists pause Enabled once a reading has listed it at all (a paused one lists it Disabled, and HOLD is
  // not reached then). Before that reading the press waits for it, saying "One moment".
  _holdDecide(finalTry) {
    this.holdPark = 0;
    if (this.recPaused) return;                     // already paused at the recorders: nothing to send
    if (this.runEvent() && this.capWait === 0) { this.coverAge = 0; this._firePause(); }
    else if (!finalTry) { this.holdPark = 50; this.postStatus("One moment", 2); }
    else this.postStatus("Could not pause - still recording");
  }
  // FireDevPause (PearlRest.usp:2170): re-judged at the send
  _firePause() {
    if (!this.runEvent() || this.teardown > 0 || !this.recording) { this.postStatus("Could not pause - still recording"); return; }
    this.opDir = OP_PAUSE;
    this.devPaused = true;                          // the event pauses at once...
    this.recFollow = REC_FOLLOW_TICKS;              // ...and the recorders follow
    this.postStatus("Pausing the recording", 2);
  }
  // RESUME (PearlRest.usp:3852-3895): resumes a recording paused at the recorders, or our pause whose cover
  // is down, with the cover down as the glass had it and nothing ending.
  holdOff() {
    this._syncBinding();
    if (this.resumeBlock > 0) { if (this.classWin > 0 && this.resumeBlock < 4) this.resumeBlock = 4; return; }
    this.resumeBlock = 5;
    const coverWas = this._cover(this._row());   // as the glass shows it at the press
    if (!this.recording || this.teardown > 0 || coverWas) return;
    if (!(this.recPaused || this.opDir === OP_PAUSE)) return;
    this.holdPark = 0;
    if (!this.runEvent()) { this.postStatus("Could not resume - press RESUME again"); return; }
    this.opDir = OP_RESUME; this.coverAge = 0;     // its own ten seconds on the glass
    this.devPaused = false; this.recFollow = REC_FOLLOW_TICKS;
    this.postStatus("Resuming the recording", 2);
  }
  setLayout(n) { this.layoutN = n; }
  layout(n) { this.setLayout(n); }

  // Either preview press says who opened the preview: a person, so it is no longer the pause's alone
  // (PreviewHoldOnly_Fb, PearlRest.usp:5049). A CLOSE also starts the clock that keeps our pause's proof
  // from reopening it in the same half second (:4208).
  previewCmd(c) {
    if (c === 1) { this.previewOn = true; this.previewSec = 60; this.pvByHold = false; }
    else if (c === 2) { this.previewOn = false; this.previewSec = 0; this.pvByHold = false; this.pvCloseAge = 0; }
  }
  // the legacy PreviewShow pin (module I20, panel d150): pressing the LIT button
  // always CLOSES; one timer either way (PearlRest.usp:4532-4538)
  previewToggle() {
    if (this.previewOn) this.previewCmd(2);
    else this.previewCmd(1);
  }
  // The device side's row, cover and page (PearlRest.usp:1731-1776, ComposeDevice)
  _row() {
    if (!this.recording) return ROW_PLAIN;
    let row = this.recPaused ? ROW_PAUSED : ROW_PLAIN;
    if (this.opDir === OP_RESUME) row = ROW_UNPROVEN;
    if (this.opDir === OP_PAUSE) row = ROW_PAUSING;
    if (this.teardown > 0 && this.pauseInPlay) row = ROW_ENDING;
    return row;
  }
  _covered(row) { return row > ROW_PLAIN && row < ROW_PAUSED; }
  _cover(row) { return this._covered(row) && this.coverAge < 100; }
  // our pause stays on the RECORDING page under its cover for ten seconds, then shows PAUSED so that
  // RESUME can be reached; PAUSED, a resume of ours and an END while paused show the PAUSED page
  _devPage(row) {
    if (row === ROW_PAUSED || row === ROW_UNPROVEN || row === ROW_ENDING) return true;
    return row === ROW_PAUSING && this.coverAge >= 100;
  }
  previewYield() { this.previewCmd(2); }
  walkupOpen() {
    // Opening the form ends any check still in flight, even if the SAME id is typed back within
    // the second (Astra, 2026-09-18, after this line was wrongly removed as redundant). With the
    // edit-cancel in setAdhocFsuid, these two are the only ways an answer can go stale.
    this.verifyTicks = 0; this._verifyId = "";
    // Every open starts with CUSTOM chosen and no length (PearlRest v10.59:3418, "CUSTOM the entry
    // default"), and the program passes the module's CUSTOM lamp straight to the glass (Rev 64
    // H=156 ORs it with the CustomArm latch). Set to false on 2026-10-01 from the latch alone, which
    // was wrong; Sol 6.1's review caught it on 2026-10-02.
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
  // CUSTOM arms the typed length. From a preset it clears the length, so START waits for one to be
  // typed; over a valid typed length it changes nothing, as on the bench, where CUSTOM only sets the
  // program's CustomArm latch (Rev 60 R:7238) and the module keeps its value (Astra 2026-09-29: the
  // second press used to wipe the length and take START away).
  customArm() {
    if (this.adhoc.custom && this.adhoc.durMin > 0) return;
    this.adhoc.custom = true; this.adhoc.durMin = 0;
  }
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
    // only the practice ID is known here; capitals are accepted, as on the real panel (owner
    // 2026-09-29: an FSUID typed in full capitals still verifies there)
    if (id.toLowerCase() !== PRACTICE_FSUID) { this.adhoc.name = "ID not found"; return; }
    this.adhoc.verified = true;
    this.adhoc.verifiedId = id;
    // The real panel shows the person's full name. A tester's typed ID is not a real one, so any
    // name here is made up: "Test Instructor" says so plainly and can never match a real instructor
    // (owner, 2026-09-28; it used to be the ID plus "Seminole", which read as broken).
    this.adhoc.name = this.opts.verifyName ? this.opts.verifyName(id) : "Test Instructor";
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
    this.adhoc = { fsuid: "", title: "", durMin: 0, custom: false, verified: false, verifiedId: "", name: "", error: "" };
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
    if (this.endBlock > 0) this.endBlock -= 1;
    if (this.holdBlock > 0) this.holdBlock -= 1;
    if (this.resumeBlock > 0) this.resumeBlock -= 1;
    if (this.classWin > 0) this.classWin -= 1;
    if (this.pvCloseAge < 30000) this.pvCloseAge += 1;
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

    this._syncBinding();
    // a HOLD waiting for the class's capabilities is decided once the reading it asked for lists them
    if (this.capWait > 0) this.capWait -= 1;
    if (this.holdPark > 0) {
      if (this.capWait === 0) this._holdDecide(true);
      else if (--this.holdPark === 0) this.postStatus("Could not pause - still recording");
    }
    // the recorders follow the event, and their reading is what proves a pause or a resume
    // (PearlRest.usp:4158-4224)
    if (this.recFollow > 0 && --this.recFollow === 0 && this.recording) {
      this.recPaused = this.devPaused;
      this.pauseInPlay = this.recPaused;
      if (this.opDir === OP_RESUME && !this.recPaused) this.opDir = 0;
      if (this.opDir === OP_PAUSE && this.recPaused) {
        this.opDir = 0;
        // the proof opens the previews, as the hold did, but never over a CLOSE made this tick or in the
        // half second before; a preview it opens from closed belongs to the pause alone (v10.65 cut 2)
        if (this.pvCloseAge >= 5) {
          if (!this.previewOn) this.pvByHold = true;
          this.previewOn = true; this.previewSec = 60;
        }
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

    // ComposeDevice's bookkeeping, once a tick: the cover's clock, and a change of row releasing a
    // progress sentence posted before this pass (PearlRest.usp:1749-1792)
    const row = this._row();
    if (this._covered(row)) { if (this.coverAge < 30000) this.coverAge += 1; } else this.coverAge = 0;
    if (row !== this.devRow) {
      if (this.statusTtl > 0 && this.statusKind === 1) { this.statusTtl = 0; this.statusTransient = ""; }
      this.devRow = row;
    }
    if (this.statusKind === 2) this.statusKind = 1;

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
    // The device side this tick (PearlRest.usp:1731-1776): its row, whether the cover is up (d80), and
    // whether the PAUSED page shows.
    const row = this._row(), cover = this._cover(row), devPage = this._devPage(row);
    // bit 3: the main card says ONE MOMENT rather than RECORDING or PAUSED (PearlRest.usp:5078-5091):
    // our pause not yet proven, a resume not yet proven, an END while a pause is in play, or the cover
    // up while a recording runs. An END on a plain recording raises nothing: RECORDING until the stop
    // lands, then RECORDING ENDED (ROW_ENDING needs a pause in play).
    const between = row === ROW_ENDING || row === ROW_PAUSING || (row > 3 && row < 8) || (this.recording && cover);
    const health = (H.recorderValid ? 1 : 0) | (schedOk ? 2 : 0) | (H.transportDown ? 4 : 0) | (between ? 8 : 0);

    // ---- kiosk state machine (PearlRest.usp:3747-3779) ----
    // display recording holds through the stop teardown (the persisted event id)
    const stopOk = this.recording || !!run || this.teardown > 0;
    const confirmReady = schedOk && !!cBind;
    const confirmed = schedOk && head ? (head.confirmed && !head.ended) : false;
    const hasNext = (schedOk && !!head) || !schedOk;
    let stRec = 0, stPau = 0, stConf = 0, stConfd = 0, stUp = 0, stIdle = 0;
    if (stopOk) { if (devPage) stPau = 1; else stRec = 1; }
    else if (this.endedTicks === 0) {
      if (confirmReady && !confirmed) stConf = 1;
      else if (confirmed) stConfd = 1;
      else if (hasNext) stUp = 1;
      else stIdle = 1;
    }
    const endedPulse = this.endedTicks > 0 && !stopOk ? 1 : 0;

    // ---- strings ----
    const nowTitle = run ? run.title : "";
    // On the bench the trigger is the schedule poll no longer listing the class as running: PearlRest
    // then clears the end clock and the countdown (PearlRest.usp:3110, OutNowUntil("") and
    // gRunFinEp = 0) while the title and RECORDING hold until the recording falls. The owner saw it
    // on Rev 63 (2026-09-30): END shows RECORDING over the source alone, then RECORDING ENDED. Here
    // the stop teardown stands in for that window. The simulation has no refused END; on the bench a
    // refused END leaves the class listed, so the clock would stay (Astra 2026-09-30).
    const listed = run && this.teardown === 0 ? run : null;
    const nowUntil = listed ? "Recording until " + fmtClockFull(listed.end) : "";
    // the confirm-card subject: confirmed head, else the confirm binding (v10.44/45)
    const cardEvent = (head && head.confirmed && !head.ended) ? head : cBind;
    const confirmTitle = cardEvent ? cardEvent.title : "";
    const confirmSub = cardEvent
      ? (now >= cardEvent.start ? "Starts recording now" : "Starts recording at " + fmtClockFull(cardEvent.start)) : "";
    let remaining = 0;
    if (listed && this.recording) remaining = Math.min(65000, Math.max(0, listed.end - now));

    // status line s1
    let status;
    if (H.transportDown || !H.recorderValid) status = "Offline";
    else if (this.recording) {
      status = nowUntil ? "Online · " + nowUntil : "Online · Recording";
      // v10.56 and v10.60: the line at rest follows the row (PearlRest.usp:4861-4872)
      if (row === ROW_PAUSED) status = "Online · Paused at the recorder";
      if (row === ROW_UNPROVEN) status = "Online · Resuming the recording";
      if (row === ROW_ENDING) status = "Online · Ending the recording";
      if (row === ROW_PAUSING) status = "Online · Pausing the recording";
    }
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
    // v10.61: the next class's line says whether it records (PearlRest.usp:4898-4906). Confirmed: it
    // records on its own. Not confirmed with its CONFIRM offered (the window is open, cBind): it needs
    // somebody. Anything else promises nothing, because outside the window the module cannot tell.
    else if (nx && nx.confirmed) status = "Online · Next recording at " + fmtClockFull(nx.start);
    else if (nx && cBind === nx) status = "Online · Needs CONFIRM · class at " + fmtClockFull(nx.start);
    else if (nx) status = "Online · Next class at " + fmtClockFull(nx.start);
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
        const t = fmtClockPad(e.actualStart || e.start);   // the device's rewritten start (D15)
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
      B.setS(4, head ? (fmtClockFull(head.actualStart || head.start) + " - " + fmtClockFull(head.end)) : "");
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
    // the loaded module's ModuleVer on analog 7 (Rev 65 H=132 O86 to DGE I195), which Technical
    // Setup prints: the room and the bench run PearlRest v10.65 cut 7, ModuleVer 1065
    B.setA(7, 1065);
    const url = this.previewOn ? "rtsp://pearl.sim:554/stream.sdp" : "";
    const urlCam = this.previewOn ? "rtsp://pearl.sim:555/stream.sdp" : "";
    B.setS(60, url); B.setS(61, urlCam); B.setS(62, url);

    // ---- digitals the glass consumes directly ----
    B.setD(80, cover ? 1 : 0);                           // PAUSING / RESUMING / ending cover
    const extReady = this._extendOk();
    B.setD(83, extReady ? 1 : 0);
    B.setD(152, extReady ? 0 : 1);
    B.setD(91, confirmReady && stopOk ? 1 : 0);          // StripVis (H=143)
    const startBind = cWin && !cWin.started && now >= cWin.start - 1800 ? cWin : null;
    B.setD(95, startBind ? 1 : 0);                       // StartReady
    const nextStarted = cBind && now >= cBind.start;
    B.setD(98, nextStarted ? 1 : 0);                     // NextStarted
    B.setD(100, nextStarted ? 0 : 1);                    // NotStarted
    // d99 ConfirmStartedHelp and d101 ConfirmPreStart are PROGRAM logic (H=144, H=140) on the
    // walk-up-gated confirm state: js/program.js sets them, not the module
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
      Paused: this.recPaused ? 1 : 0,
      PausePending: cover ? 1 : 0,
      ConfirmReady: confirmReady ? 1 : 0,
      Confirmed: confirmed ? 1 : 0,
      EventRun: run ? 1 : 0,
      StopReady: stopOk ? 1 : 0,
      StateIdleRaw: stIdle, StateUpNextRaw: stUp, StateConfirmRaw: stConf, StateConfirmedRaw: stConfd,
      StateIdle: stIdle, StateUpNext: stUp, StateRec: stRec, StatePaused: stPau,
      EndedPulse: endedPulse,
      HasNext: hasNext ? 1 : 0,
      PreviewOn: this.previewOn ? 1 : 0,
      // v10.60 O91: the open preview was opened by our proven pause alone (Rev 65 keeps it off the main page)
      PreviewHoldOnly: this.previewOn && this.pvByHold ? 1 : 0,
      PreviewSeconds: this.previewSec,
      RemainingSeconds: remaining,
      // v10.59 and v10.60: beside bit 3, the cover's word for the main page (PearlRest.usp:5092-5098,
      // holdWay): while the cover is up over our own pause or resume, 16 PAUSING on the RECORDING page
      // and 32 RESUMING on the PAUSED page. An END while paused has no word of its own: ONE MOMENT.
      RecorderHealth: health | (this.recording && cover && (row === ROW_PLAIN || row === ROW_PAUSING || row === ROW_UNPROVEN)
        ? (stPau ? 32 : 16) : 0),
      AudioLevel: this.recording || this.previewOn ? 20000 + Math.floor(Math.random() * 25000) : 8000,
      NowTitle: nowTitle, UpNextTitle: nx ? nx.title : "",
      UpNextTime: nx ? (fmtClockFull(nx.start) + " - " + fmtClockFull(nx.end)) : "",
      NowUntil: nowUntil,
      ConfirmTitle: confirmTitle, ConfirmSub: confirmSub,
    };
  }
}

window.PearlSim = PearlSim;
window.PRACTICE_FSUID = PRACTICE_FSUID;
