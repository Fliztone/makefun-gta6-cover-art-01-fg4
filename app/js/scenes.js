// Original procedural Vice City scenes — the studio's sample "photos".
// Every scene is painted from scratch with canvas paths and seeded noise:
// no borrowed imagery, no game assets. Each paints a 1280x960 frame.

import { mulberry32, between, pick } from './rng.js';

export const SCENE_W = 1280;
export const SCENE_H = 960;

function skyGradient(ctx, w, h, stops, horizon) {
  const g = ctx.createLinearGradient(0, 0, 0, h * horizon);
  for (const [t, color] of stops) g.addColorStop(t, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * horizon + 1);
}

function lerpStops(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      const a = parseInt(c0.slice(1), 16);
      const b = parseInt(c1.slice(1), 16);
      const ch = (shift) => {
        const va = (a >> shift) & 255;
        const vb = (b >> shift) & 255;
        return Math.round(va + (vb - va) * k);
      };
      return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
    }
  }
  return stops[stops.length - 1][1];
}

// A silhouette palm: curved trunk plus arcing fronds with leaflet strokes.
export function drawPalm(ctx, x, baseY, height, lean, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const topX = x + lean * height * 0.32;
  const topY = baseY - height;
  ctx.lineWidth = height * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * height * 0.1, baseY - height * 0.55, topX, topY);
  ctx.stroke();
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const ang = -Math.PI * 0.92 + (i / (fronds - 1)) * Math.PI * 0.84;
    const len = height * (0.34 + 0.1 * Math.sin(i * 2.1));
    const ex = topX + Math.cos(ang) * len;
    const ey = topY + Math.sin(ang) * len * 0.62 + len * 0.16;
    const cx = topX + Math.cos(ang) * len * 0.5;
    const cy = topY + Math.sin(ang) * len * 0.22 - len * 0.12;
    ctx.lineWidth = height * 0.02;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
    ctx.lineWidth = height * 0.012;
    for (let k = 1; k <= 6; k++) {
      const t = k / 7;
      const px = (1 - t) * (1 - t) * topX + 2 * (1 - t) * t * cx + t * t * ex;
      const py = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * cy + t * t * ey;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + len * 0.05, py + len * 0.13);
      ctx.moveTo(px, py);
      ctx.lineTo(px - len * 0.04, py + len * 0.11);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function slattedSun(ctx, cx, cy, r, stops, skyStops, horizonY) {
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, '#ffe95e');
  g.addColorStop(0.55, '#ff9a3d');
  g.addColorStop(1, '#ff2e88');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // Retro slats across the lower half, painted back in the sky's own color.
  let y = cy - r * 0.05;
  let gap = r * 0.14;
  let thick = r * 0.05;
  while (y < cy + r) {
    const t = Math.min(1, Math.max(0, y / horizonY));
    ctx.fillStyle = lerpStops(skyStops, t * 0.86);
    ctx.fillRect(cx - r - 2, y, r * 2 + 4, thick);
    y += gap + thick;
    gap *= 0.9;
    thick *= 1.3;
  }
  ctx.restore();
}

function skyline(ctx, w, baseY, maxH, color, rand, litRatio, litColors) {
  let x = -10;
  while (x < w + 10) {
    const bw = between(rand, w * 0.035, w * 0.085);
    const bh = between(rand, maxH * 0.35, maxH);
    ctx.fillStyle = color;
    ctx.fillRect(x, baseY - bh, bw, bh + 2);
    if (rand() < 0.3) {
      ctx.fillRect(x + bw * 0.4, baseY - bh - maxH * 0.12, bw * 0.2, maxH * 0.12);
    }
    if (litRatio > 0) {
      const cols = Math.max(1, Math.floor(bw / 14));
      const rows = Math.max(2, Math.floor(bh / 18));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rand() < litRatio) {
            ctx.fillStyle = pick(rand, litColors);
            ctx.fillRect(x + 5 + c * (bw - 10) / cols, baseY - bh + 6 + r * (bh - 12) / rows, 4, 6);
          }
        }
      }
    }
    x += bw + between(rand, 2, w * 0.012);
  }
}

