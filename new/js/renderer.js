// Renders pages from the generated spec (build_spec.py) into a 1920x1080 stage.
// Everything positional comes from the compiled panel via the spec; nothing here
// invents geometry. The renderer binds each object to the JoinBus:
//   press joins    -> bus.press/release on pointer events
//   feedback       -> selected face (same join number, the house convention)
//   visibility     -> DigitalVisibilityJoin / VisibilityJoin / subpage DigitalJoin
//   indirect text  -> serial join replaces the label content (markup dialect)
//   analog frames  -> frame_join walks an Image Object's mode list (flash glows)
//   sliders/gauges -> AnalogFeedbackJoin both ways
// Page flips (PageFlip / PageJoin / the LC button) address pages by UID, which is
// how the compiled panel stores them (verified: LC btn 10, BACK 6=main).
"use strict";

const ASSET = "assets/";

// minimum time the pressed face stays up, so a quick click still reads as a press
const PRESS_MIN_MS = 140;

// Ad blockers filter banner-like image names (start_gold_400x68.png), so every
// vtz image resolves through the data-URI map when assets/images.js is loaded.
function imgUrl(path) {
  if (window.IMG && window.IMG[path]) return window.IMG[path];
  return ASSET + path;
}

function el(tag, css) {
  const e = document.createElement(tag);
  if (css) Object.assign(e.style, css);
  return e;
}

function px(n) { return n + "px"; }

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The opening/closing tags of a design-time label, with its placeholder TEXT stripped out. Wrapping
// a plain indirect string in these reproduces what the glass does: the object's font attributes are
// its default text format, and live text inherits them. Returns empty wrappers when the label
// carries no markup, so a formatless label is unaffected.
function defaultTextFormat(markup) {
  const m = String(markup || "");
  const open = (m.match(/^(?:\s*<(?:P[^>]*|FONT[^>]*|B)>)+/i) || [""])[0];
  const close = (m.match(/(?:<\/(?:P|FONT|B)>\s*)+$/i) || [""])[0];
  // only trust a matched pair; a half-parsed wrapper would render broken nesting
  const n = (open.match(/</g) || []).length, c = (close.match(/</g) || []).length;
  return n > 0 && n === c ? { open, close } : { open: "", close: "" };
}

function crestColor(v, fallback) {
  if (!v) return fallback || "transparent";
  v = String(v).trim();
  if (v.startsWith("0x")) return "#" + v.slice(2);
  if (v.startsWith("#")) return v;
  return v;
}

class Renderer {
  constructor(spec, bus, opts) {
    this.spec = spec;
    this.bus = bus;
    this.opts = opts || {};
    this.pagesByUid = {};
    this.pagesByName = {};
    spec.pages.forEach(p => { this.pagesByUid[p.uid] = p; this.pagesByName[p.name] = p; });
    this.currentUid = null;
    this.root = null;
  }

  mount(rootEl) {
    this.root = rootEl;
    rootEl.innerHTML = "";
    rootEl.style.position = "relative";
    rootEl.style.width = px(1920);
    rootEl.style.height = px(1080);
    rootEl.style.overflow = "hidden";
    rootEl.style.background = "#000";
    this.pageEls = {};
    // Only top-level pages get containers; subpages render inside their references.
    for (const p of this.spec.pages) {
      if (p.geo.width === 1920 && this.isTopLevel(p)) {
        const pe = this.renderPage(p, false);
        pe.style.display = "none";
        rootEl.appendChild(pe);
        this.pageEls[p.uid] = pe;
      }
    }
  }

  isTopLevel(p) {
    // A page is top-level when no subpage reference anywhere targets it.
    for (const q of this.spec.pages) {
      for (const o of q.objects) {
        if (o.kind === "subpageref" && parseInt(o.props.PageID, 10) === p.uid) return false;
      }
    }
    return true;
  }

  flipTo(uidOrName) {
    let uid = uidOrName;
    if (typeof uidOrName === "string") {
      const p = this.pagesByName[uidOrName];
      if (!p) { console.warn("no page", uidOrName); return; }
      uid = p.uid;
    }
    if (!this.pageEls[uid]) { console.warn("not a top-level page", uid); return; }
    for (const k in this.pageEls) this.pageEls[k].style.display = "none";
    this.pageEls[uid].style.display = "block";
    this.currentUid = uid;
    if (this.opts.onPageFlip) this.opts.onPageFlip(this.pagesByUid[uid].name);
  }

  renderPage(p, isSub) {
    const g = p.geo;
    const pe = el("div", {
      position: "absolute", left: px(0), top: px(0),
      width: px(g.width), height: px(g.height),
    });
    pe.dataset.page = p.name;
    if (!isSub) {
      pe.style.background = "#101820";
      if (p.background) {
        pe.style.background = "url('" + imgUrl(p.background) + "') 0 0 no-repeat";
      }
    }
    const objs = p.objects.slice().sort((a, b) => a.geo.z - b.geo.z);
    for (const o of objs) {
      const oe = this.renderObject(o, p);
      if (oe) pe.appendChild(oe);
    }
    return pe;
  }

