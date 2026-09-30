// 被服务端 esbuild 打包成浏览器 IIFE：挂载 @remotion/player 预览当前 generated 组件。
// 暴露 window.__ml.mount(el, props, durationSec) 与 window.__ml.update(props)。
import React from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import Comp, { propsSchema } from "../remotion/generated/current";

const FPS = 30;
let root = null;
let current = { props: {}, durationSec: 15 };

function render() {
  root.render(
    React.createElement(Player, {
      component: Comp,
      inputProps: current.props,
      durationInFrames: Math.round(current.durationSec * FPS),
      fps: FPS,
      compositionWidth: 1920,
      compositionHeight: 1080,
      style: { width: "100%" },
      controls: true,
      loop: true,
    }),
  );
}

window.__ml = {
  defaults: (() => {
    try {
      return propsSchema.parse({});
    } catch {
      return {};
    }
  })(),
  mount(el, props, durationSec) {
    current = { props: props ?? {}, durationSec: durationSec ?? 15 };
    root = createRoot(el);
    render();
  },
  update(props) {
    current.props = props;
    render();
  },
};
