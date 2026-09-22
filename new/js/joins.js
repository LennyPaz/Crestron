// The join bus: the wire between the simulated program and the rendered glass.
// Digital joins are booleans, analogs are 0..65535 integers, serials are strings.
// The glass subscribes; the program writes. Presses go the other way through
// press()/release(), which fire edge handlers the program registers.
"use strict";

class JoinBus {
  constructor() {
    this.d = {};   // digital feedback TO the glass (and internal signals)
    this.a = {};   // analog
    this.s = {};   // serial
    this.subs = { d: {}, a: {}, s: {} };
    this.pressHandlers = {};   // digital press join -> [fn(edge)]  edge: 1 press, 0 release
    this.held = {};            // press joins currently held down
  }

  // ---- feedback plane (program -> glass) ----
  setD(j, v) {
    v = v ? 1 : 0;
    if (this.d[j] === v) return;
    this.d[j] = v;
    (this.subs.d[j] || []).forEach(fn => fn(v));
  }
  setA(j, v) {
    v = v | 0;
    if (this.a[j] === v) return;
    this.a[j] = v;
    (this.subs.a[j] || []).forEach(fn => fn(v));
  }
  setS(j, v, force) {
    v = String(v == null ? "" : v);
    if (this.s[j] === v && !force) return;
    this.s[j] = v;
    (this.subs.s[j] || []).forEach(fn => fn(v));
  }
  getD(j) { return this.d[j] || 0; }
  getA(j) { return this.a[j] || 0; }
  getS(j) { return this.s[j] || ""; }

  onD(j, fn) { (this.subs.d[j] = this.subs.d[j] || []).push(fn); fn(this.getD(j)); }
  onA(j, fn) { (this.subs.a[j] = this.subs.a[j] || []).push(fn); fn(this.getA(j)); }
  onS(j, fn) { (this.subs.s[j] = this.subs.s[j] || []).push(fn); fn(this.getS(j)); }

  // ---- press plane (glass -> program) ----
  onPress(j, fn) { (this.pressHandlers[j] = this.pressHandlers[j] || []).push(fn); }
  press(j) {
    if (!j) return;
    this.held[j] = 1;
    (this.pressHandlers[j] || []).forEach(fn => fn(1));
  }
  release(j) {
    if (!j) return;
    delete this.held[j];
    (this.pressHandlers[j] || []).forEach(fn => fn(0));
  }
  isHeld(j) { return !!this.held[j]; }

  // analog set from the glass (slider touch)
  sendA(j, v) {
    (this.pressHandlers["a" + j] || []).forEach(fn => fn(v));
  }
  onSendA(j, fn) { this.onPress("a" + j, fn); }

  // serial set from the glass (text entry)
  sendS(j, v) {
    (this.pressHandlers["s" + j] || []).forEach(fn => fn(v));
  }
  onSendS(j, fn) { this.onPress("s" + j, fn); }
}

window.JoinBus = JoinBus;
