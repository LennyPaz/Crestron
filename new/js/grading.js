// The tasks a tester is given, the room each one starts in, and how each is graded.
//
// Grading is SILENT and happens at one moment: when the tester says they are done (or stuck).
// Nothing here tells the tester whether it worked. That is the point: the most valuable thing a
// session can show is somebody who BELIEVES the class will record when it will not.
//
// Every rule is judged from the simulated room's STATE, never from which buttons were pressed,
// so any route that really achieves the outcome counts. Rules were corrected after an Astra
// review (2026-09-17): screen tasks need the projector on; the laptop task names ONE cable, so the
// wrong input fails; "preview first" fails if the laptop was EVER visible to the room during the
// task; recording tasks are tied to that task's own class, not any recording.
//
// Proven by verify_tasks.html: every task has a scripted right way that must grade as worked and
// at least one scripted wrong way that must grade as not worked.
"use strict";

const G_SRC = { BLURAY: 1, DOCCAM: 2, DESKTOP: 3, WIRELESS: 4, HDMI: 5, USBC: 6 };

// Start every task from the same known room. Anything a previous task or a curious tester left
// behind (a popup, the help overlay, a blanked screen, a recording) must not leak forward.
function gradeReset(app, opts) {
  opts = opts || {};
  const p = app.program, k = app.pearl, room = app.room;
  if (window.helpOverlay && window.helpOverlay.hide) { try { window.helpOverlay.hide(); } catch (e) { /* not open */ } }
  for (const j of Object.keys(app.bus.held || {})) app.bus.release(parseInt(j, 10));
  p.D(2, 0);                                    // the power-off "are you sure" subpage
  p.powerOn = !!opts.power; p.warmMs = 0; p.projQueued = false; p.spPending = false;
  p.source = 0; p.clearLatched = false;
  p.routes = { prevL: 0, prevR: 0, projL: 0, projR: 0, kaltura: 0, audio: 0 };
  p.listenPulse = 0; p.hidden = false; p.lights = 0; p.preset = 0;
  p.muteMain = false; p.muteMic = false;
  p.volMain = 32768; p.volMic = 32768;
  p.flashStepMs = 0; p.flashSrcMs = 0; p.flashPwrMs = 0; p.flashStep = -1; p.hideGuardMs = 0;
  p.hideGuardSideMs = { L: 0, R: 0 };
  k.extendGuard = 0; k.verifyTicks = 0; k.verAge = 0;
  p.lcOpen = false; p.pop = { stop: false, next: false, help: false }; p.walkup = false;
  p.closeKeyboard();                            // its keys would type into a form no longer shown
  k.recording = false; k.recStartEp = 0; k.startLag = 0; k.teardown = 0; k.teardownEvent = null;
  k.paused = false; k.pausePending = 0; k.pauseDirection = 0;
  k.previewOn = false; k.previewSec = 0; k.endedTicks = 0;
  k.statusTransient = ""; k.statusTtl = 0; k.extendNote = ""; k.extendTtl = 0;
  k.layoutN = 1;
  k.adhoc = { fsuid: "", title: "", durMin: 0, custom: false,
              verified: false, verifiedId: "", name: "", error: "" };
  room.laptopConnected = { hdmi: opts.hdmi !== false, usbc: !!opts.usbc };
  k.setSchedule(opts.schedule || []);
  if (opts.recordingId) {
    const e = k.schedule.find(x => x.id === opts.recordingId);
    e.confirmed = true;
    k.startEvent(e, true);
    // a class already recording has been recording since its start, so ELAPSED counts from there and
    // agrees with "Today in this room" (stand-in pre-test 2026-10-01: it read 0:04 for a 7:51 class)
    // It also started long before the tester arrived, so the status line is the baseline "Online ·
    // Recording until ...", not the 20 s "Recording started" PearlRest posts only on the recorder's
    // rising edge (PearlRest.usp:4047, 4321; audit 2026-10-01)
    if (k.recording && e.start < k.now()) { k.recStartEp = e.start; k.statusTransient = ""; k.statusTtl = 0; }
  }
  // Publish the new state and let the formatter see it NOW, inside the reset. Otherwise the panel
  // shows the last task's RECORDING until the next tick, and a START pressed before that tick
  // lands on top of a stale "recording just fell" edge (formatter.js:204), so STARTING reads
  // wrong. Seeing recording and its state fall together here consumes that edge cleanly.
  // Astra, 2026-09-17. A separate wipe of the formatter's edge memory was tried and removed: a
  // mutation proved it changed nothing once this line runs.
  k.publish(); p.syncFormatter(); p.fmt.pumpTick();
  // The tasks are written for, and graded on, the standard one-projector room. Exploring may have
  // switched the glass to another layout (testflow.js setUpFreeRoom); every reset puts it back.
  p.opts.twoProj = !!opts.twoProj; p.opts.listenRoom = !!opts.twoProj; p.opts.deckRoom = false;
  p.publishStatics();
  p.routeChanged(); p.refreshAll();
  // Owner 2026-09-17: the touch-to-start screen every single task is a wall in the way. The test's
  // own Start counts as that touch, so tasks begin where a person who touched the panel would be.
  app.renderer.flipTo("main");
}

