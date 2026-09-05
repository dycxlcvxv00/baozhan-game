/* === 角色属性面板（多文件版） · 来源：主文档「13. 伤害系统」属性释义 ===
 * 数值真相源 = HERO_ATTRS（Lv.60 英雄属性基线，严格遵循第 13 章「显示样式」：
 *   数值型 = 攻击力 / 生命值 / 护甲值 / 护盾值 / 多重射击 / 充能速度
 *   百分比型 = 其余增幅系数【×】（文档中以百分比展示，100% = ×1）
 *   触发类机制数值（5% / 2.5×、护盾 5000 等）直接取自第 13 章原文。
 * 面板四分类 / 顶部核心条 / 六元素均由本表驱动，不再写散落假数字。 */
(function initCharPanel(){
  const ATTR_POOL = {
    '生命值':{desc:'城墙所能承受的伤害值',affixes:['生命值加成','生命值强化','生命值增幅']},
    '攻击力':{desc:'所有伤害的计算基数',affixes:['攻击力加成','攻击力强化','攻击力增幅']},
    '护甲值':{desc:'通过特定公式降低受到的伤害',affixes:['护甲值加成','护甲值强化','护甲值增幅']},
    '物理':  {desc:'造成物理伤害时的增幅系数【×】',affixes:['物理伤害','物理精通','物理增幅','物理穿透']},
    '混沌':  {desc:'造成混沌伤害时的增幅系数【×】',affixes:['混沌伤害','混沌精通','混沌增幅']},
    '冰霜':  {desc:'造成冰霜伤害时的增幅系数【×】',affixes:['冰霜伤害','冰霜精通','冰霜增幅','冰霜穿透']},
    '火焰':  {desc:'造成火焰伤害时的增幅系数【×】',affixes:['火焰伤害','火焰精通','火焰增幅','火焰穿透']},
    '毒素':  {desc:'造成毒素伤害时的增幅系数【×】',affixes:['毒素伤害','毒素精通','毒素增幅','毒素穿透']},
    '闪电':  {desc:'造成闪电伤害时的增幅系数【×】',affixes:['闪电伤害','闪电精通','闪电增幅','闪电穿透']},
    '攻击伤害':{desc:'普攻或攻击技能造成伤害时的增幅系数【×】',affixes:['攻击伤害','攻击精通','攻击增幅','攻击强化']},
    '攻击速度':{desc:'提升普攻和攻击技能打击频率',affixes:['攻击速度','攻速加成','攻速上限']},
    '多重射击':{desc:'可同时攻击的敌人数量',affixes:['多重射击']},
    '粉碎打击':{desc:'攻击命中时 5% 几率触发，造成 2.5 倍伤害【×】',affixes:['粉碎打击几率','粉碎打击伤害']},
    '法术伤害':{desc:'法术技能造成伤害时的增幅系数【×】',affixes:['法术伤害','法术精通','法术增幅','法术强化']},
    '充能速度':{desc:'符文每秒充能基数为 1 点',affixes:['充能基数','充能速度']},
    '能量回溯':{desc:'符文释放时 5% 几率触发，立即回复 20% 能量值',affixes:['能量回溯几率','能量回溯比例']},
    '法术迸发':{desc:'法术命中时 5% 几率触发，造成 2.5 倍伤害【×】',affixes:['法术迸发几率','法术迸发伤害']},
    '暴击率': {desc:'造成直接伤害时，触发暴击的几率',affixes:['暴击率']},
    '暴击伤害':{desc:'触发暴击时，本次伤害增幅系数【×】',affixes:['暴击伤害','暴击伤害增幅']},
    '弱点暴击':{desc:'暴击时 5% 几率触发，造成 2.5 倍伤害【×】',affixes:['弱点暴击几率','弱点暴击伤害']},
    '生命回溯':{desc:'受到伤害时 5% 几率触发，回复 1% 损失生命值',affixes:['生命回溯几率','生命回溯比例']},
    '护盾值': {desc:'所有伤害优先扣除护盾再扣生命【混沌伤害无视护盾】',affixes:['护盾值','护盾值加成','护盾值增幅']},
    '护盾回溯':{desc:'每隔 2 秒自动触发，10% 几率回复 1% 最大护盾值',affixes:['护盾回溯几率','护盾回溯比例']},
    '格挡':   {desc:'受伤时 5% 几率触发格挡，降低 30% 所受伤害【×】',affixes:['格挡几率','格挡比例']},
    '伤害减免':{desc:'减少所受伤害的系数【×】',affixes:['伤害减免']},
    '最终减伤':{desc:'减少所受伤害的系数【×】',affixes:['最终减伤']},
    '小怪增伤':{desc:'对小怪造成伤害时的增幅系数【独立乘区】',affixes:['小怪增伤']},
    '精英增伤':{desc:'对精英造成伤害时的增幅系数【独立乘区】',affixes:['精英增伤']},
    '领主增伤':{desc:'对领主造成伤害时的增幅系数【独立乘区】',affixes:['领主增伤']},
    '伤害加成':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害加成']},
    '伤害增幅':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害增幅']},
    '伤害强化':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害强化']},
    '伤害提升':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害提升']},
    '伤害扩大':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害扩大']},
    '全域增伤':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['全域增伤']},
    '钞能增伤':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['钞能增伤']},
    '最终伤害':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['最终伤害']},
    '单体伤害':{desc:'造成单体伤害时的增幅系数【独立乘区】',affixes:['单体伤害']},
    '范围伤害':{desc:'造成范围伤害时的增幅系数【独立乘区】',affixes:['范围伤害']},
    '投射物伤害':{desc:'造成投射物伤害时的增幅系数【独立乘区】',affixes:['投射物伤害']},
    '持续性伤害':{desc:'造成持续性伤害时的增幅系数【独立乘区】',affixes:['持续性伤害']},
    '弹射伤害':{desc:'造成弹射伤害时的增幅系数【独立乘区】',affixes:['弹射伤害']},
    '异常伤害':{desc:'造成异常伤害时的增幅系数【独立乘区】',affixes:['异常伤害']},
    '陷阱伤害':{desc:'造成陷阱伤害时的增幅系数【独立乘区】',affixes:['陷阱伤害']},
    '灌注伤害':{desc:'造成灌注伤害时的增幅系数【独立乘区】',affixes:['灌注伤害']},
  };

  /* 英雄属性基线（Lv.60 · 满装快照）。改动平衡只动这里。
     数值型：纯数字；百分比型：总系数以百分比展示（100% = ×1）；
     触发类：原文机制数值 + 设计触发率。 */
  const HERO_ATTRS = {
    '生命值': '186,400',
    '攻击力': '12,480',
    '护甲值': '2,150',
    '护盾值': '5,000',
    '多重射击': '3',
    '充能速度': '1.0 / s',
    '物理': '142%', '混沌': '138%', '冰霜': '145%', '火焰': '148%', '毒素': '140%', '闪电': '143%',
    '攻击伤害': '188%', '攻击速度': '152%',
    '粉碎打击': '5% / ×2.5',
    '法术伤害': '176%',
    '能量回溯': '5% / 20%',
    '法术迸发': '5% / ×2.5',
    '暴击率': '18%', '暴击伤害': '260%',
    '弱点暴击': '5% / ×2.5',
    '生命回溯': '5% / 1%',
    '护盾回溯': '10% / 1%',
    '格挡': '5% / 30%',
    '伤害减免': '24%', '最终减伤': '12%',
    '小怪增伤': '130%', '精英增伤': '145%', '领主增伤': '160%',
    '伤害加成': '128%', '伤害增幅': '126%', '伤害强化': '124%', '伤害提升': '122%',
    '伤害扩大': '120%', '全域增伤': '135%', '钞能增伤': '118%', '最终伤害': '140%',
    '单体伤害': '130%', '范围伤害': '132%', '投射物伤害': '134%', '持续性伤害': '128%',
    '弹射伤害': '126%', '异常伤害': '125%', '陷阱伤害': '122%', '灌注伤害': '124%',
  };

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
  function tryInit(){
    const tabsEl = document.getElementById('attrTabs');
    const bodyEl = document.getElementById('attrBody');
    if (!tabsEl || !bodyEl) return false;

    // 顶部核心条（生命/攻击/护甲）+ 六元素：由 HERO_ATTRS 驱动，确保与面板同源
    const cp = document.getElementById('charPanel');
    if (cp) {
      cp.querySelectorAll('[data-tip]').forEach(el => {
        const k = (el.getAttribute('data-tip') || '').replace(/^attr:/, '');
        const v = HERO_ATTRS[k];
        if (!v) return;
        const out = el.querySelector('.val, .vl');
        if (out) out.textContent = v;
      });
    }

    function render(cat){
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
          e.dataset.tip = a.tip || ('attr:' + a.name);
          const nm = document.createElement('span');
          nm.className = 'nm'; nm.textContent = a.name;
          const vl = document.createElement('span');
          vl.className = 'vl';
          vl.textContent = HERO_ATTRS[a.name] || '—';
          e.appendChild(nm); e.appendChild(vl);
          affs.appendChild(e);
        });
        sg.appendChild(affs);
        bodyEl.appendChild(sg);
      });
    }
    render('damage');

    tabsEl.addEventListener('click', (e) => {
      const t = e.target.closest('.at');
      if (!t) return;
      tabsEl.querySelectorAll('.at').forEach(x => x.classList.toggle('on', x === t));
      render(t.dataset.cat);
    });

    const tip = document.createElement('div');
    tip.className = 'attrTip';
    document.body.appendChild(tip);

    function showTip(target){
      const k = (target.dataset.tip || '').replace(/^attr:/, '');
      const data = ATTR_POOL[k];
      if (!data) { tip.style.display = 'none'; return; }
      tip.innerHTML =
        '<h5>' + k + '</h5>' +
        '<div class="desc">' + data.desc + '</div>' +
        '<ul>' + data.affixes.map(a => '<li><span>' + a + '</span><b>词缀</b></li>').join('') + '</ul>' +
        '<div class="meta">当前值：' + (HERO_ATTRS[k] || '—') + ' ｜ 同名词缀加法、异名词缀乘区</div>';
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

    const charBtn = document.querySelector('#fbtns .fbtn[data-k="角色"]');
    if (charBtn) {
      charBtn.addEventListener('click', () => {
        const c = document.getElementById('charPanel');
        if (!c) return;
        const visible = c.style.display !== 'none';
        c.style.display = visible ? 'none' : 'block';
        charBtn.classList.toggle('on', !visible);
      });
    }
    return true;
  }

  if (!tryInit()) {
    document.addEventListener('DOMContentLoaded', tryInit);
  }
})();
