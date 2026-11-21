// Panel geometry for the four white-frame layouts. Everything is defined in
// unit space (0..1 inside the frame) and mapped to pixels at render time, so
// the same layout works at 1080x1080, 1080x1350 and 1920x1080.

export const LAYOUTS = [
  { id: 'grid', name: 'Grid', count: 4 },
  { id: 'hero', name: 'Hero', count: 4 },
  { id: 'mosaic', name: 'Mosaic', count: 4 },
  { id: 'duo', name: 'Diagonal Duo', count: 2 },
];

const RECT_LAYOUTS = {
  grid: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  hero: [
    { x: 0, y: 0, w: 1, h: 0.6 },
    { x: 0, y: 0.6, w: 1 / 3, h: 0.4 },
    { x: 1 / 3, y: 0.6, w: 1 / 3, h: 0.4 },
    { x: 2 / 3, y: 0.6, w: 1 / 3, h: 0.4 },
  ],
  mosaic: [
    { x: 0, y: 0, w: 0.6, h: 0.56 },
    { x: 0.6, y: 0, w: 0.4, h: 1 },
    { x: 0, y: 0.56, w: 0.3, h: 0.44 },
    { x: 0.3, y: 0.56, w: 0.3, h: 0.44 },
  ],
};

// Diagonal duo: two polygons sharing a slanted divider.
const DUO_POLYS = [
  [[0, 0], [0.66, 0], [0.34, 1], [0, 1]],
  [[0.66, 0], [1, 0], [1, 1], [0.34, 1]],
];

export function frameMetrics(w, h) {
  const unit = Math.min(w, h);
  const border = Math.round(unit * 0.03);
  const gap = Math.round(unit * 0.016);
  return { border, gap, inner: { x: border, y: border, w: w - border * 2, h: h - border * 2 } };
}

function rectPoly(r) {
  return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
}

// Pixel-space panels for a layout: rects are inset by half a gap on every
// side so the white frame shows between them; duo keeps full polygons and
// gets its divider stroked white afterwards.
export function pixelPanels(layoutId, w, h) {
  const { gap, inner } = frameMetrics(w, h);
  const map = ([ux, uy]) => [inner.x + ux * inner.w, inner.y + uy * inner.h];
  let shapes;
  if (layoutId === 'duo') {
    shapes = DUO_POLYS.map((poly) => ({ poly: poly.map(map), inset: false }));
  } else {
    const rects = RECT_LAYOUTS[layoutId] ?? RECT_LAYOUTS.grid;
    const ix = gap / 2 / inner.w;
    const iy = gap / 2 / inner.h;
    shapes = rects.map((r) => ({
      poly: rectPoly({ x: r.x + ix, y: r.y + iy, w: r.w - ix * 2, h: r.h - iy * 2 }).map(map),
      inset: true,
    }));
  }
  return shapes.map(({ poly }) => {
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return { poly, bbox: { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 } };
  });
}

export function duoDivider(w, h) {
  const { inner } = frameMetrics(w, h);
  return {
    ax: inner.x + 0.66 * inner.w,
    ay: inner.y,
    bx: inner.x + 0.34 * inner.w,
    by: inner.y + inner.h,
  };
}

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function layoutCount(layoutId) {
  return (LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[0]).count;
}
// build marker: layouts.js