  // ---------------------------------------------------------------- objects
  renderObject(o, page) {
    const t = o.type;
    if (o.kind === "subpageref") return this.subpageRef(o);
    if (t === "Advanced Button" || t === "Button") return this.button(o);
    if (t === "Simple Label" || t === "Formatted Text") return this.label(o);
    if (t === "Fill Border") return this.fillBorder(o);
    if (t === "Image Object") return this.imageObject(o);
    if (t === "EmbeddedVideo") return this.video(o);
    if (t === "Digital Date Time") return this.dateTime(o);
    if (t === "TextEntry") return this.textEntry(o);
    if (t === "Advanced Slider Vertical") return this.slider(o);
    if (t === "Vertical Segmented Gauge") return this.gauge(o);
    console.warn("unrendered type", t, o.name);
    return this.box(o);
  }

  box(o) {
    const g = o.geo;
    return el("div", {
      position: "absolute", left: px(g.left), top: px(g.top),
      width: px(g.width), height: px(g.height), zIndex: g.z,
    });
  }

  bindVis(o, e) {
    const j = parseInt(o.props.DigitalVisibilityJoin || o.props.VisibilityJoin ||
                       (o.kind === "subpageref" ? o.props.DigitalJoin : 0) || 0, 10);
    // restore the element's OWN display (labels are flex); block would break alignment
    const shown = e.style.display || "block";
    if (j > 0) this.bus.onD(j, v => { e.style.display = v ? shown : "none"; });
    return j;
  }

  bindCips(e) {
    e.querySelectorAll("[data-cips]").forEach(sp => {
      const j = parseInt(sp.dataset.cips, 10);
      this.bus.onS(j, v => { sp.innerHTML = crestronLabelToHtml(v); });
    });
  }

  subpageRef(o) {
    const g = o.geo;
    const target = this.pagesByUid[parseInt(o.props.PageID, 10)];
    const e = el("div", {
      position: "absolute", left: px(g.left), top: px(g.top),
      width: px(g.width), height: px(g.height), zIndex: g.z, overflow: "visible",
      // On the glass a subpage only intercepts touch where its own objects are.
      // A plain div intercepts across its whole rectangle, which silently ate
      // every press on CHECK RECORDER (it sits under the layout subpage's box).
      // pointer-events is inherited, so this goes none and interactive leaves
      // inside set themselves back to auto.
      pointerEvents: "none",
    });
    e.dataset.subref = o.name;
    if (target) {
      const inner = this.renderPage(target, true);
      e.appendChild(inner);
    }
    this.bindVis(o, e);
    if (!parseInt(o.props.DigitalJoin || 0, 10)) e.style.display = "block";
    else if (this.bus.getD(parseInt(o.props.DigitalJoin, 10)) === 0) e.style.display = "none";
    return e;
  }

  activeStates(o) {
    // mode 0 unless a mode analog says otherwise (multi-mode buttons unused here)
    const m = (o.modes && o.modes[0]) || {};
    return {
      normal: m.normal || {},
      pressed: m.pressed || m.normal || {},
      selected: m.selected || m.normal || {},
    };
  }

