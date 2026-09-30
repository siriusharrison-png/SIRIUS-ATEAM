import { Composition } from "remotion";
import Comp, { propsSchema } from "./generated/current";

// generated/current.tsx 由 server 每次生成时覆盖写入；默认回退到 placeholder。
// server 渲染时通过 selectComposition 用真实 props 覆盖 durationInFrames。
const fps = 30;

export const Root: React.FC = () => (
  <Composition
    id="Motion"
    component={Comp as React.FC<Record<string, unknown>>}
    durationInFrames={fps * 15}
    fps={fps}
    width={1920}
    height={1080}
    defaultProps={propsSchema.parse({}) as Record<string, unknown>}
  />
);
