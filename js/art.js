/*
 * Pre-Flow Check — original illustrations in the "riso field journal" style:
 * hand-inked outlines over flat riso-colour fills that are printed slightly off-register.
 * Card numbers and titles are HTML (so fonts and languages work); these draw artwork only.
 */
(function (root) {
  'use strict';

  const sk = root.PFC.sketch;
  const P = {
    ink: '#15120F', paper: '#F6F1E7', cream: '#FFF9EE',
    indigo: '#4B2BE8', mustard: '#FDB22B', orange: '#F05A28',
    green: '#3E7A5C', lavender: '#C9B6F2'
  };

  // Riso misregistration: the colour layer sits a few px off the ink layer.
  const OFF = 'translate(2.6 2.2)';
  const fill = (d, color, extra = '') => `<path d="${d}" fill="${color}" transform="${OFF}" ${extra}/>`;
  const ink = (d, w = 2.2, extra = '') =>
    `<path d="${d}" fill="none" stroke="${P.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const shape = (d, color, w = 2.2) => fill(d, color) + ink(d, w);
  const disc = (cx, cy, r, color, seed, w = 2.2) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" transform="${OFF}"/>` + ink(sk.circle(cx, cy, r, seed, 0.05), w);
  const star = (cx, cy, r, color, points = 5) => shape(sk.starPath(cx, cy, r, r * 0.45, points), color, 1.6);
  const spark = (cx, cy, r) => ink(`M${cx - r} ${cy} L${cx + r} ${cy} M${cx} ${cy - r} L${cx} ${cy + r}`, 1.8);
  const dot = (cx, cy, r = 2) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.ink}"/>`;
  // Squashed hand-drawn ellipse (ripples).
  const ellipse = (cx, cy, rx, ry, seed, w, extra = '') =>
    ink(sk.circle(cx, cy, rx, seed, 0.02), w, `${extra} transform="translate(${cx} ${cy}) scale(1 ${ry / rx}) translate(${-cx} ${-cy})"`);

  function polar(cx, cy, r, deg) {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }
  function arc(cx, cy, r, startDeg, sweepDeg) {
    const s = Math.max(0.01, Math.min(359.99, sweepDeg));
    const [x1, y1] = polar(cx, cy, r, startDeg);
    const [x2, y2] = polar(cx, cy, r, startDeg + s);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${s > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }

  const svg = (body, vb = '0 0 200 240') =>
    `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;

  // ---------- archetypes ----------

  // The Calm Fire: a steady flame inside a sun, on a quiet ground line.
  function calmFire() {
    const flame = 'M100 70 C114 92 124 106 117 124 C112 136 88 136 83 124 C76 106 87 92 100 70Z';
    const inner = 'M100 96 C107 108 111 115 108 123 C105 129 95 129 92 123 C89 115 93 108 100 96Z';
    return svg(`
      ${disc(100, 118, 62, P.lavender, 3)}
      ${ink(sk.circle(100, 118, 74, 4, 0.04), 1.4, 'stroke-dasharray="2 7"')}
      ${shape(flame, P.orange)}
      ${fill(inner, P.mustard)}
      ${shape('M88 134 h24 v38 h-24Z', P.cream)}
      ${ink(sk.line(28, 176, 172, 174, 9, 1.4), 2.4)}
      ${ink(sk.line(52, 188, 148, 187, 10, 1), 1.6)}
      ${star(38, 42, 9, P.mustard)}
      ${spark(160, 50, 6)}${spark(170, 150, 4)}
      ${dot(60, 66)}${dot(146, 86, 2.4)}${dot(28, 132)}${dot(124, 30, 1.6)}
    `);
  }

  // The Storm: a cloud with a bolt and gusting wind.
  function storm() {
    const cloud = 'M52 108 C40 108 34 96 42 86 C46 70 64 66 74 74 C80 56 108 52 120 68 C134 60 156 70 154 88 C166 92 166 108 152 110Z';
    const bolt = 'M112 104 L90 146 L106 146 L92 192 L132 132 L114 132 L128 104Z';
    return svg(`
      ${shape(cloud, P.cream)}
      ${shape(bolt, P.orange)}
      ${ink('M30 150 q16 -12 32 0 t32 0', 2.4)}
      ${ink('M128 176 q14 -10 28 0 t28 0', 2.4)}
      ${ink(`M48 122 l-6 14 M64 122 l-6 14 M150 120 l-6 14`, 2.4)}
      ${disc(160, 44, 10, P.indigo, 24, 1.8)}
      ${star(36, 40, 8, P.cream)}
      ${spark(40, 200, 5)}${dot(170, 200)}${dot(24, 100, 1.8)}
    `);
  }

  // The Still Lake: a crescent moon and its broken reflection.
  function stillLake() {
    const moon = 'M112 44 A30 30 0 1 0 128 98 A24 24 0 1 1 112 44Z';
    return svg(`
      ${shape(moon, P.cream)}
      ${disc(160, 40, 8, P.lavender, 31, 1.6)}
      ${ink(sk.line(18, 132, 182, 130, 32, 1.2), 2.4)}
      ${fill('M80 143 h34 v5 h-34Z M88 154 h20 v5 h-20Z M94 165 h10 v5 h-10Z', P.cream)}
      ${ink('M80 146 h34 M88 157 h20 M94 168 h10', 1.4)}
      ${ellipse(100, 198, 22, 6, 33, 1.6)}
      ${ellipse(100, 198, 48, 12, 34, 1.4)}
      ${ellipse(100, 198, 74, 19, 35, 1.2, 'stroke-dasharray="3 6"')}
      ${ink('M30 132 l-4 -26 M36 132 l2 -22 M42 132 l-1 -16', 2)}
      ${star(38, 46, 7, P.mustard)}${spark(60, 84, 4)}${dot(176, 98)}${dot(150, 110, 1.6)}
    `);
  }

  // The Fog: a pale sun behind drifting fog over soft hills.
  function fog() {
    const band = (x, y, w, color) => shape(`M${x} ${y} h${w} a6 6 0 0 1 0 12 h-${w} a6 6 0 0 1 0 -12Z`, color, 1.8);
    return svg(`
      ${disc(108, 92, 34, P.mustard, 41)}
      ${ink(sk.line(16, 166, 70, 140, 42, 1.4) + ' ' + sk.line(70, 140, 120, 158, 43, 1.4) + ' ' + sk.line(120, 158, 184, 132, 44, 1.4), 2.4)}
      ${band(30, 84, 92, P.cream)}
      ${band(70, 116, 104, P.cream)}
      ${band(22, 150, 110, P.cream)}
      ${band(84, 182, 92, P.indigo)}
      ${spark(40, 40, 6)}${dot(166, 50)}${dot(30, 204, 1.8)}${star(170, 214, 6, P.cream)}
    `);
  }

  // ---------- readiness & guidance ----------

  function readiness(index) {
    const v = typeof index === 'number' ? Math.max(0, Math.min(100, index)) : 0;
    let ticks = '';
    for (let i = 0; i <= 10; i++) {
      const deg = 135 + i * 27;
      const [x1, y1] = polar(100, 116, 78, deg);
      const [x2, y2] = polar(100, 116, i % 5 ? 84 : 89, deg);
      ticks += `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} `;
    }
    return svg(`
      <path d="${arc(100, 116, 66, 135, 270)}" fill="none" stroke="${P.lavender}" stroke-width="12" stroke-linecap="round" transform="${OFF}"/>
      <path class="gauge-value" d="${arc(100, 116, 66, 135, 270 * v / 100)}" fill="none" stroke="${P.orange}" stroke-width="12" stroke-linecap="round" transform="${OFF}"/>
      ${ink(arc(100, 116, 72, 135, 270), 1.4)}
      ${ink(arc(100, 116, 60, 135, 270), 1.4)}
      ${ink(ticks, 1.8)}
      ${star(100, 206, 9, P.mustard)}
      ${spark(30, 34, 6)}${spark(172, 34, 6)}${dot(56, 208)}${dot(144, 208)}
    `);
  }

  // A compass needle pointing the way, with stepping stones.
  function guidance() {
    return svg(`
      ${disc(100, 100, 56, P.cream, 61)}
      ${ink(sk.circle(100, 100, 66, 62, 0.03), 1.4, 'stroke-dasharray="2 6"')}
      ${shape('M100 50 L112 100 L100 112 L88 100Z', P.indigo, 2)}
      ${shape('M100 150 L112 100 L100 88 L88 100Z', P.cream, 2)}
      ${disc(100, 100, 6, P.mustard, 63, 1.6)}
      ${ink('M100 32 v8 M100 160 v8 M32 100 h8 M160 100 h8', 2)}
      ${disc(58, 204, 9, P.green, 64, 1.6)}
      ${disc(100, 194, 11, P.cream, 65, 1.6)}
      ${disc(146, 182, 13, P.indigo, 66, 1.6)}
      ${ink('M40 222 q34 -8 64 -22 t60 -34', 1.4, 'stroke-dasharray="3 6"')}
      ${star(32, 40, 8, P.mustard)}${spark(172, 46, 6)}
    `);
  }

  // ---------- card back: an original compass rose ----------

  let backSeq = 0;
  function cardBack() {
    const id = 'cb' + (++backSeq);
    let rays = '';
    for (let i = 0; i < 32; i++) {
      const [x1, y1] = polar(100, 150, 58, i * 11.25);
      const [x2, y2] = polar(100, 150, i % 4 ? 66 : 74, i * 11.25);
      rays += `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} `;
    }
    const roseMain = 'M100 78 L110 140 L172 150 L110 160 L100 222 L90 160 L28 150 L90 140Z';
    const roseDiag = 'M146 104 L104 146 L100 150 L104 154 L146 196 L100 158 L54 196 L96 154 L100 150 L96 146 L54 104 L100 142Z';
    const line = (d, w = 1.4, c = P.mustard) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return svg(`
      <defs><clipPath id="${id}"><rect x="10" y="10" width="180" height="300" rx="6"/></clipPath></defs>
      <rect width="200" height="320" fill="${P.ink}"/>
      <g clip-path="url(#${id})">
        ${line(sk.circle(100, 150, 84, 71, 0.02), 1.2)}
        ${line(sk.circle(100, 150, 96, 72, 0.02), 1, P.lavender)}
        ${line(rays, 1.3)}
        <path d="${roseDiag}" fill="${P.lavender}"/>
        <path d="${roseMain}" fill="${P.mustard}"/>
        ${line(roseMain, 1.2, P.ink)}
        <circle cx="100" cy="150" r="7" fill="${P.ink}" stroke="${P.mustard}" stroke-width="1.6"/>
        ${line(sk.line(18, 286, 182, 284, 73, 1), 1.4, P.lavender)}
      </g>
      <rect x="10" y="10" width="180" height="300" rx="6" fill="none" stroke="${P.mustard}" stroke-width="1.2"/>
      <text x="100" y="62" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="14" fill="${P.mustard}">N</text>
      <path d="${sk.starPath(30, 32, 6, 2.6, 5)}" fill="${P.mustard}"/>
      <circle cx="170" cy="32" r="7" fill="${P.mustard}"/><circle cx="173.5" cy="29" r="6" fill="${P.ink}"/>
    `, '0 0 200 320');
  }

  // ---------- corner stamps ----------

  const stamp = (color, glyph, seed) => svg(`
    <circle cx="50" cy="50" r="42" fill="${color}" transform="translate(3 3)"/>
    ${ink(sk.circle(50, 50, 42, seed, 0.04), 3)}
    ${glyph}`, '0 0 100 100');

  const cornerStar = () => stamp(P.mustard, shape(sk.starPath(50, 50, 22, 9, 8, 0), P.indigo, 2.4), 81);
  const cornerNumber = () => stamp(P.lavender, '', 82);
  const cornerMoon = () => stamp(P.orange, shape('M56 26 A24 24 0 1 0 70 70 A19 19 0 1 1 56 26Z', P.cream, 2.4), 83);
  const cornerCompass = () => stamp(P.green, shape('M50 22 L58 50 L50 78 L42 50Z', P.cream, 2.4) + dot(50, 50, 3.5), 84);

  const ARCHETYPE_ART = { calmFire, storm, stillLake, fog };
  // Card colour + text colour (text is ink or cream for contrast).
  const CARD_THEME = {
    calmFire: { bg: P.indigo, fg: P.cream },
    storm: { bg: P.mustard, fg: P.ink },
    stillLake: { bg: P.green, fg: P.cream },
    fog: { bg: P.lavender, fg: P.ink },
    readiness: { bg: P.cream, fg: P.ink },
    guidance: { bg: P.orange, fg: P.ink }
  };

  const api = {
    P, ARCHETYPE_ART, CARD_THEME, readiness, guidance, cardBack,
    cornerStar, cornerNumber, cornerMoon, cornerCompass, arc
  };
  root.PFC = root.PFC || {};
  root.PFC.art = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
