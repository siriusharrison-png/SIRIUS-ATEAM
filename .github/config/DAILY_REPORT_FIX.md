# 日报推送修复说明

## 修复内容

### 1. 用量统计不全 ✅
**问题**：project 中独立 Claude 会话的用量没有被汇总到设备日报中

**解决方案**：
- 在 `secretary-daily.yml` 中添加 "Collect device insights from all machines" 步骤
- 该步骤会扫描本地 `~/.claude/usage-data/devices` 目录
- 收集最近 3 天的日报数据，复制到临时工作目录
- 确保所有设备的使用统计都被纳入最终报告

**关键改进**：
- 从 GitHub Actions 环境直接访问本地设备数据
- 支持多设备数据聚合
- 只同步最近的数据以避免过期信息

### 2. Claude Code 日报关闭 ✅
**问题**：Claude Code 日报推送为空且无关信息

**解决方案**：
- 创建 `.github/config/daily-report-config.json` 配置文件
- 在工作流中添加 `DISABLE_CLAUDE_CODE_REPORT: 'true'` 环境变量
- 仅保留"Claude 小秘书日报"推送

**配置文件结构**：
```json
{
  "reports": {
    "secretary": { "enabled": true },
    "claude-code": { "enabled": false },
    "device": { "enabled": true, "aggregateAllDevices": true }
  }
}
```

## 文件修改

### 修改的文件
- `.github/workflows/secretary-daily.yml` - 添加设备数据收集步骤和推送配置

### 新建文件
- `.github/config/daily-report-config.json` - 日报推送配置

## 后续同步需求

由于 `claude-config` 是私有仓库，需要在那里同步以下支持：
1. 更新 `merge-daily-insights.py` 脚本以支持 `DISABLE_CLAUDE_CODE_REPORT` 环境变量
2. 使脚本能够读取 `REPORT_CONFIG` 配置文件
3. 确保设备数据聚合逻辑正确处理多个设备的数据

## 测试方式

可以在 GitHub Actions 界面手动触发工作流：
1. 进入 "Secretary Daily Report" 工作流
2. 点击 "Run workflow" 按钮
3. 检查输出日志中的数据收集步骤
4. 验证飞书推送是否只显示"小秘书日报"

## 日期
修复于 2026-07-22
