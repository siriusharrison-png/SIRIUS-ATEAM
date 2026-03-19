// Vercel Serverless Function: 飞书推送
// POST /api/push-feishu

export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, data } = req.body;

    // 根据推送类型选择对应的飞书机器人
    const webhookMap = {
      'secretary-report': process.env.FEISHU_WEBHOOK_SECRETARY,
      'photographer-stats': process.env.FEISHU_WEBHOOK_PHOTOGRAPHER,
      'knowledge-weekly': process.env.FEISHU_WEBHOOK_KNOWLEDGE,
      'test': process.env.FEISHU_WEBHOOK_SECRETARY,
    };
    const webhookUrl = webhookMap[type] || process.env.FEISHU_WEBHOOK_SECRETARY;

    if (!webhookUrl) {
      return res.status(500).json({ error: `Webhook not configured for type: ${type}` });
    }

    // 根据类型构建飞书卡片消息
    const card = buildCard(type, data);

    // 发送到飞书
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card)
    });

    const result = await response.json();

    if (result.code === 0) {
      return res.status(200).json({ success: true, message: '推送成功' });
    } else {
      return res.status(400).json({ success: false, error: result.msg });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// 格式化数字（加千位分隔符）
function formatNumber(num) {
  if (!num) return '0';
  return num.toLocaleString('zh-CN');
}

// 格式化代码变更列表
function formatChanges(changes) {
  if (!changes || changes.length === 0) {
    return '暂无近期变更记录';
  }
  return changes.map(c =>
    `• **${c.date}** ${c.author} 在 [${c.project}](${c.repo})\n  ${c.action}`
  ).join('\n\n');
}

// 格式化周变化
function formatWeeklyChange(change) {
  if (!change) return '';
  return `**📈 近 7 天变化**\n下载 ${change.downloads} · 浏览 ${change.views} · 点赞 ${change.likes}`;
}

// 构建飞书卡片消息
function buildCard(type, data) {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const templates = {
    // 小秘书日报 - 展示最近代码变更
    'secretary-report': {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: '📋 SIRIUS TEAM 工作日报' },
          template: 'blue'
        },
        elements: [
          {
            tag: 'div',
            text: { tag: 'lark_md', content: `**推送时间**: ${now}` }
          },
          {
            tag: 'div',
            text: { tag: 'lark_md', content: '**📝 今日代码变更**' }
          },
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              // 支持直接传 content 字符串，或 changes 数组
              content: data?.content || formatChanges(data?.changes)
            }
          },
          { tag: 'hr' },
          {
            tag: 'note',
            elements: [{ tag: 'plain_text', content: 'From SIRIUS TEAM · 小秘书' }]
          }
        ]
      }
    },

    // 摄影师数据推送 - 展示具体数据
    'photographer-stats': {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: '📸 Unsplash 数据更新' },
          template: 'green'
        },
        elements: [
          {
            tag: 'div',
            text: { tag: 'lark_md', content: `**统计日期**: ${data?.stats?.date || now}` }
          },
          {
            tag: 'column_set',
            flex_mode: 'none',
            background_style: 'grey',
            columns: [
              {
                tag: 'column',
                width: 'weighted',
                weight: 1,
                elements: [{
                  tag: 'div',
                  text: { tag: 'lark_md', content: `**下载量**\n${formatNumber(data?.stats?.downloads)}` }
                }]
              },
              {
                tag: 'column',
                width: 'weighted',
                weight: 1,
                elements: [{
                  tag: 'div',
                  text: { tag: 'lark_md', content: `**浏览量**\n${formatNumber(data?.stats?.views)}` }
                }]
              },
              {
                tag: 'column',
                width: 'weighted',
                weight: 1,
                elements: [{
                  tag: 'div',
                  text: { tag: 'lark_md', content: `**点赞数**\n${formatNumber(data?.stats?.likes)}` }
                }]
              }
            ]
          },
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: formatWeeklyChange(data?.stats?.weeklyChange)
            }
          },
          { tag: 'hr' },
          {
            tag: 'note',
            elements: [{ tag: 'plain_text', content: 'From SIRIUS TEAM · 摄影师' }]
          }
        ]
      }
    },

    // 知识管理周报
    'knowledge-weekly': {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: '📚 本周学习汇总' },
          template: 'purple'
        },
        elements: [
          {
            tag: 'div',
            text: { tag: 'lark_md', content: `**推送时间**: ${now}` }
          },
          {
            tag: 'div',
            text: { tag: 'lark_md', content: data?.content || '本周暂无新增知识条目。' }
          },
          { tag: 'hr' },
          {
            tag: 'note',
            elements: [{ tag: 'plain_text', content: 'From SIRIUS TEAM · 知识管理' }]
          }
        ]
      }
    },

    // 通用测试消息
    'test': {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: '🔔 SIRIUS TEAM 测试消息' },
          template: 'turquoise'
        },
        elements: [
          {
            tag: 'div',
            text: { tag: 'lark_md', content: `**时间**: ${now}` }
          },
          {
            tag: 'div',
            text: { tag: 'lark_md', content: '✅ 推送服务连接正常！' }
          }
        ]
      }
    }
  };

  return templates[type] || templates['test'];
}
