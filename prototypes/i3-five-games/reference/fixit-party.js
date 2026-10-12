/** Celebration layer for Fix-it Station: fireworks, confetti and star bursts drawn on
 * a see-through 2D canvas above the game. It works with or without the 3D workshop,
 * draws only while something is moving, and does nothing for visitors who prefer
 * reduced motion. Points are CSS pixels relative to the canvas. */
const PALETTES = [
  ['#ffd23f', '#fff1a8', '#ffffff'], ['#3ad17a', '#b4f5cf', '#ffffff'], ['#3a9bff', '#b8dcff', '#ffffff'],
  ['#ff5d8f', '#ffc2d4', '#ffffff'], ['#a77bff', '#ddd0ff', '#ffffff'], ['#ff9f43', '#ffd5a8', '#ffffff'],
];
const CONFETTI = ['#ffd23f', '#3ad17a', '#176dc4', '#ff5d8f', '#a77bff', '#ff9f43', '#2ec4b6'];
const NONE = { fireworks() {}, confetti() {}, stars() {}, clear() {}, dispose() {} };

export function createParty(canvas, { reducedMotion = false, onBurst = () => {} } = {}) {
  if (reducedMotion || !canvas) return NONE;
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  if (!ctx) return NONE;
  const win = canvas.ownerDocument.defaultView;
  let width = 0, height = 0, frame = 0, last = 0, disposed = false;
  const rockets = [], sparks = [], pieces = [];

  function fit() {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(win.devicePixelRatio || 1, 2);
    width = rect.width; height = rect.height;
    canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function run() { if (!frame && !disposed) { fit(); last = performance.now(); frame = win.requestAnimationFrame(tick); } }
  const pick = list => list[Math.floor(Math.random() * list.length)];

  function explode(x, y, palette, big) {
    const count = big ? 64 : 44, speed = big ? 330 : 250;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * .25, s = speed * (.45 + Math.random() * .55);
      sparks.push({ x, y, px: x, py: y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s, age: 0, life: .9 + Math.random() * .6, colour: palette[i % palette.length], size: 2.2 + Math.random() * 1.8, twinkle: Math.random() < .35 });
    }
    sparks.push({ ring: true, x, y, age: 0, life: .4, colour: palette[0], radius: big ? 80 : 56 });
    onBurst();
  }
  function starPath(x, y, r, rotation) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = rotation + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }

  function tick(now) {
    frame = 0; if (disposed) return;
    const dt = Math.min(.04, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, width, height);
    // Rockets climb with a fading trail, then burst.
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.age += dt;
      if (r.age < 0) continue;
      const t = Math.min(1, r.age / r.duration), e = 1 - (1 - t) ** 2;
      const x = r.x0 + (r.x - r.x0) * e, y = r.y0 + (r.y - r.y0) * e;
      r.trail.push([x, y]); if (r.trail.length > 10) r.trail.shift();
      ctx.lineCap = 'round';
      for (let k = 1; k < r.trail.length; k++) { ctx.globalAlpha = k / r.trail.length; ctx.strokeStyle = r.palette[0]; ctx.lineWidth = 3.5 * k / r.trail.length; ctx.beginPath(); ctx.moveTo(...r.trail[k - 1]); ctx.lineTo(...r.trail[k]); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      if (t >= 1) { rockets.splice(i, 1); explode(r.x, r.y, r.palette, r.big); }
    }
    // Sparks fly out, slow down, fall and fade, drawn as short streaks.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.age += dt;
      const fade = Math.max(0, 1 - s.age / s.life);
      if (s.ring) {
        ctx.globalAlpha = fade * .8; ctx.strokeStyle = s.colour; ctx.lineWidth = 4 * fade + 1;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.radius * (1 - fade * .7), 0, Math.PI * 2); ctx.stroke();
      } else {
        s.px = s.x; s.py = s.y;
        const drag = Math.pow(.18, dt); s.vx *= drag; s.vy = s.vy * drag + 240 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.globalAlpha = s.twinkle ? fade * (.4 + .6 * Math.abs(Math.sin(s.age * 30))) : fade;
        ctx.strokeStyle = s.colour; ctx.lineWidth = s.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.px - (s.x - s.px) * 2, s.py - (s.y - s.py) * 2); ctx.lineTo(s.x, s.y); ctx.stroke();
        if (s.star) { ctx.fillStyle = s.colour; starPath(s.x, s.y, s.size * 2.6, s.age * 6); ctx.fill(); }
      }
      if (s.age >= s.life) sparks.splice(i, 1);
    }
    // Confetti flutters down, turning over as it falls.
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i]; p.age += dt;
      p.vy = Math.min(p.vy + 300 * dt, 150 + p.fall); p.x += (p.vx + Math.sin(p.age * p.wobble) * 40) * dt; p.y += p.vy * dt;
      p.rotation += p.spin * dt; p.flip += p.flipSpeed * dt;
      ctx.globalAlpha = Math.min(1, (p.life - p.age) * 2);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = p.colour;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      if (p.age >= p.life || p.y > height + 30) pieces.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    if (rockets.length || sparks.length || pieces.length) frame = win.requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, width, height);
  }

  return {
    /** Rockets rise from the bottom edge and burst at each point. */
    fireworks(points, { big = false } = {}) {
      run();
      points.forEach((point, i) => rockets.push({ x0: point.x + (Math.random() - .5) * 60, y0: height + 10, x: point.x, y: point.y, age: -i * .24, duration: .62 + Math.random() * .18, palette: pick(PALETTES), big, trail: [] }));
    },
    /** Confetti rains from the top across the whole layer. */
    confetti({ count = 110 } = {}) {
      run();
      for (let i = 0; i < count; i++) pieces.push({ x: Math.random() * width, y: -10 - Math.random() * height * .6, vx: (Math.random() - .5) * 70, vy: 40 + Math.random() * 80, fall: Math.random() * 90, w: 8 + Math.random() * 7, h: 5 + Math.random() * 5, round: Math.random() < .25, colour: pick(CONFETTI), rotation: Math.random() * 6, spin: (Math.random() - .5) * 9, flip: Math.random() * 6, flipSpeed: 5 + Math.random() * 7, wobble: 2 + Math.random() * 3, age: 0, life: 4.5 });
    },
    /** Golden stars burst out from one point. */
    stars(x, y, { count = 12 } = {}) {
      run();
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2, s = 180 + Math.random() * 120;
        sparks.push({ x, y, px: x, py: y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s - 80, age: 0, life: .9 + Math.random() * .3, colour: i % 3 ? '#ffd23f' : '#ffffff', size: 2.4, star: true });
      }
    },
    clear() { rockets.length = sparks.length = pieces.length = 0; ctx.clearRect(0, 0, width, height); },
    dispose() { disposed = true; if (frame) win.cancelAnimationFrame(frame); frame = 0; rockets.length = sparks.length = pieces.length = 0; },
  };
}
