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

  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'Webhook URL not configured' });
  }

  try {
    const { type, data } = req.body;

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

// 构建飞书卡片消息
function buildCard(type, data) {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const templates = {
    // 小秘书日报
    'secretary-report': {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: '📋 SIRIUS TEAM 日报' },
          template: 'blue'
        },
        elements: [
          {
            tag: 'div',
            text: { tag: 'lark_md', content: `**推送时间**: ${now}` }
          },
          {
            tag: 'div',
            text: { tag: 'lark_md', content: data?.content || '今日团队状态正常，各 Agent 运行良好。' }
          },
          { tag: 'hr' },
          {
            tag: 'note',
            elements: [{ tag: 'plain_text', content: 'From SIRIUS TEAM · 小秘书' }]
          }
        ]
      }
    },

    // 摄影师数据推送
    'photographer-stats': {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: '📸 Unsplash 数据日报' },
          template: 'green'
        },
        elements: [
          {
            tag: 'div',
            text: { tag: 'lark_md', content: `**推送时间**: ${now}` }
          },
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: data?.content || '📊 今日 Unsplash 数据已更新\n\n[查看详情](https://unsplash.com/@siriusharrison/stats)'
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