  button(o) {
    const g = o.geo, bus = this.bus;
    const e = this.box(o);
    e.classList.add("btn");
    e.style.pointerEvents = "auto";
    const st = this.activeStates(o);
    const face = el("div", {
      position: "absolute", inset: "0",
      backgroundPosition: "center", backgroundRepeat: "no-repeat",
    });
    const labelEl = el("div", {
      position: "absolute", inset: "0", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      whiteSpace: "pre-wrap", pointerEvents: "none",
    });
    // A state can carry a custom ICON beside its caption, with its own alignment
    // and offsets: the PAUSE bars, the END RECORDING stop, the ADD 5 MINUTES
    // plus, the BACK arrow. It is a separate layer from the face and the label.
    const iconEl = el("img", { position: "absolute", pointerEvents: "none", display: "none" });
    iconEl.draggable = false;
    e.appendChild(face); e.appendChild(iconEl); e.appendChild(labelEl);

    const press = parseInt(o.props.DigitalPressJoin || 0, 10);
    const enable = parseInt(o.props.DigitalEnableJoin || 0, 10);
    const pageFlip = parseInt(o.props.PageFlip || 0, 10);
    const indirect = parseInt(o.props.IndirectTextJoin || 0, 10);
    const localFb = (o.props.ShowLocalFeedback || "true") === "true";
    const selectFb = (o.props.ShowSelectFeedback || "true") === "true";
    let held = false, selected = false, indirectText = null;

    const apply = () => {
      const s = (held && localFb) ? st.pressed : ((selected && selectFb) ? st.selected : st.normal);
      face.style.backgroundImage = s.image ? "url('" + imgUrl(s.image) + "')" : "none";
      // FillType: Stretch draws at OBJECT size (the 64x64 scrim covers 1920x1080);
      // None draws at native size, centered
      face.style.backgroundSize = s.fill === "Stretch" ? "100% 100%" : "auto";
      const ic = s.icon;
      if (ic && ic.image) {
        iconEl.src = imgUrl(ic.image);
        iconEl.style.display = "block";
        const a = ic.align || { v: "Middle", h: "Center", dx: 0, dy: 0 };
        // Offsets are measured from the aligned edge, as the panel stores them, but
        // the edge is the face's CONTENT box, not the object box: the glass insets a
        // Left or Right icon by about 12px more than dx says. Two owner photos: the
        // Instructor check (dx 4) sits 16px in and tight to the word (2026-09-11),
        // and the Both check (dx 30) sits tight to its word (2026-09-02) where
        // dx alone would leave a 15px gap. INFERRED from those two; a photo of the
        // recording page's PAUSE (dx 76) would settle it beyond doubt.
        // The inset is for a GLYPH beside a caption. A full-width icon is a face in
        // disguise (LC_Walkup's START RECORDING carries a 384x100 icon in a 384px
        // button at dx 0) and shifting that clips it; cold review 2026-09-14.
        const iconW = (ic.image && /_(\d+)x\d+\.png$/.exec(ic.image) || [])[1];
        const fullFace = iconW && parseInt(iconW, 10) >= o.geo.width - 2;
        const inset = fullFace ? 0 : 12;
        iconEl.style.left = ""; iconEl.style.right = "";
        if (a.h === "Right") iconEl.style.right = px((a.dx || 0) + inset);
        else if (a.h === "Center") {
          iconEl.style.left = "50%";
          iconEl.style.marginLeft = px(a.dx || 0);
        } else iconEl.style.left = px((a.dx || 0) + inset);
        const centreX = a.h === "Center" ? "translateX(-50%) " : "";
        if (a.v === "Middle") {
          iconEl.style.top = "50%";
          iconEl.style.transform = centreX + "translateY(-50%) translateY(" + (a.dy || 0) + "px)";
          iconEl.style.bottom = "";
        } else {
          iconEl.style.transform = centreX;
          iconEl.style.top = a.v === "Bottom" ? "" : px(a.dy || 0);
          iconEl.style.bottom = a.v === "Bottom" ? px(a.dy || 0) : "";
        }
      } else {
        iconEl.style.display = "none";
      }
      labelEl.style.whiteSpace =
        (o.props.MultilineSupport === "false") ? "nowrap" : "pre-wrap";
      const lab = indirectText != null && indirectText !== "" ? indirectText : (s.label || "");
      labelEl.innerHTML = crestronLabelToHtml(lab);
      this.bindCips(labelEl);
      if (s.align) {
        // column flex: alignItems is HORIZONTAL, justifyContent is VERTICAL
        labelEl.style.alignItems = { Left: "flex-start", Center: "center", Right: "flex-end" }[s.align.h] || "center";
        labelEl.style.justifyContent = { Top: "flex-start", Middle: "center", Bottom: "flex-end" }[s.align.v] || "center";
        labelEl.style.textAlign = (s.align.h || "center").toLowerCase();
        labelEl.style.transform = "translate(" + (s.align.dx || 0) + "px," + (s.align.dy || 0) + "px)";
      }
    };
    apply();

    if (press > 0) bus.onD(press, v => { selected = !!v; apply(); });
    if (indirect > 0) bus.onS(indirect, v => { indirectText = v; apply(); });

    e.addEventListener("pointerdown", ev => {
      if (enable > 0 && !bus.getD(enable)) return;
      ev.preventDefault();
      held = true; apply();
      const downAt = performance.now();
      if (press > 0) bus.press(press);
      const up = () => {
        // The panel shows its pressed face for as long as the finger is down. A
        // mouse click can be a couple of milliseconds, which reads as no
        // feedback at all, so hold the pressed face to a visible minimum.
        const remaining = Math.max(0, PRESS_MIN_MS - (performance.now() - downAt));
        setTimeout(() => { held = false; apply(); }, remaining);
        if (press > 0) bus.release(press);
        if (pageFlip > 0) this.flipTo(pageFlip);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointerup", up);
    });
    this.bindVis(o, e);
    return e;
  }

  label(o) {
    const e = this.box(o);
    e.style.pointerEvents = "none";
    const p = o.props;
    e.style.display = "flex";
    e.style.alignItems = { Top: "flex-start", Middle: "center", Bottom: "flex-end" }[p.VerticalAlignment] || "center";
    const inner = el("div", { width: "100%", whiteSpace: "pre-wrap" });
    inner.style.textAlign = (p.HorizontalAlignment || "center").toLowerCase();
    if (p.FontSizeChoice) inner.style.fontSize = p.FontSizeChoice + "px";
    if (p.FontColor) inner.style.color = crestColor(p.FontColor, "#fff");
    // the glass never auto-wraps single-line labels, and TruncateText clips
    if (p.MultilineSupport === "false") inner.style.whiteSpace = "nowrap";
    if (p.TruncateText === "true") { e.style.overflow = "hidden"; }
    e.appendChild(inner);
    // A label's design-time markup is the object's DEFAULT TEXT FORMAT, not just its
    // placeholder text: the glass renders indirect text that arrives in that format. We used to
    // replace innerHTML outright, so a PLAIN string on the join threw the format away. Size and
    // colour survived only because they are also CSS on `inner`; <B> did not, so the big
    // countdown (Simple Label_65, s10, `<FONT size="96" ...><B>`) rendered regular in the mockup
    // and bold on the glass. Caught by the owner off a photo, 2026-09-15.
    // Text that arrives WITH markup (Page1Formatter emits its own <FONT>/<B>) still wins outright,
    // which is also what the panel does.
    const dflt = defaultTextFormat(o.label || "");
    const hasMarkup = v => /<(P|FONT|B|BR|cips)\b/i.test(v);
    const setContent = mk => { inner.innerHTML = crestronLabelToHtml(mk); this.bindCips(inner); };
    const setText = v => {
      if (v === "" || hasMarkup(v)) { setContent(v); return; }
      setContent(dflt.open + escapeHtml(v) + dflt.close);
    };
    setContent(o.label || "");
    const indirect = parseInt(p.IndirectTextJoin || 0, 10);
    if (indirect > 0) this.bus.onS(indirect, v => setText(v));
    this.bindVis(o, e);
    return e;
  }

  fillBorder(o) {
    const e = this.box(o);
    e.style.pointerEvents = "none";
    const p = o.props;
    e.style.background = hexA(p.FillColor, p.FillAlpha);
    const th = parseInt(p.Thickness || 0, 10);
    // The panel draws the border INSIDE the object's bounds, so a 512x36 row with a
    // 2px border still occupies 512x36. CSS defaults to content-box, which put the
    // border outside: measured 515x39 for every one of the 30 Fill Border objects on
    // this panel, and the schedule rows and their card were the visible case (owner,
    // 2026-09-14). The fill and border COLOURS were right all along.
    if (th > 0) {
      e.style.boxSizing = "border-box";
      e.style.border = th + "px solid " + hexA(p.BorderColor, p.BorderAlpha);
    }
    e.style.borderRadius = (parseInt(p.CornerRadius || 0, 10)) + "px";
    this.bindVis(o, e);
    return e;
    function hexA(c, a) {
      if (!c) return "transparent";
      const hex = crestColor(c);
      let alpha = a == null ? 1 : parseFloat(a);
      if (alpha > 1) alpha = alpha / 255;
      const r = parseInt(hex.slice(1, 3), 16), g2 = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return "rgba(" + r + "," + g2 + "," + b + "," + alpha + ")";
    }
  }

  imageObject(o) {
    const e = this.box(o);
    const img = el("img", { position: "absolute", left: "0", top: "0" });
    img.draggable = false;
    e.appendChild(img);
    const frames = (o.modes || []).map(m => (m.normal && m.normal.image) || null);
    const fills = (o.modes || []).map(m => (m.normal && m.normal.fill) || null);
    const setFrame = i => {
      i = Math.max(0, Math.min(frames.length - 1, i));
      const f = frames[i];
      if (f) {
        img.src = imgUrl(f); img.style.display = "block";
        if (fills[i] === "Stretch") { img.style.width = "100%"; img.style.height = "100%"; }
        else { img.style.width = ""; img.style.height = ""; }
      }
      else img.style.display = "none";
    };
    if (frames.length) setFrame(0); else img.style.display = "none";
    if (o.frame_join) this.bus.onA(o.frame_join, v => setFrame(v));
    const pageFlip = parseInt(o.props.PageFlip || 0, 10);
    const press = parseInt(o.props.DigitalPressJoin || 0, 10);
    if (pageFlip > 0 || press > 0) {
      e.style.pointerEvents = "auto";
      e.addEventListener("pointerdown", () => {
        if (press > 0) { this.bus.press(press); setTimeout(() => this.bus.release(press), 120); }
        if (pageFlip > 0) this.flipTo(pageFlip);
      });
    } else {
      // An image object BLOCKS touch unless it says otherwise. Every warm-up
      // cover ships EnableClickThrough=false, which is what stops VIDEO MUTE and
      // PROJECT being pressed through their WARMING UP cover on the real panel.
      const clickThrough = (o.props.EnableClickThrough || "false") === "true";
      e.style.pointerEvents = clickThrough ? "none" : "auto";
    }
    this.bindVis(o, e);
    return e;
  }

  video(o) {
    const e = this.box(o);
    const p = o.props;
    e.style.background = crestColor(p["InactiveState/InactiveColor"], "#000");
    e.classList.add("video");
    e.style.pointerEvents = "auto";
    e.dataset.video = o.name;
    const pageJoin = parseInt(p.PageJoin || 0, 10);
    if (pageJoin > 0) e.addEventListener("pointerdown", () => this.flipTo(pageJoin));
    const urlSerial = parseInt(p.URLSerial || 0, 10);
    if (this.opts.videoContent) this.opts.videoContent(o, e, urlSerial);
    this.bindVis(o, e);
    return e;
  }

  dateTime(o) {
    const e = this.box(o);
    e.style.pointerEvents = "none";
    const p = o.props;
    e.style.display = "flex"; e.style.alignItems = "center";
    const inner = el("div", { width: "100%" });
    inner.style.textAlign = (p.HorizontalAlignment || "center").toLowerCase();
    inner.style.fontSize = (p.FontSizeChoice || 20) + "px";
    inner.style.color = crestColor(p.FontColor, "#fff");
    e.appendChild(inner);
    // the spec emits Display/DateAndTime, Display/TimeOnly or Display/DateOnly;
    // reading a key it never writes made date-only silently render date+time
    const timeOnly = !!p["Display/TimeOnly"];
    const dateOnly = !!p["Display/DateOnly"] || !!p["Display/DateC"];
    const tick = () => {
      const now = this.opts.now ? this.opts.now() : new Date();
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      let h = now.getHours(); const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12; if (h === 0) h = 12;
      const mm = String(now.getMinutes()).padStart(2, "0");
      const date = months[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear();
      const time = h + ":" + mm + " " + ampm;
      inner.textContent = dateOnly ? date : (timeOnly ? time : date + "  " + time);
    };
    tick();
    setInterval(tick, 1000);
    this.bindVis(o, e);
    return e;
  }

  textEntry(o) {
    const e = this.box(o);
    const p = o.props;
    // The field is the theme's own art for style 223 ("Input Text Field", states
    // Normal and OnFocus, extracted by panel-ui/vtz/extract_theme_icons.py): a white
    // field with ink text, which is what the glass shows on the walk-up form. It
    // used to be a hand-drawn dark box with white text; owner 2026-09-14: "the text
    // fields for the form are white".
    const art = s => "url('" + imgUrl("images/textfield_s223_" + s + ".png") + "')";
    const input = el("input", {
      position: "absolute", inset: "0", width: "100%", height: "100%",
      backgroundColor: "transparent", backgroundImage: art("0_Normal"),
      backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
      color: "#101820", border: "none", borderRadius: "0",
      padding: "0 " + (parseInt(p.BorderSize || 10, 10) + 6) + "px",
      fontSize: (p.FontSizeChoice || 20) + "px",
      fontFamily: "Arial, sans-serif", boxSizing: "border-box", outline: "none",
    });
    input.addEventListener("focus", () => { input.style.backgroundImage = art("1_OnFocus"); });
    input.addEventListener("blur", () => { input.style.backgroundImage = art("0_Normal"); });
    e.appendChild(input);
    e.style.pointerEvents = "auto";
    const outJ = parseInt(p.SerialOutputJoin || 0, 10);
    const inJ = parseInt(p.SerialJoin || 0, 10);
    const enterJ = parseInt(p.EnterKeyPressJoin || 0, 10);
    if (inJ > 0) this.bus.onS(inJ, v => { input.value = v; });
    input.addEventListener("input", () => { if (outJ > 0) this.bus.sendS(outJ, input.value); });
    input.addEventListener("keydown", ev => {
      if (ev.key === "Enter" && enterJ > 0) { this.bus.press(enterJ); setTimeout(() => this.bus.release(enterJ), 120); }
    });
    // LaunchKeyboard: on the real panel the field has no keyboard of its own. Tapping it opens the
    // PANEL's on-screen keyboard, over the lower half of the glass, and that is the only way to
    // type. It never opens uninvited (Set Focus On was removed 2026-07-15, owner), so this hangs
    // off the tap, and the field takes no keystrokes from the tester's own keyboard.
    if ((p.LaunchKeyboard || "false") === "true") {
      input.readOnly = true;
      input.addEventListener("keydown", ev => ev.preventDefault());
      input.addEventListener("mousedown", () => this.launchKeyboard(input, enterJ));
    }
    this.bindVis(o, e);
    return e;
  }

  // The panel's own pop-up keyboard, drawn ON the glass (so it scales with it). Layout, colours
  // and proportions read off the owner's two photos of the bench DGE-200 (2026-09-22, the letters
  // and the ?123 layer): docked from about y=590 to the bottom edge, four rows, light blue letter
  // keys, darker slate control keys, a bright blue Go. It is still a drawing, not Crestron's
  // artwork. Not shown by either photo, so inert here: the blank key at the start of the bottom row
  // and the third layer the ~\{ keys open. Every key updates the field the way a keystroke does, so the
  // serial join fires per character. Each key carries data-k, its identity, because a key like
  // ", !" shows two symbols and its text is no way to find it.
  launchKeyboard(input, enterJ) {
    if (this.kbd) this.closeKeyboard();
    // [key id, width in key units, kind]; kind: "ch" types itself, "dark" is a control key.
    // A "ch" key may carry a small second symbol, drawn top right as on the glass: [id, w, "ch", sup].
    const LETTERS = [
      [["tab", 0.85, "dark"], ..."qwertyuiop".split("").map(c => [c, 1, "ch"]), ["bksp", 1.25, "dark"]],
      [["sym", 1.2, "dark"], ..."asdfghjkl".split("").map(c => [c, 1, "ch"]), ["go", 1.9, "go"]],
      [["shift", 1.5, "dark"], ..."zxcvbnm".split("").map(c => [c, 1, "ch"]),
       [",", 1, "ch", "!"], [".", 1, "ch", "?"], ["shift2", 1.6, "dark"]],
      [["blank", 1.55, "dark"], ["/", 0.9, "dark", "@"], ["space", 5, "ch"], ["'", 1, "dark", "\""],
       ["-", 1, "dark", "_"], [":-)", 1, "dark"], ["hide", 1, "dark"]],
    ];
    // The ?123 layer, read off the owner's second photo (2026-09-22). Its ~\{ keys open a third
    // layer the photos do not show, so here they do nothing.
    const SYMBOLS = [
      [["tab", 0.85, "dark"], ..."1234567890".split("").map(c => [c, 1, "ch"]), ["bksp", 1.25, "dark"]],
      [["sym", 1.2, "dark"], ..."#$%&*-+()".split("").map(c => [c, 1, "ch"]), ["go", 1.9, "go"]],
      [["more", 1.55, "dark"], ..."<>=:;,.!?".split("").map(c => [c, 1, "ch"]), ["more2", 1.55, "dark"]],
      [["blank", 1.55, "dark"], ["/", 0.9, "ch"], ["@", 0.9, "ch"], ["space", 4.6, "ch"],
       ["\"", 1, "dark"], ["_", 1, "dark"], ["hide", 1, "dark"]],
    ];
    const C = { bg: "#23344c", key: "#6f96cb", dark: "#34496b", go: "#1f6fe3", ink: "#ffffff" };
    // The a..l row runs edge to edge on the glass: its 12.1 units plus gaps fill 1920 exactly.
    const GAP = 16, UNIT = (1920 + GAP) / 12.1 - GAP, KEY_H = 104, ROW_GAP = 18;
    const wrap = el("div", {
      position: "absolute", left: "0", top: "590px", width: "1920px", height: "490px",
      background: C.bg, zIndex: "900", padding: "8px 0 0 0", boxSizing: "border-box",
      pointerEvents: "auto", overflow: "hidden",
    });
    wrap.className = "kbd-overlay";
    let shift = false, layer = LETTERS;
    const type = t => {
      input.value = (input.value + t).slice(0, 60);
      input.dispatchEvent(new Event("input"));
    };
    const enter = () => { if (enterJ > 0) { this.bus.press(enterJ); setTimeout(() => this.bus.release(enterJ), 120); } };
    const ICON = { tab: "Tab", bksp: "⌫", go: "Go", shift: "⇧", shift2: "⇧", blank: "", hide: "⌨", space: "",
                   more: "~\\{", more2: "~\\{" };
    const act = id => {
      if (id === "bksp") { input.value = input.value.slice(0, -1); input.dispatchEvent(new Event("input")); }
      else if (id === "go") { enter(); this.closeKeyboard(); }
      else if (id === "hide") this.closeKeyboard();
      else if (id === "shift" || id === "shift2") { shift = !shift; draw(); }
      else if (id === "sym") { layer = layer === LETTERS ? SYMBOLS : LETTERS; shift = false; draw(); }
      else if (id === "space") type(" ");
      else if (id === "tab" || id === "blank" || id === "more" || id === "more2") { /* see the layer notes */ }
      else { type(shift && /^[a-z]$/.test(id) ? id.toUpperCase() : id); if (shift) { shift = false; draw(); } }
    };
    const draw = () => {
      wrap.innerHTML = "";
      for (const row of layer) {
        const r = el("div", { display: "flex", gap: GAP + "px", marginBottom: ROW_GAP + "px" });
        for (const [id, w, kind, sup] of row) {
          const k = el("div", {
            position: "relative", width: Math.round(w * UNIT + (w - 1) * GAP) + "px", height: KEY_H + "px",
            flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
            background: kind === "go" ? C.go : kind === "dark" ? C.dark : C.key, color: C.ink,
            // every one-character key (letters, digits, symbols) is drawn large, as on the glass
            fontFamily: "Arial, sans-serif", fontSize: id.length === 1 ? "42px" : "30px",
            borderRadius: "3px", cursor: "pointer", userSelect: "none",
          });
          k.dataset.k = id;
          const label = id === "sym" ? (layer === LETTERS ? "?123" : "ABC")
            : id in ICON ? ICON[id]
            : shift && /^[a-z]$/.test(id) ? id.toUpperCase() : id;
          k.appendChild(document.createTextNode(label));
          if (sup) {
            const s = el("span", { position: "absolute", top: "4px", right: "8px", fontSize: "20px", opacity: "0.85" });
            s.textContent = sup;
            k.appendChild(s);
          }
          if ((id === "shift" || id === "shift2") && shift) k.style.background = C.key;
          k.onmousedown = ev => { ev.preventDefault(); act(id); };
          r.appendChild(k);
        }
        wrap.appendChild(r);
      }
    };
    draw();
    this.root.appendChild(wrap);
    this.kbd = wrap;
  }
  closeKeyboard() {
    if (!this.kbd) return;
    this.kbd.remove();
    this.kbd = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  // Layout read off the glass (owner photo 2026-08-31), top to bottom:
  //   MIC / MAIN  ->  MAX  ->  thick track with the knob  ->  MIN  ->  83%
  // The MIN/MAX captions come from the slider's on/off button labels and DO
  // render even though OnOff is false, so they are drawn; an earlier pass
  // removed them by reading the property instead of the panel.
  slider(o) {
    const bus = this.bus, p = o.props;
    const showPct = (p["PercentageDisplay/ShowPercentageLabel"] || "false") === "true";
    const e = this.box(o);
    e.classList.add("slider");
    e.style.pointerEvents = "auto";

    // MAX/MIN are set at the MAIN label's own size: on the glass (owner photo
    // 2026-09-14) the three captions are the same height. 13px was a guess.
    const mainSize = parseInt((/size="(\d+)"/.exec(p["MainLabel/Label"] || "") || [])[1] || 17, 10);
    const cap = (txt, top) => {
      const d = el("div", {
        position: "absolute", left: "0", width: "100%", textAlign: "center",
        top: px(top), fontSize: px(mainSize), fontWeight: "bold", color: "#ffffff",
        pointerEvents: "none", letterSpacing: "0.02em",
      });
      d.textContent = txt;
      return d;
    };

    const showMain = (p["MainLabel/ShowMainLabel"] || "true") === "true";
    const label = el("div", {
      position: "absolute", top: "0", width: "100%", textAlign: "center",
      pointerEvents: "none",
    });
    if (showMain) label.innerHTML = crestronLabelToHtml(p["MainLabel/Label"] || "");

    const maxTxt = p["ButtonProperties/ButtonOnProperties/Label"] || "MAX";
    const minTxt = p["ButtonProperties/ButtonOffProperties/Label"] || "MIN";
    const H = o.geo.height;
    const TOP_LABEL = showMain ? 22 : 0;
    const CAP_H = mainSize + 4, PCT_H = 19;
    const trackTop = TOP_LABEL + CAP_H;
    const trackBot = CAP_H + (showPct ? PCT_H : 0);

    // The art is the panel's own. Styles 233/239 in the theme were replaced with
    // panel-ui/theme/make_slider_art.py's v3 output (patch_theme_swf.py), so the
    // four PNGs here are byte-for-byte what the DGE draws: a 34x144 track whose
    // groove is only columns 13..20, a matching fill, and a 50x40 knob with a 38px
    // circle. The glass stretches the track art across the slider's full width, so
    // the visible groove ends up about 8/34 of that, and it draws the knob at
    // native size. Owner photo 2026-09-14: the groove reads 0.44 to 0.53 of the
    // knob's width depending on how it is measured, and this geometry gives 0.50
    // (18px against 36 on the render). Whether the panel really spans the full
    // width or the width minus TouchPadding is not proven on the DGE; full width
    // matched the photo better and the owner's eye. An earlier pass had hand-tuned
    // a 44px opaque groove and a 62px knob to a 2026-09-02 photo of a DIFFERENT
    // build, where MIC and MAIN were both wide-track sliders.
    //
    // Two boxes, on purpose. `track` is the TOUCH target: the drawn art plus
    // TouchPadding on every side, which is how the panel widens the active region.
    // `groove` is the DRAWN part, inset by that padding, and it is the containing
    // block for the fill and the knob so their percentages measure the groove.
    //
    // The track art spans the slider's FULL width; TouchPadding widens the touch
    // box beyond it rather than shrinking the art (owner, 2026-09-14: "slightly
    // thicker", and the by-eye ratio off his photo was 0.53, which 8/34 of 86
    // against a 38px knob gives). The touch box is sized explicitly rather than
    // with a negative margin: `left: 50%` positions the MARGIN edge, so the old
    // `margin: -pad` slid the whole slider left by exactly TouchPadding. Measured
    // 10px off centre on the 2026-09-14 render, and it had been so since the
    // padding was introduced.
    const pad = parseInt(p["SliderProperties/TouchPadding"] || 0, 10);
    const TRACK_W = o.geo.width;
    const KNOB_W = 50, KNOB_H = 40;
    const track = el("div", {
      position: "absolute", left: "50%", transform: "translateX(-50%)",
      top: px(trackTop - pad), bottom: px(trackBot - pad),
      width: px(TRACK_W + 2 * pad), boxSizing: "border-box", padding: px(pad),
    });
    const groove = el("div", {
      position: "absolute", left: px(pad), right: px(pad), top: px(pad), bottom: px(pad),
      backgroundImage: "url('" + imgUrl("images/slider_v3_track_34x144.png") + "')",
      backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
    });
    track.appendChild(groove);
    const fill = el("div", {
      position: "absolute", left: "0", right: "0", bottom: "0", height: "0%",
      backgroundImage: "url('" + imgUrl("images/slider_v3_fill_34x144.png") + "')",
      backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
    });
    if ((p["SliderProperties/ShowTrackFill"] || "true") !== "true") fill.style.display = "none";
    groove.appendChild(fill);
    const knob = el("img", {
      position: "absolute", left: "50%", width: px(KNOB_W), height: px(KNOB_H),
      transform: "translate(-50%, 50%)", bottom: "0%", pointerEvents: "none",
    });
    knob.src = imgUrl("images/slider_v3_knob_up_50x40.png");
    knob.draggable = false;
    groove.appendChild(knob);

    const pct = el("div", {
      position: "absolute", left: "0", bottom: "0", width: "100%", textAlign: "center",
      fontSize: (p["PercentageDisplay/PercentageFontSize"] || "14") + "px",
      color: crestColor(p["PercentageDisplay/PercentageFontColor"], "#fff"),
      fontWeight: "bold", pointerEvents: "none", display: showPct ? "block" : "none",
    });

    e.appendChild(track);
    if (showMain) e.appendChild(label);
    e.appendChild(cap(maxTxt, trackTop - CAP_H));
    e.appendChild(cap(minTxt, H - trackBot + 1));
    e.appendChild(pct);

    const fbJ = parseInt(p.AnalogFeedbackJoin || 0, 10);
    const maxV = parseInt(p["SliderProperties/MaxValue"] || 65535, 10);
    const minV = parseInt(p["SliderProperties/MinValue"] || 0, 10);
    const setPos = v => {
      const frac = Math.max(0, Math.min(1, (v - minV) / (maxV - minV)));
      fill.style.height = (frac * 100) + "%";
      knob.style.bottom = (frac * 100) + "%";
      if (showPct) pct.textContent = Math.round(frac * 100) + "%";
    };
    if (fbJ > 0) bus.onA(fbJ, setPos); else setPos(0);

    if ((p["SliderProperties/TouchSettable"] || "true") === "true" && fbJ > 0) {
      const fromEvent = ev => {
        const r = groove.getBoundingClientRect();   // the drawn part, not the padded box
        const frac = 1 - (ev.clientY - r.top) / r.height;
        return Math.round(minV + Math.max(0, Math.min(1, frac)) * (maxV - minV));
      };
      // bound to the TRACK, not the whole object: tapping the MIC/MAX caption
      // must not jump the level to 100%
      track.addEventListener("pointerdown", ev => {
        knob.src = imgUrl("images/slider_v3_knob_down_50x40.png");
        const move = mv => bus.sendA(fbJ, fromEvent(mv));
        move(ev);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", () => {
          window.removeEventListener("pointermove", move);
          knob.src = imgUrl("images/slider_v3_knob_up_50x40.png");
        }, { once: true });
      });
    }
    this.bindVis(o, e);
    return e;
  }

  gauge(o) {
    const e = this.box(o);
    e.style.pointerEvents = "none";
    const p = o.props;
    const n = parseInt(p.NumPips || 20, 10);
    const sec = parseInt(p.SecondaryPercent || 20, 10);
    const ter = parseInt(p.TertiaryPercent || 40, 10);
    const pips = [];
    const wrap = el("div", {
      position: "absolute", inset: "0", display: "flex",
      flexDirection: "column-reverse", gap: "2px", padding: (p.Padding || 5) + "px",
      boxSizing: "border-box",
    });
    // Each pip is the theme's own art for pip style 35 ("Segmented Vertical Gauge
    // Rect Pip", 22x8, extracted by panel-ui/vtz/extract_theme_icons.py), stretched
    // to the gauge's inner width the way the panel draws it. The inactive state is a
    // translucent dark grey, which is why a resting meter reads as a dark segmented
    // column on the garnet card rather than vanishing.
    const art = s => "url('" + imgUrl("images/gauge_pip_s35_" + s + ".png") + "')";
    for (let i = 0; i < n; i++) {
      const pip = el("div", {
        flex: "1", backgroundImage: art("0_Inactive"),
        backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
      });
      wrap.appendChild(pip); pips.push(pip);
    }
    e.appendChild(wrap);
    const fbJ = parseInt(p.AnalogFeedbackJoin || 0, 10);
    if (fbJ > 0) this.bus.onA(fbJ, v => {
      const lit = Math.round((v / 65535) * n);
      pips.forEach((pip, i) => {
        // Owner's rule for the meter (2026-09-14): "all green if it only reaches
        // 50%". So SecondaryPercent and TertiaryPercent are slices from the TOP:
        // the top 20% of pips are red, the next 20% yellow, everything below green.
        // The literal bottom-up reading of the properties (green only to 20%) was
        // tried first and rendered a talking lecturer as a red column; it was
        // wrong. Whether the real gauge's config produces this same split on the
        // glass is the owner's to confirm, since he set the values.
        const fromTop = 100 - (i / n) * 100;
        let s = "0_Inactive";
        if (i < lit) s = fromTop <= sec ? "3_Red" : (fromTop <= ter ? "2_Yellow" : "1_Green");
        pip.style.backgroundImage = art(s);
      });
    });
    this.bindVis(o, e);
    return e;
  }
}

window.Renderer = Renderer;
