/* 爆战丨无限弹幕 v2.8 · 架构层：GameState + GameBridge + BattleScene */
'use strict';
var W = 1280, H = 720;
var GameState = (function () {
  var VERSION = 'v2.8';
  var SAVE_KEY = 'baozhan_save_v1';
  var SLOT_FILL_ORDER = BZ.SLOT_ORDER || [12,11,13,10,14,9,15,8,3,4,2,5,1,6,0,7];
  var state = { selectedRunes: [] };
  function loadSave(){ try{return JSON.parse(localStorage.getItem(SAVE_KEY))||{};}catch(e){return{};} }
  function writeSave(){ try{localStorage.setItem(SAVE_KEY,JSON.stringify({runes:state.selectedRunes.slice(0,16)}));}catch(e){} }
  function init(){ var save=loadSave(), arr=Array.isArray(save.runes)?save.runes.slice(0,16):['fireball','icespike']; state.selectedRunes=new Array(16).fill(null); for(var i=0;i<arr.length&&i<16;i++)state.selectedRunes[i]=arr[i]||null; }
  function getSelectedRunes(){ return state.selectedRunes.slice(0,16); }
  function getEquippedCount(){ var n=0; for(var i=0;i<state.selectedRunes.length;i++)if(state.selectedRunes[i])n++; return n; }
  function getRuneSlot(id){ for(var i=0;i<state.selectedRunes.length;i++)if(state.selectedRunes[i]===id)return i; return -1; }
  function placeRuneAt(orderIndex,id){ if(!BZ.RUNE_DEFS[id]||orderIndex<0||orderIndex>=16)return false; var old=getRuneSlot(id); if(old>=0)state.selectedRunes[old]=null; if(!state.selectedRunes[orderIndex]&&getEquippedCount()>=5){ if(old>=0)state.selectedRunes[old]=id; return false; } state.selectedRunes[orderIndex]=id; writeSave(); return true; }
  function clearRuneAt(orderIndex){ if(orderIndex>=0&&orderIndex<16){ state.selectedRunes[orderIndex]=null; writeSave(); } }
  function resetSave(){ try{localStorage.removeItem(SAVE_KEY);}catch(e){} }
  function buildHoneycombUiSlots(box){
    // v2.8 冻结版：整体上移并轻微缩小，确保不越界；横纵观感等距。
    var cx=box.matrixX || box.centerX, cy=box.centerY, colGap=40, rowGap=39, innerGap=31, shift=20;
    var rows=[
      {y:cy-innerGap-rowGap*3,shift:shift},{y:cy-innerGap-rowGap*2,shift:0},{y:cy-innerGap-rowGap,shift:shift},{y:cy-innerGap,shift:0},
      {y:cy+innerGap,shift:0},{y:cy+innerGap+rowGap,shift:shift},{y:cy+innerGap+rowGap*2,shift:0},{y:cy+innerGap+rowGap*3,shift:shift}
    ];
    var slots=[]; for(var r=0;r<rows.length;r++){ slots.push({x:cx-colGap/2+rows[r].shift,y:rows[r].y}); slots.push({x:cx+colGap/2+rows[r].shift,y:rows[r].y}); } return slots;
  }
  function getLoadoutSlotView(box){ var selected=getSelectedRunes(), uiSlots=buildHoneycombUiSlots(box); return uiSlots.map(function(point,orderIndex){ var slotIndex=SLOT_FILL_ORDER[orderIndex], runeId=selected[orderIndex]||null; return {orderIndex:orderIndex,slot:slotIndex,point:point,runeId:runeId,def:runeId?BZ.RUNE_DEFS[runeId]:null}; }); }
  function getHeroUiPoint(box){ return {x:box.heroX || box.centerX + 60,y:box.centerY}; }
  function getDividerUiLine(box){ return {x1:box.matrixX - 48, x2:box.dividerX || box.centerX + 42, y:box.centerY}; }
  function createBattleConfig(){ return {version:VERSION,runes:getSelectedRunes(),slotOrder:SLOT_FILL_ORDER.slice(),saveKey:SAVE_KEY}; }
  init();
  return {VERSION:VERSION,SAVE_KEY:SAVE_KEY,SLOT_FILL_ORDER:SLOT_FILL_ORDER,getSelectedRunes:getSelectedRunes,getEquippedCount:getEquippedCount,getRuneSlot:getRuneSlot,placeRuneAt:placeRuneAt,clearRuneAt:clearRuneAt,resetSave:resetSave,getLoadoutSlotView:getLoadoutSlotView,getHeroUiPoint:getHeroUiPoint,getDividerUiLine:getDividerUiLine,createBattleConfig:createBattleConfig};
})();
var GameBridge=(function(){var handlers={};return{on:function(n,fn){(handlers[n]||(handlers[n]=[])).push(fn);},emit:function(n,p){var list=handlers[n]||[];for(var i=0;i<list.length;i++)list[i](p||{});}};})();
function cssColor(c){return '#'+('000000'+c.toString(16)).slice(-6);}
var BattleScene=new Phaser.Class({Extends:Phaser.Scene,initialize:function BattleScene(){Phaser.Scene.call(this,{key:'battle'});},init:function(data){this.battleConfig=data||{runes:[]};this.runes=this.battleConfig.runes||[];},create:function(){this.S=BZ.createBattle(this.runes);this.g=this.add.graphics();this.paused=false;this.result=null;this.liveTexts=[];this.freeTexts=[];this.slotFlash={};var st={fontFamily:'Arial, sans-serif',fontSize:'20px',color:'#e5e7eb'};this.hudWave=this.add.text(18,18,'',st);this.hudWall=this.add.text(W/2,18,'',{fontFamily:'Arial',fontSize:'18px',color:'#e5e7eb'}).setOrigin(.5,0);this.add.text(W-18,18,'空格暂停 · R重开',{fontFamily:'Arial',fontSize:'15px',color:'#64748b'}).setOrigin(1,0);this.pauseText=this.add.text(W/2,H/2,'已暂停',{fontFamily:'Arial',fontSize:'48px',color:'#fbbf24'}).setOrigin(.5).setVisible(false);var scene=this;this.input.keyboard.on('keydown-SPACE',function(){scene.paused=!scene.paused;scene.pauseText.setVisible(scene.paused);});this.input.keyboard.on('keydown-R',function(){GameBridge.emit('battle:restart');});GameBridge.emit('battle:ready');},update:function(time,delta){if(this.paused)return;var S=this.S,i;BZ.updateBattle(S,delta/1000);for(i=0;i<S.flashSlots.length;i++)this.slotFlash[S.flashSlots[i]]=0.5;for(i=0;i<S.runes.length;i++)if(S.flashSlots.indexOf(S.runes[i].slot)>=0)S.runes[i].flash=0.5;this.sync();if((S.state==='victory'||S.state==='defeat')&&!this.result){this.result=S.result;this.paused=true;GameBridge.emit(S.result.win?'battle:ended':'battle:failed',S.result);}},getText:function(str,color){var v=this.freeTexts.pop();if(!v)v=this.add.text(0,0,'',{fontFamily:'Arial',fontSize:'17px',fontStyle:'bold'});v.setText(str).setColor(color||'#fff').setAlpha(1).setVisible(true).setOrigin(.5);this.liveTexts.push(v);return v;},recycleTexts:function(seen){for(var j=this.liveTexts.length-1;j>=0;j--){var v=this.liveTexts[j];if(seen.indexOf(v._src)<0){v.setVisible(false);v._src=null;this.liveTexts.splice(j,1);this.freeTexts.push(v);}}}});
