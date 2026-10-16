import { lumaGrid, asciiFromLuma } from './ascii.js';
import { risoSvgFromLuma, RISO_PALETTES } from './riso.js';
import { risoFaceSvg, asciiFaceSvg, RISO_GRID, ASCII } from './card.js';
import { receiptLines } from './receipt.js';
import { loadGallery, saveGallery, addEntry } from './gallery.js';
import { EXAMPLES, materializeExample } from './examples.js';

const $ = (id) => document.getElementById(id);
let current = null; // 当前展示的卡片（{ card, risoArt, asciiArt }）
let showNotes = false;
let paletteName = 'classic';
let carouselTimer = null;

// ---------- 小票：逐行"打印"渐显 ----------

function renderReceipt(card, { instant = false } = {}) {
  const el = $('receipt');
  const lines = receiptLines(card, { showNotes });
  el.innerHTML = '';
  lines.forEach((line, i) => {
    const row = document.createElement('p');
    row.className = `receipt-line receipt-${line.kind}`;
    row.textContent = line.kind === 'notes' ? `${line.label}  ${line.items.join(' / ')}` : line.text;
    if (!instant) {
      row.style.animationDelay = `${i * 90}ms`;
      row.classList.add('receipt-reveal');
    }
    el.appendChild(row);
  });
}

// ---------- 图片两面渲染 + ASCII 翻面揭示动效 ----------

function render() {
  if (!current) return;
  const { card, risoArt, asciiArt } = current;
  $('front').innerHTML = risoFaceSvg(card, risoArt);
  renderAsciiFace(card, asciiArt);
}

function renderAsciiFace(card, asciiArt) {
  // 先放完整 SVG（保证导出 PNG 时内容完整），再用一个覆盖层做打字机扫描动效，
  // 动效只是视觉层，不影响底层内容。
  $('back').innerHTML = asciiFaceSvg(card, asciiArt);
}

function playAsciiRevealAnimation() {
  const lines = $('back').querySelectorAll('[data-ascii-line]');
  lines.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.animation = `asciiLineIn .25s ease forwards`;
    el.style.animationDelay = `${i * 14}ms`;
  });
}

function setPaletteButtons() {
  const el = $('paletteSwitch');
  el.innerHTML = Object.keys(RISO_PALETTES)
    .map((name) => `<button type="button" data-palette="${name}" class="${name === paletteName ? 'active' : ''}">${name}</button>`)
    .join('');
  el.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      paletteName = btn.dataset.palette;
      setPaletteButtons();
      repaintRiso();
    });
  });
}

// 切配色只重新跑 Riso 渲染（纯函数，瞬间完成），不用重新请求网络或重算亮度矩阵。
function repaintRiso() {
  if (!current?.lumaForRiso) return;
  current.risoArt = risoSvgFromLuma(current.lumaForRiso, RISO_PALETTES[paletteName], { cell: RISO_GRID.cell });
  $('front').innerHTML = risoFaceSvg(current.card, current.risoArt);
}

// ---------- 骨架屏：生成中绝不空白 ----------

function showSkeleton() {
  $('carousel').classList.add('hidden');
  $('scene').classList.add('hidden');
  $('stageActions').classList.add('hidden');
  $('loading').classList.remove('hidden');
  $('receipt').classList.add('hidden');
  $('receiptLoading').classList.remove('hidden');
}

function hideSkeleton() {
  $('loading').classList.add('hidden');
  $('receiptLoading').classList.add('hidden');
  $('receipt').classList.remove('hidden');
}

function setStatus(msg) {
  $('status').textContent = msg;
}

// ---------- 网络 ----------

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

// ---------- 生成流程 ----------

