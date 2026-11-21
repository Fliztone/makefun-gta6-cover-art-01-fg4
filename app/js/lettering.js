// Caption lettering: auto-fitted Bungee titles in three styles, an Anton
// tagline with wide tracking, and an original VI badge. No game fonts or
// logos — Bungee and Anton are SIL OFL faces shipped under app/fonts/.

import { frameMetrics } from './layouts.js';

export const LETTERING_STYLES = [
  { id: 'sunset', name: 'Sunset' },
  { id: 'neon', name: 'Neon' },
  { id: 'chrome', name: 'Chrome' },
];

function fitSize(ctx, text, family, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

function titlePaint(ctx, style, size, cx, baseline, text) {
  if (style === 'neon') {
    ctx.shadowColor = 'rgba(41,230,255,0.9)';
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#c8f6ff';
    ctx.fillText(text, cx, baseline);
    ctx.shadowColor = 'rgba(255,46,136,0.85)';
    ctx.shadowBlur = size * 0.4;
    ctx.fillText(text, cx, baseline);
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeStyle = '#0a1030';
    ctx.strokeText(text, cx, baseline);
    ctx.fillStyle = '#e6fbff';
    ctx.fillText(text, cx, baseline);
    return;
  }
  if (style === 'chrome') {
    const g = ctx.createLinearGradient(0, baseline - size, 0, baseline);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.32, '#cfd9ec');
    g.addColorStop(0.5, '#5a6b8c');
    g.addColorStop(0.62, '#e8eef8');
    g.addColorStop(1, '#98a5c0');
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = '#141b2e';
    ctx.strokeText(text, cx, baseline);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.1;
    ctx.shadowOffsetY = size * 0.05;
    ctx.fillStyle = g;
    ctx.fillText(text, cx, baseline);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    return;
  }
  // Sunset: warm gradient over a heavy dark outline, pink glow behind.
  const g = ctx.createLinearGradient(0, baseline - size, 0, baseline);
  g.addColorStop(0, '#ffe95e');
  g.addColorStop(0.5, '#ff9a3d');
  g.addColorStop(1, '#ff2e88');
  ctx.shadowColor = 'rgba(255,46,136,0.55)';
  ctx.shadowBlur = size * 0.2;
  ctx.shadowOffsetY = size * 0.05;
  ctx.lineWidth = Math.max(3, size * 0.11);
  ctx.strokeStyle = '#2a0a3a';
  ctx.strokeText(text, cx, baseline);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = g;
  ctx.fillText(text, cx, baseline);
}

// Manual per-character tracking so the tagline spaces identically everywhere.
function drawTracked(ctx, text, cx, baseline, spacing) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x + widths[i] / 2, baseline);
    x += widths[i] + spacing;
  });
}

export function drawLettering(ctx, w, h, title, tagline, style) {
  const { border } = frameMetrics(w, h);
  const cx = w / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  const cleanTitle = (title || '').trim().toUpperCase();
  const cleanTag = (tagline || '').trim().toUpperCase();

  const tagSize = Math.max(14, Math.min(h * 0.034, w * 0.03));
  const tagBaseline = h - border - h * 0.03;
  const titleCap = Math.min(h * 0.135, w * 0.16);
  const titleBaseline = cleanTag ? tagBaseline - tagSize * 1.55 : h - border - h * 0.045;

  if (cleanTitle) {
    const size = fitSize(ctx, cleanTitle, 'Bungee', titleCap, w * 0.88);
    ctx.font = `${size}px Bungee`;
    // Stroke pass first for styles that outline, then the painted fill.
    titlePaint(ctx, style, size, cx, titleBaseline, cleanTitle);
    if (style === 'sunset') {
      ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeText(cleanTitle, cx, titleBaseline);
    }
  }

  if (cleanTag) {
    ctx.font = `${tagSize}px Anton`;
    ctx.shadowColor = 'rgba(10,0,25,0.8)';
    ctx.shadowBlur = tagSize * 0.3;
    ctx.shadowOffsetY = tagSize * 0.08;
    ctx.fillStyle = '#fff6e8';
    drawTracked(ctx, cleanTag, cx, tagBaseline, tagSize * 0.42);
  }
  ctx.restore();
}

// Original VI badge: a gradient hexagon shield with the studio's VI mark.
export function drawBadge(ctx, w, h) {
  const { border } = frameMetrics(w, h);
  const size = Math.min(w, h) * 0.115;
  const cx = w - border - size * 0.72;
  const cy = border + size * 0.72;
  ctx.save();
  ctx.translate(cx, cy);
  const hex = (r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = size * 0.2;
  const g = ctx.createLinearGradient(-size, -size, size, size);
  g.addColorStop(0, '#ffc44d');
  g.addColorStop(0.5, '#ff2e88');
  g.addColorStop(1, '#8a2be2');
  hex(size * 0.62);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  hex(size * 0.62);
  ctx.lineWidth = size * 0.045;
  ctx.strokeStyle = '#fff6e8';
  ctx.stroke();
  hex(size * 0.5);
  ctx.lineWidth = size * 0.018;
  ctx.strokeStyle = 'rgba(255,246,232,0.6)';
  ctx.stroke();
  ctx.font = `${size * 0.52}px Bungee`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.05;
  ctx.strokeStyle = '#2a0a3a';
  ctx.strokeText('VI', 0, size * 0.04);
  ctx.fillStyle = '#fff6e8';
  ctx.fillText('VI', 0, size * 0.04);
  ctx.restore();
}
// build marker: lettering.js