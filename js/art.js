/*
 * Pre-Flow Check — original illustrations as inline SVG strings.
 *
 * Two families:
 *  - Tarot: flat saturated shapes on night, with class hooks that CSS/JS animate
 *    (.blink lids, .look pupils, .flicker flames, .ripple, .drift, .needle, .twinkle …).
 *  - Journal: ink line drawings on paper (.ink paths draw themselves on; .steam, .pencil …).
 *
 * Card numbers and titles are HTML (so fonts and languages work); these draw artwork only.
 */
(function (root) {
  'use strict';

  const sk = root.PFC.sketch;
  const P = {
    night: '#0D0B12', night2: '#17131F', night3: '#231D2E',
    cream: '#F5F0E6', indigo: '#4B2BE8', mustard: '#FDB22B', orange: '#F05A28',
    green: '#3E7A5C', lavender: '#C9B6F2', gold: '#E6B04A', ink: '#1A1714'
  };

  let uid = 0;
  const nextId = (p) => `${p}${++uid}`;
  const f1 = (n) => Math.round(n * 10) / 10;

  const svg = (body, vb, cls = '') =>
    `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;
  const star8 = (cx, cy, r, fill, cls = '') => `<path class="${cls}" d="${sk.starPath(cx, cy, r, r * 0.42, 8, 0)}" fill="${fill}"/>`;
  const spark = (cx, cy, r, fill, cls = 'twinkle') => `<path class="${cls}" d="${sk.starPath(cx, cy, r, r * 0.22, 4, 0)}" fill="${fill}"/>`;
  const dot = (cx, cy, r, fill, cls = '') => `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

  function polar(cx, cy, r, deg) {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }
  function arc(cx, cy, r, startDeg, sweepDeg) {
    const s = Math.max(0.01, Math.min(359.99, sweepDeg));
    const [x1, y1] = polar(cx, cy, r, startDeg);
    const [x2, y2] = polar(cx, cy, r, startDeg + s);
    return `M${f1(x1)} ${f1(y1)} A${r} ${r} 0 ${s > 180 ? 1 : 0} 1 ${f1(x2)} ${f1(y2)}`;
  }
  function rays(cx, cy, r1, r2, n, offset = 0) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const [x1, y1] = polar(cx, cy, r1, offset + (i * 360) / n);
      const [x2, y2] = polar(cx, cy, i % 2 ? r2 - (r2 - r1) * 0.45 : r2, offset + (i * 360) / n);
      d += `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
    }
    return d;
  }

  /*
   * An eye that can blink, look and open/close.
   * Geometry: almond from (cx-w) to (cx+w) at height cy. `scale` sizes it.
   * Hooks: .eye-lid-top / .eye-lid-bot (translateY), .eye-look (translate), whole group .eye.
   */
  function eye(cx, cy, w, { lid = P.indigo, white = P.cream, iris = P.mustard, ring = P.orange, line = P.night, open = 1 } = {}) {
    const id = nextId('eye');
    const h = w * 0.88;                       // almond control height
    const top = `M${cx - w} ${cy} Q${cx} ${cy - h} ${cx + w} ${cy}`;
    const almond = `${top} Q${cx} ${cy + h} ${cx - w} ${cy}Z`;
    const r = w * 0.38;
    const lidTravel = h * 0.8;
    // Top lid: a block whose lower edge sags below the centre line when closed.
    const lidTop = `M${cx - w - 6} ${cy - h - 10} H${cx + w + 6} V${cy} Q${cx} ${cy + h * 0.45} ${cx - w - 6} ${cy}Z`;
    const lidBot = `M${cx - w - 6} ${cy + h + 10} H${cx + w + 6} V${cy + 4} Q${cx} ${cy + h * 0.6} ${cx - w - 6} ${cy + 4}Z`;
    const lash = `M${cx - w} ${cy} Q${cx} ${cy + h * 0.45} ${cx + w} ${cy}`;
    return `<g class="eye" data-eye="${id}" data-w="${w}" style="--lid:${f1(lidTravel)}px;--open:${open}">
      <defs><clipPath id="${id}"><path d="${almond}"/></clipPath></defs>
      <path d="${almond}" fill="${white}"/>
      <g clip-path="url(#${id})">
        <g class="eye-look">
          <circle cx="${cx}" cy="${cy}" r="${f1(r)}" fill="${iris}"/>
          <circle cx="${cx}" cy="${cy}" r="${f1(r * 0.68)}" fill="none" stroke="${ring}" stroke-width="${f1(r * 0.16)}"/>
          <circle cx="${cx}" cy="${cy}" r="${f1(r * 0.4)}" fill="${line}"/>
          <path d="${sk.starPath(cx, cy, r * 0.26, r * 0.08, 4, 0)}" fill="${iris}"/>
          <circle cx="${f1(cx - r * 0.35)}" cy="${f1(cy - r * 0.38)}" r="${f1(r * 0.14)}" fill="${white}"/>
        </g>
        <g class="eye-lid-top"><path d="${lidTop}" fill="${lid}"/><path d="${lash}" fill="none" stroke="${line}" stroke-width="${f1(w * 0.05)}" stroke-linecap="round"/></g>
        <g class="eye-lid-bot"><path d="${lidBot}" fill="${lid}"/></g>
      </g>
      <path d="${almond}" fill="none" stroke="${line}" stroke-width="${f1(w * 0.045)}" stroke-linejoin="round"/>
    </g>`;
  }

  // ---------------- hero / guide visuals (tarot) ----------------

  // The oracle: an eye at the centre of a slowly turning compass of orbits.
  function oracle() {
    const c = 120;
    return svg(`
      <g class="orbit orbit-a">
        <circle cx="${c}" cy="${c}" r="106" fill="none" stroke="${P.lavender}" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="1 7" stroke-linecap="round"/>
        ${dot(c, 14, 5, P.mustard)}${dot(c + 75, c + 75, 3.5, P.orange)}${dot(c - 104, c + 20, 2.5, P.lavender)}
      </g>
      <g class="orbit orbit-b">
        <circle cx="${c}" cy="${c}" r="88" fill="none" stroke="${P.cream}" stroke-opacity=".14" stroke-width="1"/>
        <path d="${rays(c, c, 80, 96, 32)}" stroke="${P.cream}" stroke-opacity=".22" stroke-width="1.4" stroke-linecap="round"/>
        ${star8(c + 88, c, 6, P.cream)}
      </g>
      <circle class="halo" cx="${c}" cy="${c}" r="66" fill="${P.indigo}"/>
      <path class="sunrays" d="${rays(c, c, 66, 78, 16, 11.25)}" stroke="${P.mustard}" stroke-width="3" stroke-linecap="round"/>
      ${eye(c, c, 52)}
      ${spark(30, 40, 7, P.cream)}${spark(206, 52, 5, P.mustard, 'twinkle t2')}${spark(214, 200, 6, P.lavender, 'twinkle t3')}${spark(36, 196, 4, P.cream, 'twinkle t4')}
    `, '0 0 240 240', 'art art-oracle');
  }

  // Energy: a flame whose size, glow and sparks follow the rating (set by JS via --e, 1–10).
  function flame() {
    let sparks = '';
    for (let i = 0; i < 10; i++) {
      const x = 96 + ((i * 37) % 50);
      sparks += `<circle class="ember" style="--i:${i}" cx="${x}" cy="168" r="${2 + (i % 3)}" fill="${i % 2 ? P.mustard : P.orange}"/>`;
    }
    return svg(`
      <circle class="flame-glow" cx="120" cy="138" r="92" fill="${P.mustard}"/>
      <path class="flame-rays" d="${rays(120, 138, 78, 100, 24)}" stroke="${P.mustard}" stroke-width="3" stroke-linecap="round"/>
      <g class="embers">${sparks}</g>
      <g class="flame-body">
        <g class="flicker">
          <path d="M120 40 C146 82 168 108 156 146 C148 172 92 172 84 146 C72 108 94 82 120 40Z" fill="${P.orange}"/>
          <path d="M120 82 C136 106 146 124 139 146 C134 162 106 162 101 146 C94 124 104 106 120 82Z" fill="${P.mustard}"/>
          <path d="M120 116 C128 128 132 138 128 148 C125 156 115 156 112 148 C108 138 112 128 120 116Z" fill="${P.cream}"/>
        </g>
      </g>
      <rect x="96" y="168" width="48" height="10" rx="5" fill="${P.lavender}"/>
      <rect x="80" y="182" width="80" height="10" rx="5" fill="${P.indigo}"/>
    `, '0 0 240 240', 'art art-flame');
  }

  // Tension: a ring that is smooth when calm and trembles when tense (path set by JS).
  function tensionRing() {
    return svg(`
      <circle class="calm-core" cx="120" cy="120" r="34" fill="${P.indigo}"/>
      <circle cx="120" cy="120" r="10" fill="${P.cream}"/>
      <path class="tension-path tp-2" d="" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/>
      <path class="tension-path tp-1" d="" fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    `, '0 0 240 240', 'art art-tension');
  }

  // Ring path with noise: amp in px, freq = number of bumps, phase animates the tremble.
  function ringPath(cx, cy, r, amp, freq, phase) {
    let d = '';
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const wob = Math.sin(a * freq + phase) * amp + Math.sin(a * (freq * 2.3) - phase * 1.7) * amp * 0.45;
      const rr = r + wob;
      d += (i ? 'L' : 'M') + f1(cx + Math.cos(a) * rr) + ' ' + f1(cy + Math.sin(a) * rr);
    }
    return d + 'Z';
  }

  // Context step: a moon over a quiet bed of hills.
  function nightSky() {
    return svg(`
      <circle class="halo" cx="120" cy="104" r="70" fill="${P.indigo}"/>
      <g class="float">
        <path d="M128 52 A46 46 0 1 0 160 132 A36 36 0 1 1 128 52Z" fill="${P.cream}"/>
        <circle cx="112" cy="96" r="5" fill="${P.lavender}"/><circle cx="104" cy="120" r="3" fill="${P.lavender}"/>
      </g>
      <text class="zzz z1" x="168" y="76" fill="${P.lavender}" font-family="Fredoka, sans-serif" font-weight="600" font-size="20">z</text>
      <text class="zzz z2" x="182" y="58" fill="${P.lavender}" font-family="Fredoka, sans-serif" font-weight="600" font-size="15">z</text>
      <path d="M10 196 Q70 160 120 182 T230 176 V240 H10Z" fill="${P.night3}"/>
      ${spark(44, 52, 6, P.mustard)}${spark(200, 120, 4, P.cream, 'twinkle t2')}${spark(60, 140, 3.5, P.cream, 'twinkle t3')}
    `, '0 0 240 240', 'art art-night');
  }

  // PVT demo: the dot appears, a finger taps, the counter freezes. Pure CSS loop.
  function pvtDemo() {
    return svg(`
      <circle cx="120" cy="120" r="100" fill="${P.night3}"/>
      <g class="demo-dot"><circle cx="120" cy="116" r="54" fill="${P.mustard}"/>
        <text x="120" y="128" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="32" fill="${P.night}">287</text></g>
      <g class="demo-finger">
        <path d="M150 238 L150 176 Q150 164 160 164 Q170 164 170 176 L170 206 Q178 198 186 204 Q192 210 188 222 L176 252Z" fill="${P.cream}" stroke="${P.night}" stroke-width="3" stroke-linejoin="round"/>
      </g>
      <circle class="demo-ripple" cx="158" cy="168" r="10" fill="none" stroke="${P.cream}" stroke-width="3"/>
    `, '0 0 240 240', 'art art-pvt');
  }

  // Onboarding slide 2: moon, flame and wave orbit the reaction dot.
  function orbitTrio() {
    const moon = `<path d="M-2 -16 A16 16 0 1 0 12 10 A12 12 0 1 1 -2 -16Z" fill="${P.cream}"/>`;
    const fire = `<path d="M0 -18 C8 -6 13 2 9 10 C6 16 -6 16 -9 10 C-13 2 -8 -6 0 -18Z" fill="${P.orange}"/><path d="M0 -4 C4 2 6 6 4 10 C2 13 -2 13 -4 10 C-6 6 -4 2 0 -4Z" fill="${P.mustard}"/>`;
    const wave = `<path d="M-16 0 Q-8 -10 0 0 T16 0" fill="none" stroke="${P.lavender}" stroke-width="5" stroke-linecap="round"/>`;
    const item = (deg, inner) => `<g transform="rotate(${deg} 120 120) translate(120 34) rotate(${-deg})"><g class="counter-spin"><circle r="26" fill="${P.night3}"/>${inner}</g></g>`;
    return svg(`
      <circle cx="120" cy="120" r="86" fill="none" stroke="${P.cream}" stroke-opacity=".16" stroke-dasharray="2 8" stroke-linecap="round"/>
      <g class="orbit-spin">${item(0, moon)}${item(120, fire)}${item(240, wave)}</g>
      <circle class="pulse-dot" cx="120" cy="120" r="34" fill="${P.mustard}"/>
      <circle class="pulse-ring" cx="120" cy="120" r="34" fill="none" stroke="${P.mustard}" stroke-width="3"/>
    `, '0 0 240 240', 'art art-trio');
  }

  // ---------------- tarot card art ----------------

  function calmFire() {
    return svg(`
      <circle class="pulse" cx="100" cy="112" r="64" fill="${P.lavender}" opacity=".22"/>
      <circle cx="100" cy="112" r="50" fill="${P.night}"/>
      <path class="spin-slow" style="transform-origin:100px 112px" d="${rays(100, 112, 54, 70, 24)}" stroke="${P.mustard}" stroke-width="2" stroke-linecap="round"/>
      <g class="flicker" style="transform-origin:100px 132px">
        <path d="M100 58 C114 82 124 98 117 117 C112 130 88 130 83 117 C76 98 87 82 100 58Z" fill="${P.orange}"/>
        <path d="M100 84 C108 98 112 106 108 116 C105 123 95 123 92 116 C88 106 92 98 100 84Z" fill="${P.mustard}"/>
        <ellipse cx="100" cy="113" rx="4" ry="6.5" fill="${P.cream}"/>
      </g>
      <rect x="91" y="128" width="18" height="34" rx="2" fill="${P.cream}"/>
      <ellipse cx="100" cy="166" rx="42" ry="7" fill="${P.lavender}"/>
      <ellipse cx="100" cy="180" rx="58" ry="9" fill="${P.green}"/>
      <ellipse cx="100" cy="194" rx="70" ry="8" fill="${P.mustard}"/>
      ${star8(36, 40, 10, P.mustard, 'twinkle')}${spark(164, 48, 8, P.cream, 'twinkle t2')}${spark(166, 150, 5, P.lavender, 'twinkle t3')}
      ${dot(56, 70, 2, P.cream, 'twinkle t4')}${dot(150, 86, 2.4, P.lavender)}${dot(30, 140, 2, P.cream)}
    `, '0 0 200 240', 'art card-art');
  }

  function storm() {
    let arcs = '';
    [18, 30, 42, 54].forEach((r, i) => {
      arcs += `<path d="${arc(100, 118, r, 200 + i * 55, 240)}" fill="none" stroke="${P.cream}" stroke-width="${i % 2 ? 2 : 3}" stroke-linecap="round"/>`;
    });
    return svg(`
      <circle cx="100" cy="118" r="66" fill="${P.indigo}"/>
      <g class="spin-slow" style="transform-origin:100px 118px">${arcs}</g>
      <g class="drift">
        <path d="M44 100 C34 100 30 90 36 82 C40 70 54 66 62 72 C68 58 90 56 98 68 C108 62 124 70 122 84 C132 86 132 100 120 102Z" fill="${P.cream}"/>
      </g>
      <path class="flash" d="M112 70 L86 124 L102 124 L86 196 L130 108 L110 108 L126 70Z" fill="${P.orange}" stroke="${P.night}" stroke-width="2.5" stroke-linejoin="round"/>
      <g class="rain" stroke="${P.lavender}" stroke-width="2.5" stroke-linecap="round"><path d="M46 112 l-4 10 M62 112 l-4 10 M80 112 l-4 10"/></g>
      ${eye(158, 52, 16, { lid: P.mustard, white: P.cream, iris: P.lavender, ring: P.indigo })}
      ${star8(34, 44, 8, P.night, 'twinkle')}${spark(170, 156, 8, P.orange, 'twinkle t2')}${dot(176, 204, 2, P.night)}${dot(24, 168, 2, P.night)}
    `, '0 0 200 240', 'art card-art');
  }

  function stillLake() {
    return svg(`
      <g class="float">
        <path d="M112 42 A30 30 0 1 0 128 96 A24 24 0 1 1 112 42Z" fill="${P.cream}"/>
      </g>
      ${dot(160, 40, 7, P.lavender)}
      <line x1="18" y1="132" x2="182" y2="132" stroke="${P.cream}" stroke-width="2.5" stroke-linecap="round"/>
      <g class="shimmer"><path d="M80 144 h34 M88 155 h20 M94 166 h10" stroke="${P.cream}" stroke-width="3.2" stroke-linecap="round"/></g>
      <g fill="none" stroke="${P.lavender}" stroke-width="2">
        <ellipse class="ripple" cx="100" cy="196" rx="24" ry="6"/>
        <ellipse class="ripple r2" cx="100" cy="196" rx="24" ry="6"/>
        <ellipse class="ripple r3" cx="100" cy="196" rx="24" ry="6"/>
      </g>
      <path class="sway" d="M30 132 l-4 -26 M36 132 l2 -22 M42 132 l-1 -16" stroke="${P.night}" stroke-width="2.4" stroke-linecap="round"/>
      ${star8(38, 46, 7, P.mustard, 'twinkle')}${spark(60, 86, 4, P.cream, 'twinkle t2')}${dot(176, 98, 2, P.cream)}
    `, '0 0 200 240', 'art card-art');
  }

  function fog() {
    const band = (x, y, w, color, cls) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="12" rx="6" fill="${color}"/>`;
    return svg(`
      <circle class="pulse" cx="104" cy="96" r="40" fill="${P.mustard}" opacity=".85"/>
      ${eye(104, 118, 46, { lid: P.lavender, white: P.cream, iris: P.indigo, ring: P.lavender, open: 0.45 })}
      ${band(16, 78, 96, P.cream, 'drift-a')}
      ${band(66, 150, 110, P.cream, 'drift-b')}
      ${band(20, 170, 104, P.cream, 'drift-a')}
      ${band(80, 194, 92, P.indigo, 'drift-b')}
      ${spark(40, 40, 6, P.night, 'twinkle')}${dot(166, 50, 2, P.night)}${dot(28, 206, 2, P.night)}${star8(170, 218, 6, P.indigo, 'twinkle t2')}
    `, '0 0 200 240', 'art card-art');
  }

  function readiness(index) {
    const v = typeof index === 'number' ? Math.max(0, Math.min(100, index)) : 0;
    let ticks = '';
    for (let i = 0; i <= 10; i++) {
      const deg = 135 + i * 27;
      const [x1, y1] = polar(100, 116, 76, deg);
      const [x2, y2] = polar(100, 116, i % 5 ? 82 : 87, deg);
      ticks += `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
    }
    return svg(`
      <path d="${arc(100, 116, 64, 135, 270)}" fill="none" stroke="${P.lavender}" stroke-width="12" stroke-linecap="round"/>
      <path class="gauge-value" pathLength="100" style="--v:${v}" d="${arc(100, 116, 64, 135, 270)}" fill="none" stroke="${P.orange}" stroke-width="12" stroke-linecap="round"/>
      <path d="${ticks}" stroke="${P.night}" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="100" cy="116" r="44" fill="${P.lavender}" opacity=".35"/>
      ${star8(100, 206, 9, P.mustard, 'twinkle')}${spark(30, 34, 7, P.indigo, 'twinkle t2')}${spark(172, 34, 7, P.indigo, 'twinkle t3')}
      ${dot(56, 208, 2, P.night)}${dot(144, 208, 2, P.night)}
    `, '0 0 200 240', 'art card-art');
  }

  function guidance() {
    return svg(`
      <path class="spin-slow" style="transform-origin:100px 104px" d="${rays(100, 104, 54, 72, 16)}" stroke="${P.night}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="100" cy="104" r="48" fill="${P.cream}"/>
      <g class="needle" style="transform-origin:100px 104px">
        <path d="M100 62 L110 104 L100 114 L90 104Z" fill="${P.indigo}"/>
        <path d="M100 146 L110 104 L100 94 L90 104Z" fill="${P.night}"/>
      </g>
      <circle cx="100" cy="104" r="6" fill="${P.mustard}"/>
      <circle class="pop" style="--i:0" cx="58" cy="206" r="9" fill="${P.green}"/>
      <circle class="pop" style="--i:1" cx="100" cy="194" r="11" fill="${P.cream}"/>
      <circle class="pop" style="--i:2" cx="146" cy="180" r="13" fill="${P.indigo}"/>
      <path d="M40 222 q34 -8 64 -22 t60 -34" fill="none" stroke="${P.night}" stroke-width="1.5" stroke-dasharray="3 6" stroke-linecap="round"/>
      ${spark(32, 40, 8, P.cream, 'twinkle')}${star8(168, 46, 7, P.mustard, 'twinkle t2')}
    `, '0 0 200 240', 'art card-art');
  }

  // Card back: a compass rose with a watching eye at its heart.
  function cardBack() {
    const cid = nextId('cb');
    return svg(`
      <defs><clipPath id="${cid}"><rect x="10" y="10" width="180" height="300" rx="8"/></clipPath></defs>
      <rect width="200" height="320" fill="${P.night}"/>
      <g clip-path="url(#${cid})">
        <circle cx="100" cy="160" r="96" fill="none" stroke="${P.gold}" stroke-opacity=".5" stroke-width="1"/>
        <circle cx="100" cy="160" r="84" fill="none" stroke="${P.gold}" stroke-width="1.2" stroke-dasharray="1 5" stroke-linecap="round"/>
        <g class="spin-slow" style="transform-origin:100px 160px">
          <path d="${rays(100, 160, 60, 76, 32)}" stroke="${P.gold}" stroke-width="1.3" stroke-linecap="round"/>
        </g>
        <path d="M100 74 L112 148 L186 160 L112 172 L100 246 L88 172 L14 160 L88 148Z" fill="none" stroke="${P.gold}" stroke-width="1.3" stroke-linejoin="round"/>
        ${eye(100, 160, 34, { lid: P.night, white: P.gold, iris: P.night, ring: P.gold, line: P.gold })}
      </g>
      <rect x="10" y="10" width="180" height="300" rx="8" fill="none" stroke="${P.gold}" stroke-width="1.2"/>
      <text x="100" y="60" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="14" fill="${P.gold}">N</text>
      <path d="${sk.starPath(30, 32, 6, 2.6, 5)}" fill="${P.gold}"/>
      <circle cx="170" cy="32" r="7" fill="${P.gold}"/><circle cx="173.5" cy="29" r="6" fill="${P.night}"/>
      <circle cx="30" cy="288" r="6" fill="none" stroke="${P.gold}" stroke-width="1.4"/><circle cx="30" cy="288" r="2" fill="${P.gold}"/>
      ${spark(170, 288, 7, P.gold, '')}
    `, '0 0 200 320', 'art card-back-art');
  }

  // ---------------- corner stamps ----------------

  const stamp = (color, glyph) => svg(`<circle cx="50" cy="50" r="48" fill="${color}"/>${glyph}`, '0 0 100 100');
  const cornerStar = () => stamp(P.mustard, star8(50, 50, 24, P.indigo));
  const cornerNumber = () => stamp(P.indigo, '');
  const cornerMoon = () => stamp(P.orange, `<circle cx="50" cy="50" r="26" fill="${P.lavender}"/><circle cx="62" cy="44" r="22" fill="${P.orange}"/>`);
  const cornerEye = () => stamp(P.green, eye(50, 52, 26, { lid: P.green, white: P.lavender, iris: P.green, ring: P.lavender, line: P.green }));

  // ---------------- journal (ink on paper) ----------------

  // One ink stroke that draws itself on (pathLength=1 lets CSS animate the dash).
  const inkPath = (d, i, w = 2.2, extra = '') =>
    `<path class="ink" pathLength="1" style="--i:${i}" d="${d}" fill="none" stroke="${P.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

  /*
   * Focus scene: someone writing at a desk by a window at night; lamp, steaming cup,
   * a plant, and the idea jar (slips are added by JS into .jar-slips).
   */
  function deskScene() {
    let i = 0;
    const L = (x1, y1, x2, y2, seed, w) => inkPath(sk.line(x1, y1, x2, y2, seed, 0.7), i++, w);
    return svg(`
      <g class="lamp-glow"><path d="M296 128 L246 192 L352 192 L326 128Z" fill="${P.mustard}" opacity=".28"/></g>
      <g class="window-sky"><rect x="214" y="26" width="118" height="100" rx="2" fill="${P.indigo}" opacity=".9"/>
        <path d="M296 44 A16 16 0 1 0 312 70 A12 12 0 1 1 296 44Z" fill="${P.cream}"/>
        <path class="twinkle" d="${sk.starPath(236, 46, 4, 1.2, 4, 0)}" fill="${P.cream}"/>
        <path class="twinkle t3" d="${sk.starPath(256, 92, 3, 1, 4, 0)}" fill="${P.mustard}"/></g>
      ${inkPath('M214 26 H332 V126 H214Z M273 26 V126 M214 76 H332', i++, 2.4)}
      ${inkPath('M206 132 H340', i++, 2.6)}
      ${L(14, 192, 350, 192, 3, 2.8)}
      ${L(14, 201, 350, 201, 4, 2)}
      ${L(34, 201, 30, 258, 5, 2.4)}
      ${L(330, 201, 334, 258, 6, 2.4)}
      <g class="lamp">
        ${inkPath('M302 190 Q300 184 312 184 Q324 184 322 190', i++, 2.4)}
        ${inkPath('M312 184 L296 150 L318 120', i++, 2.4)}
        <path d="M300 112 L330 108 L340 128 L296 134Z" fill="${P.mustard}"/>
        ${inkPath('M300 112 L330 108 L340 128 L296 134Z', i++, 2.4)}
      </g>
      <g class="cup">
        <path d="M238 160 H262 V182 Q262 190 254 190 H246 Q238 190 238 182Z" fill="${P.cream}"/>
        ${inkPath('M238 160 H262 V182 Q262 190 254 190 H246 Q238 190 238 182Z M262 166 Q272 166 272 174 Q272 182 262 180', i++, 2.2)}
        <path class="steam s1" d="M246 152 q-6 -8 0 -16 t0 -16" fill="none" stroke="${P.ink}" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>
        <path class="steam s2" d="M254 154 q6 -8 0 -16 t0 -16" fill="none" stroke="${P.ink}" stroke-width="1.8" stroke-linecap="round" opacity=".45"/>
      </g>
      <g class="book">
        <path d="M142 186 L178 178 L214 186 L214 190 L142 190Z" fill="${P.cream}"/>
        ${inkPath('M142 188 L178 180 L214 188 M178 180 V190 M150 186 L172 181 M186 181 L206 186', i++, 2)}
      </g>
      <g class="person">
        <g class="breath">
          <path d="M106 120 Q92 150 94 188 L140 188 Q138 150 128 122 Q118 112 106 120Z" fill="${P.lavender}" opacity=".85"/>
          ${inkPath('M106 120 Q92 150 94 188 M128 122 Q138 150 140 188', i++, 2.4)}
          ${inkPath('M112 110 Q116 114 122 114', i++, 2.2)}
          <circle cx="116" cy="94" r="17" fill="${P.cream}"/>
          ${inkPath(sk.circle(116, 94, 17, 9, 0.04), i++, 2.4)}
          <path d="M102 86 Q108 72 124 76 Q134 80 132 92 Q122 84 108 92Z" fill="${P.ink}"/>
          <circle cx="104" cy="78" r="7" fill="${P.ink}"/>
          ${inkPath('M128 124 Q150 140 164 168', i++, 2.4)}
          <g class="pencil-hand">
            ${inkPath('M164 168 Q172 176 182 178', i++, 2.4)}
            <path class="pencil" d="M180 178 L190 160" stroke="${P.orange}" stroke-width="3" stroke-linecap="round"/>
          </g>
        </g>
      </g>
      <g class="chair">
        ${inkPath('M76 112 Q80 150 84 192 M84 192 H126 M88 192 L84 258 M122 192 L126 258', i++, 2.4)}
      </g>
      <g class="plant">
        <path d="M228 132 H248 L245 118 H231Z" fill="${P.orange}"/>
        <g class="sway" style="transform-origin:238px 118px">${inkPath('M238 118 Q232 100 222 96 M238 118 Q242 98 254 92 M238 118 Q238 104 238 90', i++, 2)}</g>
      </g>
      <g class="jar" data-jar>
        <path d="M44 150 H76 V184 Q76 190 70 190 H50 Q44 190 44 184Z" fill="${P.cream}" opacity=".7"/>
        <g class="jar-slips"></g>
        ${inkPath('M44 150 V184 Q44 190 50 190 H70 Q76 190 76 184 V150 M40 150 H80 M42 144 H78 V150', i++, 2.2)}
      </g>
    `, '0 0 360 260', 'art art-desk');
  }

  // A slip of paper for the jar, at slot n (stacks up from the bottom).
  function jarSlip(n) {
    const colors = [P.mustard, P.lavender, P.orange, P.green, P.indigo];
    const row = Math.floor(n / 3);
    const col = n % 3;
    const x = 47 + col * 9 + (row % 2) * 4;
    const y = 180 - row * 6;
    if (y < 152) return '';
    const rot = ((n * 37) % 30) - 15;
    return `<g class="slip"><rect x="${x}" y="${y}" width="10" height="6" rx="1" fill="${colors[n % colors.length]}" transform="rotate(${rot} ${x + 5} ${y + 3})"/></g>`;
  }

  // Flow wave: choppy scribble at 1, a smooth swell at 10 (journal log header).
  function flowWave(rating, width = 320, height = 90) {
    const r = Math.max(1, Math.min(10, rating || 5));
    const rnd = sk.rng(7);
    const chop = (10 - r) / 9;
    const pts = [];
    for (let x = 0; x <= width; x += 6) {
      const base = height / 2 + Math.sin(x * 0.035) * (10 + r * 1.2);
      pts.push({ x, y: base + (rnd() - 0.5) * chop * 34 });
    }
    return sk.smoothPath(pts);
  }

  const ARCHETYPE_ART = { calmFire, storm, stillLake, fog };
  const CARD_THEME = {
    calmFire: { bg: P.indigo, fg: P.cream },
    storm: { bg: P.mustard, fg: P.night },
    stillLake: { bg: P.green, fg: P.cream },
    fog: { bg: P.lavender, fg: P.night },
    readiness: { bg: P.cream, fg: P.night },
    guidance: { bg: P.orange, fg: P.night }
  };

  const api = {
    P, eye, oracle, flame, tensionRing, ringPath, nightSky, pvtDemo, orbitTrio,
    ARCHETYPE_ART, CARD_THEME, readiness, guidance, cardBack,
    cornerStar, cornerNumber, cornerMoon, cornerEye,
    deskScene, jarSlip, flowWave, arc
  };
  root.PFC = root.PFC || {};
  root.PFC.art = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