// THIS class is capturing, or is in a transition that gets there with nothing more from the
// tester (the few-second STARTING window, or a resume going through). Not while held, not while
// a hold is going on, not while it is being stopped.
function capturing(app, id) {
  const k = app.pearl, run = k.runEvent();
  if (!run || run.id !== id || k.teardown) return false;
  if (k.paused ? k.pauseDirection !== 2 : k.pauseDirection === 1) return false;
  return !!(k.recording || k.startLag > 0);
}

// A class for a fixture, on the SIMULATOR's clock (the page can offset it), with a fixed id so
// grading can insist on THIS class and not any recording.
// The panel rounds its countdown DOWN (js/pearl.js _countdown), so a class exactly 20 minutes out
// reads "19 min" a moment later while the prompt says 20. Classes a prompt times start this much
// later, so the panel agrees with the prompt for the first 50 s (stand-in tester, owner 3A, 2026-10-01).
const G_LEAD_MIN = 50 / 60;
function gradeEvent(app, id, title, startsInMin, lenMin, optIn, confirmed) {
  const n = app.pearl.now();
  // whole seconds: a fractional lead would print as 9:59.999... in a class's last ten minutes
  const start = n + Math.round(startsInMin * 60);
  return { id, title, start, end: start + Math.round(lenMin * 60),
           optIn: !!optIn, confirmed: !!confirmed, started: false, ended: false };
}

// What the room can SEE right now: a source on a projector that is on, warmed up, and not blanked.
function visibleToRoom(app, src) {
  const p = app.program, r = p.routes;
  if (!p.powerOn || p.warmMs > 0) return false;
  return (r.projL === src && !p.hiddenL) || (r.projR === src && !p.hiddenR);
}

// Screen tasks: the projector is on, not blanked, and the source is routed or queued to show.
// Still warming up counts (the panel will show it without anyone doing anything more), and is
// recorded so it can be told apart.
function onScreenOrComing(app, src) {
  const p = app.program, r = p.routes;
  if (!p.powerOn) return false;
  // A pending START PRESENTING queue projects whatever source is selected when warm-up ends
  // (program.js tick), overwriting the current route, so while it is pending it decides.
  if (p.projQueued) return p.source === src && !p.hiddenL && !p.hiddenR;
  return (r.projL === src && !p.hiddenL) || (r.projR === src && !p.hiddenR);
}

