import re, sys, pathlib
ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')
if 'Demo v0.33' in src:
    print('v0.33 already applied; nothing to do')
    sys.exit(0)
def rep(old, new, tag):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('%s anchor count=%d' % (tag, n))
    src = src.replace(old, new, 1)

# ---- E1: version h1 ----
rep('<div><h1>爆战丨无限弹幕 Demo v0.32</h1><div class="subtitle">修复领主特效负半径 · 彻底根治卡死</div></div>',
    '<div><h1>爆战丨无限弹幕 Demo v0.33</h1><div class="subtitle">战前装配界面重构 · 四页签导航 · 关卡列表 · 英雄装备展示</div></div>', 'E1')

# ---- E2: changelog ----
old = '''      <div class="changelogCurrent"><h3>当前版本 · v0.32</h3>
        <ol>
          <li><b>根治战斗卡死（真凶）：</b>领主登场特效设了 life 却漏设 maxLife，导致光环半径衰减公式算出负值，ctx.arc() 每帧抛异常、渲染循环被杀——每 5 关领主波必现卡死。已为该特效补上 maxLife。</li>
          <li><b>防御加固：</b>特效绘制统一对半径做非负钳制，任何后续特效即使漏设 maxLife 也不会再因负半径崩溃。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.31 及更早，点击展开）</summary>'''
new = '''      <div class="changelogCurrent"><h3>当前版本 · v0.33</h3>
        <ol>
          <li><b>战前装配界面重构：</b>标题移到最左，导航改为符文 / 装备 / 专精 / 设置四页签；设置页集中收纳版本、速度、音频、存档。</li>
          <li><b>关卡选择改为纵向列表：</b>每关一行带通关勾与领主标记，当前关高亮，未解锁关显示锁。</li>
          <li><b>符文说明收进感叹号：</b>符文库旁 ⓘ 悬浮显示装配规则，默认隐藏不占地。</li>
          <li><b>装备页英雄展示：</b>新增可编辑玩家名、英雄等级、背景光环，10 个装备位均分到英雄左右两侧。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.32 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.32</h4><ul><li>根治战斗卡死：领主登场特效漏设 maxLife 致光环半径算出负值崩溃，已补上并对特效半径统一非负钳制。</li></ul></div>'''
rep(old, new, 'E2')

p.write_text(src, encoding='utf-8')
print('published v0.33')
