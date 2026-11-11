# 爆站游戏台账

《爆战丨无限弹幕》账号运营台账：**角色晶石台账**（收支闭合 / 来源分桶 / 转移模型）
与**打图经验台账**（升级记录 / 8 点结算口径）。

## 🔗 固定链接（GitHub Pages，永不换址）

> **https://dycxlcvxv00.github.io/baozhan-game/**

- 根路径 `index.html` = 导航页，自动跳转台账首页
- **角色晶石台账**：`index-records.html`（自包含单文件）
- **打图经验台账**：`index-xp.html`（自包含单文件）
- 看到旧内容先强刷：Windows `Ctrl+F5` / macOS `Cmd+Shift+R`

## 目录结构

```
index.html              导航页（跳转台账首页）
index-records.html      角色晶石台账（v12 竖版卡牌 · A 版深空霓虹配色）
index-xp.html           打图经验台账
data.json               数据快照（供页面「仓库恢复」按钮使用）
data/
  data.json             快照副本
  scripts/              push_snapshot.py（同步快照）+ 各项测试脚本
docs/
  台账维护手册.md        ★ 项目唯一权威文档，新会话必读
  档位与每日产出分析.md   档位 × 产出分析报告
tools/
  xp.py                 经验台账工具脚本（单条/批量录入、发布）
  readshot.py           经验台账截图一键识别
  retry_*.py            推送重试工具
theme-preview.html       卡牌配色重做模板（仅预览，未实装）
.nojekyll                禁用 Jekyll，Pages 原样发布
```

## 新会话接续（三步走）

```bash
# ① 连 GitHub：跑项目资产《GitHub 连接》第 0 步（写 SSH key + 硬编码 hosts + 锁 TLS1.2）
#    成功标志：ssh -T git@github.com 返回 "Hi dycxlcvxv00!"
git clone git@github.com:dycxlcvxv00/baozhan-game.git /workspace/baozhan-game

# ② 必读：读 docs/台账维护手册.md（数据架构 / 口径 / SOP / 变更日志）
#    数据私有仓：baozhan-data（台账记录真相源，本仓 data.json 只是快照）

# ③ 改代码 → git push origin main → Pages 1~2 分钟自动生效
```

## 维护要点

1. **一切口径、SOP、避坑、变更日志以《台账维护手册》为准** —— 别凭记忆改代码。
2. 数据存在私有仓 `baozhan-data`，改了页面逻辑不碰数据；快照同步用
   `data/scripts/push_snapshot.py`。
3. `/workspace` 不跨会话持久，**任何改动都要 push 回仓库**才安全。
4. 本仓库为 **public（公开仓）**，快照含角色/收益数据 —— 用户已确认。
5. 2026-11-11 清理：已删除混入本仓库的另一项目文件（《爆战丨无限弹幕》横版沙盒
   `index-h.html`/`js/*`/`build_single.cjs` 与技能专精觉醒树 `docs/skill-*`、
   `.codebuddy/skills/skill-awakening`），本仓库现在**只含台账项目**。