function water(ctx, w, h, horizonY, topColor, bottomColor) {
  const g = ctx.createLinearGradient(0, horizonY, 0, h);
  g.addColorStop(0, topColor);
  g.addColorStop(1, bottomColor);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizonY, w, h - horizonY);
}

function glitterPath(ctx, cx, horizonY, h, rand, colors, width) {
  // Quantized alpha levels over a vertical gradient keep rows of identical
  // pixels, which compresses well in PNG without losing the shimmer look.
  const alphas = [0.3, 0.55, 0.8];
  for (let y = horizonY + 4; y < h; y += 8) {
    const spread = width * (0.25 + (y - horizonY) / (h - horizonY));
    const n = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const x = cx + between(rand, -spread, spread);
      const len = between(rand, 10, 44);
      ctx.fillStyle = pick(rand, colors);
      ctx.globalAlpha = pick(rand, alphas);
      ctx.fillRect(x, y, len, 2.4);
    }
  }
  ctx.globalAlpha = 1;
}

// --- Scene 1: a synthwave sunset over the ocean, palms framing the strip. ---
function paintSunsetStrip(ctx, w, h, rand) {
  const horizon = 0.62;
  const stops = [[0, '#2b0a4e'], [0.45, '#a12a70'], [0.78, '#ff6a3d'], [1, '#ffc44d']];
  skyGradient(ctx, w, h, stops, horizon);
  slattedSun(ctx, w * 0.5, h * 0.56, w * 0.14, stops, stops, h * horizon);
  skyline(ctx, w, h * horizon, h * 0.1, '#240a38', rand, 0.12, ['#ffc44d', '#ff8ac2']);
  water(ctx, w, h, h * horizon, '#5a1a5e', '#1c0830');
  glitterPath(ctx, w * 0.5, h * horizon, h, rand, ['#ffc44d', '#ff9a3d', '#ff2e88'], w * 0.1);
  drawPalm(ctx, w * 0.06, h * 1.02, h * 0.62, 1, '#160626');
  drawPalm(ctx, w * 0.97, h * 1.03, h * 0.7, -1, '#160626');
  drawPalm(ctx, w * 0.16, h * 1.04, h * 0.4, 1, '#1d0930');
}

