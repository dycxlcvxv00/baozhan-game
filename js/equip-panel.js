
  /* 装备栏顶部切换按钮（预留：装备 / 背包 / 图鉴 / 属性） */
  (function renderEquipTabs(){
    const wrap = document.getElementById('equipTabs');
    if (!wrap) return;
    const TABS = ['装备', '背包', '图鉴', '属性'];
    TABS.forEach(function(t, i){
      const b = document.createElement('div');
      b.className = 'etab' + (i === 0 ? ' on' : '');
      b.textContent = t;
      b.addEventListener('click', function(){
        Array.prototype.querySelectorAll.call(wrap.querySelectorAll('.etab'), function(x){ x.classList.remove('on'); });
        b.classList.add('on');
      });
      wrap.appendChild(b);
    });
  })();

  /* 英雄 10 件装备面板 —— 竖版纸娃娃布局（与 window.HERO 装备系统同步）
   * 坐标来源：截图 963x252 像素实测（装备栏区域 x140~817 y9~244，宽 678 高 236）
   * x/y/w/h = 相对装备栏左上角的 px；c = 该槽位框色（截图实测品质色）
   *
   * 同步逻辑：
   *   - 从 window.HERO.equipped + window.ITEM_MAP 读取已穿戴装备
   *   - 按装备的 slot 字段（武器/护甲/饰品/鞋子/核心）匹配到对应槽位
   *   - 装备变化时（HERO.onChange）自动重绘
   *   - 初始状态：所有槽位为空（HERO.equipped = {}）
   */
  (function renderEquip(){
    var grid = document.getElementById('equipGrid');
    if (!grid) return;

    // 槽位定义：slot 名 → 布局坐标 / 颜色 / 匹配规则
    var SLOT_DEFS = [
      { key:'武器',   x:0,   y:35,  w:120, h:200, c:'rgb(128,92,45)',  match:['武器'] },
      { key:'头盔',   x:139, y:0,   w:110, h:110, c:'rgb(46,81,134)',  match:['头盔'] },
      { key:'手套',   x:139, y:125, w:110, h:110, c:'rgb(100,65,135)', match:['手套'] },
      { key:'护甲',   x:278, y:0,   w:120, h:175, c:'rgb(129,93,45)',  match:['护甲'] },
      { key:'腰带',   x:278, y:190, w:120, h:45,  c:'rgb(127,92,46)',  match:['腰带'] },
      { key:'项链',   x:457, y:1,   w:50,  h:50,  c:'rgb(54,88,50)',   match:['项链'] },
      { key:'左戒指', x:427, y:61,  w:50,  h:50,  c:'rgb(114,83,42)',  match:['饰品','左戒指'] },
      { key:'右戒指', x:487, y:61,  w:50,  h:50,  c:'rgb(43,70,113)',  match:['饰品','右戒指'] },
      { key:'鞋子',   x:427, y:125, w:110, h:110, c:'rgb(98,65,132)',  match:['鞋子'] },
      { key:'副手',   x:558, y:35,  w:120, h:200, c:'rgb(128,92,45)',  match:['副手','核心'] }
    ];

    // 查找某槽位当前穿戴的装备
    function findItemForSlot(slotDef){
      var HERO = window.HERO;
      var ITEM_MAP = window.ITEM_MAP;
      if (!HERO || !ITEM_MAP) return null;
      for (var id in HERO.equipped) {
        if (HERO.equipped[id]) {
          var it = ITEM_MAP[id];
          if (it && slotDef.match.indexOf(it.slot) >= 0) return it;
        }
      }
      return null;
    }

    function draw(){
      grid.innerHTML = '';
      SLOT_DEFS.forEach(function(sd){
        var it = findItemForSlot(sd);
        var on = !!it;
        var div = document.createElement('div');
        div.className = 'eslot' + (on ? ' on' : '');
        div.style.left = sd.x + 'px';
        div.style.top = sd.y + 'px';
        div.style.width = sd.w + 'px';
        div.style.height = sd.h + 'px';
        div.style.borderColor = on ? sd.c : 'rgba(165,172,190,.55)';
        div.style.fontSize = (sd.w < 60 ? 10 : (sd.w < 120 ? 12 : 14)) + 'px';

        if (on) {
          // 已穿戴：显示装备图标 + 名称 + 品质色
          var RAR = window.RARITY || {};
          var rc = (RAR[it.rarity] || {}).color || '#fff';
          div.innerHTML =
            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px">'
          +   '<span style="font-size:' + (sd.w < 60 ? '20' : '32') + 'px;line-height:1">' + (it.icon || '❔') + '</span>'
          +   '<span class="nm" style="color:' + rc + ';font-size:' + (sd.w < 60 ? '9' : '11') + 'px;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">' + it.name + '</span>'
          + '</div>';
          div.title = it.name + '（' + it.slot + '）· 右键卸下';
        } else {
          div.innerHTML = '<span class="nm">' + sd.key + '</span>';
          div.title = sd.key + '  未穿戴';
        }

        // 右键卸下已穿戴装备
        div.addEventListener('contextmenu', function(e){
          e.preventDefault(); e.stopPropagation();
          if (it && window.HERO) { window.HERO.toggle(it); }
        });

        grid.appendChild(div);
      });
    }

    // 绑定装备变化监听并重绘（HERO 未就绪则延迟到 DOMContentLoaded）
    function bindAndDraw(){
      if (window.HERO) {
        window.HERO.onChange(draw);
        draw();
      } else {
        document.addEventListener('DOMContentLoaded', bindAndDraw);
      }
    }
    bindAndDraw();
  })();

  (function blockContextMenu(){
    var st = document.getElementById('stage') || document;
    st.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    st.addEventListener('mousedown', function(e){ if (e.button === 2) e.preventDefault(); });
    document.addEventListener('dragstart', function(e){ e.preventDefault(); });
  })();
