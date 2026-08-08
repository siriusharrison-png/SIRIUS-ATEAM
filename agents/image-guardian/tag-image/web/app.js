// 图片打标签工作台 · 前端逻辑
(function () {
  const drop = document.getElementById('drop');
  const fileInput = document.getElementById('file');
  const grid = document.getElementById('grid');
  const bar = document.getElementById('bar');
  const count = document.getElementById('count');
  const toast = document.getElementById('toast');
  const keyWarn = document.getElementById('keyWarn');

  let items = []; // {id, name, tags, status}

  // 检查 key 状态
  fetch('/api/status').then(r => r.json()).then(d => {
    if (!d.keyReady) keyWarn.style.display = 'block';
  }).catch(() => {});

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  function updateBar() {
    const done = items.filter(i => i.status === 'done').length;
    if (items.length === 0) {
      bar.classList.remove('show');
      return;
    }
    bar.classList.add('show');
    count.textContent = `${items.length} 张 · ${done} 张已完成`;
  }

  function renderRow(item) {
    let row = document.getElementById('row-' + item.id);
    if (!row) {
      row = document.createElement('div');
      row.className = 'row';
      row.id = 'row-' + item.id;
      row.innerHTML = `
        <img class="thumb" src="${item.preview}" alt="">
        <div class="row-main">
          <div class="row-name">${escapeHtml(item.name)}</div>
          <div class="tags"></div>
        </div>
        <div class="row-actions"></div>`;
      grid.appendChild(row);
    }
    const tagsEl = row.querySelector('.tags');
    const actions = row.querySelector('.row-actions');
    if (item.status === 'pending') {
      tagsEl.className = 'tags pending';
      tagsEl.innerHTML = '<span class="spin"></span> 打标签中…';
      actions.innerHTML = '';
    } else if (item.status === 'error') {
      tagsEl.className = 'tags error';
      tagsEl.textContent = item.error || '出错了';
      actions.innerHTML = '<button data-retry="' + item.id + '">重试</button>';
    } else {
      tagsEl.className = 'tags';
      tagsEl.textContent = item.tags.join(',');
      tagsEl.title = '点击复制';
      tagsEl.style.cursor = 'pointer';
      tagsEl.onclick = () => copy(item.tags.join(','));
      actions.innerHTML = '<button data-copy="' + item.id + '">复制</button>';
    }
    updateBar();
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制');
    } catch {
      // 回退方案
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast('已复制');
    }
  }

  async function tagOne(item, file) {
    item.status = 'pending';
    renderRow(item);
    const fd = new FormData();
    fd.append('image', file, item.name);
    try {
      const res = await fetch('/api/tag', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        item.tags = data.tags;
        item.status = 'done';
      } else {
        item.status = 'error';
        item.error = data.error;
      }
    } catch (e) {
      item.status = 'error';
      item.error = String(e);
    }
    renderRow(item);
  }

  let seq = 0;
  async function addFiles(files) {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    for (const file of imgs) {
      const id = ++seq;
      const item = { id, name: file.name, tags: [], status: 'pending', preview: URL.createObjectURL(file) };
      items.push(item);
      renderRow(item);
    }
    // 逐张串行处理，对免费额度友好
    const startIdx = items.length - imgs.length;
    for (let i = 0; i < imgs.length; i++) {
      await tagOne(items[startIdx + i], imgs[i]);
    }
  }

  // 事件绑定
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => addFiles(e.target.files));

  ['dragover', 'dragenter'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));

  grid.addEventListener('click', e => {
    const copyId = e.target.getAttribute('data-copy');
    const retryId = e.target.getAttribute('data-retry');
    if (copyId) {
      const it = items.find(i => i.id == copyId);
      if (it) copy(it.tags.join(','));
    }
    if (retryId) {
      showToast('请重新拖入该图重试');
    }
  });

  document.getElementById('copyAll').addEventListener('click', () => {
    const done = items.filter(i => i.status === 'done');
    if (done.length === 0) return showToast('还没有可复制的标签');
    const text = done.map(i => i.tags.join(',')).join('\n');
    copy(text);
  });

  document.getElementById('exportCsv').addEventListener('click', () => {
    const done = items.filter(i => i.status === 'done');
    if (done.length === 0) return showToast('还没有可导出的标签');
    const rows = ['文件名,标签', ...done.map(i => `"${i.name}","${i.tags.join(',')}"`)];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tags.csv';
    a.click();
    showToast('已导出 tags.csv');
  });

  document.getElementById('clear').addEventListener('click', () => {
    items = []; grid.innerHTML = ''; updateBar();
  });
})();
