// The poster compositor: white frame, cropped + graded photo panels, film
// grain, palm silhouettes, lettering and badge. One function draws both the
// live preview and the full-resolution export, so they always match.

import { pixelPanels, duoDivider, frameMetrics } from './layouts.js';
import { gradeFilter, applyGrade, applyVignette } from './grades.js';
import { applyGrain } from './grain.js';
import { drawLettering, drawBadge } from './lettering.js';
import { drawPalm } from './scenes.js';

// Cover-fit crop for one panel. cx/cy (0..1) pick the photo's focus point;
// zoom >= 1 enlarges it. Offsets are clamped so the panel never shows gaps.
export function cropTransform(panel, bbox, photo) {
  const base = Math.max(bbox.w / photo.w, bbox.h / photo.h);
  const scale = base * (panel.zoom || 1);
  const drawW = photo.w * scale;
  const drawH = photo.h * scale;
  const minCx = bbox.w / (2 * drawW);
  const minCy = bbox.h / (2 * drawH);
  const cx = Math.min(1 - minCx, Math.max(minCx, panel.cx ?? 0.5));
  const cy = Math.min(1 - minCy, Math.max(minCy, panel.cy ?? 0.5));
  return {
    drawW,
    drawH,
    dx: bbox.x + bbox.w / 2 - cx * drawW,
    dy: bbox.y + bbox.h / 2 - cy * drawH,
    cx,
    cy,
  };
}

function clipPoly(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function placeholder(ctx, bbox) {
  const g = ctx.createLinearGradient(bbox.x, bbox.y, bbox.x + bbox.w, bbox.y + bbox.h);
  g.addColorStop(0, '#241040');
  g.addColorStop(1, '#12061f');
  ctx.fillStyle = g;
  ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
}

export function renderCover(ctx, w, h, state, getPhoto) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const panels = pixelPanels(state.layout, w, h);
  const { gap } = frameMetrics(w, h);

  panels.forEach((shape, i) => {
    const panel = state.panels[i] ?? { zoom: 1, cx: 0.5, cy: 0.5 };
    const photo = getPhoto(panel.photo);
    ctx.save();
    clipPoly(ctx, shape.poly);
    ctx.clip();
    if (photo) {
      const t = cropTransform(panel, shape.bbox, photo);
      ctx.filter = gradeFilter(state.grade);
      ctx.drawImage(photo.source, t.dx, t.dy, t.drawW, t.drawH);
      ctx.filter = 'none';
      applyGrade(ctx, shape.bbox, state.grade);
    } else {
      placeholder(ctx, shape.bbox);
    }
    ctx.restore();
  });

  if (state.layout === 'duo') {
    const d = duoDivider(w, h);
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = gap;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(d.ax, d.ay);
    ctx.lineTo(d.bx, d.by);
    ctx.stroke();
    ctx.restore();
  }

  applyVignette(ctx, w, h);
  applyGrain(ctx, w, h, state.grainSeed ?? 1986, state.grainAlpha ?? 0.11);

  // Palm silhouettes rise from the bottom corners, behind the lettering.
  const { border } = frameMetrics(w, h);
  const palmColor = 'rgba(22,6,38,0.9)';
  drawPalm(ctx, border * 0.9, h - border * 0.35, Math.min(w, h) * 0.3, 1, palmColor);
  drawPalm(ctx, w - border * 0.9, h - border * 0.3, Math.min(w, h) * 0.34, -1, palmColor);

  drawLettering(ctx, w, h, state.title, state.tagline, state.lettering);
  drawBadge(ctx, w, h);
  ctx.restore();
}
// build marker: render.js