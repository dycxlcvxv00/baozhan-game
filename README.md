# 《爆战丨无限弹幕》· 横版数值验证沙盒（web demo）

PixiJS 横版原型，设计尺寸 **1920×1080**，用于玩法「数值验证沙盒」。

## 🔗 固定测试链接（永不换址）

> **https://dycxlcvxv00.github.io/baozhan-game/**

- 由 **GitHub Pages** 托管，源 = 本仓库 `main` 分支 **根目录的 `index.html`**。
- **链接恒定**：无论更新多少次，地址不变。这与「每次发布生成新地址」的做法相反——
  同域名意味着 localStorage 存档同源，测试进度不会因为换链接而丢档。
- **更新方式**：改完代码 `git push` 到 `main`，Pages 在 1~2 分钟内自动生效。
- 看到旧内容先强刷：Windows `Ctrl+Shift+R` / macOS `Cmd+Shift+R`。
- 存档写在 `localStorage`，同浏览器同域名自动续接。

开发过程文档（玩法进度 / 避坑 / 变更日志）在 **Notion《demo 开发文档》**；
**代码唯一真相源是本仓库**，两侧分工见下方「维护规则」。

## 目录结构

```
index-h.html            开发入口（多文件）：:root CSS 变量、DOM 骨架、模块化 <script> 引用
index.html              构建产物 · Pages 发布入口 · 双击即玩下载版（勿手改）
js/
  pixi.min.js           第三方库 PixiJS v7.4.2（vendored，一般不改）
  runes.js              符文矩阵 + 装备系统（符文数值 / EQUIP_SLOTS / EQUIP_PRESETS）
  game-h.js             横版战斗主循环 + 第13章 29 项属性 + 伤害结算 + 坐标常量
  equip-panel.js        装备面板（10 部位 / 右键卸装备 / 屏蔽右键菜单与文字选中）
  char-panel.js         角色属性面板（6 主属性 / 6 元素 / 4 分类 tab / hover 词缀 tooltip）
  skill-panel.js        技能面板（2×2 技能格 + Last Epoch 弹窗，数值待同步主文档 7.4）
build_single.cjs        多文件 → 零依赖单文件构建脚本
.github/workflows/
  pages-sync.yml        push 源码后自动重建 index.html（防忘记打包导致线上不同步）
.nojekyll               禁用 Jekyll 处理，确保 Pages 原样发布
```

> 2026-09-04 清理：已删除与 `index.html` **字节完全相同**的 `index-h-single.html`
> （510KB 冗余）。双击即玩请直接下载 `index.html`，内容一致。

## 本地开发

```bash
git clone git@github.com:dycxlcvxv00/baozhan-game.git /workspace/baozhan-game
cd /workspace/baozhan-game

# 1) 起静态服务（多文件版必须走服务，双击 index-h.html 会白屏，见避坑指南 1）
python3 -m http.server 8200     # 浏览器打开 http://localhost:8200/index-h.html

# 2) 改代码 —— 只动对应模块，不要动 index.html
#    改布局 / 配色 / 面板结构 → index-h.html 的 :root 变量与 DOM
#    改符文 / 装备数值       → js/runes.js
#    改战斗逻辑 / 坐标常量   → js/game-h.js
#    改装备 UI               → js/equip-panel.js
#    改属性面板              → js/char-panel.js
#    改技能展示              → js/skill-panel.js

# 3) 改完重打包（必须）
node build_single.cjs
```

## 提交与发布

```bash
node build_single.cjs
git add -A && git commit -m "说明改了什么" && git push origin main
```

push 后访问固定链接即可看到最新版，**无需任何手动部署动作**。
若漏跑第 1 步，`pages-sync.yml` 会在 CI 里补打并自动提交。

## 维护规则（代码侧）

1. **真相源分层**：本仓库 = 代码唯一真相源；Notion《demo 开发文档》= 开发过程文档
   （进度 / 避坑 / 变更日志）。源码不复制进 Notion，避免双份分叉。
2. **产物不手改**：`index.html` 由 `build_single.cjs` 从 `index-h.html` + `js/*` 生成，
   手工改动会在下次构建被覆盖。
3. **改动闭环**：改模块 → `node build_single.cjs` → `git push` → 链接自动更新
   → 在 Notion ⑨ 变更日志追加一条。
4. **玩法设定不在这里立**：设定改动写进主文档《爆战丨无限弹幕》，本仓库只同步实现。
5. `js/pixi.min.js` 为第三方库，一般不改。
6. `js/skill-panel.js` 的 `SKILLS` 数组数值为占位，待从主文档 7.4 同步精确平衡值。

## 避坑指南（精简版）

| # | 坑 | 表现 | 解法 |
|---|---|---|---|
| 1 | 多文件版双击打开 | `index-h.html` 白屏 | `file://` 下 `<script src>` 被 CORS 拦截、PixiJS 未定义。多文件版**必须**起 http 服务；想双击直接玩用 `index.html` |
| 2 | 打包注入游离标签 | 页面崩坏、报脚本错误 | PixiJS 源码含 `$&` / `` $` `` / `$'`，用 `String.replace(re, content)` 会被当作替换模式解析。`build_single.cjs` 已改用**函数返回值**替换 |
| 3 | 忘记打包就 push | 线上停在旧版 | 先 `node build_single.cjs`；`pages-sync.yml` 兜底 |
| 4 | 换测试链接 | 玩家丢档 | 固定链接永不变，域名即存档域 |
| 5 | 坐标散落硬编码 | 布局改一处坏一片 | `BW/BH/DEF_X/WALL_X/SPAWN_X/LANES` 全在 `js/game-h.js`，只改常量 |
| 6 | 改视觉动内联样式 | 配色不一致 | 只动 `index-h.html` 的 `:root` 变量 |
| 7 | 暴击不涨 | 以为数值 bug | `onHitCritBuild` 有装备门控，须穿带该特效的装备（默认「烈阳长刃」），卸下立即归零 |
| 8 | 沙箱连不上 GitHub | `gnutls_handshake() failed` / `Permission denied` | 见「新会话接续」第 1 步，跑项目资产《GitHub 连接》第 0 步 |
| 9 | `/workspace` 内容消失 | 新会话目录是空的 | 沙箱不跨会话持久，**任何东西都要 push 回本仓库**才安全 |

完整版见 Notion ⑦ 避坑指南。

## 新会话接续（三步走）

```bash
# ① 连 GitHub：跑项目资产《GitHub 连接》第 0 步（写 SSH key + 硬编码 hosts + 锁 TLS1.2）
#    验证成功标志：ssh -T git@github.com 返回 "Hi dycxlcvxv00!"
git clone git@github.com:dycxlcvxv00/baozhan-game.git /workspace/baozhan-game

# ② 看效果：起服务看多文件版，或直接用固定测试链接
cd /workspace/baozhan-game && python3 -m http.server 8200

# ③ 改代码 → 打包 → push → 链接自动更新
node build_single.cjs && git add -A && git commit -m "..." && git push origin main
```

> 本仓库是 **public（公开仓）**，不是私有仓——早期文档里「GitHub 私有仓」的表述已作废。
