// The self-guided usability test: welcome, two optional questions, seven tasks with two worded
// ratings after each, then submit, and a summary of how they did once it is sent. Testers can also
// explore the panel on their own at any time. Replaces the old free-choice picker (tasks.js).
//
// Decisions it carries (owner, 2026-09-17 and 18): unmoderated, a link people do alone; ratings
// after EACH task; standard room only for now; results to a Power Automate flow that writes one row
// per tester to a SharePoint list. Wording reviewed by agy and Astra (see js/grading.js prompts).
//
// Rules that are load-bearing:
// 1. NO success feedback during a task. Grading is silent, at the moment the tester says "I think
//    I am done" or "I am stuck". The old picker flashed "that worked", which taught the answer and
//    hid the case that matters most: someone who believes a class will record when it will not.
// 2. Nothing is drawn on the 1920x1080 glass. The task card is the side panel; everything else is
//    the full-window overlay, shown only between tasks.
// 3. The answers survive a reload (browser storage after every step), and a task interrupted by a
//    reload restarts from its starting room and is marked as restarted.
// 4. Only an explicit allowlist of fields is ever sent. Nothing typed into the panel (the walk-up
//    FSUID and title) is recorded, and grade details are reduced to true/false flags.
// 5. "Sent" is shown ONLY when the flow replies result "stored" AND echoes this session's id.
//    Anything else offers Try again and keeps the draft. There is no "save to a file": the owner
//    ruled 2026-09-17 that a file with nowhere to send it is a dead end.
// 6. Two tabs of one test: a tab that finds a newer save stops ("open somewhere else", with
//    Continue here). KNOWN RESIDUAL, accepted 2026-09-17 after three Astra rounds: browser storage
//    has no cross-tab lock, so two tabs saving within the same few milliseconds can both think
//    they are current, and the second to send can be shown Sent for answers the list dropped as a
//    duplicate. Closing that needs a cross-tab lock, out of proportion for a usability test.
"use strict";

const TF_VERSION = "tf1";
// The key changes whenever a scale's meaning does, so a draft never loads with its numbers read
// the other way: v2 when 0-10 became 1-5 (2026-09-17), v3 when confidence flipped, v4 when the
// three numbered scales became two worded ones (both 2026-09-18).
const TF_KEY = "panelUxTest.v4";
// Owner 2026-09-18: two questions, not three ("lost" and "confident" were nearly opposites of one
// thing), and WORDS on the buttons, so nobody has to work out which end of a number is good.
// Each button still stores 1 to 5, and the number measures what the question names: easy is
// 1 very easy to 5 very hard; sure is 1 very unsure to 5 very sure. Both show the good end first.
const TF_RATINGS = [
  // wording from agy and Astra (2026-09-18): "Okay" can mean acceptable, "Not sure" read as doubt
  // rather than a middle, and "it worked" could mean the panel merely responded
  { key: "easy", q: "How easy was this task?",
    opts: [["Very easy", 1], ["Easy", 2], ["Neither easy nor hard", 3], ["Hard", 4], ["Very hard", 5]] },
  { key: "sure", q: "How sure are you that you did what the task asked?",
    opts: [["Completely sure", 5], ["Very sure", 4], ["Moderately sure", 3], ["Slightly sure", 2], ["Not at all sure", 1]] },
];
// The situations a tester can pick while exploring (owner 2026-09-18). 45 minutes is before the
// confirm window opens (30 minutes), so the "not yet" state can be seen as well.
const TF_FREE_KINDS = [["needsOk", "A class needs your OK"], ["confirmed", "A class is confirmed"],
                       ["recording", "A class is recording"], ["none", "Nothing booked"]];
const TF_FREE_MINS = [5, 20, 45];
// Room layouts the CURRENT panel (round 28) actually has: both are pages of the same compiled
// panel, switched by d58/d59. Blu-ray and a second doc cam are not on the current glass, so they
// are not offered (owner asked 2026-09-18/21; see docs/panel_ux_test_pickup_2026-09-17.md).
const TF_FREE_ROOMS = [["one", "One projector"], ["two", "Two projectors"]];
// Student and IT Staff added by the owner 2026-09-18
const TF_ROLES = ["Instructor or faculty member", "Teaching assistant", "Student", "Classroom support staff", "IT staff", "Other"];
const TF_FREQ = ["Daily", "A few times a week", "About once a week", "Less than once a week, or never"];