// --- Scene 2: neon marina at night, reflections on black water. ---
function paintNeonMarina(ctx, w, h, rand) {
  const horizon = 0.64;
  skyGradient(ctx, w, h, [[0, '#04040f'], [0.7, '#141040'], [1, '#2a1555']], horizon);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = rand() < 0.2 ? '#9be8ff' : '#e8e6ff';
    ctx.globalAlpha = pick(rand, [0.3, 0.6, 0.9]);
    ctx.fillRect(between(rand, 0, w), between(rand, 0, h * horizon * 0.7), 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.shadowColor = '#cfe9ff';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#eef4ff';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.16, w * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const neon = ['#29e6ff', '#ff2e88', '#b06bff', '#ffc44d'];
  skyline(ctx, w, h * horizon, h * 0.34, '#0a0820', rand, 0.3, neon);
  water(ctx, w, h, h * horizon, '#0c0a26', '#040310');
  for (let i = 0; i < 46; i++) {
    const x = between(rand, 0, w);
    const color = pick(rand, neon);
    const len = between(rand, h * 0.05, h * 0.26);
    ctx.strokeStyle = color;
    ctx.globalAlpha = pick(rand, [0.15, 0.3, 0.45]);
    ctx.lineWidth = pick(rand, [2, 3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, h * horizon + 3);
    ctx.lineTo(x + between(rand, -8, 8), h * horizon + len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Pier and a moored sailboat in the foreground.
  ctx.fillStyle = '#05040f';
  ctx.fillRect(0, h * 0.88, w * 0.46, h * 0.035);
  for (let i = 0; i < 5; i++) ctx.fillRect(w * 0.04 + i * w * 0.09, h * 0.88, w * 0.012, h * 0.12);
  ctx.beginPath();
  ctx.moveTo(w * 0.6, h * 0.9);
  ctx.quadraticCurveTo(w * 0.7, h * 0.96, w * 0.8, h * 0.9);
  ctx.lineTo(w * 0.78, h * 0.86);
  ctx.lineTo(w * 0.62, h * 0.86);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(w * 0.7, h * 0.56, w * 0.006, h * 0.3);
  ctx.strokeStyle = '#29e6ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.703, h * 0.58);
  ctx.lineTo(w * 0.63, h * 0.85);
  ctx.stroke();
}

// --- Scene 3: pastel art-deco hotels on Ocean Drive, bright day. ---
function paintOceanDrive(ctx, w, h, rand) {
  skyGradient(ctx, w, h, [[0, '#69c8ff'], [1, '#dff6ff']], 0.72);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 5; i++) {
    const cx = between(rand, 0, w);
    const cy = between(rand, h * 0.05, h * 0.3);
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse(cx + k * 26 - 52, cy + between(rand, -6, 6), between(rand, 26, 46), between(rand, 12, 20), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const pastels = ['#ff9ecb', '#7fe3dc', '#fff1c9', '#c9b6ff', '#ffd9a1'];
  const trims = ['#ff2e88', '#0fb5ba', '#ff9a3d', '#7a5cff', '#ff6a3d'];
  let x = -w * 0.02;
  let i = 0;
  while (x < w) {
    const bw = between(rand, w * 0.14, w * 0.22);
    const bh = between(rand, h * 0.3, h * 0.46);
    const top = h * 0.68 - bh;
    const body = pastels[i % pastels.length];
    const trim = trims[i % trims.length];
    ctx.fillStyle = body;
    ctx.fillRect(x, top, bw, bh);
    ctx.beginPath();
    ctx.arc(x + bw / 2, top, bw / 2, Math.PI, 0);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = trim;
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 6, top + 8, bw - 12, bh - 14);
    for (let b = 1; b <= 3; b++) {
      ctx.beginPath();
      ctx.moveTo(x + 6, top + (bh * b) / 4);
      ctx.lineTo(x + bw - 6, top + (bh * b) / 4);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,30,70,0.75)';
    const cols = Math.floor(bw / 34);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 4; r++) {
        ctx.fillRect(x + 16 + c * 32, top + 22 + r * (bh / 4.6), 14, 22);
      }
    }
    x += bw + w * 0.015;
    i++;
  }
  // Sidewalk, road, palms.
  ctx.fillStyle = '#d8cfc2';
  ctx.fillRect(0, h * 0.68, w, h * 0.06);
  ctx.fillStyle = '#3a3550';
  ctx.fillRect(0, h * 0.74, w, h * 0.26);
  ctx.fillStyle = '#ffc44d';
  for (let dx = 0; dx < w; dx += w * 0.08) ctx.fillRect(dx, h * 0.865, w * 0.045, h * 0.014);
  drawPalm(ctx, w * 0.12, h * 0.72, h * 0.42, 1, '#1d4a3a');
  drawPalm(ctx, w * 0.55, h * 0.73, h * 0.5, -1, '#1d4a3a');
  drawPalm(ctx, w * 0.9, h * 0.72, h * 0.44, 1, '#225644');
}

// --- Scene 4: downtown towers at dusk above a lit causeway. ---
function paintDowntownDusk(ctx, w, h, rand) {
  const horizon = 0.7;
  skyGradient(ctx, w, h, [[0, '#180a38'], [0.55, '#5b2a86'], [0.85, '#e0567a'], [1, '#ff9a5c']], horizon);
  ctx.save();
  ctx.shadowColor = '#ffb066';
  ctx.shadowBlur = 60;
  ctx.fillStyle = '#ffd9a1';
  ctx.beginPath();
  ctx.arc(w * 0.3, h * horizon - h * 0.02, w * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  skyline(ctx, w, h * horizon, h * 0.3, '#4a2270', rand, 0.08, ['#ffd98a']);
  skyline(ctx, w, h * horizon, h * 0.46, '#200c3c', rand, 0.24, ['#ffc44d', '#9be8ff', '#ff8ac2']);
  water(ctx, w, h, h * horizon, '#3a1650', '#12061f');
  glitterPath(ctx, w * 0.3, h * horizon, h, rand, ['#ffb066', '#ff6a8a'], w * 0.06);
  // Causeway with lamp dots crossing the lower third.
  ctx.fillStyle = '#0d0518';
  ctx.fillRect(0, h * 0.82, w, h * 0.045);
  for (let px = w * 0.05; px < w; px += w * 0.09) {
    ctx.fillRect(px, h * 0.78, w * 0.006, h * 0.045);
    ctx.save();
    ctx.shadowColor = '#ffe95e';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffe95e';
    ctx.beginPath();
    ctx.arc(px + w * 0.003, h * 0.778, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,233,94,0.25)';
  for (let px = w * 0.05; px < w; px += w * 0.09) ctx.fillRect(px, h * 0.865, w * 0.006, h * 0.08);
}

// --- Scene 5: golden-hour beach with a striped parasol. ---
function paintGoldenBeach(ctx, w, h, rand) {
  const horizon = 0.52;
  skyGradient(ctx, w, h, [[0, '#ffd98a'], [0.6, '#ff9a5c'], [1, '#ff5e8a']], horizon);
  ctx.save();
  ctx.shadowColor = '#fff3c9';
  ctx.shadowBlur = 70;
  ctx.fillStyle = '#fff3c9';
  ctx.beginPath();
  ctx.arc(w * 0.62, h * horizon - h * 0.03, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  water(ctx, w, h, h * horizon, '#e08a6a', '#b05a70');
  glitterPath(ctx, w * 0.62, h * horizon, h * 0.72, rand, ['#fff3c9', '#ffd98a'], w * 0.08);
  // Sand.
  const sand = ctx.createLinearGradient(0, h * 0.7, 0, h);
  sand.addColorStop(0, '#f2c98f');
  sand.addColorStop(1, '#d9a066');
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.76);
  ctx.quadraticCurveTo(w * 0.5, h * 0.68, w, h * 0.78);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.755);
  ctx.quadraticCurveTo(w * 0.5, h * 0.675, w, h * 0.775);
  ctx.stroke();
  // Striped parasol.
  const px = w * 0.3;
  const py = h * 0.62;
  ctx.fillStyle = '#8a4a2a';
  ctx.fillRect(px - 3, py, 6, h * 0.26);
  for (let s = 0; s < 6; s++) {
    ctx.fillStyle = s % 2 ? '#ff2e88' : '#fff1c9';
    ctx.beginPath();
    ctx.moveTo(px, py - h * 0.09);
    ctx.arc(px, py - h * 0.02, w * 0.11, Math.PI + (s * Math.PI) / 6, Math.PI + ((s + 1) * Math.PI) / 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#29e6ff';
  ctx.fillRect(px + w * 0.05, h * 0.86, w * 0.13, h * 0.05);
  drawPalm(ctx, w * 0.94, h * 1.02, h * 0.72, -1, '#4a2a1a');
  ctx.strokeStyle = '#4a2a1a';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const gx = between(rand, w * 0.1, w * 0.8);
    const gy = between(rand, h * 0.1, h * 0.3);
    ctx.beginPath();
    ctx.arc(gx - 9, gy, 9, Math.PI * 1.1, Math.PI * 1.9);
    ctx.arc(gx + 9, gy, 9, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

export const SCENES = [
  { id: 'sunset-strip', name: 'Sunset Strip', seed: 8601, paint: paintSunsetStrip },
  { id: 'neon-marina', name: 'Neon Marina', seed: 8602, paint: paintNeonMarina },
  { id: 'ocean-drive', name: 'Ocean Drive', seed: 8603, paint: paintOceanDrive },
  { id: 'downtown-dusk', name: 'Downtown Dusk', seed: 8604, paint: paintDowntownDusk },
  { id: 'golden-beach', name: 'Golden Beach', seed: 8605, paint: paintGoldenBeach },
];

// Paint one scene to its own canvas; seedOffset lets "Shuffle scenes"
// re-roll the details deterministically without changing the composition.
export function renderSceneCanvas(sceneId, seedOffset = 0) {
  const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];
  const canvas = document.createElement('canvas');
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  const ctx = canvas.getContext('2d');
  scene.paint(ctx, SCENE_W, SCENE_H, mulberry32(scene.seed + seedOffset * 7919));
  return canvas;
}
// build marker: scenes.js