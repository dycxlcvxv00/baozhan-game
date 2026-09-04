/* ============================================================
 * skill-panel.js — 技能面板（2026-09-03 新增模块）
 * 规格来源：demo开发文档 ⑩「源码与模块索引」+ 主文档 7.4 基础技能列表
 * 交互：左侧 UI「技能」按钮 → #panelView 渲染 2×2 技能格
 *       → 点技能格 → 居中弹出 Last Epoch 风格弹窗 → 点外部关闭
 * 注意：#skillTip 容器若需独立定位，必须放在 body 开头（IIFE 之前），
 *       否则初始化时 getElementById 取到 null、弹窗不显示；此处用
 *       skTipEl() 懒获取兜底，规避该坑。
 * 数据源：主文档 7.4 基础技能列表（4 技能）。
 *       ⚠️ 下列 SKILLS 数值为占位，待从主文档 7.4 同步精确平衡值。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 技能数据（占位，待同步主文档 7.4） ---------- */
  const SKILLS = [
    { id: 'iceLance',  name: '寒冰锥刺', en: 'Ice Lance',     element: 'ice',
      tags: ['冰霜', '直线'], desc: '（待同步）向前方射出冰霜锥刺，造成冰霜伤害并减速。',
      cost: 0, charge: 0 },
    { id: 'fireball',  name: '爆裂火球', en: 'Fireball',       element: 'fire',
      tags: ['火焰', '范围'], desc: '（待同步）投掷爆裂火球，命中后产生范围火焰伤害。',
      cost: 0, charge: 0 },
    { id: 'chain',     name: '连锁闪电', en: 'Chain Lightning', element: 'lightning',
      tags: ['闪电', '弹射'], desc: '（待同步）释放连锁闪电，在敌人间弹射。',
      cost: 0, charge: 0 },
    { id: 'spore',     name: '剧毒孢子', en: 'Poison Spore',   element: 'poison',
      tags: ['毒素', '持续'], desc: '（待同步）播撒剧毒孢子，造成持续毒素伤害。',
      cost: 0, charge: 0 },
  ];

  const ELEM_COLOR = {
    ice: '#7fd4ff', fire: '#ff8a5c', lightning: '#ffd95c', poison: '#9b7bff',
    physical: '#cfd6e6', chaos: '#c77bff',
  };

  function skTipEl() {
    let el = document.getElementById('skillTip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'skillTip';
      document.body.appendChild(el);
    }
    return el;
  }

  function renderGrid() {
    const view = document.getElementById('panelView');
    if (!view) return;
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;'
      + 'padding:8px;width:100%;height:100%;box-sizing:border-box';
    SKILLS.forEach(function (s) {
      const cell = document.createElement('div');
      cell.style.cssText = 'border:1px solid var(--line);border-radius:12px;'
        + 'background:var(--panel2);padding:12px;cursor:pointer;display:flex;'
        + 'flex-direction:column;gap:6px;transition:.15s';
      cell.innerHTML = '<div style="font-weight:700;color:' + (ELEM_COLOR[s.element] || '#eaf0ff')
        + '">' + s.name + ' <span style="color:var(--mute);font-size:12px">' + s.en + '</span></div>'
        + '<div style="font-size:13px;color:var(--dim)">' + s.tags.join(' · ') + '</div>'
        + '<div style="font-size:13px;color:var(--mute)">' + s.desc + '</div>';
      cell.addEventListener('click', function () { openPopup(s); });
      grid.appendChild(cell);
    });
    view.innerHTML = '';
    view.appendChild(grid);
  }

  function openPopup(s) {
    const tip = skTipEl();
    tip.innerHTML = '';
    tip.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);'
      + 'width:420px;max-width:90vw;background:var(--panel2);border:1px solid '
      + (ELEM_COLOR[s.element] || 'var(--line)') + ';border-radius:16px;padding:20px;'
      + 'box-shadow:0 20px 60px rgba(0,0,0,.6);z-index:9999;backdrop-filter:blur(12px)';
    tip.innerHTML =
      '<div style="font-weight:800;font-size:20px;color:' + (ELEM_COLOR[s.element] || '#eaf0ff') + '">'
      + s.name + ' <span style="color:var(--mute);font-size:13px;font-weight:600">' + s.en + '</span></div>'
      + '<div style="margin:8px 0;color:var(--accent2);font-size:13px">' + s.tags.join(' · ') + '</div>'
      + '<div style="color:var(--dim);font-size:14px;line-height:1.6">' + s.desc + '</div>'
      + '<div style="display:flex;gap:10px;margin-top:14px">'
      + '<div style="flex:1;border:1px solid var(--line);border-radius:8px;padding:8px;color:var(--dim);font-size:13px">能耗 ' + s.cost + '</div>'
      + '<div style="flex:1;border:1px solid var(--line);border-radius:8px;padding:8px;color:var(--dim);font-size:13px">充能 ' + s.charge + '</div>'
      + '</div>';
    tip.onclick = function (e) { e.stopPropagation(); };
    setTimeout(function () {
      document.addEventListener('click', function close() {
        tip.remove();
        document.removeEventListener('click', close);
      }, { once: true });
    }, 0);
  }

  function init() {
    const btn = document.querySelector('#fbtns .fbtn[data-k="技能"]');
    if (!btn) return; // 当前 DOM 尚未含「技能」按钮，待接入左侧 UI 后自动生效
    const placeholder = document.getElementById('panelView');
    btn.addEventListener('click', function () {
      if (btn.classList.contains('on')) {
        btn.classList.remove('on');
        if (placeholder) placeholder.innerHTML = '<b>功能面板</b><br>点击左侧功能按钮（装备 / 技能 / 宠物 / 铭文）切换此处内容';
      } else {
        Array.prototype.forEach.call(document.querySelectorAll('#fbtns .fbtn'), function (x) { x.classList.remove('on'); });
        btn.classList.add('on');
        renderGrid();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
