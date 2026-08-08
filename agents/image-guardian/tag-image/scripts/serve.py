#!/usr/bin/env python3
"""
serve.py — 图片打标签工作台

起一个本地 Web 服务，浏览器里拖入多张照片 → 自动打标签 →
每张显示缩略图＋可复制标签，并可一键导出整张 tags.csv。

复用 Imagga AI（与 Node 版同一套凭证），零第三方依赖：仅标准库 http.server。
凭证从与项目根同级的 .env.local 读取（不入库）。

用法：
    python3 scripts/serve.py                # 默认 http://127.0.0.1:8770
    python3 scripts/serve.py --port 9000
    PORT=9000 python3 scripts/serve.py
"""

import argparse
import base64
import json
import os
import sys
import ssl
import urllib.request
import urllib.error
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def _make_ssl_context():
    """构造 SSL context。macOS 自带 Python 常缺根证书，优先用 certifi，
    没有则回退系统默认；仍失败时对固定可信端点放宽校验（本地个人工具的合理折中）。"""
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        pass
    try:
        return ssl.create_default_context()
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


_SSL_CTX = _make_ssl_context()

ROOT_DIR = Path(__file__).resolve().parent.parent
STATIC_HTML = ROOT_DIR / "web" / "index.html"
IMAGGA_ENDPOINT = "https://api.imagga.com/v2/tags"
CONFIDENCE_MIN = 20
MAX_TAGS = 20


def _load_env():
    """把同级 .env.local 读进环境变量（若尚未设置）。"""
    env_file = ROOT_DIR / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _auth_header():
    key = os.environ.get("IMAGGA_API_KEY", "")
    secret = os.environ.get("IMAGGA_API_SECRET", "")
    if not key or not secret:
        return None
    raw = f"{key}:{secret}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("ascii")


def _parse_multipart(body: bytes, boundary: bytes) -> dict:
    """极简 multipart/form-data 解析：返回 {字段名: (文件名, 字节)}。"""
    result = {}
    sep = b"--" + boundary
    for part in body.split(sep):
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        if b"\r\n\r\n" not in part:
            continue
        head, data = part.split(b"\r\n\r\n", 1)
        head_text = head.decode("utf-8", "ignore")
        disp_line = ""
        for hl in head_text.split("\r\n"):
            if hl.lower().startswith("content-disposition:"):
                disp_line = hl
                break
        name = None
        filename = None
        for token in disp_line.split(";"):
            token = token.strip()
            if token.startswith('name="') and token.endswith('"'):
                name = token[len('name="'):-1]
            elif token.startswith('filename="') and token.endswith('"'):
                filename = token[len('filename="'):-1]
        if name is None:
            continue
        result[name] = (filename, data)
    return result


def _tag_image_bytes(filename: str, content: bytes) -> list:
    """把一张图上传给 Imagga，返回过滤后的标签列表。"""
    auth = _auth_header()
    if auth is None:
        raise RuntimeError("缺少 Imagga 凭证（.env.local 里的 IMAGGA_API_KEY / IMAGGA_API_SECRET）")

    boundary = "----TagImageBoundary"
    pre = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode("utf-8")
    post = f"\r\n--{boundary}--\r\n".encode("utf-8")
    payload = pre + content + post

    req = urllib.request.Request(IMAGGA_ENDPOINT, data=payload, method="POST")
    req.add_header("Authorization", auth)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    try:
        with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")
        raise RuntimeError(f"Imagga 返回 {e.code}: {detail}")
    except urllib.error.URLError as e:
        # SSL 证书链缺失时的兜底：对 api.imagga.com 这个固定端点降级重试
        if isinstance(e.reason, ssl.SSLError):
            insecure = ssl.create_default_context()
            insecure.check_hostname = False
            insecure.verify_mode = ssl.CERT_NONE
            req2 = urllib.request.Request(IMAGGA_ENDPOINT, data=payload, method="POST")
            req2.add_header("Authorization", auth)
            req2.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
            with urllib.request.urlopen(req2, timeout=60, context=insecure) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        else:
            raise RuntimeError(f"网络错误: {e.reason}")

    if data.get("status", {}).get("type") != "success":
        raise RuntimeError(data.get("status", {}).get("text", "打标签失败"))

    tags = data.get("result", {}).get("tags", [])
    return [
        t["tag"]["en"]
        for t in tags
        if t.get("confidence", 0) > CONFIDENCE_MIN
    ][:MAX_TAGS]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # 静默，保持终端干净

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            if not STATIC_HTML.exists():
                self._send(500, b"web/index.html missing", "text/plain")
                return
            self._send(200, STATIC_HTML.read_bytes(), "text/html; charset=utf-8")
            return
        if self.path == "/app.js":
            js = ROOT_DIR / "web" / "app.js"
            if not js.exists():
                self._send(404, b"app.js missing", "text/plain")
                return
            self._send(200, js.read_bytes(), "application/javascript; charset=utf-8")
            return
        if self.path == "/api/status":
            ok = _auth_header() is not None
            self._send(200, json.dumps({"keyReady": ok}).encode("utf-8"))
            return
        self._send(404, b"not found", "text/plain")

    def do_POST(self):
        if self.path != "/api/tag":
            self._send(404, b"not found", "text/plain")
            return
        ctype = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        if "multipart/form-data" not in ctype or "boundary=" not in ctype:
            self._send(400, json.dumps({"ok": False, "error": "需要 multipart 表单"}).encode("utf-8"))
            return
        boundary = ctype.split("boundary=", 1)[1].strip().encode("utf-8")
        try:
            fields = _parse_multipart(body, boundary)
            if "image" not in fields:
                raise RuntimeError("没有收到图片")
            filename, content = fields["image"]
            tags = _tag_image_bytes(filename or "upload.jpg", content)
            result = {"ok": True, "tags": tags}
        except Exception as e:
            result = {"ok": False, "error": str(e)}
        code = 200 if result.get("ok") else 500
        self._send(code, json.dumps(result, ensure_ascii=False).encode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="图片打标签工作台")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8770)))
    parser.add_argument("--no-open", action="store_true", help="不自动打开浏览器")
    args = parser.parse_args()

    _load_env()

    url = f"http://127.0.0.1:{args.port}"
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    key_ok = "✓ 已就位" if _auth_header() else "✗ 缺失（打标签会失败）"
    print(f"图片打标签工作台 → {url}")
    print(f"Imagga Key: {key_ok}")
    print("按 Ctrl+C 停止。")
    if not args.no_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")


if __name__ == "__main__":
    main()
