// 拼 LLM 消息：系统 prompt 写死契约要求；自愈重试时把上次错误回喂。
export function buildMessages(userDesc, priorError) {
  const system = `你为 Remotion 生成一个动画组件。硬性要求：
1) export default 一个 React 组件；export const propsSchema = z.object({...})（每个字段必须 .default(...)）。
2) 所有可变内容（文案/颜色/时长/速度等）走 props，不许写死。
3) 用 useCurrentFrame()/interpolate() 做帧驱动动画；从 props 读取可调参数。
4) 从 "remotion" import 所需 API，从 "zod" import z。
5) 只输出代码，不要解释、不要 markdown 围栏。`;

  const messages = [
    { role: "system", content: system },
    { role: "user", content: userDesc },
  ];
  if (priorError) {
    messages.push({
      role: "user",
      content: `上次生成的代码校验失败（${priorError}），请修正后重新输出完整代码。`,
    });
  }
  return messages;
}
