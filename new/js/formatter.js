// Page1Formatter v1.10, ported line-for-line from panel-project/Page1Formatter.usp,
// PLUS one v1.16 change: the s20 LC-page countdown line (2026-09-17, mockup phase 1).
// The rest of v1.11..v1.16 (elapsed-time fault debounce, queued preview commands) is NOT
// ported yet; the current source is pearl-api-reference/simplplus/Page1Formatter.usp.
// Composes the main-page status card (s15 body, s19 top), the preview countdown
// (s16, and s20 on the LC page), the listened source (s17), the recorder truth word
// (s18) and the d69 LC dot cadence. Inputs arrive as a plain object the Pearl sim maintains; outputs
// go to the join bus. PumpTick is ~100ms, same as the program.
"use strict";

const PULSE_HIGH = 8, PULSE_LOW = 6;

class Page1Formatter {
  constructor(bus, sources) {
    this.bus = bus;
    this.sources = sources; // {1:"Blu-ray", 2:"Document Camera", ...} route names
    this.in = {
      ConfirmReady: 0, Confirmed: 0, StateIdle: 0, StateUpNext: 0, StateRec: 0,
      StatePaused: 0, EndedPulse: 0, RecordingTruth: 0, EventRun: 0, PreviewOn: 0,
      NowTitle: "", UpNextTitle: "", UpNextTime: "", NowUntil: "",
      ConfirmTitle: "", ConfirmSub: "",
      RemainingSeconds: 0, RecorderHealth: 0, PreviewSeconds: 0,
      CaptureRoute: 0, AudioRoute: 0,
    };
    this.gTick = 0; this.gDot = 0; this.gFaultTicks = 0; this.gWasRec = 0;
    this.gFaultTitle = ""; this.gEndedTitle = "";
    this.o = { top: "\x01", body: "\x01", truth: "\x01", count: "\x01", lcCount: "\x01", listen: "\x01" };
    this._lastTruth = 0; this._lastStateRec = 0; this._lastEnded = 0; this._lastNowTitle = "";
  }

