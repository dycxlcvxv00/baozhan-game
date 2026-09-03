# 《爆战丨无限弹幕》· 横版数值验证沙盒（web demo）

PixiJS 横版原型，设计尺寸 **1920×1080**，作为玩法「数值验证沙盒」。
本仓库是**代码唯一真源（single source of truth）**；`index-h-single.html` / `index.html`
是 `build_single.cjs` 内联打包出的零依赖产物（双击即玩 / 对外发布用），不要手工改。

## 目录结构

```
index-h.html          多文件开发入口：:root CSS 变量、DOM 骨架、模块化 <script> 引用
js/
  pixi.min.js        第三方库 PixiJS v7.4.2（vendored，一般不改）
  runes.js           符文矩阵 + 装备系统（符文数值 / EQUIP 槽位 / 预设）
  game-h.js          横版战斗主循环 + 第13章 29 项属性 + 伤害结算 + 坐标常量
  equip-panel.js     装备面板（10 部位 / 右键卸装备 / 屏蔽右键菜单与文字选中）
  char-panel.js      角色属性面板（6 主属性 / 6 元素 / 4 分类 tab / hover 词缀 tooltip）
  skill-panel.js     技能面板（2×2 技能格 + Last Epoch 弹窗；按⑩补齐，数据待同步主文档 7.4）
build_single.cjs     多文件 → 零依赖单文件构建脚本
index.html           构建产物（发布入口，内容与 index-h-single.html 相同）
index-h-single.html  构建产物（双击即玩）
```

## 本地开发

```bash
# 1) 起静态服务（多文件版必须走服务，双击 index-h.html 会白屏）
python3 -m http.server 8200
#    浏览器打开 http://localhost:8200/index-h.html

# 2) 改代码：只动 js/ 下对应模块
#    改布局 / 配色 → index-h.html 的 :root 变量与 DOM
#    改符文 / 装备数值 → js/runes.js
#    改战斗逻辑 / 坐标 → js/game-h.js
#    改属性面板 → js/char-panel.js

# 3) 改完重打包
node build_single.cjs
```

## 提交与发布

```bash
git add -A && git commit -m "..." && git push origin main
# 发布：用固定测试链接（重复发布保持同一地址，会话续接不丢档）
```

## 维护规则

- 源码真相源 = 本 GitHub 仓；单文件版仅为「双击即玩」运行副本。
- 任一模块改动后：重跑 `build_single.cjs` → `git commit && git push` → 在开发文档⑨变更日志追加记录。
- 玩法设定改动写进主文档《爆战丨无限弹幕》，本仓库只同步实现。
- `js/pixi.min.js` 为第三方库，一般不改。
- `skill-panel.js` 的 `SKILLS` 数组数值为占位，待从主文档 7.4 同步精确平衡值。
