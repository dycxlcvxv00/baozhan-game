/* === 角色属性面板（多文件版） · 数据真相源 = js/attr-engine.js ===
 *
 * 本文件只负责 UI：四分类渲染 + tooltip 词缀明细。
 * 属性基准 / 词缀全表 / 装备数据 / 聚合计算 / 战斗快照全部在
 * AttrEngine（attr-engine.js）——严格对齐主文档第 13 章词缀乘区规则：
 *   同属性下同名词缀为加法，不同名词缀之间为乘区，不设加法区。
 *
 * 全局共享：window.HERO / window.ITEM_MAP / window.AttrEngine，
 *          背包面板穿戴/卸下 → HERO.onChange → 本面板重渲染。
 * ============================================================ */
(function initCharPanel(){
  const AE = window.AttrEngine;
  const HERO = window.HERO;
  const ITEM_MAP = window.ITEM_MAP;

  /* ---- 面板分类（行名 = 属性名，取值走 AttrEngine.displayVal） ---- */
  const ATTR_CATS = {
    damage:{
      groups:[
        {cls:'atk',title:'攻击',affs:[
          {name:'攻击伤害'}, {name:'攻击速度'}, {name:'多重射击'}, {name:'粉碎打击'},
        ]},
        {cls:'mgc',title:'法术',affs:[
          {name:'法术伤害'}, {name:'充能速度'}, {name:'能量回溯'}, {name:'法术迸发'},
        ]},
        {cls:'crt',title:'暴击',affs:[
          {name:'暴击率'}, {name:'暴击伤害'}, {name:'弱点暴击'},
        ]},
      ]
    },
    defense:{
      groups:[
        {cls:'def',title:'防御',affs:[
          {name:'护盾值'}, {name:'护盾回溯'}, {name:'格挡'}, {name:'生命回溯'},
        ]},
        {cls:'def',title:'减伤',affs:[
          {name:'伤害减免'}, {name:'最终减伤'},
        ]},
      ]
    },
    boost:{
      groups:[
        {cls:'bst',title:'独立乘区',affs:[
          {name:'伤害加成'}, {name:'伤害增幅'}, {name:'伤害强化'}, {name:'伤害提升'},
          {name:'伤害扩大'}, {name:'全域增伤'}, {name:'钞能增伤'}, {name:'最终伤害'},
        ]},
      ]
    },
    other:{
      groups:[
        {cls:'oth',title:'怪物类型',affs:[
          {name:'小怪增伤'}, {name:'精英增伤'}, {name:'领主增伤'},
        ]},
        {cls:'oth',title:'伤害方式',affs:[
          {name:'单体伤害'}, {name:'范围伤害'}, {name:'投射物伤害'}, {name:'持续性伤害'},
          {name:'弹射伤害'}, {name:'异常伤害'}, {name:'陷阱伤害'}, {name:'灌注伤害'},
        ]},
      ]
    },
  };

  function ready(){ return document.getElementById('attrTabs') && document.getElementById('attrBody'); }

  let curCat = 'damage';

  function tryInit(){
    const tabsEl = document.getElementById('attrTabs');
    const bodyEl = document.getElementById('attrBody');
    if (!tabsEl || !bodyEl) return false;

    // 顶部核心条（生命/攻击/护甲）+ 六元素：由当前状态驱动
    function updateCore(){
      const cp = document.getElementById('charPanel');
      if (!cp) return;
      cp.querySelectorAll('[data-tip]').forEach(el => {
        const k = (el.getAttribute('data-tip') || '').replace(/^attr:/, '');
        if (!(k in AE.ATTR_POOL) && !(k in AE.ATTR_BASE)) return;
        const out = el.querySelector('.val, .vl');
        if (out) out.textContent = AE.displayVal(k);
      });
    }

    function render(cat){
      curCat = cat;
      const def = ATTR_CATS[cat];
      if (!def) return;
      bodyEl.innerHTML = '';
      def.groups.forEach(g => {
        const sg = document.createElement('div');
        sg.className = 'sg ' + g.cls;
        const sgh = document.createElement('div');
        sgh.className = 'sgh ' + g.cls;
        sgh.textContent = g.title;
        sg.appendChild(sgh);
        const affs = document.createElement('div');
        affs.className = 'affs';
        g.affs.forEach(a => {
          const e = document.createElement('div');
          e.className = 'aff';
          e.dataset.tip = 'attr:' + a.name;
          const nm = document.createElement('span');
          nm.className = 'nm'; nm.textContent = a.name;
          const vl = document.createElement('span');
          vl.className = 'vl';
          vl.textContent = AE.displayVal(a.name);
          e.appendChild(nm); e.appendChild(vl);
          affs.appendChild(e);
        });
        sg.appendChild(affs);
        bodyEl.appendChild(sg);
      });
    }

    function refresh(){ updateCore(); render(curCat); }
    refresh();

    tabsEl.addEventListener('click', (e) => {
      const t = e.target.closest('.at');
      if (!t) return;
      tabsEl.querySelectorAll('.at').forEach(x => x.classList.toggle('on', x === t));
      render(t.dataset.cat);
    });

    // 装备变化时重渲染
    HERO.onChange(refresh);

    const tip = document.createElement('div');
    tip.className = 'attrTip';
    document.body.appendChild(tip);

    // 属性弹窗：按词缀维度（加成/增幅/强化…）列出实际生效值（机制基准 + 装备加成）
    function buildSrcList(k){
      const affs = (AE.ATTR_POOL[k] && AE.ATTR_POOL[k].affixes) || [];
      if (!affs.length) return '<div class="meta">该属性暂无词缀维度</div>';
      const rows = affs.map(function (af) {
        const v = AE.affixVal(af);                      // 基准 + Σ装备同名加法
        const def = AE.resolveAffix(af);
        const unit = (def && def.role === 'flat') ? '' : '%';
        return '<li><span>' + af + '</span><b>' + (v > 0 ? '+' : '') + AE.fmtNum(v) + unit + '</b></li>';
      });
      return '<ul class="src">' + rows.join('') + '</ul>';
    }

    // 基础值 / 最终值行（数值型属性才有裸身基准）
    // 基础值 = 裸身基准 + Σflat 主属性（乘区之前）；最终值 = 基础值 × ∏乘区
    function hasBaseValue(k){
      return k in AE.ATTR_BASE;
    }

    function showTip(target){
      const k = (target.dataset.tip || '').replace(/^attr:/, '');
      const data = AE.ATTR_POOL[k] || {desc:'', affixes:[]};
      let baseRow = '';
      if (hasBaseValue(k)) {
        const baseV = AE.attrBaseFinal(k);
        const zm = AE.zoneMult(k);
        baseRow = '<div class="srcTitle">基础值</div>'
          + '<div class="baseRow"><b>' + AE.fmtNum(baseV) + '</b></div>'
          + '<div class="srcTitle">最终值</div>'
          + '<div class="baseRow"><b>' + AE.displayVal(k) + '</b>'
          + (zm !== 1
              ? '<span style="opacity:.7;font-weight:400;font-size:12px">（' + AE.fmtNum(baseV) + ' × ' + AE.fmtNum(zm) + '）</span>'
              : '')
          + '</div>';
      }
      tip.innerHTML =
        '<h5>' + k + '</h5>' +
        '<div class="desc">' + (data.desc || '该属性的实际装备加成数值如下。') + '</div>' +
        baseRow +
        '<div class="srcTitle">词缀明细</div>' + buildSrcList(k) +
        '<div class="meta">主属性叠加进基础值 → 词缀乘区相乘得最终值；同名词缀加法合并，不同名词缀之间为独立乘区（第 13 章规则）</div>';
      const r = target.getBoundingClientRect();
      tip.style.display = 'block';
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = r.right + 8, y = r.top - 4;
      if (x + tw > window.innerWidth) x = r.left - tw - 8;
      if (x < 8) x = 8;
      if (y + th > window.innerHeight) y = window.innerHeight - th - 8;
      if (y < 8) y = 8;
      tip.style.left = x + 'px';
      tip.style.top  = y + 'px';
    }

    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-tip]');
      if (t) showTip(t);
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest('[data-tip]');
      if (t) tip.style.display = 'none';
    });

    return true;
  }

  if (!tryInit()) {
    document.addEventListener('DOMContentLoaded', tryInit);
  }
})();
