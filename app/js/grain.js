// Seeded film grain: one small noise tile per seed, tiled as a pattern and
// composited in 'overlay' so it reads as film texture, not static. The tile
// is generated once and reused, so exports stay fast and deterministic.

import { mulberry32 } from './rng.js';

const TILE = 160;
const tileCache = new Map();

export function grainTile(seed) {
  if (tileCache.has(seed)) return tileCache.get(seed);
  // Noise is painted at half resolution in quantized steps, then nearest-
  // neighbour upscaled: 2x2 grain clumps read as film texture and keep the
  // exported PNGs small enough to share.
  const half = TILE / 2;
  const small = document.createElement('canvas');
  small.width = half;
  small.height = half;
  const sctx = small.getContext('2d');
  const image = sctx.createImageData(half, half);
  const rand = mulberry32(seed);
  for (let i = 0; i < image.data.length; i += 4) {
    // Two-level clumped noise: subtle film texture that stays compressible.
    const v = rand() < 0.5 ? 112 : 144;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  sctx.putImageData(image, 0, 0);
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, TILE, TILE);
  tileCache.set(seed, canvas);
  return canvas;
}

export function applyGrain(ctx, w, h, seed, alpha = 0.11) {
  const pattern = ctx.createPattern(grainTile(seed), 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
// build marker: grain.js