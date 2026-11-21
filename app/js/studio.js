// Vice Cover studio controller: owns the cover state, builds the controls,
// drives the live preview, handles per-panel drag/zoom cropping, local photo
// loading and PNG export. Everything runs offline in the browser.

import { LAYOUTS, layoutCount, pixelPanels, pointInPoly } from './layouts.js';
import { GRADES } from './grades.js';
import { LETTERING_STYLES } from './lettering.js';
import { SCENES, renderSceneCanvas } from './scenes.js';
import { renderCover, cropTransform } from './render.js';

const SIZES = [
  { id: 'square', name: '1080²', w: 1080, h: 1080 },
  { id: 'portrait', name: '1080×1350', w: 1080, h: 1350 },
  { id: 'wide', name: '1920×1080', w: 1920, h: 1080 },
];

const state = {
  layout: 'grid',
  grade: 'sunset',
  lettering: 'sunset',
  size: 'square',
  title: 'VICE CITY',
  tagline: 'SUMMER NEVER ENDS',
  grainSeed: 1986,
  grainAlpha: 0.11,
  panels: [],
};

const photos = new Map();
let sceneRound = 0;
let uploadCounter = 0;
let activePanel = 0;

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const stage = $('stage');
const pctx = preview.getContext('2d');

function getPhoto(id) {
  return photos.get(id);
}

function loadScenes() {
  for (const scene of SCENES) {
    const canvas = renderSceneCanvas(scene.id, sceneRound);
    photos.set(`scene:${scene.id}`, { source: canvas, w: canvas.width, h: canvas.height, name: scene.name, kind: 'scene' });
  }
}

function defaultPanelPhoto(i) {
  return `scene:${SCENES[i % SCENES.length].id}`;
}

function syncPanelCount() {
  const count = layoutCount(state.layout);
  while (state.panels.length < count) {
    const i = state.panels.length;
    state.panels.push({ photo: defaultPanelPhoto(i), zoom: 1, cx: 0.5, cy: 0.5 });
  }
  state.panels.length = count;
  if (activePanel >= count) activePanel = 0;
}

// --- preview sizing -------------------------------------------------------

function sizePreview() {
  const size = SIZES.find((s) => s.id === state.size);
  const aspect = size.w / size.h;
  const availW = Math.max(280, stage.clientWidth - 44);
  const availH = Math.max(320, window.innerHeight - 230);
  const fitW = Math.min(availW, availH * aspect, 780);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  preview.style.width = `${Math.round(fitW)}px`;
  preview.width = Math.round(fitW * dpr);
  preview.height = Math.round((fitW * dpr) / aspect);
}

let renderQueued = false;
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderCover(pctx, preview.width, preview.height, state, getPhoto);
  });
}

// --- controls -------------------------------------------------------------

function chipRow(container, items, current, onPick, withSwatch = false) {
  container.replaceChildren();
  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (item.id === current ? ' active' : '');
    btn.dataset.id = item.id;
    if (withSwatch) {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = item.swatch;
      btn.appendChild(sw);
    }
    btn.appendChild(document.createTextNode(item.name));
    btn.addEventListener('click', () => onPick(item.id));
    container.appendChild(btn);
  }
}

function markActive(container, id) {
  for (const btn of container.querySelectorAll('.chip')) {
    btn.classList.toggle('active', btn.dataset.id === id);
  }
}

