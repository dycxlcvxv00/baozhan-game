/* ============================================================
 * skill-panel.js — 技能面板（2026-09-05 重构）
 * 规格来源：demo开发文档 ⑩「源码与模块索引」+ 主文档 7.4 基础技能列表
 *
 * 布局（对齐装备面板左右分栏）：
 *   左栏「技能区域」再分两块：
 *     - 左：技能列表（图标 + 名字，正方形，可拖拽）
 *     - 右：120px 宽上阵插槽区（4 个插槽，点击列表技能 → 高亮 → 点格子放置）
 *   右栏「专精树」：嵌入 docs/skill-tree-ice-shard.html（缩放 95%，上移 30px）
 *
 * 交互：
 *   - 悬停列表/上阵技能 → 弹出技能提示（图标镶嵌顶部 / 名字居中 / 标签居中 / 描述数字着色 / 伤害·能耗·充能）
 *   - 点击列表技能 → 进入「放置模式」：右侧 4 个格子高亮；再点格子 → 放置（同技能仅上阵一个，再次点可替换）
 *   - 拖拽技能到格子同样上阵
 *   - 技能上阵后立即同步战斗区（4 塔对应 4 插槽）
 *
 * 专精树数据源：
 *   - iceLance（寒冰锥刺）已接入 docs/skill-tree-ice-shard.html 觉醒路线
 *   - 其余技能专精树尚未设计，展示占位提示
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 技能数据（iceLance 已同步主文档 7.4；其余占位待同步） ---------- */
  const SKILLS = [
    { id: 'iceLance', name: '寒冰锥刺', en: 'Ice Lance',      element: 'ice',       icon: '❄',
      tags: ['法术', '冰霜', '投射物', '直射', '异常'],
      // 描述数字按属性着色（语义化 span），dmgCoef 用于计算释放前伤害（英雄攻击力 × coef）
      descHTML: '直线发射 <span class="tipNum cnt">4</span> 枚冰锥，造成 <span class="tipNum frost">300%</span> 冰霜伤害；'
        + '冰锥可穿透 <span class="tipNum pierce">2</span> 个敌人；命中时降低目标 <span class="tipNum slow">30%</span> 移动速度（持续 <span class="tipNum dur">2s</span>）。',
      cost: 10, chargeRate: '1.5/S', dmgCoef: 3.0 },
    { id: 'fireball', name: '爆裂火球', en: 'Fireball',        element: 'fire',      icon: '🔥',
      tags: ['火焰', '范围'], desc: '（待同步）投掷爆裂火球，命中后产生范围火焰伤害。',
      cost: 0, chargeRate: '0' },
    { id: 'chain',    name: '连锁闪电', en: 'Chain Lightning', element: 'lightning', icon: '⚡',
      tags: ['闪电', '弹射'], desc: '（待同步）释放连锁闪电，在敌人间弹射。',
      cost: 0, chargeRate: '0' },
    { id: 'spore',    name: '剧毒孢子', en: 'Poison Spore',    element: 'poison',    icon: '🧪',
      tags: ['毒素', '持续'], desc: '（待同步）播撒剧毒孢子，造成持续毒素伤害。',
      cost: 0, chargeRate: '0' },
  ];

  const ELEM_COLOR = {
    ice: '#7fd4ff', fire: '#ff8a5c', lightning: '#ffd95c', poison: '#9b7bff',
    physical: '#cfd6e6', chaos: '#c77bff',
  };

  const SLOT_COUNT = 4;
  const slots = new Array(SLOT_COUNT).fill(null); // 每个元素存技能 id 或 null
  let selectedId = null;
  let armedId = null;     // 放置模式：当前待放置的技能
  let treeFrame = null;   // 专精树 iframe（懒创建、复用）

  function skillById(id) {
    for (let i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i];
    return null;
  }

  /* 英雄攻击力（用于计算释放前伤害值，取角色面板里的攻击力数值） */
  function getHeroAttack() {
    const el = document.querySelector('.ca.atk .val');
    if (!el) return 100;
    const n = parseInt(String(el.textContent).replace(/[^\d]/g, ''), 10);
    return isNaN(n) ? 100 : n;
  }

  /* ---------- 渲染：左侧技能列表 ---------- */
  function renderList() {
    const host = document.getElementById('skillList');
    if (!host) return;
    host.innerHTML = '';
    SKILLS.forEach(function (s) {
      const item = document.createElement('div');
      item.className = 'skillItem' + (s.id === selectedId ? ' sel' : '') + (s.id === armedId ? ' arm' : '');
      item.setAttribute('draggable', 'true');
      item.dataset.id = s.id;
      item.innerHTML =
        '<div class="ic" style="border-color:' + (ELEM_COLOR[s.element] || 'var(--line)') + '">' + s.icon + '</div>'
        + '<div class="nm">' + s.name + '</div>';
      item.addEventListener('mouseenter', function () { openSkillPopup(s); });
      item.addEventListener('mouseleave', hideSkillPopup);
      item.addEventListener('click', function () {
        armedId = (armedId === s.id) ? null : s.id; // 再次点击同一技能 → 取消放置模式
        renderList(); renderSlots(); select(s.id);
      });
      item.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', s.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
      host.appendChild(item);
    });
  }

  /* 放置技能到插槽 i（保证同一技能只上阵一个） */
  function placeSkill(i, id) {
    for (let k = 0; k < SLOT_COUNT; k++) if (slots[k] === id) slots[k] = null;
    slots[i] = id;
  }

  /* 上阵变化 → 立即同步战斗区 4 塔 */
  function syncBattleArea() {
    const defs = slots.map(function (id) { return id ? skillById(id) : null; });
    if (window.__gameH && typeof window.__gameH.applySkillSlots === 'function') {
      window.__gameH.applySkillSlots(defs);
    }
  }

  /* ---------- 渲染：右侧上阵插槽 ---------- */
  function renderSlots() {
    const host = document.getElementById('skillSlots');
    if (!host) return;
    host.innerHTML = '';
    host.classList.toggle('armed', !!armedId); // 放置模式：格子整体高亮
    for (let i = 0; i < SLOT_COUNT; i++) {
      const id = slots[i];
      const slot = document.createElement('div');
      slot.className = 'slot' + (id ? ' filled' : '') + (id === selectedId ? ' sel' : '') + (id === armedId ? ' arm' : '');
      slot.dataset.index = String(i);
      if (id) {
        const s = skillById(id);
        slot.innerHTML =
          '<span class="badge">上阵</span>'
          + '<div class="ic" style="border-color:' + (ELEM_COLOR[s.element] || 'var(--line)') + '">' + s.icon + '</div>'
          + '<div class="nm">' + s.name + '</div>'
          + '<span class="rm" title="取消上阵">✕</span>';
        slot.addEventListener('mouseenter', function () { openSkillPopup(s); });
        slot.addEventListener('mouseleave', hideSkillPopup);
        slot.addEventListener('click', function (e) {
          if (e.target.classList.contains('rm')) {
            e.stopPropagation();
            slots[i] = null; renderSlots(); syncBattleArea();
            return;
          }
          if (armedId) { // 放置模式：点格子 → 放置（可替换）
            placeSkill(i, armedId); armedId = null; renderSlots(); select(slots[i]); syncBattleArea();
          } else {
            select(id); openSkillPopup(s);
          }
        });
      } else {
        slot.innerHTML = '<div class="ph">空</div>';
        slot.addEventListener('mouseenter', function () { if (armedId) openSkillPopup(skillById(armedId)); });
        slot.addEventListener('mouseleave', hideSkillPopup);
        slot.addEventListener('click', function () {
          if (armedId) { placeSkill(i, armedId); armedId = null; renderSlots(); select(slots[i]); syncBattleArea(); }
        });
      }
      slot.addEventListener('dragover', function (e) { e.preventDefault(); slot.classList.add('over'); });
      slot.addEventListener('dragleave', function () { slot.classList.remove('over'); });
      slot.addEventListener('drop', function (e) {
        e.preventDefault(); slot.classList.remove('over');
        const dropped = e.dataTransfer.getData('text/plain');
        if (dropped && skillById(dropped)) {
          placeSkill(i, dropped); renderSlots(); select(dropped); syncBattleArea();
        }
      });
      host.appendChild(slot);
    }
  }

  /* ---------- 选择技能 → 高亮 + 展示专精树 ---------- */
  function select(id) {
    selectedId = id;
    Array.prototype.forEach.call(document.querySelectorAll('#skillList .skillItem'), function (el) {
      el.classList.toggle('sel', el.dataset.id === id);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#skillSlots .slot'), function (el) {
      const idx = Number(el.dataset.index);
      el.classList.toggle('sel', slots[idx] === id);
    });
    renderTree(id);
  }

  /* ---------- 渲染：右栏专精树（缩放 95% + 上移 30px） ---------- */
  function ensureFrame() {
    if (treeFrame) return treeFrame;
    treeFrame = document.createElement('iframe');
    treeFrame.id = 'treeFrame';
    treeFrame.style.width = '1060px';
    treeFrame.style.height = '560px';
    treeFrame.onload = fitFrame;
    return treeFrame;
  }

  function fitFrame() {
    const host = document.getElementById('skillTreeHost');
    if (!treeFrame || !treeFrame.parentNode || !host) return;
    const sc = 0.95; // 固定缩放至 95%
    treeFrame.style.transform = 'scale(' + sc + ')';
    treeFrame.style.left = ((host.clientWidth - 1060 * sc) / 2) + 'px';
    treeFrame.style.top = ((host.clientHeight - 560 * sc) / 2 - 30) + 'px'; // 上移 30px
  }

  function renderTree(id) {
    const host = document.getElementById('skillTreeHost');
    if (!host) return;
    host.innerHTML = '';
    const s = skillById(id);
    if (s && s.id === 'iceLance') {
      const f = ensureFrame();
      const TREE_SRC = 'docs/skill-tree-ice-shard.html?embed=1';
      if (f.getAttribute('data-src') !== TREE_SRC) {
        f.setAttribute('data-src', TREE_SRC);
        f.src = TREE_SRC;
      }
      host.appendChild(f);
      fitFrame();
    } else {
      const name = s ? s.name : id;
      const ph = document.createElement('div');
      ph.className = 'treePlaceholder';
      ph.innerHTML = '<b>专精树开发中</b>「' + name + '」的专精树尚未设计<br>当前仅「寒冰锥刺」已接入觉醒路线文档。';
      host.appendChild(ph);
    }
  }

  /* ---------- 技能提示弹窗（悬停显示） ---------- */
  function skillTipEl() {
    let el = document.getElementById('skillTip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'skillTip';
      el.className = 'skillTip';
      document.body.appendChild(el);
    }
    return el;
  }

  /* 描述数字着色：语义化 class（冰霜蓝 / 数量橙 / 穿透绿 / 减速紫 / 时间金） */
  function renderDesc(text) {
    const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(/(\d+(?:\.\d+)?)(%|\/S|s)?/g, function (m, _num, unit) {
      let cls = 'tipNum ';
      if (unit === '%') cls += 'pct';
      else if (unit === '/S' || unit === 's') cls += 'time';
      else cls += 'gen';
      return '<span class="' + cls + '">' + m + '</span>';
    });
  }

  function popupHTML(s) {
    // 左侧伤害值 = 英雄攻击力 × 系数（释放前的值）
    const atk = getHeroAttack();
    const dmgVal = (typeof s.dmgCoef === 'number') ? Math.round(atk * s.dmgCoef) : (s.damage || '—');
    const desc = s.descHTML ? s.descHTML : renderDesc(s.desc);
    return '<div class="tipIcon" style="border-color:' + (ELEM_COLOR[s.element] || '#eaf0ff') + '">' + s.icon + '</div>'
      + '<div class="tipTitle">' + s.name + '</div>'
      + '<div class="tipTags">' + s.tags.map(function (t) { return '<span class="tipTag">' + t + '</span>'; }).join('') + '</div>'
      + '<div class="tipDesc">' + desc + '</div>'
      + '<div class="tipStats">'
      +   '<div class="tipStat dmg"><div class="tipDmgVal">' + dmgVal + '</div>'
      +     '<div class="tipDivider"></div><div class="tipDmgLabel">伤害</div></div>'
      +   '<div class="tipStatCol">'
      +     '<div class="tipStat mini"><div class="tipStatLabel">能耗</div><div class="tipStatValue">' + s.cost + '</div></div>'
      +     '<div class="tipStat mini"><div class="tipStatLabel">充能</div><div class="tipStatValue">' + s.chargeRate + '</div></div>'
      +   '</div>'
      + '</div>';
  }

  function openSkillPopup(s) {
    const tip = skillTipEl();
    tip.innerHTML = popupHTML(s);
    tip.style.display = 'block';
    tip.onclick = function (e) { e.stopPropagation(); };
  }

  function hideSkillPopup() {
    const tip = document.getElementById('skillTip');
    if (tip) tip.style.display = 'none';
  }

  /* ---------- 入口：由 left-tabs.js 在切到「技能」视图时调用 ---------- */
  function render() {
    renderList();
    renderSlots();
    if (!selectedId) selectedId = 'iceLance'; // 默认展示寒冰锥刺觉醒树
    select(selectedId);
    syncBattleArea(); // 初始同步战斗区（当前 4 槽为空 → 使用默认塔配置）
  }

  window.__skillRender = render;
})();
