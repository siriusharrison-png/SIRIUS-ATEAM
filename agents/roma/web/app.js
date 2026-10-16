import { lumaGrid } from './ascii.js';
import { risoSvgFromLuma } from './riso.js';
import { asciiFromLuma } from './ascii.js';
import { risoFaceSvg, asciiFaceSvg, RISO_GRID, ASCII } from './card.js';

const $ = (id) => document.getElementById(id);
let current = null; // 最近一次生成的卡片结构化数据
let showNotes = false;

function setStatus(msg, busy = false) {
  $('status').textContent = msg;
  $('status').classList.toggle('busy', busy);
}

async function loadModels() {
  const { models } = await (await fetch('/config')).json();
  $('model').innerHTML = models.map((m) => `<option value="${m.id}">${m.label}</option>`).join('');
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
  return data;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('源图加载失败'));
    img.src = src;
  });
}

async function generate(ev) {
  ev.preventDefault();
  const input = $('input').value.trim();
  if (!input) return setStatus('先写点香味描述');

  $('gen').disabled = true;
  try {
    setStatus('读取香气信息…', true);
    const card = await postJson('/generate', { input, model: $('model').value });

    setStatus('生成抽象源图…', true);
    const { image } = await postJson('/image', { imagePrompt: card.imagePrompt });
    const img = await loadImage(image);

    setStatus('渲染卡面…', true);
    const risoLuma = lumaGrid(img, RISO_GRID.cols, RISO_GRID.rows, RISO_GRID.cols / RISO_GRID.rows);
    const risoArt = risoSvgFromLuma(risoLuma, card.visual?.palette, { cell: RISO_GRID.cell });
    const asciiLuma = lumaGrid(img, ASCII.cols, ASCII.rows, ASCII.cols / (ASCII.rows * 2));
    const asciiArt = asciiFromLuma(asciiLuma);

    current = { card, risoArt, asciiArt };
    render();
    $('scene').classList.remove('empty');
    $('flip').disabled = false;
    $('export').disabled = false;
    $('card').classList.remove('flipped');
    setStatus('');
  } catch (e) {
    setStatus(String(e.message || e));
  } finally {
    $('gen').disabled = false;
  }
}

function render() {
  if (!current) return;
  const { card, risoArt, asciiArt } = current;
  $('front').innerHTML = risoFaceSvg(card, risoArt, { showNotes });
  $('back').innerHTML = asciiFaceSvg(card, asciiArt, { showNotes });
}

async function exportPng() {
  if (!current) return;
  const flipped = $('card').classList.contains('flipped');
  const svgEl = flipped ? $('back').querySelector('svg') : $('front').querySelector('svg');
  const svgText = new XMLSerializer().serializeToString(svgEl);
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${current.card.perfumeName || 'roma'}-${flipped ? 'ascii' : 'riso'}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

$('form').addEventListener('submit', generate);
$('flip').addEventListener('click', () => $('card').classList.toggle('flipped'));
$('card').addEventListener('click', () => { if (current) $('card').classList.toggle('flipped'); });
$('export').addEventListener('click', exportPng);
$('showNotes').addEventListener('change', (e) => { showNotes = e.target.checked; render(); });

loadModels();
