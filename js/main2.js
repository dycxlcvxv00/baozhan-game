/* 爆战丨无限弹幕 v4.3 · BattleScene 渲染同步：性能回退 + 装配外观同构 */
'use strict';
BattleScene.prototype.hex=function(g,x,y,r,color,alpha,lw){var pts=[];for(var k=0;k<6;k++){var a=Math.PI/3*k-Math.PI/2;pts.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r});}if(lw){g.lineStyle(lw,color,alpha);g.strokePoints(pts,true);}else{g.fillStyle(color,alpha);g.fillPoints(pts,true);}};
BattleScene.prototype.hexBox=function(g,x,y,w,h,color,alpha,lw){var hw=w/2,hh=h/2,pts=[{x:x,y:y-hh},{x:x+hw,y:y-hh*.5},{x:x+hw,y:y+hh*.5},{x:x,y:y+hh},{x:x-hw,y:y+hh*.5},{x:x-hw,y:y-hh*.5}];if(lw){g.lineStyle(lw,color,alpha);g.strokePoints(pts,true);}else{g.fillStyle(color,alpha);g.fillPoints(pts,true);}};
BattleScene.prototype.sync=function(){
  var oldW=W,oldH=H;adaptBattleLayout();if((oldW!==W||oldH!==H)&&this.scale)this.scale.resize(W,H);
  var S=this.S,g=this.g,cfg=BZ.CONFIG,ui=BZ.UI,i;
  var topH=ui.topH,bottomH=ui.bottomH,battleTop=ui.battleTop,battleBottom=ui.battleBottom,battleH=battleBottom-battleTop;
  g.clear();
  g.fillStyle(0x050816,1).fillRect(0,0,W,H);
  g.fillStyle(0x0f172a,1).fillRoundedRect(6,6,W-12,topH-10,12);
  g.fillStyle(0x0b1120,1).fillRoundedRect(6,battleTop+6,W-12,battleH-12,14);
  g.fillStyle(0x0f172a,1).fillRoundedRect(6,H-bottomH+6,W-12,bottomH-12,14);
  g.lineStyle(2,0x334155,.95).strokeRoundedRect(6,6,W-12,topH-10,12);
  g.lineStyle(2,0x334155,.95).strokeRoundedRect(6,battleTop+6,W-12,battleH-12,14);
  g.lineStyle(2,0x334155,.95).strokeRoundedRect(6,H-bottomH+6,W-12,bottomH-12,14);
  g.fillStyle(0x101a30,1).fillRoundedRect(14,battleTop+14,W-28,battleH-28,12);
  g.fillStyle(0x1e3a8a,.18).fillRoundedRect(18,battleTop+18,Math.max(24,cfg.wallX-42),Math.max(20,battleH-36),16);
  g.fillStyle(0x0d1426,1).fillRect(cfg.wallX,battleTop+14,W-cfg.wallX-18,battleH-28);
  g.lineStyle(1,0x1e293b,.24);for(i=0;i<=Math.ceil(W/72);i++)g.lineBetween(i*72,battleTop+14,i*72,battleBottom-14);for(i=0;i<=Math.ceil(battleH/72);i++)g.lineBetween(14,battleTop+i*72,W-14,battleTop+i*72);
  var wallColor=S.wallFlash>0?0xfef2f2:0xcbd5e1;g.fillStyle(wallColor,1).fillRoundedRect(cfg.wallX-5,battleTop+18,10,battleH-36,5);if(S.shield>0)g.lineStyle(4,0x7dd3fc,.75).strokeRoundedRect(cfg.wallX-15,battleTop+22,30,battleH-44,8);
  this.hexBox(g,S.hero.x,S.hero.y,50,58,0x60a5fa,1,0);this.hexBox(g,S.hero.x,S.hero.y,42,51,0x1d4ed8,1,0);g.fillStyle(0xdbeafe,1).fillCircle(S.hero.x,S.hero.y,5);
  for(i=0;i<BZ.SLOT_POS.length;i++){var sp=BZ.SLOT_POS[i];this.hexBox(g,sp.x,sp.y,42,48,0x64748b,.72,0);this.hexBox(g,sp.x,sp.y,34,40,0x1e293b,1,0);}for(i=0;i<S.runes.length;i++){var r=S.runes[i],def=BZ.RUNE_DEFS[r.id],pct=Math.min(1,r.energy/def.energyMax);this.hexBox(g,r.x,r.y,42,48,def.color,.58,0);this.hexBox(g,r.x,r.y,34,40,def.color,pct>=1?.88:.55,0);if(r.flash>0)this.hex(g,r.x,r.y,26+r.flash*5,def.color,Math.max(0,r.flash),2);g.fillStyle(0x020617,1).fillRoundedRect(r.x-10,r.y+17,20,3,2);g.fillStyle(def.color,1).fillRoundedRect(r.x-10,r.y+17,20*pct,3,2);}
  for(i=0;i<S.monsters.length;i++){var m=S.monsters[i],alpha=m.inv>0?.45:1;g.fillStyle(m.flash>0?0xffffff:m.color,alpha).fillCircle(m.x,m.y,m.radius);if(m.inv>0)g.lineStyle(2,0x7dd3fc,.8).strokeCircle(m.x,m.y,m.radius+4);if(m.slowPct>0)g.lineStyle(2,0x38bdf8,.9).strokeCircle(m.x,m.y,m.radius+2);if(m.poisonT>0)g.lineStyle(2,0x4ade80,.9).strokeCircle(m.x,m.y,m.radius+5);var hpct=Math.max(0,m.hp/m.maxHp);g.fillStyle(0x111827,1).fillRect(m.x-16,m.y-m.radius-10,32,4);g.fillStyle(0xef4444,1).fillRect(m.x-16,m.y-m.radius-10,32*hpct,4);}for(i=0;i<S.projectiles.length;i++){var pr=S.projectiles[i];g.fillStyle(pr.color,1).fillCircle(pr.x,pr.y,pr.radius);}
  for(i=0;i<S.effects.length;i++){var e=S.effects[i],prog=1-e.life/e.maxLife,ea=Math.max(0,e.life/e.maxLife);if(e.kind==='ring'||e.kind==='burst')g.lineStyle(4,e.color,ea).strokeCircle(e.x,e.y,(14+prog*60)*e.scale);else if(e.kind==='shield')g.lineStyle(5,e.color,ea).strokeRect(cfg.wallX-14-prog*6,battleTop+8,28+prog*12,battleH-16);else if(e.kind==='bolt'&&e.hops){g.lineStyle(3,e.color,ea);g.beginPath();g.moveTo(e.x,e.y);for(var h=0;h<e.hops.length;h++)g.lineTo(e.hops[h].x,e.hops[h].y);g.strokePath();}}
  var bw=Math.min(420,Math.max(260,W*.34)),bx=W/2-bw/2,by=H-bottomH/2+6;g.fillStyle(0x111827,1).fillRoundedRect(bx-12,by-18,bw+24,40,12);g.lineStyle(1,0x475569,.9).strokeRoundedRect(bx-12,by-18,bw+24,40,12);g.fillStyle(0x020617,1).fillRect(bx,by,bw,13);g.fillStyle(0xef4444,1).fillRect(bx,by,bw*Math.max(0,S.wallHp/S.wallMaxHp),13);if(S.shield>0)g.fillStyle(0x7dd3fc,1).fillRect(bx,by-7,bw*Math.min(1,S.shield/S.shieldMax),4);
  var sx=34,sy=H-bottomH/2+6;g.fillStyle(0x111827,1).fillCircle(sx,sy,24);g.lineStyle(2,0x60a5fa,.75).strokeCircle(sx,sy,24);
  var seen=[];for(i=0;i<S.texts.length;i++){var t=S.texts[i];seen.push(t);var v=t._view;if(!v){v=this.getText(t.str,t.color);t._view=v;v._src=t;}v.setPosition(t.x,t.y).setAlpha(Math.max(0,t.life/t.maxLife));}this.recycleTexts(seen);this.hudWave.setText(BZ.waveLabel(S));this.hudWall.setText('围墙 '+Math.ceil(S.wallHp)+' / '+S.wallMaxHp+(S.shield>0?' · 护盾 '+Math.ceil(S.shield):''));this.hudWall.setX(W/2);if(this.helpText)this.helpText.setPosition(W-18,18);if(this.pauseText)this.pauseText.setPosition(W/2,H/2);if(this.speedBtn)this.speedBtn.setPosition(sx,sy);
};
