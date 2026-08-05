#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const workflowsDir = path.join(root, '.github', 'workflows');

const memberOrder = [
  {
    name: '小秘书',
    number: '001 / Secretary',
    role: 'Central Hub',
    folder: 'agents/secretary',
    config: 'agents/secretary/config.json',
    summary: '作为团队中枢持续维护',
    scheduleText: '每天 18:00 北京时生成日报。',
    tasks: ['任务分配', '信息汇总', '飞书推送'],
    primaryButton: { label: '查看', action: "openGitHub('agents/secretary')" },
  },
  {
    name: '摄影师',
    number: '002 / Photographer',
    role: 'Content Tracker',
    folder: 'agents/image-guardian',
    config: 'agents/image-guardian/config.json',
    summary: '保持日报链路稳定，按需优化数据展示',
    scheduleText: '每日 09:00 检查更新，进行内容分析推送。',
    tasks: ['每日数据追踪', '趋势分析', '标签优化'],
    primaryButton: { label: '查看', action: "openGitHub('agents/image-guardian')" },
  },
  {
    name: '知识管理',
    number: '003 / Knowledge',
    role: 'Data Sync',
    folder: 'agents/knowledge-keeper',
    config: 'agents/knowledge-keeper/config.json',
    summary: '持续优化同步稳定性与日志可观测性',
    scheduleText: '双源同步到 Notion。',
    tasks: ['飞书同步', 'GitLab 同步', '周报汇总'],
    primaryButton: { label: '同步', action: 'triggerSync()' },
    secondaryButton: { label: '查看', action: "openGitHub('agents/knowledge-keeper')" },
  },
  {
    name: '设计师',
    number: '004 / Designer',
    role: 'Multi-Agent Expert',
    folder: 'agents/design-infra',
    config: 'agents/design-infra/config.json',
    summary: '持续同步 Astra 与 Design Token 规范',
    scheduleText: '参与 Multi-Agent 协作。',
    tasks: ['设计系统评审', 'Token 规范维护', '设计咨询'],
    primaryButton: { label: '名片', action: 'openDesignerCard()' },
    secondaryButton: { label: '查看', action: "openGitHub('agents/design-infra')" },
  },
  {
    name: '海报设计师',
    number: '005 / Poster',
    role: 'Zine Poster Maker',
    folder: 'agents/posterdesigner',
    config: 'agents/posterdesigner/config.json',
    summary: '把上传图片/主题优化成极简 zine 纸感海报',
    scheduleText: '访达右键或拖拽进终端，随手出图。',
    tasks: ['图生图优化', 'Prompt 编译', '批量出图'],
    primaryButton: { label: '查看', action: "openGitHub('agents/posterdesigner')" },
  },
];

const archivedMembers = [
  {
    name: 'Figma 设计员工',
    capability: 'Figma 画布操作、元素创建/修改',
    launched: '2026-03-05',
    version: '无独立版本',
    retired: '2026-07-10',
    plan: '如需恢复，先从历史提交或外部备份恢复。',
  },
  {
    name: '测试QA',
    capability: '设计还原度检查、硬编码走查、报告生成',
    launched: '2026-03-05',
    version: '无独立版本',
    retired: '2026-07-10',
    plan: '如需恢复，需补回目录与任务流转入口。',
  },
];

const capabilityLabels = {
  task_dispatch: '任务分配',
  progress_monitor: '进度监控',
  report_generate: '日报生成',
  feishu_push: '飞书推送',
  stats_fetch: '每日数据追踪',
  trend_analyze: '趋势分析',
  tag_optimize: '标签优化',
  report_push: '推送汇报',
  knowledge_add: '知识收集',
  notion_sync: 'Notion 同步',
  feishu_docs_sync: '飞书同步',
  gitlab_workspace_sync: 'GitLab 同步',
  weekly_summary: '周报汇总',
  design_token_manage: '设计 Token',
  figma_sync: 'Figma 同步',
  mapping_maintain: '映射维护',
  version_control: '版本管理',
  astra_based_design: 'Astra 设计支持',
  multi_agent_collaboration: '多 Agent 协作',
  image_to_poster: '图生图优化',
  prompt_compile: 'Prompt 编译',
  style_optimize: '风格优化',
  batch_generate: '批量出图',
};

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTasks(tasks) {
  return tasks.map((task) => `<div><span class="task-marker">—</span> ${escapeHtml(task)}</div>`).join('\n');
}

