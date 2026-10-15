const grid = document.getElementById('grid');
const warnings = document.getElementById('warnings');
const logDialog = document.getElementById('logDialog');
const logTitle = document.getElementById('logTitle');
const logBody = document.getElementById('logBody');
document.getElementById('logClose').onclick = () => logDialog.close();

async function load() {
  const res = await fetch('/api/capabilities');
  const { capabilities, warnings: w } = await res.json();
  warnings.textContent = (w && w.length) ? '⚠ ' + w.join('\n⚠ ') : '';
  render(capabilities);
}

function render(caps) {
  grid.innerHTML = '';
  for (const c of caps) grid.appendChild(cardOf(c));
}

function cardOf(c) {
  const el = document.createElement('div');
  el.className = 'card';
  const t = c.launch.type;
  const running = c.status && c.status.running;
  el.innerHTML = `
    <span class="badge ${t}">${t}</span>
    <h3>${c.name}</h3>
    <div class="role">${c.role || ''}</div>
    <div class="desc">${c.description || ''}</div>
    <div class="actions"></div>`;
  const actions = el.querySelector('.actions');

  if (t === 'server') {
    const dot = `<span class="dot ${running ? 'on' : 'off'}"></span>${running ? '运行中 :' + (c.launch.port ?? '') : '已停止'}`;
    const line = document.createElement('div'); line.innerHTML = dot; actions.appendChild(line);
    actions.appendChild(btn(running ? '停止' : '启动', running ? 'stop' : '', async () => {
      await fetch(`/api/${running ? 'stop' : 'launch'}/${c.id}`, { method: 'POST' });
      load();
    }));
    if (running && c.launch.openUrl) actions.appendChild(btn('打开', '', () => window.open(c.launch.openUrl, '_blank')));
    actions.appendChild(btn('日志', '', () => showLogs(c)));
  } else if (t === 'interactive') {
    actions.appendChild(btn('在终端运行', '', async () => {
      const r = await (await fetch(`/api/launch/${c.id}`, { method: 'POST' })).json();
      if (r.mode === 'copy') { await navigator.clipboard.writeText(r.hint); alert('已复制命令：\n' + r.hint); }
    }));
  } else {
    actions.appendChild(btn('打开目录', '', async () => {
      const r = await (await fetch(`/api/launch/${c.id}`, { method: 'POST' })).json();
      if (r.mode === 'path') alert('目录：' + r.path);
    }));
  }
  return el;
}

function btn(label, cls, onclick) {
  const b = document.createElement('button');
  b.textContent = label; if (cls) b.className = cls; b.onclick = onclick;
  return b;
}

async function showLogs(c) {
  logTitle.textContent = c.name + ' · 日志';
  const { lines } = await (await fetch(`/api/logs/${c.id}`)).json();
  logBody.textContent = (lines || []).join('\n') || '（暂无日志）';
  logDialog.showModal();
}

load();
setInterval(load, 3000);
