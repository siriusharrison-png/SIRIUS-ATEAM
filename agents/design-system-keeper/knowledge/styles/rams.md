# 拉姆斯风格（Rams）— 风格档案

- **状态**：MVP 演示
- **仓库**：https://github.com/siriusharrison-png/rams-system
- **在线 Playground**：https://rams-system.vercel.app

## 设计理念

以 Dieter Rams 的 Braun 器物为参照的拟物控件体系：真实材质质感、克制的配色、清晰的功能表达。控件只认「材质契约」，不认具体材质，一处切换即可换肤。

## 材质契约（9 个 `--surface-*` 变量）

所有材质实现同一组契约，`data-material` 挂在容器上，其下控件继承换肤：

| 变量 | 含义 | 变量 | 含义 |
| --- | --- | --- | --- |
| `--surface-case` | 外壳面 | `--surface-knob` | 旋钮面 |
| `--surface-text` | 主文字 | `--surface-text-2` | 次文字 |
| `--surface-sh-raised` | 凸起阴影 | `--surface-sh-inset` | 凹陷阴影 |
| `--surface-border` | 描边 | `--surface-groove` | 凹槽 |
| `--surface-backdrop` | 磨砂滤镜（仅玻璃赋值，默认 none） | | |

## 控件清单

- **atoms（14）**：Checkbox、ConvexKey、Display、Fader、JewelLamp、LED、LevelMeter、MagicEye、Nameplate、NumKey、RadioButton、ReflexBar、Rocker、RotarySelector、Slider、SpeakerGrille、SpeedRing、Stepper、Thumbwheel、TunerScale（以仓库 `src/atoms/index.ts` 为准）
- **modules（3）**：以仓库 `src/modules/` 为准
- **devices（4）**：CalculatorET66、MixerChannelMX、RadioT3 等，以仓库 `src/devices/` 为准

> 控件清单以 rams-system 仓库实际导出为准；本档案记录风格定位与契约，不复制代码。
