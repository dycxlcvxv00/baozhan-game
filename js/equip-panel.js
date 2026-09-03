
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
        Array.prototype.forEach.call(wrap.querySelectorAll('.etab'), function(x){ x.classList.remove('on'); });
        b.classList.add('on');
      });
      wrap.appendChild(b);
    });
  })();

  /* 英雄 10 件装备面板 —— 竖版纸娃娃布局
   * 坐标来源：截图 963x252 像素实测（装备栏区域 x140~817 y9~244，宽 678 高 236）
   * x/y/w/h = 相对装备栏左上角的 px；c = 该槽位框色（截图实测品质色）
   */
  (function renderEquip(){
    const grid = document.getElementById('equipGrid');
    if (!grid || !window.__gameH) return;
    const G = window.__gameH;
    const EQ_LAYOUT = [
      { slot:'武器',   x:0,   y:35,  w:120, h:200, c:'rgb(128,92,45)'  },
      { slot:'头盔',   x:139, y:0,   w:110, h:110, c:'rgb(46,81,134)'  },
      { slot:'手套',   x:139, y:125, w:110, h:110, c:'rgb(100,65,135)' },
      { slot:'护甲',   x:278, y:0,   w:120, h:175, c:'rgb(129,93,45)'  },
      { slot:'腰带',   x:278, y:190, w:120, h:45,  c:'rgb(127,92,46)'  },
      { slot:'项链',   x:457, y:1,   w:50,  h:50,  c:'rgb(54,88,50)'   },
      { slot:'左戒指', x:427, y:61,  w:50,  h:50,  c:'rgb(114,83,42)'  },
      { slot:'右戒指', x:487, y:61,  w:50,  h:50,  c:'rgb(43,70,113)'  },
      { slot:'鞋子',   x:427, y:125, w:110, h:110, c:'rgb(98,65,132)'  },
      { slot:'副手',   x:558, y:35,  w:120, h:200, c:'rgb(128,92,45)'  }
    ];
    function draw(){
      grid.innerHTML = '';
      EQ_LAYOUT.forEach(function(it){
        const on = !!G.isFitted(it.slot);
        const div = document.createElement('div');
        div.className = 'eslot' + (on ? ' on' : '');
        div.style.left = it.x + 'px';
        div.style.top = it.y + 'px';
        div.style.width = it.w + 'px';
        div.style.height = it.h + 'px';
        div.style.borderColor = on ? it.c : 'rgba(165,172,190,.55)';
        div.style.fontSize = (it.w < 60 ? 10 : (it.w < 120 ? 12 : 14)) + 'px';
        div.title = it.slot + (on ? '  已穿戴\n左键脱下 · 右键卸下' : '  未穿戴\n左键穿戴');
        div.innerHTML = '<span class="nm">' + it.slot + '</span>';
        div.addEventListener('click', function(){ G.toggleSlot(it.slot); draw(); });
        div.addEventListener('contextmenu', function(e){
          e.preventDefault(); e.stopPropagation();
          if (G.isFitted(it.slot)) { G.unequipSlot(it.slot); draw(); }
        });
        grid.appendChild(div);
      });
    }
    draw();
  })();

  (function blockContextMenu(){
    const st = document.getElementById('stage') || document;
    st.addEventListener('contextmenu', (e) => e.preventDefault());
    st.addEventListener('mousedown', (e) => { if (e.button === 2) e.preventDefault(); });
    document.addEventListener('dragstart', (e) => e.preventDefault());
  })();
