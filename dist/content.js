(function () {
  "use strict";

  // ─── Config ───────────────────────────────────────────
  const C = {
    bg: "rgba(255, 255, 255, 0.3)", 
    fg: "#3D3A36",                 
    ish: "rgba(0,0,0,0.05)",
    hl: "rgba(255,255,255,0.8)",
    trk: "rgba(0,0,0,0.1)",        
    accent: "#E2A871",
    gray: "rgba(0,0,0,0.1)"
  };

  const DOMAINS = ["youtube.com", "bilibili.com"];
  if (!DOMAINS.some((d) => location.hostname.includes(d))) return;

  // ─── State ────────────────────────────────────────────
  let S = { 
    power: false, 
    speed: 1.0, 
    noise: 10, 
    wobble: 15, 
    satur: 15, 
    collapsed: true, 
    pinned: false, 
    x: 20, 
    y: 100, 
    vu: new Array(18).fill(0) 
  };

  // ─── Audio Engine ─────────────────────────────────────
  let audioCtx = null;
  function ensureAC() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function distort(amt) {
    const k = amt, n = 44100, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((3 + k) * x * 0.4) / (Math.PI + k * Math.abs(x)); }
    return c;
  }

  function processVid() {
    const vids = Array.from(document.querySelectorAll("video")).filter((v) => v.clientWidth > 50);
    if (S.power && audioCtx && audioCtx.state === "suspended") audioCtx.resume();

    vids.forEach((v) => {
      v.style.filter = S.power ? "brightness(1.05) contrast(0.9) saturate(0.7) sepia(0.05)" : "none";
      const ctx = audioCtx;
      if (!ctx) return;
      try {
        let n = v._rsN;
        if (S.power && !n && v.readyState >= 2) {
          const src = ctx.createMediaElementSource(v), flt = ctx.createBiquadFilter(), dst = ctx.createWaveShaper(),
            pan = ctx.createStereoPanner(), ng = ctx.createGain(); ng.gain.value = 0;
          const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true; ns.start();
          const an = ctx.createAnalyser(); an.fftSize = 64;
          src.connect(flt); flt.connect(dst); dst.connect(pan); pan.connect(an); an.connect(ctx.destination);
          ns.connect(ng); ng.connect(ctx.destination);
          n = { flt, dst, pan, ng, an, ns, src }; v._rsN = n;
        }
        if (!n) return;
        const isPlaying = !v.paused && !v.ended && v.readyState >= 2;
        const nv = (S.noise / 100) * 0.04, wv = ((S.wobble - 50) / 50) * 0.03, sv = (S.satur / 100) * 15;
        if (S.power && isPlaying) {
          n.flt.frequency.setTargetAtTime(2800, ctx.currentTime, 0.01);
          n.dst.curve = distort(sv);
          n.ng.gain.setTargetAtTime(nv, ctx.currentTime, 0.01);
          v.playbackRate = S.speed + Math.sin(Date.now() / 160) * wv;
        } else {
          n.ng.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
          n.dst.curve = null;
          n.flt.frequency.setTargetAtTime(20000, ctx.currentTime, 0.01);
          if (!S.power) v.playbackRate = 1;
        }
      } catch (_) {}
    });
  }
  setInterval(processVid, 100);

  // ─── Styles ──────────────────────────────────────────
  if (!document.getElementById("rs-styles")) {
    const s = document.createElement("style");
    s.id = "rs-styles";
    s.textContent = `
#rs-root{all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;pointer-events:none}
#rs-root *{pointer-events:auto}
.rs-c{position:fixed;z-index:2147483647;width:230px;background:${C.bg};border-radius:12px;padding:20px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.12); border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);
  color:${C.fg};cursor:grab;user-select:none;transition:transform .2s ease, opacity .4s ease, height .3s ease;overflow:hidden;will-change: left, top;}

.rs-dragging { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; cursor: grabbing !important; }

.rs-c.mini{width:40px;height:40px;padding:0;display:flex;align-items:center;justify-content:center;opacity:0.6}
.rs-c.mini:hover{opacity:1}

.rs-h{display:flex;justify-content:space-between;font-weight:800;font-size:13px;letter-spacing:1px;margin-bottom:15px;opacity:0.8;white-space:nowrap}
.rs-hl{display:flex;align-items:center;gap:6px;cursor:pointer}
.rs-icon{font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center}

/* Pin button style */
.rs-pin{cursor:pointer;border:none;background:transparent;color:${C.fg};font-size:14px;padding:0;line-height:1;opacity:.3;transition: all 0.3s ease; transform: rotate(45deg); outline:none;}
.rs-pin.active{opacity:1; color:#666; transform: rotate(0deg); filter: drop-shadow(0 0 2px rgba(0,0,0,0.2));}

.rs-vr { display: flex; align-items: center; gap: 12px; transition: opacity .3s ease; }
.rs-vb{flex: 1; height:75px;background:rgba(255,255,255,0.2);border-radius:18px;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:flex-end;justify-content:center;padding:10px 8px 8px}
.rs-vu{display:flex;align-items:flex-end;gap:2px;height:100%;width:100%}
.rs-v{flex:1;border-radius:1px;transition:height .1s ease-out,background .3s ease}

.rs-pa { display: flex; flex-direction: column; align-items: center; width: 45px; }
.rs-pb{width:38px;height:55px;background:rgba(0,0,0,0.05);border-radius:12px;position:relative;cursor:pointer;border:none;padding:0;outline:none}
.rs-pk{width:30px;height:24px;background:rgba(255,255,255,0.9);border-radius:9px;position:absolute;left:4px;
  transition:top .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 4px 8px rgba(0,0,0,0.1);
  display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#999}
  
.rs-id{width:7px;height:7px;border-radius:50%;margin-bottom:6px;transition:all .5s ease;background:#999}

.rs-ct{margin-top:10px}
.rs-r{display:grid;grid-template-columns:1.2fr 2fr 1fr;align-items:center;gap:10px;margin-bottom:12px}
.rs-l{font-size:9px;font-weight:900;opacity:0.5}
.rs-vl{background:rgba(255,255,255,0.2);padding:4px;border-radius:6px;text-align:center;font-family:monospace;font-size:10px;font-weight:700}
input[type=range].rs-s{-webkit-appearance:none;width:100%;background:rgba(0,0,0,0.05);height:6px;border-radius:3px;outline:none}
input[type=range].rs-s::-webkit-slider-thumb{-webkit-appearance:none;height:16px;width:16px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.15);cursor:pointer}

.rs-c.mini .rs-vr, .rs-c.mini .rs-ct, .rs-c.mini .rs-h span:not(.rs-icon), .rs-c.mini .rs-pin{opacity:0;pointer-events:none;display:none}
.rs-c.mini .rs-h{margin:0}
`;
    document.head.appendChild(s);
  }

  // ─── UI Build ──────────────────────────────────────────
  let root, $ = {};
  function build() {
    if (document.getElementById("rs-root")) return;
    root = document.createElement("div"); root.id = "rs-root";
    root.innerHTML = `
<div class="rs-c" id="rs-c">
  <div class="rs-h" id="rs-h">
    <div class="rs-hl" id="rs-toggle"><span class="rs-icon" style="letter-spacing:-2px;">⠿</span><span>RETRO PLAYER</span></div>
    <button class="rs-pin" id="rs-pin">📌</button>
  </div>
  <div class="rs-vr">
    <div class="rs-vb"><div class="rs-vu" id="rs-vu"></div></div>
    <div class="rs-pa">
      <div class="rs-id" id="rs-id"></div>
      <button class="rs-pb" id="rs-pb"><div class="rs-pk" id="rs-pk"><span>OFF</span></div></button>
      <div style="font-size:9px;font-weight:900;margin-top:6px;opacity:0.6;text-align:center;">POWER</div>
    </div>
  </div>
  <div class="rs-ct" id="rs-ct">
    <div class="rs-r"><span class="rs-l">SPEED</span><input type="range" class="rs-s" id="rs-speed" min=".25" max="2" step=".05"><span class="rs-vl" id="rs-v-speed"></span></div>
    <div class="rs-r"><span class="rs-l">NOISE</span><input type="range" class="rs-s" id="rs-noise" min="0" max="100" step="5"><span class="rs-vl" id="rs-v-noise"></span></div>
    <div class="rs-r"><span class="rs-l">WOBBLE</span><input type="range" class="rs-s" id="rs-wobble" min="0" max="100" step="5"><span class="rs-vl" id="rs-v-wobble"></span></div>
    <div class="rs-r"><span class="rs-l">SATUR</span><input type="range" class="rs-s" id="rs-satur" min="0" max="100" step="5"><span class="rs-vl" id="rs-v-satur"></span></div>
  </div>
</div>`;
    document.body.appendChild(root);

    Object.assign($, {
      c: root.querySelector("#rs-c"), h: root.querySelector("#rs-h"), pin: root.querySelector("#rs-pin"),
      t: root.querySelector("#rs-toggle"), ct: root.querySelector("#rs-ct"), vu: root.querySelector("#rs-vu"),
      pb: root.querySelector("#rs-pb"), pk: root.querySelector("#rs-pk"), id: root.querySelector("#rs-id"),
      spd: root.querySelector("#rs-speed"), noi: root.querySelector("#rs-noise"), wob: root.querySelector("#rs-wobble"), sat: root.querySelector("#rs-satur"),
      vspd: root.querySelector("#rs-v-speed"), vnoi: root.querySelector("#rs-v-noise"), vwob: root.querySelector("#rs-v-wobble"), vsat: root.querySelector("#rs-v-satur")
    });

    for (let i = 0; i < 18; i++) { const b = document.createElement("div"); b.className = "rs-v"; $.vu.appendChild(b); }

    $.pb.addEventListener("click", () => { S.power = !S.power; syncPower(); ensureAC(); processVid(); save(); });
    
    $.pin.addEventListener("click", (e) => { 
      e.stopPropagation(); 
      S.pinned = !S.pinned; 
      if(S.pinned) S.collapsed = false; 
      syncCollapse(); 
      save(); 
    });

    $.c.addEventListener("mouseenter", () => { 
      if(!S.pinned && S.collapsed) { S.collapsed = false; syncCollapse(); } 
    });
    $.c.addEventListener("mouseleave", () => { 
      if(!S.pinned && !S.collapsed) { S.collapsed = true; syncCollapse(); } 
    });

    // ─── Drag Logic ──────────────────────────────────
    let drag = false, sx, sy, ox, oy, requestId;
    const updatePosition = (me) => {
      if (!drag) return;
      S.x = Math.max(0, Math.min(ox + me.clientX - sx, innerWidth - $.c.offsetWidth));
      S.y = Math.max(0, Math.min(oy + me.clientY - sy, innerHeight - $.c.offsetHeight));
      $.c.style.left = S.x + "px";
      $.c.style.top = S.y + "px";
      requestId = null;
    };

    $.h.addEventListener("mousedown", (e) => {
      if (e.target.closest("#rs-pin")) return;
      drag = true; sx = e.clientX; sy = e.clientY; ox = S.x; oy = S.y;
      $.c.classList.add("rs-dragging");
      const mv = (me) => { if (!requestId) requestId = requestAnimationFrame(() => updatePosition(me)); };
      const up = () => { drag = false; $.c.classList.remove("rs-dragging"); save(); document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); };
      document.addEventListener("mousemove", mv);
      document.addEventListener("mouseup", up);
    });

    const bind = (k, el, vdn, fmt) => {
      const up = () => {
        const p = (el.value - el.min) / (el.max - el.min) * 100;
        el.style.background = `linear-gradient(to right, ${S.power ? C.accent : C.gray} ${p}%, ${C.gray} ${p}%)`;
        vdn.textContent = fmt(el.value);
      };
      el.addEventListener("input", () => { S[k] = parseFloat(el.value); up(); save(); });
      el._up = up;
    };
    bind("speed", $.spd, $.vspd, v => parseFloat(v).toFixed(2) + "x");
    bind("noise", $.noi, $.vnoi, v => Math.round(v) + "%");
    bind("wobble", $.wob, $.vwob, v => Math.round(v) + "%");
    bind("satur", $.sat, $.vsat, v => Math.round(v) + "%");

    load();
  }

  function syncPower() {
    $.pk.style.top = S.power ? "4px" : "26px";
    $.pk.querySelector("span").textContent = S.power ? "ON" : "OFF";
    $.pk.querySelector("span").style.color = S.power ? C.fg : "#999";
    $.id.style.background = S.power ? C.accent : "#999";
    $.id.style.boxShadow = S.power ? `0 0 8px 2px rgba(226,168,113,0.4)` : "none";
    [$.spd, $.noi, $.wob, $.sat].forEach(el => { el.disabled = !S.power; el._up(); });
  }

  function syncCollapse() {
    $.c.classList.toggle("mini", S.collapsed);
    $.pin.classList.toggle("active", S.pinned);
    $.c.style.opacity = S.collapsed ? ".6" : "1";
  }

  function vuLoop() {
    const bars = $.vu.children;
    const isPlaying = Array.from(document.querySelectorAll("video")).some(v => !v.paused && v.readyState >= 2);
    S.vu = S.vu.map(h => (S.power && isPlaying) ? h + (Math.random() * 85 - h) * 0.35 : h * 0.8);
    for (let i = 0; i < 18; i++) {
      if(!bars[i]) continue;
      bars[i].style.height = Math.max(5, S.vu[i]) + "%";
      bars[i].style.background = (S.power && isPlaying) ? (S.vu[i] > 75 ? C.accent : "#D4955B") : "rgba(0,0,0,0.1)";
      bars[i].style.opacity = S.power ? ".8" : ".2";
    }
    requestAnimationFrame(vuLoop);
  }

  function save() { if (typeof chrome !== "undefined" && chrome.storage) chrome.storage.local.set({ rsS: S }); }
  
  function load() {
    const done = () => { 
      $.c.style.left = S.x + "px"; 
      $.c.style.top = S.y + "px"; 
      
      // Sync UI
      $.spd.value = S.speed;
      $.noi.value = S.noise;
      $.wob.value = S.wobble;
      $.sat.value = S.satur;
      [$.spd, $.noi, $.wob, $.sat].forEach(el => el._up());

      if(S.pinned) S.collapsed = false;
      syncPower(); 
      syncCollapse(); 
      vuLoop(); 
    };
    if (typeof chrome !== "undefined" && chrome.storage) chrome.storage.local.get(["rsS"], r => { if(r.rsS) Object.assign(S, r.rsS); done(); });
    else done();
  }

  build();

  const unlockAudio = () => {
    if (S.power) {
      const ctx = ensureAC();
      if (ctx && ctx.state === "running") {
        document.removeEventListener("mousedown", unlockAudio);
        document.removeEventListener("keydown", unlockAudio);
      }
    }
  };
  document.addEventListener("mousedown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);

})();
