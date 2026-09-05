/* ============================================================
 * skill-panel.js — 技能面板（2026-09-05 重构）
 * 规格来源：demo开发文档 ⑩「源码与模块索引」+ 主文档 7.4 基础技能列表
 *
 * 布局（对齐装备面板左右分栏）：
 *   左栏「技能区域」再分两块：
 *     - 左：技能列表（图标 + 名字，正方形，可拖拽）
 *     - 右：120px 宽上阵插槽区（4 个插槽，拖入即上阵）
 *   右栏「专精树」：嵌入 docs/skill-tree-ice-shard.html（自动缩放适配）
 *
 * 交互：
 *   - 从列表把技能拖到插槽 → 设为上阵
 *   - 点击列表技能 / 点击已上阵插槽 → 右栏展示该技能专精树（效果一致）
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
      desc: '直线发射 4 枚冰锥，造成 300% 冰霜伤害；冰锥可穿透 2 个敌人；命中时降低目标 30% 移动速度（持续 2s）。',
      cost: 12, chargeRate: '1/S' },
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
  let treeFrame = null; // 专精树 iframe（懒创建、复用）

  function skillById(id) {
    for (let i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i];
    return null;
  }

  /* ---------- 渲染：左侧技能列表 ---------- */
  function renderList() {
    const host = document.getElementById('skillList');
    if (!host) return;
    host.innerHTML = '';
    SKILLS.forEach(function (s) {
      const item = document.createElement('div');
      item.className = 'skillItem' + (s.id === selectedId ? ' sel' : '');
      item.setAttribute('draggable', 'true');
      item.dataset.id = s.id;
      item.innerHTML =
        '<div class="ic" style="border-color:' + (ELEM_COLOR[s.element] || 'var(--line)') + '">' + s.icon + '</div>'
        + '<div class="nm">' + s.name + '</div>';
      item.addEventListener('click', function () { select(s.id); });
      item.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', s.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
      host.appendChild(item);
    });
  }

  /* ---------- 渲染：右侧上阵插槽 ---------- */
  function renderSlots() {
    const host = document.getElementById('skillSlots');
    if (!host) return;
    host.innerHTML = '';
    for (let i = 0; i < SLOT_COUNT; i++) {
      const id = slots[i];
      const slot = document.createElement('div');
      slot.className = 'slot' + (id ? ' filled' : '') + (id === selectedId ? ' sel' : '');
      slot.dataset.index = String(i);
      if (id) {
        const s = skillById(id);
        slot.innerHTML =
          '<span class="badge">上阵</span>'
          + '<div class="ic" style="border-color:' + (ELEM_COLOR[s.element] || 'var(--line)') + '">' + s.icon + '</div>'
          + '<div class="nm">' + s.name + '</div>'
          + '<span class="rm" title="取消上阵">✕</span>';
        slot.addEventListener('click', function (e) {
          if (e.target.classList.contains('rm')) {
            e.stopPropagation();
            slots[i] = null;
            renderSlots();
            return;
          }
          select(id);
        });
      } else {
        slot.innerHTML = '<div class="ph">空</div>';
      }
      slot.addEventListener('dragover', function (e) { e.preventDefault(); slot.classList.add('over'); });
      slot.addEventListener('dragleave', function () { slot.classList.remove('over'); });
      slot.addEventListener('drop', function (e) {
        e.preventDefault();
        slot.classList.remove('over');
        const dropped = e.dataTransfer.getData('text/plain');
        if (dropped && skillById(dropped)) {
          slots[i] = dropped;
          renderSlots();
          select(dropped); // 拖入后顺便展示其专精树
        }
      });
      host.appendChild(slot);
    }
  }

  /* ---------- 选择技能 → 高亮 + 展示专精树 ---------- */
  function select(id) {
    selectedId = id;
    // 更新高亮
    Array.prototype.forEach.call(document.querySelectorAll('#skillList .skillItem'), function (el) {
      el.classList.toggle('sel', el.dataset.id === id);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#skillSlots .slot'), function (el) {
      const idx = Number(el.dataset.index);
      el.classList.toggle('sel', slots[idx] === id);
    });
    renderTree(id);
  }

  /* ---------- 渲染：右栏专精树 ---------- */
  function ensureFrame() {
    if (treeFrame) return treeFrame;
    treeFrame = document.createElement('iframe');
    treeFrame.id = 'treeFrame';
    // 嵌入模式仅保留 SVG 树区域（viewBox 1060×560）
    treeFrame.style.width = '1060px';
    treeFrame.style.height = '560px';
    treeFrame.onload = fitFrame;
    return treeFrame;
  }

  function fitFrame() {
    const host = document.getElementById('skillTreeHost');
    if (!treeFrame || !treeFrame.parentNode || !host) return;
    const sc = Math.min(host.clientWidth / 1060, host.clientHeight / 560);
    treeFrame.style.transform = 'scale(' + sc + ')';
    treeFrame.style.left = ((host.clientWidth - 1060 * sc) / 2) + 'px';
    treeFrame.style.top = ((host.clientHeight - 560 * sc) / 2) + 'px';
  }

  function renderTree(id) {
    const host = document.getElementById('skillTreeHost');
    if (!host) return;
    host.innerHTML = '';
    const s = skillById(id);
    if (s && s.id === 'iceLance') {
      // 寒冰锥刺：嵌入觉醒路线文档
      const f = ensureFrame();
      const TREE_SRC = 'docs/skill-tree-ice-shard.html?embed=1';
      if (f.getAttribute('data-src') !== TREE_SRC) {
        f.setAttribute('data-src', TREE_SRC);
        f.src = TREE_SRC;
      }
      host.appendChild(f);
      fitFrame();
    } else {
      // 其余技能：专精树尚未设计
      const name = s ? s.name : id;
      const ph = document.createElement('div');
      ph.className = 'treePlaceholder';
      ph.innerHTML = '<b>专精树开发中</b>「' + name + '」的专精树尚未设计<br>当前仅「寒冰锥刺」已接入觉醒路线文档。';
      host.appendChild(ph);
    }
  }

  /* ---------- 入口：由 left-tabs.js 在切到「技能」视图时调用 ---------- */
  function render() {
    renderList();
    renderSlots();
    if (!selectedId) selectedId = 'iceLance'; // 默认展示寒冰锥刺觉醒树
    select(selectedId);
  }

  window.__skillRender = render;
})();
