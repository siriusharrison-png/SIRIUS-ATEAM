/**
 * hub.json Schema Documentation
 * 
 * Agent 协作中枢的完整数据结构定义
 * Version: 1.1.0
 */

{
  "rulesVersion": "1.1.0",
  "lastUpdated": "2026-07-22T00:00:00+08:00",
  
  // ==================== Agent 状态 ====================
  "agents": {
    "摄影师": {
      "name": "摄影师",
      "name_en": "image-guardian",
      "description": "Unsplash 每日数据采集与飞书推送",
      "status": "active",  // active | busy | error | idle | offline
      "lastSeen": "2026-07-22T10:00:00+08:00",
      "lastError": null,  // 最后一次错误信息，null 表示无错误
      "nextScheduled": "2026-07-23T09:00:00+08:00",  // 下次预计运行时间
      
      // 统计信息
      "stats": {
        "runCount": 42,       // 总运行次数
        "successCount": 40,   // 成功次数
        "failureCount": 2,    // 失败次数
        "successRate": 0.952  // 成功率 (0-1)
      },
      
      // 最后运行的任务结果（可选）
      "lastResult": {
        "date": "2026-07-22",
        "duration": 45,  // 执行耗时（秒）
        "data": {
          "downloads": 1234,
          "views": 5678,
          "likes": 89,
          "new_downloads": 12
        }
      }
    },
    
    "知识管理": {
      "name": "知识管理",
      "name_en": "knowledge-keeper",
      "description": "飞书和 GitLab 文件同步到 Notion",
      "status": "active",
      "lastSeen": "2026-07-22T04:00:00+08:00",
      "lastError": null,
      "nextScheduled": "2026-07-23T00:00:00+08:00",
      
      "stats": {
        "runCount": 50,
        "successCount": 49,
        "failureCount": 1,
        "successRate": 0.98
      },
      
      // 子任务状态（知识管理包含两个独立同步）
      "subTasks": {
        "sync-feishu": {
          "status": "active",
          "lastSeen": "2026-07-22T08:00:00+08:00",
          "lastError": null
        },
        "sync-gitlab": {
          "status": "active",
          "lastSeen": "2026-07-22T12:00:00+08:00",
          "lastError": null
        }
      }
    },
    
    "秘书": {
      "name": "秘书",
      "name_en": "secretary",
      "description": "每日工作日报生成与推送",
      "status": "active",
      "lastSeen": "2026-07-21T18:00:00+08:00",
      "lastError": null,
      "nextScheduled": "2026-07-22T18:00:00+08:00",
      
      "stats": {
        "runCount": 30,
        "successCount": 29,
        "failureCount": 1,
        "successRate": 0.967
      }
    }
  },

  // ==================== 消息队列 ====================
  "messages": [
    {
      "id": "msg-20260722-001",
      "timestamp": "2026-07-22T10:00:15+08:00",
      "from": "摄影师",
      "to": "系统",
      "type": "update",              // update | alert | task | status
      "priority": "normal",           // normal | high | critical
      "status": "done",               // pending | processing | done | failed
      
      "content": {
        "action": "daily_report_sent",
        "summary": "完成每日数据采集与飞书推送"
      },
      
      // 详细数据（可选）
      "data": {
        "downloads": 1234,
        "views": 5678,
        "likes": 89,
        "new_downloads": 12,
        "trending": ["wallpapers", "nature", "travel"]
      },
      
      // 关联的 Agent 任务 ID（可选，用于追踪）
      "taskId": "task-20260722-0901",
      
      // TTL：消息在 24 小时后自动过期
      "expiresAt": "2026-07-23T10:00:15+08:00"
    },
    
    {
      "id": "msg-20260722-002",
      "timestamp": "2026-07-22T04:05:30+08:00",
      "from": "知识管理",
      "to": "系统",
      "type": "update",
      "priority": "normal",
      "status": "done",
      
      "content": {
        "action": "sync_completed",
        "summary": "飞书文档同步完成"
      },
      
      "data": {
        "source": "feishu",
        "new_count": 3,
        "updated_count": 2,
        "cache_size": 45
      },
      
      "expiresAt": "2026-07-23T04:05:30+08:00"
    },
    
    {
      "id": "msg-20260722-003",
      "timestamp": "2026-07-21T18:05:45+08:00",
      "from": "秘书",
      "to": "系统",
      "type": "alert",
      "priority": "high",
      "status": "done",
      
      "content": {
        "action": "report_sent",
        "summary": "每日工作日报已推送"
      },
      
      "data": {
        "date": "2026-07-21",
        "devices": 3,
        "total_usage": "4.5h"
      },
      
      "expiresAt": "2026-07-22T18:05:45+08:00"
    }
  ],

  // ==================== 待办任务 ====================
  "tasks": [
    {
      "id": "task-20260722-0901",
      "createdAt": "2026-07-22T09:00:00+08:00",
      "createdBy": "github-actions",
      "type": "daily_report",
      "status": "completed",  // pending | in_progress | completed | failed
      
      "agent": "摄影师",
      "description": "每日数据采集与飞书推送",
      
      "scheduledFor": "2026-07-22T09:00:00+08:00",
      "startedAt": "2026-07-22T09:00:05+08:00",
      "completedAt": "2026-07-22T10:00:15+08:00",
      "duration": 60,  // 秒
      
      "result": {
        "success": true,
        "message": "任务完成"
      }
    }
  ],

  // ==================== 系统配置 ====================
  "config": {
    "logLevel": "INFO",  // DEBUG | INFO | WARNING | ERROR | CRITICAL
    "retryPolicy": {
      "maxRetries": 3,
      "initialDelay": 1,   // 秒
      "maxDelay": 60,      // 秒
      "backoffMultiplier": 2
    },
    "messageTTL": 86400,   // 消息保留时长（秒，默认 24 小时）
    "maxMessages": 1000,   // 消息队列最大条数，超过则删除最旧的
    "lockTimeout": 30      // 文件锁超时（秒）
  },

  // ==================== 监控告警 ====================
  "monitoring": {
    "alerts": [
      {
        "id": "alert-001",
        "severity": "high",
        "type": "agent_failure",
        "agent": "知识管理",
        "subTask": "sync-gitlab",
        "message": "GitLab 同步失败：401 Unauthorized",
        "firstSeen": "2026-07-21T12:00:00+08:00",
        "lastSeen": "2026-07-21T12:00:00+08:00",
        "count": 1,
        "resolved": false
      }
    ],
    
    "healthChecks": {
      "lastRun": "2026-07-22T12:00:00+08:00",
      "status": "healthy",  // healthy | degraded | unhealthy
      "issues": []
    }
  },

  // ==================== 变更日志 ====================
  "changelog": {
    "version": "1.1.0",
    "changes": [
      {
        "date": "2026-07-22",
        "version": "1.1.0",
        "description": "添加 subTasks、taskId、expiresAt 等字段，支持更详细的任务追踪"
      },
      {
        "date": "2026-07-21",
        "version": "1.0.0",
        "description": "初版 hub.json 架构"
      }
    ]
  }
}

/**
 * 使用指南
 * 
 * 1. Agent 状态更新
 *    HubManager.update_agent_status("摄影师", "active")
 *    
 * 2. 发送消息
 *    hub.add_message("摄影师", "update", "完成每日采集", data={...})
 *    
 * 3. 查询消息
 *    recent = hub.get_recent_messages("摄影师", limit=10)
 *    
 * 4. 获取日报
 *    summary = hub.export_daily_summary()
 * 
 * 5. 监控告警
 *    - 检查 monitoring.alerts
 *    - 定期运行 health checks
 */