function tfEsc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function tfStorageWorks() {
  try { localStorage.setItem(TF_KEY + ".probe", "1"); localStorage.removeItem(TF_KEY + ".probe"); return true; }
  catch (e) { return false; }
}
function tfNewId() {
  const b = new Uint8Array(8);
  (window.crypto || window.msCrypto).getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

// The ONLY shape that leaves the browser. Built field by field so nothing else can ride along.
function tfPayload(st) {
  const flags = d => {
    const o = {};
    for (const [k, v] of Object.entries(d || {})) if (typeof v === "boolean") o[k] = v;
    return o;
  };
  const rating = v => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
  const tasks = (st.results || []).map(r => ({
    id: String(r.id), declared: r.declared === "done" ? "done" : "stuck", worked: !!r.worked,
    seconds: Math.max(0, Math.round(r.seconds || 0)), presses: Math.max(0, r.presses | 0),
    restarted: Math.max(0, r.restarted | 0), wentBack: Math.max(0, r.wentBack | 0),
    explored: Math.max(0, r.explored | 0), resets: Math.max(0, r.resets | 0),
    easy: rating(r.easy), sure: rating(r.sure),
    comment: String(r.comment || "").slice(0, 500), detail: flags(r.detail),
  }));
  return {
    v: 1, scale: "1-5: easy 1 = very easy, 5 = very hard; sure 1 = not at all sure, 5 = completely sure",
    sessionId: String(st.sessionId), build: String(st.build),
    role: TF_ROLES.includes(st.role) ? st.role : "", frequency: TF_FREQ.includes(st.frequency) ? st.frequency : "",
    workedCount: tasks.filter(t => t.worked).length, stuckCount: tasks.filter(t => t.declared === "stuck").length,
    totalSeconds: tasks.reduce((a, t) => a + t.seconds, 0), tasks,
    exploreVisits: Math.max(0, st.exploreVisits | 0),
  };
}

// Success is a reply that says stored AND names this session. Returns true or a reason string.
function tfAcceptReply(status, bodyText, sessionId) {
  if (status !== 200) return "status " + status;
  let j;
  try { j = JSON.parse(bodyText); } catch (e) { return "reply was not JSON"; }
  if (!j || j.result !== "stored") return "reply said " + JSON.stringify(j && j.result);
  if (j.sessionId !== sessionId) return "reply named a different session";
  return true;
}

class TestFlow {
  constructor(app, opts) {
    this.app = app;
    this.opts = opts || {};
    this.tasks = window.GRADING.TASK_DEFS;
    this.tasksKey = this.tasks.map(t => t.id).join(",");
    // one storage key per task list, so a newer page version opened beside an older tab never
    // reads, refuses or deletes that tab's draft (Astra round 2)
    this.key = TF_KEY + "." + this.tasksKey;
    this.storageOk = tfStorageWorks();
    // ?fresh starts the test over from the welcome screen. It exists for review passes: answers
    // are kept across reloads, so without it a reviewer resumes wherever they left off.
    if (new URLSearchParams(location.search).has("fresh")) {
      try { localStorage.removeItem(this.key); } catch (e) { /* nothing stored */ }
    }
    this.st = this.load();
    if (!this.st) {
      // a draft that was refused must go, or the fresh test would read it as another tab's newer
      // session and lock itself out on the first save
      try { localStorage.removeItem(this.key); } catch (e) { /* nothing stored */ }
      this.st = this.fresh();
    }
    // Without working storage, tabs cannot see each other, so each must send under its own id:
    // two tabs sharing one would have the second one's different answers dropped as a duplicate.
    if (!this.storageOk) this.st.sessionId = tfNewId();
    this.sending = false;
    this.stale = false;
    this.presses = 0;
    this.hookPresses();
    this.build();
    if (window.__tfWarmTimer) clearInterval(window.__tfWarmTimer);
    window.__tfWarmTimer = setInterval(() => this.showWarmUp(), 250);
    // another tab or window of this test saved: this one is out of date and must stop, or its
    // older answers would overwrite the newer ones, or be sent under the same session id
    window.addEventListener("storage", e => { if (e.key === this.key && window.__tfFlow === this) this.checkFresh(); });
    // a page brought back from the back/forward cache holds whatever it had when it was left:
    // if the saved draft moved on since, load that instead of locking this tab out
    window.addEventListener("pageshow", e => {
      if (e.persisted && window.__tfFlow === this && this.storageOk && !this.isFresh()) this.reloadPage();
    });
    this.route(true);
  }

  fresh() {
    return { v: 1, rev: 0, tasksKey: this.tasksKey, sessionId: tfNewId(),
             build: TF_VERSION + "/" + (this.app.specSource || "unknown"),
             step: "welcome", i: 0, role: "", frequency: "", results: [], pending: null, sent: false,
             restarts: 0 };
  }
  // A stored draft is resumed only if it is whole and belongs to THIS task list. Anything else (an
  // older page version, a hand-edited or torn value) starts a fresh test rather than a stuck one.
  load() {
    let s;
    try { s = JSON.parse(localStorage.getItem(this.key) || "null"); } catch (e) { return null; }
    if (!s || s.v !== 1 || typeof s.sessionId !== "string" || s.tasksKey !== this.tasksKey) return null;
    const n = this.tasks.length, i = s.i;
    if (!Number.isInteger(s.rev) || !Number.isInteger(i) || i < 0 || i > n || !Array.isArray(s.results)) return null;
    if (s.results.length !== i) return null;
    const steps = { welcome: 1, about: 1, task: i < n, rate: i < n && s.pending && s.pending.id === this.tasks[i].id,
                    finish: i === n, sent: i === n, explore: i === n, free: i < n };
    if (!steps[s.step]) return null;
    return s;
  }
  // true when nobody else has saved since this tab last did (or there is no storage to compare)
  isFresh() {
    if (!this.storageOk) return true;
    try {
      const cur = JSON.parse(localStorage.getItem(this.key) || "null");
      return !cur || (cur.sessionId === this.st.sessionId && cur.rev === this.st.rev);
    } catch (e) { return true; }
  }
  checkFresh() {
    if (this.stale) return false;
    if (this.isFresh()) return true;
    this.stale = true;
    window.GRADING.gradeUnwatch(this.app);
    this.setBar(false);
    // Also reached by one tab alone: Back/Forward can restore an older copy of this page. So the
    // screen always offers to pick up the saved progress, which reloading does.
    this.showOverlay('<h1>This test is open somewhere else</h1>' +
      '<p class="tp-sub">It was continued in another tab or window. You can carry on there, or ' +
      'continue from your saved place here.</p>' +
      '<div class="tf-row"><button class="tf-primary tf-resume">Continue here</button></div>');
    this.card.querySelector(".tf-resume").onclick = () => this.reloadPage();
    return false;
  }
  reloadPage() { location.reload(); }
  save() {
    // once this tab has gone in-memory it never writes the shared draft again: storage coming
    // back later would let it overwrite another tab's progress under a session it no longer owns
    if (!this.storageOk) return false;
    if (!this.checkFresh()) return false;
    this.st.rev += 1;
    try { localStorage.setItem(this.key, JSON.stringify(this.st)); return true; }
    catch (e) {
      if (this.storageOk && !this.st.sent) this.st.sessionId = tfNewId();   // same reason as in the constructor
      this.storageOk = false; this.showStorageWarning(); return false;
    }
  }
  // Progress that cannot be kept must not look kept: say so on every screen from then on.
  storageNote() {
    return this.storageOk ? "" :
      '<p class="tf-error tf-storage-warn">This browser cannot save your progress. Please send your feedback before closing or reloading this page.</p>';
  }
  showStorageWarning() {
    // the screen already showing was drawn before the failure: add the warning to it now
    if (!this.storageOk && this.card && !this.stale && !this.card.querySelector(".tf-storage-warn"))
      this.card.insertAdjacentHTML("afterbegin", this.storageNote());
    const w = this.bar && this.bar.querySelector(".tb-warn");
    if (w) { w.textContent = this.storageOk ? "" : "Progress is not being saved. Keep this page open and do not reload it."; w.hidden = this.storageOk; }
  }

  // Presses on the glass during a task, counted once however many times the flow is rebuilt.
  hookPresses() {
    const bus = this.app.bus;
    window.__tfFlow = this;
    if (bus.__tfHooked) return;
    const o = bus.press.bind(bus);
    bus.press = j => { const f = window.__tfFlow; if (f && f.st.step === "task") f.presses++; return o(j); };
    bus.__tfHooked = true;
  }

  build() {
    let wrap = document.getElementById("taskui");
    if (wrap) wrap.remove();
    wrap = document.createElement("div");
    wrap.id = "taskui";
    wrap.innerHTML =
      '<div id="task-picker"><div class="tp-card" role="dialog" aria-live="polite"></div></div>' +
      '<div id="task-bar" hidden>' +
        '<div class="tb-left"><div class="tb-title"></div><div class="tb-prompt"></div>' +
          '<div class="tb-warm" hidden></div>' +
          '<div class="tb-warn tf-error" hidden></div></div>' +
        '<div class="tb-right">' +
          '<button class="tf-primary tb-done">I think I am done</button>' +
          '<button class="tb-skip tb-stuck">I am stuck, skip this</button>' +
          '<button class="tb-skip tb-reset">Start this task over</button>' +
          '<button class="tb-skip tb-free">Explore on my own</button>' +
          '<button class="tf-primary tb-tasks" hidden>Start the tasks</button>' +
          '<button class="tf-primary tb-send" hidden>Send feedback</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    this.overlay = wrap.querySelector("#task-picker");
    this.card = wrap.querySelector(".tp-card");
    this.bar = wrap.querySelector("#task-bar");
    this.bar.querySelector(".tb-done").onclick = () => this.endTask("done");
    this.bar.querySelector(".tb-stuck").onclick = () => this.endTask("stuck");
    this.bar.querySelector(".tb-free").onclick = () => this.enterFree();
    this.bar.querySelector(".tb-reset").onclick = () => this.resetTask();
    this.bar.querySelector(".tb-tasks").onclick = () => this.leaveFree();
    this.bar.querySelector(".tb-send").onclick = () => this.go("finish");
    this.showStorageWarning();
  }

  // Which buttons the side panel shows: during a task, while exploring, or with feedback unsent.
  barMode(mode) {
    const show = { task: [".tb-done", ".tb-stuck", ".tb-reset", ".tb-free"], free: [".tb-tasks"], unsent: [".tb-send"] }[mode];
    // what a mode shows, it also enables: endTask disables every panel button ("one answer per
    // task"), and a shown but disabled button is a dead end (found by the flow check 2026-09-18)
    for (const sel of [".tb-done", ".tb-stuck", ".tb-reset", ".tb-free", ".tb-tasks", ".tb-send"]) {
      const el = this.bar.querySelector(sel);
      el.hidden = !show.includes(sel);
      if (!el.hidden) el.disabled = false;
    }
    const setup = this.bar.querySelector(".tb-setup");
    if (setup) setup.hidden = mode !== "free";
  }

  // Owner 2026-09-18: testers can try the panel on their own, before the tasks or in the middle of
  // them, and the way back to the tasks is always on screen. Nothing done while exploring is graded.
  enterFree() {
    if (this.stale) return;
    this.st.freeFromTask = this.st.step === "task";
    this.st.exploreVisits = (this.st.exploreVisits || 0) + 1;
    window.GRADING.gradeUnwatch(this.app);
    this.go("free");
  }
  free() {
    this.hideOverlay();
    window.GRADING.gradeUnwatch(this.app);
    this.setUpFreeRoom();
    const begun = this.st.freeFromTask || this.st.i > 0;
    this.bar.querySelector(".tb-title").textContent = "Exploring on your own";
    this.bar.querySelector(".tb-prompt").textContent = "Nothing here is graded. Try anything you like." +
      (this.st.freeFromTask ? " When you go back, Task " + (this.st.i + 1) + " starts again from the beginning." : "");
    this.drawFreeSetup();
    this.bar.querySelector(".tb-tasks").textContent = begun ? "Back to the tasks" : "Start the tasks";
    this.barMode("free");
    this.bar.querySelectorAll("button").forEach(b => { b.disabled = false; });
    this.setBar(true);
    this.showWarmUp();
  }
  // Owner 2026-09-18: while exploring, the tester picks the situation (which recorder state, and
  // how long until class) instead of getting one fixed room. Always an ordinary room otherwise:
  // projector off, both laptop cables in. A later class is on the list so the schedule has depth.
  freeScenario() {
    const s = this.st.freeScenario || {};
    return { kind: TF_FREE_KINDS.some(k => k[0] === s.kind) ? s.kind : "needsOk",
             mins: TF_FREE_MINS.includes(s.mins) ? s.mins : 20,
             room: TF_FREE_ROOMS.some(r => r[0] === s.room) ? s.room : "one" };
  }
  setUpFreeRoom() {
    const G = window.GRADING, app = this.app, sc = this.freeScenario();
    const later = G.gradeEvent(app, "free-2", "CHM 1045-0001 - Doe, John", 180, 75, false, true);
    const opts = { hdmi: true, usbc: true, schedule: [later], twoProj: sc.room === "two" };
    if (sc.kind === "needsOk" || sc.kind === "confirmed")
      opts.schedule = [G.gradeEvent(app, "free-1", "BSC 2085-0003 - Smith, Jane", sc.mins, 50, true, sc.kind === "confirmed"), later];
    if (sc.kind === "recording") {
      opts.schedule = [G.gradeEvent(app, "free-1", "BSC 2085-0003 - Smith, Jane", -10, 60, false, true), later];
      opts.recordingId = "free-1";
    }
    if (sc.kind === "none") opts.schedule = [];
    G.gradeReset(app, opts);
  }
  drawFreeSetup() {
    let box = this.bar.querySelector(".tb-setup");
    if (!box) {
      box = document.createElement("div");
      box.className = "tb-setup";
      this.bar.querySelector(".tb-prompt").after(box);
    }
    box.hidden = this.st.step !== "free";
    if (box.hidden) return;
    const sc = this.freeScenario();
    const pick = (group, items, cur) => items.map(([v, label]) =>
      '<button type="button" class="tb-pick' + (v === cur ? " on" : "") + '" data-g="' + group + '" data-v="' + v + '">' +
      label + '</button>').join("");
    const timed = sc.kind === "needsOk" || sc.kind === "confirmed";
    box.innerHTML =
      '<div class="tb-setup-q">Room</div><div class="tb-pick-row tb-pick-row2">' + pick("room", TF_FREE_ROOMS, sc.room) + '</div>' +
      '<div class="tb-setup-q">Lecture capture</div>' + pick("kind", TF_FREE_KINDS, sc.kind) +
      (timed ? '<div class="tb-setup-q">Class starts in</div><div class="tb-pick-row">' +
               pick("mins", TF_FREE_MINS.map(m => [m, m + " min"]), sc.mins) + '</div>' : '') +
      '<div class="tb-setup-note">Changing these resets the room.</div>' +
      '<button type="button" class="tb-pick tb-room-reset">Reset the room</button>';
    box.querySelector(".tb-room-reset").onclick = () => this.setUpFreeRoom();
    box.querySelectorAll(".tb-pick[data-g]").forEach(b => {
      b.onclick = () => {
        const next = this.freeScenario();
        if (b.dataset.g === "kind") next.kind = b.dataset.v;
        else if (b.dataset.g === "room") next.room = b.dataset.v;
        else next.mins = parseInt(b.dataset.v, 10);
        this.st.freeScenario = next;
        if (this.storageOk && !this.save() && this.stale) return;
        this.setUpFreeRoom();
        this.drawFreeSetup();
      };
    });
  }
  // Owner 2026-09-21: a tester who has tangled the room can put this task back to how it started.
  // The clock and presses start again with it; the answer records how many times they did.
  resetTask() {
    if (this.stale || this.st.step !== "task") return;
    window.GRADING.gradeUnwatch(this.app);
    this.st.resets = (this.st.resets || 0) + 1;
    this.startTask(true);
  }
  leaveFree() {
    if (this.stale) return;
    if (this.st.freeFromTask) {
      // the task left for exploring starts again from its own room, and its answer says so
      this.st.explored = (this.st.explored || 0) + 1;
      this.st.step = "task";
      if (this.storageOk && !this.save() && this.stale) return;
      return this.startTask(true);
    }
    this.go(this.st.aboutSeen ? "task" : "about");
  }

  setBar(show) { this.bar.hidden = !show; if (window.scaleStage) window.scaleStage(); }

  // The projector's 30 s warm-up covers the panel's own buttons, so a tester who turns it on has
  // nothing to press and no idea why. Say what is happening and that they need not wait for it.
  // (Owner 2026-09-17.) Driven off the program's own warm-up clock, not a timer of its own.
  showWarmUp() {
    const el = this.bar && this.bar.querySelector(".tb-warm");
    if (!el) return;
    const ms = this.app.program.warmMs;
    if (ms > 0 && (this.st.step === "task" || this.st.step === "free")) {
      el.hidden = false;
      el.textContent = "Projector warming up: " + Math.ceil(ms / 1000) + " seconds left." +
        (this.st.step === "task" ? " You do not need to wait for it." : "");
    } else if (!el.hidden) {
      el.hidden = true;
      el.textContent = "";
    }
  }
  showOverlay(html) { this.overlay.style.display = ""; this.card.innerHTML = html; this.card.scrollTop = 0; }
  hideOverlay() { this.overlay.style.display = "none"; }

  // fromLoad: the page was (re)loaded onto this step, as opposed to arriving from the step before
  route(fromLoad) {
    const s = this.st.step;
    if (s === "welcome") return this.welcome();
    if (s === "about") return this.about();
    if (s === "task") {
      if (fromLoad) { this.st.restarts++; return this.startTask(true); }
      return this.startTask(false);
    }
    if (s === "rate") return this.rate();
    if (s === "finish") return this.finish();
    if (s === "sent") return this.sent();
    if (s === "explore") return this.explore();
    if (s === "free") return this.free();
    this.st.step = "welcome"; this.welcome();
  }

  go(step) {
    if (this.stale) return;
    this.st.step = step;
    if (this.storageOk && !this.save() && this.stale) return;
    this.route(false);
  }

  welcome() {
    this.setBar(false);
    const small = window.innerWidth < 900;
    this.showOverlay(
      '<h1>Help us test the classroom touch panel</h1>' +
      '<p class="tp-sub">This is a browser version of the classroom touch panel, the touch screen at the ' +
      'front of the room that controls the projector and lecture recording. Some parts may behave a ' +
      'little differently from the real panel. Try seven short tasks and tell us how each one felt.</p>' +
      '<p class="tf-note">About 10 minutes. You can skip any task, and you can explore the panel on ' +
      'your own first, or at any time during the tasks.' +
      (small ? ' <b>This works best on a computer or tablet. On a phone the screen will be very small.</b>' : '') +
      '</p>' + this.storageNote() +
      '<div class="tf-row"><button class="tf-secondary tf-free">Explore on my own</button>' +
      '<button class="tf-primary tf-start">Start the tasks</button></div>');
    this.card.querySelector(".tf-start").onclick = () => this.go("about");
    this.card.querySelector(".tf-free").onclick = () => this.enterFree();
  }

  about() {
    this.setBar(false);
    const group = (name, label, opts, cur) =>
      '<fieldset class="tf-q"><legend>' + label + '</legend><div class="tf-choices">' +
      opts.map(o => '<button type="button" class="tf-choice' + (o === cur ? " on" : "") +
                    '" data-g="' + name + '" data-v="' + tfEsc(o) + '">' + tfEsc(o) + '</button>').join("") +
      '</div></fieldset>';
    this.showOverlay(
      '<h1>About you</h1><p class="tp-sub">Both questions are optional.</p>' + this.storageNote() +
      group("role", "Which best describes your role at FSU?", TF_ROLES, this.st.role) +
      group("frequency", "How often do you attend, teach, or support classes in rooms with a projector?", TF_FREQ, this.st.frequency) +
      '<div class="tf-row"><button class="tf-primary tf-next">Continue</button></div>');
    this.card.querySelectorAll(".tf-choice").forEach(b => {
      b.onclick = () => {
        const g = b.dataset.g;
        this.st[g] = this.st[g] === b.dataset.v ? "" : b.dataset.v;
        this.save();
        this.card.querySelectorAll('.tf-choice[data-g="' + g + '"]').forEach(x =>
          x.classList.toggle("on", x.dataset.v === this.st[g]));
      };
    });
    this.card.querySelector(".tf-next").onclick = () => { this.st.i = 0; this.st.aboutSeen = true; this.go("task"); };
  }

  startTask(isRestart) {
    const t = this.tasks[this.st.i];
    if (!t) return this.go("finish");
    if (!isRestart) { this.st.restarts = 0; this.st.explored = 0; this.st.resets = 0; }
    this.st.freeFromTask = false;
    this.st.step = "task";
    if (this.storageOk && !this.save() && this.stale) return;
    this.hideOverlay();
    this.bar.querySelector(".tb-title").textContent = "Task " + (this.st.i + 1) + " of " + this.tasks.length;
    this.bar.querySelector(".tb-prompt").textContent = t.prompt;
    this.barMode("task");
    this.bar.querySelectorAll("button").forEach(b => { b.disabled = false; });
    this.setBar(true);
    this.showWarmUp();
    this.gradeState = {};
    t.setup(this.app);
    window.GRADING.gradeWatch(this.app, t, this.gradeState);
    this.presses = 0;
    this.resumes = 0;
    this.t0 = performance.now();              // the clock starts once the room is ready
  }

  // Back to a task already in progress: the room is left exactly as the tester had it, the clock
  // keeps running, and the watcher is re-armed on the same history.
  resumeTask() {
    const t = this.tasks[this.st.i];
    if (!t) return this.go("finish");
    this.hideOverlay();
    this.barMode("task");
    this.bar.querySelectorAll("button").forEach(b => { b.disabled = false; });
    this.setBar(true);
    this.showWarmUp();
    window.GRADING.gradeWatch(this.app, t, this.gradeState || (this.gradeState = {}));
  }

  endTask(declared) {
    if (this.st.step !== "task") return;
    this.bar.querySelectorAll("button").forEach(b => { b.disabled = true; });  // one answer per task
    const t = this.tasks[this.st.i];
    let g = { worked: false, detail: {} };
    try { g = t.grade(this.app, this.gradeState); } catch (e) { g = { worked: false, detail: { gradeError: true } }; }
    window.GRADING.gradeUnwatch(this.app);
    this.st.pending = {
      id: t.id, declared, worked: !!g.worked, detail: g.detail || {},
      seconds: (performance.now() - this.t0) / 1000, presses: this.presses, restarted: this.st.restarts,
      wentBack: this.resumes || 0, explored: this.st.explored || 0, resets: this.st.resets || 0,
      easy: null, sure: null, comment: "",
    };
    this.go("rate");
  }

  rate() {
    this.setBar(false);
    const p = this.st.pending;
    if (!p) { this.st.step = "task"; return this.startTask(false); }
    const scale = r =>
      '<fieldset class="tf-q"><legend>' + r.q + '</legend><div class="tf-scale">' +
      r.opts.map(([label, v]) =>
        '<button type="button" class="tf-pt' + (p[r.key] === v ? " on" : "") + '" data-k="' + r.key +
        '" data-v="' + v + '">' + label + '</button>').join("") +
      '</div></fieldset>';
    this.showOverlay(
      '<h1>Task ' + (this.st.i + 1) + ' of ' + this.tasks.length + '</h1>' +
      '<p class="tp-sub">' + tfEsc(this.tasks[this.st.i].prompt) + '</p>' +
      TF_RATINGS.map(scale).join("") +
      '<fieldset class="tf-q"><legend>Anything confusing or unexpected? (Optional)</legend>' +
      '<textarea class="tf-comment" maxlength="500" rows="3" placeholder="Please do not include names or other personal details.">' +
      tfEsc(p.comment || "") + '</textarea></fieldset>' +
      this.storageNote() +
      '<div class="tf-row"><span class="tf-need"></span>' +
        '<button class="tf-secondary tf-back">Go back to the task</button>' +
        '<button class="tf-primary tf-next">Next</button></div>');
    const next = this.card.querySelector(".tf-next"), need = this.card.querySelector(".tf-need");
    const ready = () => {
      const missing = TF_RATINGS.filter(r => !(Number.isInteger(p[r.key]) && p[r.key] >= 1 && p[r.key] <= 5)).length;
      next.disabled = missing > 0;
      need.textContent = missing ? "Please answer both questions to continue." : "";
    };
    this.card.querySelectorAll(".tf-pt").forEach(b => {
      b.onclick = () => {
        p[b.dataset.k] = parseInt(b.dataset.v, 10); this.save();
        this.card.querySelectorAll('.tf-pt[data-k="' + b.dataset.k + '"]').forEach(x =>
          x.classList.toggle("on", parseInt(x.dataset.v, 10) === p[b.dataset.k]));
        ready();
      };
    });
    // Owner 2026-09-17: pressing "I think I am done" by mistake must not be a trap. Going back
    // throws away that answer and returns to the SAME room, untouched (no reset), so they can
    // carry on. The next answer is marked as having gone back, which is worth knowing: it means
    // they thought they were finished and then saw they were not.
    this.card.querySelector(".tf-back").onclick = () => {
      this.st.pending = null;
      this.st.step = "task";
      // After a reload the room this task was done in is gone (Astra, 2026-09-18): there is
      // nothing to go back TO, so this is the same restart a reload mid-task gets.
      if (this.t0 === undefined) {
        this.st.restarts++;
        if (this.storageOk && !this.save() && this.stale) return;
        return this.startTask(true);
      }
      this.resumes = (this.resumes || 0) + 1;
      if (this.storageOk && !this.save() && this.stale) return;
      this.resumeTask();
    };
    const ta = this.card.querySelector(".tf-comment");
    ta.oninput = () => { p.comment = ta.value.slice(0, 500); this.save(); };
    ready();
    next.onclick = () => {
      if (next.disabled) return;
      this.st.results.push(p);
      this.st.pending = null;
      this.st.i += 1;
      this.go(this.st.i < this.tasks.length ? "task" : "finish");
    };
  }

  finish(errorText) {
    this.setBar(false);
    this.showOverlay(
      '<h1>Ready to send your feedback</h1>' +
      '<p class="tp-sub">Thank you for your time. Your feedback will help us make the classroom touch ' +
      'panel simpler for everyone at FSU.</p>' +
      // "kept" is said only when it is true; without storage the warning below says the opposite
      (errorText
        ? '<p class="tf-error">We could not send your feedback. Please try again.' +
          (this.storageOk ? ' It is saved in this browser, so you can also come back to this page later and send it.' : '') +
          '</p>'
        : '') + this.storageNote() +
      '<div class="tf-row">' +
        // Owner 2026-09-17: Try again as the only way out is a trap. Close puts the panel back,
        // and the strip on the left keeps the way to submit in front of them.
        (errorText ? '<button class="tf-secondary tf-close">Keep exploring</button>' : '') +
        '<button class="tf-primary tf-send">' + (errorText ? "Try again" : "Send feedback") + '</button>' +
      '</div>');
    this.card.querySelector(".tf-send").onclick = () => this.send();
    const cl = this.card.querySelector(".tf-close");
    if (cl) cl.onclick = () => this.go("explore");
  }

  submitUrl() {
    const qs = new URLSearchParams(location.search);
    const local = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    // a local stand-in receiver may be named on the URL, and only when the page itself is local
    if (local && qs.get("submit")) return qs.get("submit");
    return window.TEST_SUBMIT_URL || "";
  }

  async send() {
    if (this.sending || this.st.sent || !this.checkFresh()) return;
    this.sending = true;
    const btn = this.card.querySelector(".tf-send");
    if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }
    const body = JSON.stringify(tfPayload(this.st));
    let verdict = "no address to send to";
    const url = this.submitUrl();
    if (url) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30000);
      try {
        const r = await fetch(url, { method: "POST", body, signal: ctl.signal, credentials: "omit",
                                     cache: "no-store", headers: { "Content-Type": "text/plain;charset=UTF-8" } });
        verdict = tfAcceptReply(r.status, await r.text(), this.st.sessionId);
      } catch (e) {
        verdict = e && e.name === "AbortError" ? "timed out" : "network error";
      } finally { clearTimeout(timer); }
    }
    this.sending = false;
    this.lastVerdict = verdict;
    if (this.stale) return;          // another tab took over while this one was sending
    if (verdict === true) { this.st.sent = true; this.go("sent"); }
    else this.finish(String(verdict));
  }

  // Owner 2026-09-18: testers should find out how they did. Only HERE, after the answers are
  // sent, so knowing cannot change a rating or a later task. A task that did not work shows how
  // the panel does it, which is the one thing a tester can take back to a real room.
  sent() {
    this.setBar(false);
    const byId = Object.fromEntries(this.st.results.map(r => [r.id, r]));
    const done = this.tasks.filter(t => byId[t.id] && byId[t.id].worked).length;
    const rows = this.tasks.map(t => {
      const r = byId[t.id];
      const ok = !!(r && r.worked);
      const word = ok ? "Done" : (r && r.declared === "stuck" ? "Skipped" : "Not quite");
      return '<li class="tf-res ' + (ok ? "ok" : "miss") + '"><span class="tf-res-word">' + word + '</span>' +
             '<span class="tf-res-name">' + tfEsc(t.name) + '</span>' +
             (ok ? "" : '<span class="tf-res-hint">' + tfEsc(t.hint) + '</span>') + '</li>';
    }).join("");
    this.showOverlay(
      '<h1>Your feedback has been sent. Thank you!</h1>' +
      '<p class="tp-sub">Here is how you did: ' + done + ' of ' + this.tasks.length + ' tasks done.</p>' +
      '<ul class="tf-results">' + rows + '</ul>' +
      '<div class="tf-row"><button class="tf-secondary tf-explore">Keep exploring the panel</button></div>');
    this.card.querySelector(".tf-explore").onclick = () => this.go("explore");
  }

  // Free play with no grading and nothing recorded. Reached after sending, or by closing the
  // send screen: in that case the answers are still unsent, so the way back stays on screen.
  explore() {
    this.hideOverlay();
    window.GRADING.gradeUnwatch(this.app);
    const unsent = !this.st.sent && this.st.results.length > 0;
    this.bar.querySelector(".tb-title").textContent = unsent ? "Not sent yet" : "";
    this.bar.querySelector(".tb-prompt").textContent = unsent
      ? "Your feedback has not been sent. You can explore the panel and send it when you are ready."
      : "";
    this.barMode("unsent");
    this.setBar(unsent);
    if (!unsent) this.app.renderer.flipTo("SCREENSAVER");
  }
}

window.TestFlow = TestFlow;
window.tfPayload = tfPayload;
window.tfAcceptReply = tfAcceptReply;