async function generate(ev) {
  ev.preventDefault();
  const input = $('input').value.trim();
  if (!input) return setStatus('先写点香味描述');

  stopCarousel();
  $('gen').disabled = true;
  showSkeleton();
  try {
    setStatus('读取香气信息…');
    const card = await postJson('/generate', { input, model: $('model').value });
    renderReceipt(card); // 小票比图片快，先打印出来，图片还在加载也不空白

    setStatus('生成抽象源图…');
    const { image } = await postJson('/image', { imagePrompt: card.imagePrompt });
    const img = await loadImage(image);

    const risoLuma = lumaGrid(img, RISO_GRID.cols, RISO_GRID.rows, RISO_GRID.cols / RISO_GRID.rows);
    const risoArt = risoSvgFromLuma(risoLuma, RISO_PALETTES[paletteName], { cell: RISO_GRID.cell });
    const asciiLuma = lumaGrid(img, ASCII.cols, ASCII.rows, ASCII.cols / (ASCII.rows * 2));
    const asciiArt = asciiFromLuma(asciiLuma);

    const entry = { id: Date.now(), card, risoArt, asciiArt, lumaForRiso: risoLuma };
    hideSkeleton();
    selectEntry(entry);
    addToGallery(entry);
    setStatus('');
  } catch (e) {
    hideSkeleton();
    renderReceipt({ perfumeName: '生成失败', caption: String(e.message || e) }, { instant: true });
    $('scene').classList.remove('hidden');
    setStatus(String(e.message || e));
  } finally {
    $('gen').disabled = false;
  }
}

function selectEntry(entry) {
  current = entry;
  render();
  renderReceipt(entry.card);
  $('scene').classList.remove('hidden');
  $('stageActions').classList.remove('hidden');
  $('card').classList.remove('flipped');
  setPaletteButtons();
  renderGalleryStrip();
}

// ---------- Gallery（本地持久化） ----------

let gallery = loadGallery(window.localStorage);

function addToGallery(entry) {
  // 存储不需要带 lumaForRiso（可从 risoArt 再生，省空间），只留渲染所需的最小字段。
  gallery = addEntry(gallery, { id: entry.id, card: entry.card, risoArt: entry.risoArt, asciiArt: entry.asciiArt });
  saveGallery(window.localStorage, gallery);
  renderGalleryStrip();
}

function renderGalleryStrip() {
  const el = $('gallery');
  el.innerHTML = '';
  gallery.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gallery-item' + (current && item.id === current.id ? ' active' : '');
    btn.title = item.card.perfumeName || '';
    btn.innerHTML = risoFaceSvg(item.card, item.risoArt);
    btn.addEventListener('click', () => selectEntry(item));
    el.appendChild(btn);
  });
}

// ---------- 左侧示例轮播（打开即展示，零网络调用） ----------

function renderCarousel() {
  const el = $('carousel');
  el.innerHTML = EXAMPLES.map((ex, i) => {
    const art = materializeExample(ex);
    return `<div class="carousel-slide${i === 0 ? ' active' : ''}" data-index="${i}">${risoFaceSvg(ex.card, art.risoArt)}</div>`;
  }).join('');
  el.querySelectorAll('.carousel-slide').forEach((slide, i) => {
    slide.addEventListener('click', () => {
      renderReceipt(EXAMPLES[i].card);
      showSlide(i);
    });
  });
}

let slideIndex = 0;
function showSlide(i) {
  const slides = $('carousel').querySelectorAll('.carousel-slide');
  slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
  slideIndex = i;
}

function startCarousel() {
  renderCarousel();
  renderReceipt(EXAMPLES[0].card);
  carouselTimer = setInterval(() => showSlide((slideIndex + 1) % EXAMPLES.length), 3800);
}

function stopCarousel() {
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = null;
}

// ---------- 事件绑定 ----------

$('form').addEventListener('submit', generate);
$('flip').addEventListener('click', () => toggleFlip());
$('card').addEventListener('click', () => { if (current) toggleFlip(); });
$('export').addEventListener('click', exportPng);
$('showNotes').addEventListener('change', (e) => {
  showNotes = e.target.checked;
  if (current) renderReceipt(current.card, { instant: true });
});

function toggleFlip() {
  const nowFlipped = $('card').classList.toggle('flipped');
  if (nowFlipped) playAsciiRevealAnimation(); // 翻到 ASCII 面时触发打字机式逐行揭示
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

loadModels();
renderGalleryStrip();
startCarousel();
