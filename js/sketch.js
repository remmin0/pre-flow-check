/*
 * Pre-Flow Check — hand-drawn SVG primitives.
 * A small seeded jitter engine: the same seed always draws the same wobble, so lines
 * don't re-wiggle on every render. Returns SVG path data / markup strings.
 */
(function (root) {
  'use strict';

  // mulberry32 — tiny deterministic PRNG.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const f = (n) => Math.round(n * 10) / 10;

  // Dense samples of a Catmull-Rom spline through `pts` (passes through every point).
  function catmull(pts, step = 6) {
    if (pts.length < 2) return pts.slice();
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const t2 = t * t;
        const t3 = t2 * t;
        const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // Smooth path through points using quadratic curves between midpoints.
  function smoothPath(pts) {
    if (!pts.length) return '';
    let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q${f(pts[i].x)} ${f(pts[i].y)} ${f(mx)} ${f(my)}`;
    }
    const last = pts[pts.length - 1];
    d += ` L${f(last.x)} ${f(last.y)}`;
    return d;
  }

  // A slightly wobbly straight line with a touch of overshoot, like a pen stroke.
  function line(x1, y1, x2, y2, seed = 1, amp = 1.2) {
    const r = rng(seed);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    const segs = Math.max(2, Math.round(len / 40));
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const off = (i === 0 || i === segs) ? (r() - 0.5) * amp * 0.6 : (r() - 0.5) * 2 * amp;
      pts.push({ x: x1 + (x2 - x1) * t + nx * off, y: y1 + (y2 - y1) * t + ny * off });
    }
    return smoothPath(catmull(pts, 8));
  }

  // Box made of four separate strokes that slightly overshoot the corners.
  function box(x, y, w, h, seed = 1, amp = 1.2) {
    const r = rng(seed);
    const o = () => (r() - 0.3) * 3;
    return [
      line(x - o(), y + (r() - 0.5), x + w + o(), y + (r() - 0.5), seed + 1, amp),
      line(x + w + (r() - 0.5), y - o(), x + w + (r() - 0.5), y + h + o(), seed + 2, amp),
      line(x + w + o(), y + h + (r() - 0.5), x - o(), y + h + (r() - 0.5), seed + 3, amp),
      line(x + (r() - 0.5), y + h + o(), x + (r() - 0.5), y - o(), seed + 4, amp)
    ].join(' ');
  }

  // Hand-drawn circle: a little more than one turn, radius wobbling.
  function circle(cx, cy, rad, seed = 1, amp = 0.06) {
    const r = rng(seed);
    const start = r() * Math.PI * 2;
    const turns = 1.08 + r() * 0.06;
    const n = Math.max(10, Math.round(rad * 0.8));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = start + (i / n) * Math.PI * 2 * turns;
      const rr = rad * (1 + (r() - 0.5) * amp);
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
    return smoothPath(catmull(pts, 3));
  }

  /*
   * The horizon. `values` (0–100, oldest first) become the hills; with no values a gentle
   * default landscape is drawn. Returns { d, samples, points, yAt(x) }.
   * opts: { width, height, top, bottom, padX, seed, spacing }
   */
  function horizon(values, opts) {
    const { width, top, bottom } = opts;
    const seed = opts.seed || 7;
    const r = rng(seed);
    const padX = opts.padX !== undefined ? opts.padX : 40;
    const anchors = [];
    const points = [];
    const yFor = (v) => bottom - (Math.max(0, Math.min(100, v)) / 100) * (bottom - top);

    if (values && values.length) {
      const n = values.length;
      const usable = width - padX * 2;
      const step = n > 1 ? usable / (n - 1) : 0;
      const x0 = n > 1 ? padX : width * (opts.single || 0.5);
      for (let i = 0; i < n; i++) {
        const p = { x: x0 + step * i, y: yFor(values[i]), value: values[i], i };
        points.push(p);
      }
      // Lead-in and lead-out so the line spans the full width.
      anchors.push({ x: -10, y: points[0].y + (r() - 0.3) * 18 });
      if (points[0].x > 60) anchors.push({ x: points[0].x * 0.5, y: points[0].y + (r() - 0.5) * 22 });
      for (let i = 0; i < n; i++) {
        anchors.push(points[i]);
        if (i < n - 1 && step > 50) {
          // A gentle in-between bump keeps the terrain organic.
          const mid = (points[i].y + points[i + 1].y) / 2;
          anchors.push({ x: points[i].x + step / 2, y: mid + (r() - 0.5) * Math.min(14, step * 0.15) });
        }
      }
      const last = points[n - 1];
      if (width - last.x > 60) anchors.push({ x: last.x + (width - last.x) * 0.5, y: last.y + (r() - 0.5) * 22 });
      anchors.push({ x: width + 10, y: last.y + (r() - 0.5) * 18 });
    } else {
      const segs = Math.max(3, Math.round(width / 140));
      const mid = (top + bottom) / 2;
      for (let i = 0; i <= segs; i++) {
        anchors.push({ x: -10 + (width + 20) * (i / segs), y: mid + (r() - 0.5) * (bottom - top) * 0.55 });
      }
    }

    const dense = catmull(anchors, 5);
    // Tiny pen tremor; leave the data points themselves exact.
    const samples = dense.map((p) => ({ x: p.x, y: p.y + (r() - 0.5) * 0.7 }));
    const yAt = (x) => {
      if (x <= samples[0].x) return samples[0].y;
      for (let i = 1; i < samples.length; i++) {
        if (samples[i].x >= x) {
          const a = samples[i - 1];
          const b = samples[i];
          const t = (x - a.x) / ((b.x - a.x) || 1);
          return a.y + (b.y - a.y) * t;
        }
      }
      return samples[samples.length - 1].y;
    };
    return { d: smoothPath(samples), samples, points, yAt };
  }

  /*
   * Original stick figure, feet at (0,0), facing right, ~58 px tall at scale 1.
   * Legs and arms have classes so CSS can animate a walk cycle.
   */
  function figure(seed = 3) {
    const s = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
    return `
      <g class="fig-body" ${s}>
        <path d="${circle(1, -50, 6.5, seed, 0.08)}"/>
        <path d="M5.5 -51.5 l2.2 0.6"/>
        <path d="${line(0.5, -43, 0, -21, seed + 1, 0.6)}"/>
        <path d="M0 -40 q 6 -1 9 -5 l 3 -3" class="fig-scarf" stroke-width="2"/>
        <g class="fig-arm fig-arm-l"><path d="M0.4 -39 L -4 -29 L -3 -24"/></g>
        <g class="fig-arm fig-arm-r"><path d="M0.4 -39 L 4.5 -29.5 L 5 -24.5"/></g>
        <g class="fig-leg fig-leg-l"><path d="M0 -21 L -3 -10 L -4 0 L -1 0"/></g>
        <g class="fig-leg fig-leg-r"><path d="M0 -21 L 3 -10 L 3.5 0 L 6.5 0"/></g>
      </g>`;
  }

  // Square ">" (or "<") story button graphic in a 48×48 box.
  function arrowButton(dir = 'next', seed = 11) {
    const chevron = dir === 'next' ? 'M19 15 L29 24 L19 33' : 'M29 15 L19 24 L29 33';
    return `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      <path d="${box(4, 4, 40, 40, seed, 0.9)}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <path d="${chevron}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  // A stretchy hand-drawn frame for buttons/cards (uses non-scaling stroke).
  function frame(seed = 5) {
    return `<svg class="sk-frame" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="${box(3, 3, 194, 54, seed, 0.8)}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>`;
  }

  // Five-point star path centred at (cx, cy).
  function starPath(cx, cy, outer, inner, points = 5, rot = -Math.PI / 2) {
    let d = '';
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 ? inner : outer;
      const a = rot + (i * Math.PI) / points;
      d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rad) + ' ' + f(cy + Math.sin(a) * rad);
    }
    return d + 'Z';
  }

  const api = { rng, hash, catmull, smoothPath, line, box, circle, horizon, figure, arrowButton, frame, starPath };
  root.PFC = root.PFC || {};
  root.PFC.sketch = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