function renderCard(member, index) {
  const config = readJson(member.config);
  const taskList = (config.capabilities || [])
    .map((capability) => capabilityLabels[capability] || capability)
    .slice(0, 3);
  const description = `${config.description || member.summary}。${member.scheduleText}`;
  const footerButtons = [];
  if (member.primaryButton) {
    footerButtons.push(`<button class="card-btn" onclick="${member.primaryButton.action}">${escapeHtml(member.primaryButton.label)}</button>`);
  }
  if (member.secondaryButton) {
    footerButtons.push(`<button class="card-btn" onclick="${member.secondaryButton.action}">${escapeHtml(member.secondaryButton.label)}</button>`);
  }

  return `        <div class="card">
          <div class="card-header">
            <div class="card-number">${escapeHtml(member.number)}</div>
            <div class="card-title">${escapeHtml(member.name)}</div>
          </div>
          <div class="card-body">
            <div class="card-role">${escapeHtml(member.role)}</div>
            <div class="card-desc">${escapeHtml(description)}</div>
            <div class="card-tasks">
${renderTasks(taskList)}
            </div>
          </div>
          <div class="card-footer">
            ${footerButtons.join('\n            ')}
          </div>
        </div>`;
}

function renderArchiveRow(member) {
  return `        <div class="archive-row">
          <div>
            <div class="archive-name">${escapeHtml(member.name)}</div>
            <div class="archive-tag">已离轨</div>
          </div>
          <div class="archive-value">${escapeHtml(member.capability)}</div>
          <div class="archive-value">${escapeHtml(member.launched)}</div>
          <div class="archive-value">${escapeHtml(member.version)}</div>
          <div class="archive-value">${escapeHtml(member.retired)}</div>
          <div class="archive-muted">${escapeHtml(member.plan)}</div>
        </div>`;
}

function updateText(source, id, replacement) {
  const pattern = new RegExp(`(<[^>]+id="${id}"[^>]*>)([\\s\\S]*?)(<\\/[^>]+>)`);
  return source.replace(pattern, `$1${replacement}$3`);
}

function main() {
  const workflows = fs.readdirSync(workflowsDir).filter((file) => /\.(yml|yaml)$/i.test(file));
  let html = fs.readFileSync(indexPath, 'utf8');
  const cards = memberOrder.map((member, index) => renderCard(member, index)).join('\n');
  const archiveRows = [
    `        <div class="archive-header">
          <div>名称</div>
          <div>有关能力</div>
          <div>上线时间</div>
          <div>当前版本</div>
          <div>下线时间</div>
          <div>更新计划</div>
        </div>`,
    ...archivedMembers.map((member) => renderArchiveRow(member)),
  ].join('\n');

  html = html.replace(
    /<!-- TEAM_CARDS_START -->[\s\S]*?<!-- TEAM_CARDS_END -->/,
    `<!-- TEAM_CARDS_START -->\n${cards}\n        <!-- TEAM_CARDS_END -->`
  );
  html = html.replace(
    /<!-- TEAM_ARCHIVE_START -->[\s\S]*?<!-- TEAM_ARCHIVE_END -->/,
    `<!-- TEAM_ARCHIVE_START -->\n${archiveRows}\n        <!-- TEAM_ARCHIVE_END -->`
  );
  html = updateText(html, 'activeAgentsCount', `✓ ${memberOrder.length} Active Agents`);
  html = updateText(html, 'workflowCount', `✓ ${workflows.length} Automated Workflows`);
  html = updateText(html, 'retiredAgentsCount', `✓ ${archivedMembers.length} Archived Members`);
  html = updateText(html, 'onlineAgentsLabel', `Agents Online: ${memberOrder.length}`);

  fs.writeFileSync(indexPath, html);
  console.log(`Synced team page with ${memberOrder.length} active members and ${workflows.length} workflows.`);
}

main();
