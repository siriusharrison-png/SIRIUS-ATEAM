#!/usr/bin/env python3
"""
Agent 日志仪表板服务
提供 HTTP 接口访问日志数据
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

LOG_DIR = Path.home() / ".claude/logs"


class LogServerHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        """处理 GET 请求"""
        if self.path == '/logs-api':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            logs_data = load_all_logs()
            self.wfile.write(json.dumps(logs_data).encode())
        else:
            super().do_GET()

    def end_headers(self):
        """添加 CORS 头"""
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


def load_all_logs():
    """加载所有 Agent 的日志"""
    agents = {}

    if not LOG_DIR.exists():
        return []

    # 扫描所有 .jsonl 文件
    for log_file in LOG_DIR.glob("*.jsonl"):
        agent_name = log_file.stem
        logs = []

        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    try:
                        log_entry = json.loads(line.strip())
                        logs.append(log_entry)
                    except json.JSONDecodeError:
                        continue

            agents[agent_name] = {
                'name': agent_name,
                'logs': logs[-100:],  # 只保留最近 100 条
                'total': len(logs),
                'last_updated': log_file.stat().st_mtime
            }
        except Exception as e:
            print(f"读取日志文件失败 {log_file}: {e}", file=sys.stderr)
            agents[agent_name] = {
                'name': agent_name,
                'logs': [],
                'total': 0,
                'last_updated': 0
            }

    return list(agents.values())


def generate_static_report():
    """生成静态 HTML 报告"""
    agents = load_all_logs()

    html_parts = []

    for agent in agents:
        logs = agent['logs']
        html_parts.append(f'<h2>{agent["name"]} ({len(logs)} 条日志)</h2>')
        html_parts.append('<pre style="background: #f5f5f5; padding: 10px; overflow: auto;">')

        for log in logs[-30:]:  # 最近 30 条
            timestamp = log.get('timestamp', '')
            level = log.get('level', 'INFO')
            message = log.get('message', '')
            context = log.get('context', {})

            html_parts.append(f'[{timestamp}] {level}: {message}')
            if context:
                html_parts.append(f'  Context: {json.dumps(context)}')

        html_parts.append('</pre>')

    return '\n'.join(html_parts)


def start_server(port=8000):
    """启动 HTTP 服务"""
    os.chdir(str(Path(__file__).parent))

    server = HTTPServer(('localhost', port), LogServerHandler)
    print(f"日志服务启动于 http://localhost:{port}")
    print(f"访问 http://localhost:{port}/dashboard.html 查看实时仪表板")
    print(f"Ctrl+C 停止服务")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.shutdown()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    start_server(port)
