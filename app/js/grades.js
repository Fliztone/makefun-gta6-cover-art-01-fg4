// Five color grades. Each is a canvas filter applied while the photo is
// drawn, plus one or two gradient passes composited over the panel — fast,
// deterministic, and identical at preview and export resolution.

export const GRADES = [
  { id: 'sunset', name: 'Vice Sunset', swatch: 'linear-gradient(120deg,#ffc44d,#ff2e88)' },
  { id: 'neon', name: 'Neon Night', swatch: 'linear-gradient(120deg,#29e6ff,#8a2be2)' },
  { id: 'golden', name: 'Golden', swatch: 'linear-gradient(120deg,#ffe95e,#ff9a3d)' },
  { id: 'ocean', name: 'Ocean', swatch: 'linear-gradient(120deg,#7fe3dc,#2a6bd4)' },
  { id: 'raw', name: 'Raw', swatch: 'linear-gradient(120deg,#cccccc,#888888)' },
];

const FILTERS = {
  sunset: 'saturate(1.28) contrast(1.08) brightness(1.03)',
  neon: 'saturate(1.35) contrast(1.18) brightness(0.9) hue-rotate(-14deg)',
  golden: 'saturate(1.18) contrast(1.06) sepia(0.28) brightness(1.04)',
  ocean: 'saturate(1.12) contrast(1.06) hue-rotate(10deg) brightness(1.02)',
  raw: 'none',
};

export function gradeFilter(gradeId) {
  return FILTERS[gradeId] ?? 'none';
}

function vertical(ctx, bbox, stops) {
  const g = ctx.createLinearGradient(0, bbox.y, 0, bbox.y + bbox.h);
  for (const [t, color] of stops) g.addColorStop(t, color);
  return g;
}

// Overlay passes run inside the panel's clip, in pixel space.
export function applyGrade(ctx, bbox, gradeId) {
  if (gradeId === 'raw') return;
  ctx.save();
  if (gradeId === 'sunset') {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = vertical(ctx, bbox, [[0, 'rgba(255,60,170,0.85)'], [0.5, 'rgba(255,140,60,0.55)'], [1, 'rgba(120,20,140,0.8)']]);
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = vertical(ctx, bbox, [[0, 'rgba(255,196,77,0.22)'], [0.4, 'rgba(255,46,136,0.1)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  } else if (gradeId === 'neon') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = vertical(ctx, bbox, [[0, 'rgba(70,60,160,0.75)'], [0.6, 'rgba(40,20,90,0.55)'], [1, 'rgba(10,5,30,0.8)']]);
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(bbox.x + bbox.w * 0.5, bbox.y + bbox.h * 0.35, 0, bbox.x + bbox.w * 0.5, bbox.y + bbox.h * 0.35, Math.max(bbox.w, bbox.h) * 0.75);
    glow.addColorStop(0, 'rgba(41,230,255,0.2)');
    glow.addColorStop(0.55, 'rgba(255,46,136,0.12)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  } else if (gradeId === 'golden') {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = vertical(ctx, bbox, [[0, 'rgba(255,233,94,0.8)'], [0.6, 'rgba(255,154,61,0.6)'], [1, 'rgba(180,90,20,0.65)']]);
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = vertical(ctx, bbox, [[0, 'rgba(255,240,180,0.18)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  } else if (gradeId === 'ocean') {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = vertical(ctx, bbox, [[0, 'rgba(127,227,220,0.75)'], [0.55, 'rgba(42,107,212,0.55)'], [1, 'rgba(10,30,90,0.7)']]);
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(180,220,255,0.14)';
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  }
  ctx.restore();
}

// A gentle vignette over the whole poster, before lettering goes on.
export function applyVignette(ctx, w, h, strength = 0.32) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(15,0,35,0)');
  g.addColorStop(1, `rgba(15,0,35,${strength})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
// build marker: grades.js