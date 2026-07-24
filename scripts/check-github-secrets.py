#!/usr/bin/env python3
"""
GitHub Secrets 检查工具
验证所有必需的 Secret 是否已配置

用法:
  python scripts/check-github-secrets.py
"""

import sys
import json
from pathlib import Path

# 定义所有工作流所需的 Secrets
REQUIRED_SECRETS = {
    "daily.yml": [
        "UNSPLASH_ACCESS_KEY",
        "UNSPLASH_USERNAME",
        "FEISHU_WEBHOOK_PHOTOGRAPHER",
    ],
    "knowledge-sync.yml": [
        "FEISHU_APP_ID",
        "FEISHU_APP_SECRET",
        "FEISHU_NODE_TOKEN",  # ← 这个缺失了!
        "GITLAB_TOKEN",
        "NOTION_API_KEY",
        "NOTION_DATABASE_ID",
    ],
    "secretary-daily.yml": [
        "CONFIG_REPO_TOKEN",
        "FEISHU_WEBHOOK_SECRETARY",
    ],
    "deploy.yml": [
        # deploy 工作流不需要额外的 Secret
    ],
    "global": [
        "FEISHU_WEBHOOK_SECRETARY",  # 用于所有工作流的失败告警
    ]
}

def parse_workflows():
    """解析 .github/workflows 中的所有工作流"""
    workflows_dir = Path(".github/workflows")
    workflows = {}

    if not workflows_dir.exists():
        print("❌ 错误：.github/workflows 目录不存在")
        return workflows

    for yml_file in sorted(workflows_dir.glob("*.yml")):
        with open(yml_file, 'r') as f:
            content = f.read()
            workflows[yml_file.name] = content

    return workflows

def extract_secrets_from_workflow(content):
    """从工作流 YAML 中提取使用的 Secret"""
    import re
    pattern = r'\$\{\{\s*secrets\.([A-Z_]+)\s*\}\}'
    matches = re.findall(pattern, content)
    return sorted(set(matches))

def check_secrets():
    """检查所有 Secret 配置"""
    print("🔐 GitHub Secrets 检查工具")
    print("=" * 70)
    print()

    workflows = parse_workflows()

    if not workflows:
        print("⚠️  未找到工作流文件")
        return 1

    print(f"找到 {len(workflows)} 个工作流文件")
    print()

    all_required = set()
    all_found = set()
    issues = []

    for workflow_name in sorted(workflows.keys()):
        print(f"📄 {workflow_name}")

        content = workflows[workflow_name]
        found_secrets = extract_secrets_from_workflow(content)
        required = REQUIRED_SECRETS.get(workflow_name, [])

        if found_secrets:
            all_found.update(found_secrets)

            for secret in sorted(found_secrets):
                if secret in required or secret in REQUIRED_SECRETS.get("global", []):
                    print(f"   ✅ ${{{{{secret}}}}}")
                else:
                    print(f"   ⚠️  ${{{{{secret}}}}} (未在清单中)")

        # 检查缺失的 Secret
        missing = set(required) - set(found_secrets)
        if missing:
            for secret in sorted(missing):
                print(f"   ❌ ${{{{{secret}}}}} (MISSING)")
                issues.append((workflow_name, secret))

        all_required.update(required)
        print()

    # 汇总报告
    print("=" * 70)
    print("📊 汇总")
    print()
    print(f"总共需要: {len(all_required)} 个 Secret")
    print(f"已在工作流中使用: {len(all_found)} 个 Secret")
    print()

    if issues:
        print("⚠️  问题清单:")
        print()
        for workflow, secret in issues:
            print(f"  [{workflow}] 缺失: {secret}")
        print()
        print(f"总共 {len(issues)} 个缺失的 Secret")
        print()
        print("解决步骤:")
        print("1. 访问: https://github.com/siriusharrison-png/SIRIUS-ATEAM/settings/secrets/actions")
        print("2. 点击 'New repository secret'")
        print("3. 添加缺失的 Secret")
        print()
        return 1
    else:
        print("✅ 所有必需的 Secret 都已配置！")
        return 0

if __name__ == "__main__":
    sys.exit(check_secrets())