// Owner 2026-09-28: the room-computer task was dropped (it was the laptop task's presses with a
// different source); its grading cases moved to the laptop task in verify_tasks.js. Since
// 2026-10-01 every task starts with the projector off.
const TASK_DEFS = [
  {
    id: "laptop",
    name: "Show your laptop",
    hint: "Press POWER ON, then LAPTOP HDMI, then PROJECT.",
    prompt: "You just plugged your own laptop in at the front of the room with the HDMI cable. Show your laptop on the projector screen.",
    // Owner 2026-10-01 (reversing 2026-09-17's "these start warm"): every task starts with the
    // projector OFF, as a room is before class. The warm-up a tester then sees is cut to 5 s in the
    // test (js/testflow.js TF_WARM_MS) and the side panel says the real one is about 30 s; on the
    // real panel PROJECT and VIDEO MUTE are covered for it (spec covers on join 4).
    // HDMI is connected, USB-C is not: choosing the wrong input shows a black picture and must not pass
    setup: app => gradeReset(app, { power: false, hdmi: true, usbc: false }),
    grade: app => ({ worked: onScreenOrComing(app, G_SRC.HDMI),
                     detail: { warming: app.program.warmMs > 0,
                               wrongInput: onScreenOrComing(app, G_SRC.USBC) } }),
  },
  {
    id: "preview",
    name: "Check your laptop before the room sees it",
    hint: "Press LAPTOP HDMI, then LEFT PREVIEW or RIGHT PREVIEW, and leave PROJECT alone.",
    prompt: "Your laptop is plugged in with the HDMI cable. See what your laptop is showing here on the touch panel, and keep it off the projector screen the whole time.",
    setup: app => gradeReset(app, { power: false, hdmi: true, usbc: false }),
    // tracked on every state change, not polled: a brief flash on the screen still counts
    watch: (app, st) => { if (visibleToRoom(app, G_SRC.HDMI)) st.laptopShown = true; },
    grade: (app, st) => {
      const r = app.program.routes, k = app.pearl;
      // Owner 2026-09-29 (Astra): the recorder's content window counts too. VIDEO MUTE, the laptop,
      // PROJECT, then CHECK RECORDER shows the laptop on the panel with the projector blanked. It
      // follows whatever the program sends to the recorder, so if VIDEO MUTE ever cuts that feed,
      // this path stops passing on its own.
      const viaRecorder = !!(k.out && k.out.PreviewOn) && !k.paused && r.kaltura === G_SRC.HDMI &&
                          app.bus.getS(60) !== "";
      const previewing = r.prevL === G_SRC.HDMI || r.prevR === G_SRC.HDMI || viaRecorder;
      // also not about to be shown: projected during a warm-up appears when it ends, and since every
      // task starts with the projector OFF (2026-10-01), a laptop routed to it while it is off appears
      // at the next POWER ON (powering on clears a blank). Cold review 2026-10-01: that path passed.
      const coming = onScreenOrComing(app, G_SRC.HDMI) ||
                     (!app.program.powerOn && (r.projL === G_SRC.HDMI || r.projR === G_SRC.HDMI));
      return { worked: previewing && !st.laptopShown && !coming,
               detail: { previewing, viaRecorder, laptopShownToRoom: !!st.laptopShown, laptopAboutToShow: coming } };
    },
  },
  {
    id: "confirm",
    name: "Make sure a class records",
    hint: "Open LECTURE CAPTURE and press CONFIRM. A class that needs your OK will not record without it.",
    // owner 2026-09-29: the scheduled start has to be clear, and starting early no longer passes
    prompt: "Your class starts in 20 minutes and you want it recorded. Make sure the recording will start on its own at the class's scheduled start time.",
    setup: app => gradeReset(app, { power: false, schedule: [
      gradeEvent(app, "task-confirm", "BSC 2085-0003 - Smith, Jane", 20 + G_LEAD_MIN, 50, true, false)] }),
    // Looking at the schedule is NOT success. The class has to be confirmed and not ended.
    // Expiry is read on the simulator clock (terminal), not only the ended flag, so a class whose
    // time passed without recording fails. Owner 2026-09-29: starting it NOW (START NOW, or the
    // one-press confirm-and-start) is not the task either; it records from 20 minutes early.
    // And the confirm has to land BEFORE the start (Astra 2026-09-29): a class left unconfirmed past
    // its start has already lost its opening, however it is rescued afterwards.
    watch: (app, st) => {
      const k = app.pearl, e = k.schedule.find(x => x.id === "task-confirm");
      if (e && e.started && k.now() < e.start) st.startedEarly = true;
      if (e && e.confirmed && !e.started && k.now() < e.start) st.confirmedInTime = true;
    },
    grade: (app, st) => {
      const k = app.pearl, e = k.schedule.find(x => x.id === "task-confirm");
      const alive = !!(e && !k.terminal(e) && k.teardownEvent !== e);
      // read live too: "done" pressed within one watch tick of CONFIRM
      const inTime = !!st.confirmedInTime || !!(e && e.confirmed && !e.started && k.now() < e.start);
      const worked = alive && !!e.confirmed && inTime && !st.startedEarly;
      return { worked, detail: { confirmed: !!(e && e.confirmed), started: !!(e && e.started),
                                 startedEarly: !!st.startedEarly, confirmedInTime: inTime } };
    },
  },
  {
    id: "walkup",
    name: "Record an unscheduled session",
    hint: "Open LECTURE CAPTURE, press NEW RECORDING, enter the FSUID, press VERIFY, choose a length, then START RECORDING.",
    // the practice ID (owner 2026-09-29), so nobody types their own FSUID into a test
    prompt: "You're holding a review session in this room right now. It isn't on the schedule, so nothing will record it unless you do. Create a new recording. When it asks for your FSUID, use the practice ID " + window.PRACTICE_FSUID + ".",
    setup: app => gradeReset(app, { power: false }),
    // how far a tester got, so a miss says where it stopped (Astra 2026-09-29); flags only, never
    // what was typed
    watch: (app, st) => {
      const k = app.pearl, a = k.adhoc || {}, run = k.runEvent();
      if (app.program.walkup) st.formOpened = true;
      if (a.verified) st.verified = true;
      if (a.name === "ID not found") st.idNotFound = true;
      if (a.durMin > 0) st.lengthPicked = true;
      if (run && run.walkup) st.started = true;
    },
    grade: (app, st) => {
      const k = app.pearl, run = k.runEvent();
      const worked = !!(run && run.walkup && capturing(app, run.id));
      return { worked, detail: { formOpen: !!app.program.walkup, formOpened: !!st.formOpened,
                                 verified: !!st.verified, idNotFound: !!st.idNotFound,
                                 // a started walk-up always had a length, even picked in the same instant
                                 lengthPicked: !!(st.lengthPicked || st.started), started: !!st.started } };
    },
  },
  {
    id: "startearly",
    name: "Start a class recording early",
    hint: "Open LECTURE CAPTURE and press START NOW.",
    prompt: "Your class starts in 15 minutes and its recording is already approved. Everyone is here early and you want to begin. Have the recording running from this point, not from the scheduled time.",
    setup: app => gradeReset(app, { power: false, schedule: [
      gradeEvent(app, "task-early", "CHM 1045-0001 - Doe, John", 15 + G_LEAD_MIN, 50, true, true)] }),
    // Waiting for the scheduled auto-start must NOT pass. "Early" is when the class was STARTED,
    // caught by the watcher the moment it happens, not when the recorder rose: the recorder lags
    // about 2 s, so a START NOW just before the boundary would otherwise flip from worked to not
    // worked depending on when Done was pressed.
    watch: (app, st) => {
      const k = app.pearl, e = k.schedule.find(x => x.id === "task-early");
      if (e && e.started && st.startedEarly === undefined) st.startedEarly = k.now() < e.start;
      // fresh from the walk-up task, a tester may reach for NEW RECORDING instead. With the class 15
      // minutes out the device refuses anything longer, so what is flagged is OPENING the form, the
      // attempt the results need to see (cold review 2026-10-01)
      if (app.program.walkup) st.walkupInstead = true;
    },
    grade: (app, st) => {
      const ours = capturing(app, "task-early");
      return { worked: !!(ours && st.startedEarly),
               detail: { capturing: ours, startedEarly: !!st.startedEarly, walkupInstead: !!st.walkupInstead,
                         startingNotYetRecording: ours && !app.pearl.recording } };
    },
  },
  {
    id: "privacy",
    name: "Keep a private moment out of a recording",
    hint: "Open LECTURE CAPTURE, press PAUSE for the conversation, then RESUME. The same recording carries on.",
    prompt: "Your class is being recorded when a student comes up with a private question. Keep that conversation, and the student, out of the recording without ending it. By the end of this task, the class should be recording again.",
    setup: app => gradeReset(app, { power: false, recordingId: "task-privacy", schedule: [
      gradeEvent(app, "task-privacy", "PSY 3810-0002 - Smith, Jane", -10, 60, false, true)] }),
    // Both halves, on the SAME recording: it was held at some point, and at the moment they say
    // done it is capturing again or its resume is going through (same rule as the other recording
    // tasks: nothing more is needed from the tester), not held, not being stopped.
    // Muting the mic is NOT the task (owner 2026-09-28): the camera still films the student at the
    // lectern, and a forgotten mute silently loses the rest of the lecture's sound. It is recorded
    // as its own flag, so the results show how many testers reach for mute first.
    watch: (app, st) => {
      const k = app.pearl, run = k.runEvent();
      if (k.paused && run && run.id === "task-privacy") st.heldPrivacy = true;
      if (app.program.muteMic) st.mutedMic = true;
    },
    grade: (app, st) => {
      const k = app.pearl, run = k.runEvent();
      const same = !!(run && run.id === "task-privacy");
      const live = capturing(app, "task-privacy");
      // and the mic must be back on: a mute left on loses the rest of the lecture's sound, which is
      // the failure this system exists to prevent (Astra 2026-09-29, owner's 09-28 reasoning)
      const micOn = !app.program.muteMic;
      return { worked: !!(st.heldPrivacy && live && micOn),
               detail: { held: !!st.heldPrivacy, recordingAgain: !!live, stillPaused: same && k.paused,
                         mutedMic: !!st.mutedMic, micStillMuted: !micOn } };
    },
  },
];