function buildPanelList() {
  const list = $('panel-list');
  list.replaceChildren();
  state.panels.forEach((panel, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row';
    const name = document.createElement('span');
    name.className = 'panel-name';
    name.textContent = `Panel ${i + 1}`;
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Photo for panel ${i + 1}`);
    for (const [id, photo] of photos) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = photo.kind === 'scene' ? `✦ ${photo.name}` : photo.name;
      select.appendChild(opt);
    }
    select.value = panel.photo;
    select.addEventListener('change', () => {
      panel.photo = select.value;
      activePanel = i;
      requestRender();
    });
    select.addEventListener('focus', () => { activePanel = i; });
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'mini-btn';
    reset.textContent = '⟲';
    reset.title = 'Reset this crop';
    reset.addEventListener('click', () => {
      panel.zoom = 1;
      panel.cx = 0.5;
      panel.cy = 0.5;
      requestRender();
    });
    row.append(name, select, reset);
    list.appendChild(row);
  });
}

function rebuildControls() {
  chipRow($('layout-chips'), LAYOUTS, state.layout, (id) => {
    state.layout = id;
    syncPanelCount();
    markActive($('layout-chips'), id);
    buildPanelList();
    requestRender();
  });
  chipRow($('grade-chips'), GRADES, state.grade, (id) => {
    state.grade = id;
    markActive($('grade-chips'), id);
    requestRender();
  }, true);
  chipRow($('lettering-chips'), LETTERING_STYLES, state.lettering, (id) => {
    state.lettering = id;
    markActive($('lettering-chips'), id);
    requestRender();
  });
  chipRow($('size-chips'), SIZES, state.size, (id) => {
    state.size = id;
    markActive($('size-chips'), id);
    sizePreview();
    requestRender();
  });
  buildPanelList();
}

// --- pointer cropping -----------------------------------------------------

function canvasPoint(e) {
  const rect = preview.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * preview.width,
    y: ((e.clientY - rect.top) / rect.height) * preview.height,
  };
}

function panelAt(x, y) {
  const shapes = pixelPanels(state.layout, preview.width, preview.height);
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (pointInPoly(x, y, shapes[i].poly)) return i;
  }
  return -1;
}

let drag = null;

preview.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(p.x, p.y);
  if (i === -1) return;
  activePanel = i;
  drag = { i, x: p.x, y: p.y };
  preview.classList.add('dragging');
  preview.setPointerCapture(e.pointerId);
});

preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[drag.i];
  const photo = getPhoto(panel.photo);
  if (!photo) return;
  const shape = pixelPanels(state.layout, preview.width, preview.height)[drag.i];
  const t = cropTransform(panel, shape.bbox, photo);
  const minCx = shape.bbox.w / (2 * t.drawW);
  const minCy = shape.bbox.h / (2 * t.drawH);
  panel.cx = Math.min(1 - minCx, Math.max(minCx, (panel.cx ?? 0.5) - (p.x - drag.x) / t.drawW));
  panel.cy = Math.min(1 - minCy, Math.max(minCy, (panel.cy ?? 0.5) - (p.y - drag.y) / t.drawH));
  drag.x = p.x;
  drag.y = p.y;
  requestRender();
});

function endDrag() {
  drag = null;
  preview.classList.remove('dragging');
}
preview.addEventListener('pointerup', endDrag);
preview.addEventListener('pointercancel', endDrag);

preview.addEventListener('wheel', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(p.x, p.y);
  if (i === -1) return;
  e.preventDefault();
  const panel = state.panels[i];
  const photo = getPhoto(panel.photo);
  if (!photo) return;
  const shape = pixelPanels(state.layout, preview.width, preview.height)[i];
  const before = cropTransform(panel, shape.bbox, photo);
  const u = (p.x - before.dx) / before.drawW;
  const v = (p.y - before.dy) / before.drawH;
  panel.zoom = Math.min(4, Math.max(1, (panel.zoom || 1) * Math.exp(-e.deltaY * 0.0012)));
  const after = cropTransform(panel, shape.bbox, photo);
  const minCx = shape.bbox.w / (2 * after.drawW);
  const minCy = shape.bbox.h / (2 * after.drawH);
  panel.cx = Math.min(1 - minCx, Math.max(minCx, (shape.bbox.x + shape.bbox.w / 2 - (p.x - u * after.drawW)) / after.drawW));
  panel.cy = Math.min(1 - minCy, Math.max(minCy, (shape.bbox.y + shape.bbox.h / 2 - (p.y - v * after.drawH)) / after.drawH));
  activePanel = i;
  requestRender();
}, { passive: false });

// --- photos ---------------------------------------------------------------

function addUploads(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) return;
  let loaded = 0;
  images.forEach((file, k) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const id = `upload:${++uploadCounter}`;
      photos.set(id, { source: img, w: img.naturalWidth, h: img.naturalHeight, name: file.name, kind: 'upload' });
      URL.revokeObjectURL(url);
      const target = state.panels[k % state.panels.length];
      if (target) target.photo = id;
      loaded++;
      if (loaded === images.length) {
        buildPanelList();
        requestRender();
        toast(`${loaded} photo${loaded > 1 ? 's' : ''} loaded — drag panels to recompose`);
      }
    };
    img.onerror = () => toast(`Could not read ${file.name}`);
    img.src = url;
  });
}

$('photo-input').addEventListener('change', (e) => {
  addUploads(e.target.files);
  e.target.value = '';
});

stage.addEventListener('dragover', (e) => e.preventDefault());
stage.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer?.files?.length) addUploads(e.dataTransfer.files);
});

// --- actions --------------------------------------------------------------

$('fill-all').addEventListener('click', () => {
  const source = state.panels[activePanel]?.photo;
  if (!source) return;
  for (const panel of state.panels) panel.photo = source;
  buildPanelList();
  requestRender();
  toast('One photo fills every panel');
});

$('reseed').addEventListener('click', () => {
  sceneRound++;
  loadScenes();
  requestRender();
  toast('Scenes re-rolled');
});

$('reset-crops').addEventListener('click', () => {
  for (const panel of state.panels) {
    panel.zoom = 1;
    panel.cx = 0.5;
    panel.cy = 0.5;
  }
  requestRender();
});

$('title-input').addEventListener('input', (e) => {
  state.title = e.target.value;
  requestRender();
});
$('tagline-input').addEventListener('input', (e) => {
  state.tagline = e.target.value;
  requestRender();
});

let toastTimer = 0;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// --- export ---------------------------------------------------------------

function renderAt(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas.getContext('2d'), w, h, state, getPhoto);
  return canvas;
}

function exportPNG() {
  const size = SIZES.find((s) => s.id === state.size);
  const canvas = renderAt(size.w, size.h);
  canvas.toBlob((blob) => {
    if (!blob) return toast('Export failed');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-cover-${state.layout}-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Exported ${size.w}×${size.h} PNG`);
  }, 'image/png');
}

