# 经典模式规则核对

本项目使用用户提供的 Fruit Ninja 3.39.3 APKM 里的美术与音频，游戏逻辑为 H5 重新实现。APK 中不存在或尚未确认的素材不以手绘/生成图片替代。

| 条目 | 当前实现 |
| --- | --- |
| 3 次机会、普通水果漏掉扣一次 | 已实现 |
| 切中炸弹结束 | 已实现；切中后立即停止接受切割输入，播放爆炸再显示结算 |
| 每跨过 100 分补回一次机会 | 已实现；最多 3 次，不储存满生命时的补命奖励；一次加分跨多个门槛也正确处理 |
| 三果及以上连击 | 已实现；n 个普通水果基础 n 分，额外奖励 n 分，合计 2n 分 |
| 暴击 | 已实现；经典模式随机额外 +10 分，不是根据是否切中几何中心判断 |
| 难度递增 | 已实现；时间和得分同时影响密度、抛射速度与炸弹概率 |
| 16 种普通水果 | 已实现，均有 APK 原始完整模型及两半模型 |
| 石榴 | 已实现；从侧面出现、首次切中后悬停、多次挥刀计数、到时爆裂并按命中数加分 |
| 火龙果 | 已实现；经典模式稀有出现，切开 +50 分 |
| 特殊水果漏掉不扣命 | 已实现；石榴、火龙果均不扣机会 |
| 杨桃“加 150～200 分” | 未采用此规则；资料混淆了杨桃货币奖励与本局得分，没有实现杨桃货币系统 |
| 特殊香蕉、刀刃能力、护盾和商店 | 未实现；本项目聚焦基础经典模式，另附 90 秒禅模式 |

## 素材证据

- `dist/assets/fruits/sources.json`：16 种普通水果的 Unity 文件、path ID、原始 Mesh 名称、FruitAtlas 来源和渲染角度。
- `dist/assets/fruits/pomegranate-sources.json`：原始石榴及 8 块爆裂模型，材质 Pomegranate。
- `dist/assets/fruits/dragonfruit-sources.json`：原始 DragonWhole、DragonHalfTop、DragonHalfBottom，材质 FruitAtlas。
- `dist/assets/fruits/bomb-sources.json`：原始 bomb 模型及 BombRedCross 材质。
- `dist/assets/audio-sources.json`：18 个原版音效的 Unity 来源。
- 完整安装包、原始 OBJ/PNG 与额外参考素材保留在本地 reference 目录，不上传整个 APK。

## 规则来源与实现参数

Halfbrick 官方指南明确说明“三个以上水果连击使这组基础分翻倍”、“暴击随机发生并额外加 10 分”，以及强化香蕉属于街机模式：
https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja

三次漏果、100 分倍数补命、石榴连续切割与经典模式火龙果 +50 可与以下说明交叉核对：
https://zh.wikipedia.org/zh-cn/水果忍者
https://fruitninja.fandom.com/wiki/Dragon_Fruit

杨桃分数和货币的区分：
https://fruitninja.fandom.com/wiki/Starfruit

飞行轨迹、3% 暴击概率、连击间隔 240 ms、石榴 4.5 秒持续时间和稀有水果的生成间隔属于本项目的可调参数，没有宣称逐项恢复了 APK 的内部配置。炸弹频率围绕约六颗普通水果一次的量级调整，并随难度变化，不是固定的每六颗必定出现。

## 验证

已通过 JavaScript 语法检查和临时集成检查：快速划动碰撞、连击计分、漏果结束、炸弹结束、90 秒结算、暂停、百分快照补命、跨多个补命门槛、满生命不囤积奖励、随机暴击、石榴启动/重复事件防刷/来回划动/暂停/爆裂结算、特殊漏果不扣命、火龙果 50 分、普通水果种类和难度递增。

浏览器实测石榴 12 次命中并结算 12 分，无控制台错误；验证副本只提前石榴出现时间，正式部署不带该改动。没有新增仓库测试用例，没有运行提交前钩子。
