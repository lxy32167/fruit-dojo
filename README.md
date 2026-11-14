# 水果道场 · Fruit Dojo

用原生 HTML、CSS 和 Canvas 2D 实现的经典切水果小游戏。独立于上级目录的水果合成游戏，无框架、无构建、无运行时 CDN。

## 在线试玩

游戏网址：https://lxy32167.github.io/fruit-dojo/

源码仓库：https://github.com/lxy32167/fruit-dojo

GitHub Actions 将 `main` 分支的 `dist/` 发布到 GitHub Pages。推送后自动更新，iPad 可在 Safari 中打开并添加到主屏幕。

## 启动

双击 `启动游戏.command`，或者运行：

```sh
cd fruit-ninja
python3 serve.py
```

电脑打开 http://localhost:5175。iPad 连接同一 Wi-Fi，访问终端显示的局域网地址。电脑需保持运行；端口冲突时可用 `PORT=5176 python3 serve.py`。

## 玩法

- 经典模式：漏掉 3 颗水果或切中炸弹即结束，难度随时间逐渐提升。
- 禅模式：90 秒倒计时，不生成炸弹，不惩罚漏果。
- 鼠标按住拖动或手指划过水果，支持多点触摸。每颗水果 1 分；一次连续切割切中至少 3 颗，再获得等于水果数量的连击奖励。相邻命中间隔超过 240 ms 分为两次切割。
- 水果沿刀锋方向分为两半，包含果肉、飞溅、残留果汁、刀光和音效。
- 右上角开关声音、全屏、查看玩法；游戏中点击暂停或按 Esc / P。
- 切换页面、窗口失去焦点或调整尺寸时自动暂停。最高分按模式分别保存在当前浏览器，本局进度不跨刷新保存。
- iPad Safari 不支持网页全屏时，可通过分享菜单添加到主屏幕。
- HTTPS / localhost 下缓存已访问的资源，支持后续离线打开；首次使用需联网。普通局域网 HTTP 无 Service Worker 离线缓存。

## 实现

`dist/index.html` 和 `dist/styles.css` 负责界面；`dist/game.js` 负责抛射、线段碰撞、粒子、状态切换与 Web Audio；`dist/sw.js` 负责缓存。只需部署 `dist/` 即可作为静态网站运行。

逻辑为重新实现，不是原作源码；界面使用“水果道场”独立名称。本次参考用户提供的 Fruit Ninja 3.39.3 APKM，未运行安装包中的任何代码。

## 素材来源

`dist/assets/background.webp` 来自 APKM 中的 `Dojo_Basic`；`splats.webp` 来自 `FruitSplats`；基础四个 WAV 分别来自 `FruitImpactSplatter01`、`BombExplode`、`UICombo3Fruit` 和 `BombLaunch`。挥刀使用 `BladeRegularSwipe04/05/06` 三个随机变体，苹果切开使用 `FruitImpactMediumCrunchy02`，西瓜和桃子使用 `FruitImpactBigWet01`。完整音频来源见 `dist/assets/audio-sources.json`。原始解析记录保存在上级 `reference/fruit-ninja-3.39.3/`，不随网站发布。素材原有权利归属不变，本项目不授予其再分发或商业使用许可。六种水果的完整外观和切开后的果肉均使用 APK 原始 Mesh + FruitAtlas 材质渲染成透明 WebP，位于 `dist/assets/fruits/`，不再使用程序绘制的水果。模型与材质来源记录见该目录的 `sources.json`；离线渲染脚本位于 `tools/render-fruit-assets.py`。刀光、图标与界面为本项目实现。

## 验证

已运行 JavaScript 语法检查、针对实际游戏函数的临时集成检查，并在浏览器实际拖动切水果、检查漏果结算与暂停。已检查 1024×768 和 768×1024 的 iPad 视口布局。尚未在真实 iPad 上验证帧率、音频与多指操作。

未新增仓库测试文件，未运行提交钩子。
