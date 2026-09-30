// MotionLab 前端：生成 → 预览 → 参数微调 → 渲染。
const $ = (id) => document.getElementById(id);
const yuan = (n) => "¥" + (Math.round(n * 10000) / 10000);

let state = { code: null, defaults: {}, props: {}, durationSec: 15, schemaMeta: {} };

async function init() {
  const cfg = await fetch("/config").then((r) => r.json());
  $("model").innerHTML = cfg.models
    .map((m) => `<option value="${m.id}">${m.label}</option>`)
    .join("");
  state.durationSec = cfg.render.defaultDurationSec;
  $("total").textContent = yuan(cfg.total);
}

function setStatus(msg, cls = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = "status " + cls;
}

// 按 defaults 每个字段类型渲染控件；数值越界按 min/max clamp。
function buildParams() {
  const box = $("params");
  box.innerHTML = "";
  const entries = Object.entries(state.defaults);
  if (!entries.length) {
    box.innerHTML = '<span style="color:var(--muted);font-size:13px">这个动画没有可调参数</span>';
    return;
  }
  for (const [key, def] of entries) {
    const field = document.createElement("div");
    field.className = "field";
    const isColor = /color|colour/i.test(key);
    if (typeof def === "number") {
      const min = 0, max = def === 0 ? 10 : def * 3;
      field.innerHTML = `<label>${key}<span class="val" id="v_${key}">${def}</span></label>
        <input type="range" min="${min}" max="${max}" step="0.01" value="${def}" data-key="${key}">`;
      field.querySelector("input").addEventListener("input", (e) => {
        let v = parseFloat(e.target.value);
        if (v < min) v = min; if (v > max) v = max; // clamp
        $("v_" + key).textContent = v;
        state.props[key] = v;
        updatePreview();
      });
    } else if (isColor) {
      field.innerHTML = `<label>${key}</label><input type="color" value="${def}" data-key="${key}">`;
      field.querySelector("input").addEventListener("input", (e) => {
        state.props[key] = e.target.value;
        updatePreview();
      });
    } else {
      field.innerHTML = `<label>${key}</label><input type="text" value="${def}" data-key="${key}">`;
      field.querySelector("input").addEventListener("input", (e) => {
        state.props[key] = e.target.value;
        updatePreview();
      });
    }
    box.appendChild(field);
  }
}

// 加载 /preview-bundle（含最新 generated 组件），挂载 Player。
async function mountPreview() {
  const prev = $("preview");
  prev.innerHTML = "";
  document.querySelectorAll("script[data-preview]").forEach((s) => s.remove());
  delete window.__ml;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.dataset.preview = "1";
    s.src = "/preview-bundle?t=" + Date.now();
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
  window.__ml.mount(prev, state.props, state.durationSec);
}

function updatePreview() {
  if (window.__ml) window.__ml.update({ ...state.props });
}

$("gen").addEventListener("click", async () => {
  const desc = $("desc").value.trim();
  if (!desc) return;
  $("gen").disabled = true;
  $("render").disabled = true;
  setStatus("生成中…（LLM 写代码 + 校验，可能重试）");
  try {
    const r = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: $("model").value, desc }),
    }).then((res) => res.json());
    if (r.error) {
      setStatus("生成失败：" + r.error, "err");
      return;
    }
    state.code = r.code;
    state.defaults = r.defaults;
    state.props = { ...r.defaults };
    $("cost").textContent = yuan(r.cost);
    $("total").textContent = yuan(r.total);
    buildParams();
    await mountPreview();
    $("render").disabled = false;
    setStatus(`生成成功（尝试 ${r.attempts} 次）`, "ok");
  } catch (e) {
    setStatus("请求出错：" + e, "err");
  } finally {
    $("gen").disabled = false;
  }
});

$("render").addEventListener("click", async () => {
  $("render").disabled = true;
  setStatus("渲染中…（headless Chrome 出 mp4）");
  try {
    const r = await fetch("/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: state.code, props: state.props, durationSec: state.durationSec }),
    }).then((res) => res.json());
    if (r.error) setStatus("渲染失败：" + r.error, "err");
    else setStatus("已渲染到 output/" + r.outputPath, "ok");
  } catch (e) {
    setStatus("请求出错：" + e, "err");
  } finally {
    $("render").disabled = false;
  }
});

init();