// Attach a task's watcher to every state change. The program repaints through refreshAll on every
// press, route, power and warm-up change, and ticks on a timer, so hooking both sees each
// transition synchronously; a 250 ms poll could miss a laptop that was on the screen briefly.
function gradeWatch(app, task, st) {
  const p = app.program;
  if (p.__gradeHooked) { p.__gradeTask = task; p.__gradeState = st; return; }
  p.__gradeTask = task; p.__gradeState = st;
  const run = () => { const t = p.__gradeTask; if (t && t.watch) t.watch(app, p.__gradeState); };
  const oR = p.refreshAll.bind(p);
  p.refreshAll = (...a) => { const v = oR(...a); run(); return v; };
  const oT = p.tick.bind(p);
  p.tick = (...a) => { const v = oT(...a); run(); return v; };
  p.__gradeHooked = true;
}
function gradeUnwatch(app) { app.program.__gradeTask = null; app.program.__gradeState = null; }

// every helper the grades call is listed here: testflow's study version hashes these, so a helper
// left out could change how tasks are graded without changing the version
window.GRADING = { TASK_DEFS, gradeReset, gradeEvent, gradeWatch, gradeUnwatch, visibleToRoom, onScreenOrComing,
                   capturing, G_SRC, G_LEAD_MIN };
