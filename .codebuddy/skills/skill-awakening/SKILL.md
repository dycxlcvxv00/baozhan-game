---
name: skill-awakening
description: 《爆战丨无限弹幕》技能专精（觉醒树）代码调用入口。当用户提到"调用技能专精代码"、"技能专精"、"技能觉醒"、"觉醒树"、"寒冰锥刺觉醒路线"等时使用本技能。用于查看/修改 docs/skill-tree-ice-shard.html 觉醒树交互原型（5 路线 20 节点、门槛门互斥取舍、流光连线），以及其开发文档与截图。
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# 技能专精（觉醒树）Skill

本技能是《爆战丨无限弹幕》**技能专精/觉醒树**原型的唯一调用入口。
用户说「**调用技能专精代码**」即进入本流程。

## 代码位置（仓库内，必须先连 GitHub）

```
docs/skill-tree-ice-shard.html      # 觉醒树交互原型（自包含单文件，双击即开）★主改这个
docs/skill-tree-ice-shard.json      # 同一套拓扑的结构化数据
docs/skill-awakening-ice-shard.md   # 开发文档（拓扑/交互规则/截图/变更记录）改完要同步
docs/screenshots/*.png              # 关键状态截图
```

仓库：`git@github.com:dycxlcvxv00/baozhan-game.git`（public，main 分支）。
沙箱不跨会话持久，**动手前必须先 clone**（连 GitHub 用项目资产《GitHub 连接》）：

```bash
git clone git@github.com:dycxlcvxv00/baozhan-game.git /workspace/baozhan-game
```

## 必读约定（改代码前）

1. **只改 `docs/skill-tree-ice-shard.html`**，不要动 `index.html`（构建产物）、
   `index-h.html`、`js/*`（主 demo，可能与本文件并行开发，rebase 时保留双方改动）。
2. 觉醒树不参与 `build_single.cjs` 打包，**不需要**跑构建。
3. 20 节点编号与拓扑、互斥取舍规则、流光/配色规则、SVG 滤镜坑——
   全部写在 `docs/skill-awakening-ice-shard.md` 第 4~6 节，**先读再改**。
4. 改动闭环：改 HTML → 同步 JSON（若拓扑变化）→ 截图更新（若视觉变化）
   → 开发文档「变更记录」加一行 → `git add -A && git commit && git push origin main`。
5. push 前先 `git fetch`，若远程有新提交先 `git stash` → `git rebase origin/main` → `git stash pop`
   （其它会话可能并行改了 index-h/js）。

## 验证方法（改动后必做）

拓扑/互斥逻辑：写临时 Node 脚本，从 HTML 里正则抽取 `skillData`，
复刻 `computeActivatable()`/`linkState()` 断言各场景（点 3 关 2/4、点 5 关 6、点 7 关 8、点 15 关 16…），
**验证完删除临时脚本再提交**。

视觉/截图：用 Python Playwright（已装）打开 `file://…/docs/skill-tree-ice-shard.html`，
通过 `page.evaluate` 派发点击驱动状态，对 `#tree` 元素截图，肉眼核对流光/变淡/配色。

## 口令约定

| 用户说 | 含义 |
|---|---|
| 调用技能专精代码 | clone 仓库 → 读开发文档 → 等待具体修改需求 |
| 技能专精 + 具体需求 | 直接按上文流程实现该需求 |
| 归档到主文档 | 提醒用户：主文档为《爆战丨无限弹幕》，归档动作需用户在主文档侧确认 |