$('export-btn').addEventListener('click', exportPNG);

window.addEventListener('resize', () => {
  sizePreview();
  requestRender();
});

// --- boot -----------------------------------------------------------------

loadScenes();
syncPanelCount();
rebuildControls();
sizePreview();

const fontsReady = Promise.all([
  document.fonts.load('16px Bungee'),
  document.fonts.load('16px Anton'),
]).catch(() => {});

fontsReady.then(() => requestRender());

// Small automation surface used by the maker's screenshot rig; it exposes
// the app's own renderer, not a separate drawing path.
window.viceCover = {
  ready: fontsReady,
  state,
  photos,
  renderAt,
  dataURL(w, h) {
    return renderAt(w, h).toDataURL('image/png');
  },
  setLayout(id) { state.layout = id; syncPanelCount(); rebuildControls(); requestRender(); },
  setGrade(id) { state.grade = id; markActive($('grade-chips'), id); requestRender(); },
  setLettering(id) { state.lettering = id; markActive($('lettering-chips'), id); requestRender(); },
  setSize(id) { state.size = id; markActive($('size-chips'), id); sizePreview(); requestRender(); },
  setCaption(title, tagline) {
    state.title = title;
    state.tagline = tagline;
    $('title-input').value = title;
    $('tagline-input').value = tagline;
    requestRender();
  },
  setPanelPhoto(i, photoId) {
    if (state.panels[i]) state.panels[i].photo = photoId;
    buildPanelList();
    requestRender();
  },
  exportPNG,
};
// build marker: studio.js