  clean(src, maxlen) {
    let out = "";
    for (let i = 0; i < src.length; i++) {
      if (out.length >= maxlen) break;
      const c = src.charCodeAt(i);
      if (c === 60 || c === 62) continue;
      out += (c < 32 || c > 126) ? " " : src[i];
    }
    return out;
  }
  ellip(src, cap) {
    if (src.length <= cap) return src;
    if (cap <= 2) return src.slice(0, cap);
    return src.slice(0, cap - 2) + "..";
  }
  mss(secs) { return Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0"); }
  sourceName(route, base) {
    const n = route - base;
    const raw = this.sources[n] || "";
    return this.clean(raw, 24);
  }
  upNextStart(range) {
    const i = range.indexOf(" - ");
    let out = i > 0 ? range.slice(0, i) : range;
    return this.clean(out, 12);
  }
  nowEndClock(nu) {
    let out = nu.startsWith("Recording until ") ? nu.slice(16) : nu;
    return this.clean(out, 12);
  }
  wrapFit(src, fitLen, maxLines) {
    if (src.length <= fitLen) return src;
    let out = "", rest = src, lines = 0;
    while (rest.length > fitLen) {
      let cut = 0;
      for (let i = 1; i <= fitLen + 1; i++) {
        if (i <= rest.length) {
          if (rest.charCodeAt(i - 1) === 32) cut = i;
          if (rest.charCodeAt(i - 1) === 47 && i <= fitLen) cut = -i;
        }
      }
      let chunk;
      if (cut === 0) { chunk = rest.slice(0, fitLen); rest = rest.slice(fitLen); }
      else if (cut < 0) { const i = -cut; chunk = rest.slice(0, i); rest = rest.slice(i); }
      else { chunk = rest.slice(0, cut - 1); rest = rest.slice(cut); }
      lines += 1;
      if (lines >= maxLines - 1 && rest.length > fitLen) rest = this.ellip(rest, fitLen);
      if (out.length > 0) out += "<BR>";
      out += chunk;
    }
    if (out.length === 0) return src;
    return out + "<BR>" + rest;
  }

  compose() {
    const I = this.in;
    const recValid = ((I.RecorderHealth & 1) && !(I.RecorderHealth & 4)) ? 1 : 0;
    const cardValid = (recValid && (I.RecorderHealth & 2)) ? 1 : 0;
    let topPx = 22, topColor = "#CEB888", title = "", dim = "", top = "", t1, t2;

    if (!cardValid) {
      if (recValid) { top = "NO SCHEDULE"; dim = "The recorder is still responding"; }
      else { top = "STATUS UNKNOWN"; dim = "Cannot reach the recorder right now"; }
    } else if (this.gFaultTicks >= 120) {
      topColor = "#FF8F9C"; top = "NOT RECORDING"; title = this.gFaultTitle;
      dim = "Class is running. Call support.";
    } else if (I.EndedPulse) {
      top = "RECORDING ENDED"; title = this.gEndedTitle;
      dim = "Uploads to My Media on its own";
    } else if (I.StatePaused && I.RecordingTruth) {
      top = "ON HOLD"; title = this.clean(I.NowTitle, 54);
      dim = "Open Lecture Capture to resume";
    } else if (I.StateRec && I.RecordingTruth && I.RemainingSeconds > 0 && I.RemainingSeconds < 600) {
      top = this.mss(I.RemainingSeconds); title = this.clean(I.NowTitle, 54);
      dim = "left of this recording";
    } else if (I.StateRec && I.RecordingTruth) {
      top = "RECORDING"; title = this.clean(I.NowTitle, 54);
      t1 = this.ellip(this.sourceName(I.CaptureRoute, 0), 15);
      t2 = this.nowEndClock(I.NowUntil);
      if (t1.length === 0 && t2.length > 0) dim = "until " + t2;
      else if (t2.length > 0) dim = t1 + " - until " + t2;
      else dim = t1;
    } else if (I.StateRec && !I.RecordingTruth && !this.gWasRec) {
      top = "STARTING";
      if (I.NowTitle.length > 0) title = this.clean(I.NowTitle, 54);
      dim = "Recording begins on its own";
    } else if (I.StateRec) {
      top = "RECORDING"; title = this.clean(I.NowTitle, 54);
      t1 = this.ellip(this.sourceName(I.CaptureRoute, 0), 15);
      t2 = this.nowEndClock(I.NowUntil);
      if (t1.length === 0 && t2.length > 0) dim = "until " + t2;
      else if (t2.length > 0) dim = t1 + " - until " + t2;
      else dim = t1;
    } else if (I.ConfirmReady && !I.Confirmed) {
      top = "NEEDS YOUR OK";
      if (I.ConfirmTitle.length > 0) title = this.clean(I.ConfirmTitle, 54);
      dim = "Open Lecture Capture to confirm";
    } else if (I.Confirmed) {
      top = "CONFIRMED";
      if (I.ConfirmTitle.length > 0) title = this.clean(I.ConfirmTitle, 54);
      t2 = this.clean(I.ConfirmSub, 40);
      dim = t2.length > 0 ? t2 : "Starts on its own";
    } else if (I.StateUpNext) {
      top = "NEXT"; title = this.clean(I.UpNextTitle, 54);
      t2 = this.upNextStart(I.UpNextTime);
      dim = t2.length > 0 ? "Scheduled for " + t2 : "Coming up today";
    } else {
      top = "LECTURE CAPTURE";
      dim = "Nothing scheduled. You can still record from here.";
    }

    this.shTop = '<FONT size="' + topPx + '" color="' + topColor + '"><B>' + top + "</B></FONT>";

    let body;
    if (title.length > 0) {
      let titleCap = 45;
      dim = this.ellip(dim, 32);
      for (;;) {
        t1 = this.ellip(title, titleCap);
        t1 = this.wrapFit(t1, 26, 2);
        body = '<FONT size="14"><B>' + t1 + '</B></FONT><BR><FONT size="1"> </FONT><BR><FONT color="#C3CAD1" size="13">' + dim + "</FONT>";
        if (body.length <= 242 || titleCap <= 6) break;
        titleCap -= 6;
      }
    } else {
      t2 = this.ellip(dim, 69);
      t2 = this.wrapFit(t2, 32, 3);
      body = '<FONT color="#C3CAD1" size="13">' + t2 + "</FONT>";
    }
    this.shBody = body;

    if (!recValid) this.shTruth = '<FONT size="13" color="#5A6068"><B>STATUS UNKNOWN</B></FONT>';
    else if (I.RecordingTruth && I.StatePaused) this.shTruth = '<FONT size="13" color="#101820"><B>ON HOLD</B></FONT>';
    else if (I.RecordingTruth) this.shTruth = '<FONT size="13" color="#A6192E"><B>RECORDING</B></FONT>';
    else this.shTruth = '<FONT size="13" color="#101820"><B>NOT RECORDING</B></FONT>';
  }

  refresh() {
    this.compose();
    const B = this.bus, o = this.o, I = this.in;
    if (this.shTop.length && this.shTop !== o.top) { o.top = this.shTop; B.setS(19, this.shTop); }
    if (this.shBody.length && this.shBody !== o.body) { o.body = this.shBody; B.setS(15, this.shBody); }
    if (this.shTruth !== o.truth) { o.truth = this.shTruth; B.setS(18, this.shTruth); }
    // v1.16 samples PreviewSeconds once so the test and both texts agree, and adds s20:
    // the LC page's own "Live view. Closes in M:SS" line off the same clock, empty when the
    // preview is closed (Page1Formatter.usp v1.16 Refresh; panel round 28 points
    // Simple Label_21 at s20; Rev 56 wires O7 LcCountdown$ to DGE I240).
    const pvs = I.PreviewSeconds;
    let c = "", lc = "";
    if (I.PreviewOn && pvs > 0) {
      const m = this.mss(pvs);
      c = "closes in " + m;
      lc = "Live view. Closes in " + m;
    }
    if (c !== o.count) { o.count = c; B.setS(16, c); }
    if (lc !== o.lcCount) { o.lcCount = lc; B.setS(20, lc); }
    let l = I.AudioRoute > 0 ? this.sourceName(I.AudioRoute, 5) : "";
    if (l !== o.listen) { o.listen = l; B.setS(17, l); }
  }

  // edge latches, mirrored from the .usp event handlers
  edges() {
    const I = this.in;
    if (I.NowTitle !== this._lastNowTitle) {
      if (I.NowTitle.length > 0) this.gFaultTitle = this.clean(I.NowTitle, 54);
      this._lastNowTitle = I.NowTitle;
    }
    if (I.EndedPulse && !this._lastEnded) {
      this.gEndedTitle = I.NowTitle.length > 0 ? this.clean(I.NowTitle, 54) : this.gFaultTitle;
      this.gWasRec = 0;
    }
    this._lastEnded = I.EndedPulse;
    if (I.RecordingTruth && !this._lastTruth) { this.gTick = 0; this.gWasRec = 0; }
    if (!I.RecordingTruth && this._lastTruth) { this.gTick = 0; this.gWasRec = 1; }
    this._lastTruth = I.RecordingTruth;
    if (!I.StateRec && this._lastStateRec) this.gWasRec = 0;
    this._lastStateRec = I.StateRec;
  }

  pumpTick() {
    this.edges();
    const I = this.in;
    const recValid = (I.RecorderHealth & 1) && !(I.RecorderHealth & 4);
    let want;
    if (!recValid) { want = 0; this.gTick = 0; }
    else if (!I.RecordingTruth) { want = 1; }
    else {
      want = this.gTick < PULSE_HIGH ? 1 : 0;
      this.gTick += 1;
      if (this.gTick >= PULSE_HIGH + PULSE_LOW) this.gTick = 0;
    }
    if (want !== this.gDot) { this.gDot = want; this.bus.setD(69, want); }

    if (recValid && I.EventRun && !I.RecordingTruth) {
      if (this.gFaultTicks < 200) this.gFaultTicks += 1;
    } else this.gFaultTicks = 0;
    this.refresh();
  }
}

window.Page1Formatter = Page1Formatter;
