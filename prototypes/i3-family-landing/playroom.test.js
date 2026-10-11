/** Real board renderers and engine are exercised together. Browser checks cover
 * geometry and native touch; these tests verify learning and interaction rules. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountPlayroom} from './playroom.js';
import {GAMES,PLAYROOM_KEY,loadGames,saveGames,createGame,attemptMove,advanceGame,gameById,currentLevel} from './playroom-engine.js';
const GUIDE='fixforward.playroom.guide.v1';
function setup(t,{route='play?game=materials',seen=true,storageFail=false,motion=false,haptic=false,initialSessions=[]}={}){
  const dom=new JSDOM('<main></main>',{url:'http://playroom.test/'}),win=dom.window,host=win.document.querySelector('main');
  win.matchMedia=()=>({matches:motion});if(seen)win.localStorage.setItem(GUIDE,'seen');
  saveGames(win.localStorage,initialSessions);
  const vibrations=[];if(haptic)win.navigator.vibrate=p=>{vibrations.push(p);return true;};
  if(storageFail)win.Storage.prototype.setItem=()=>{throw new Error('Full');};
  const scroll=[];win.HTMLElement.prototype.scrollIntoView=function(){scroll.push(this);};
  const controller=new win.AbortController(),cleanup=mountPlayroom(host,{route,signal:controller.signal});
  t.after(()=>{cleanup();win.close();});
  const ui={win,host,vibrations,scroll,cleanup,controller,q:s=>host.querySelector(s),read:()=>loadGames(win.localStorage).at(-1),click:s=>{const b=host.querySelector(s);assert.ok(b,s);assert.equal(b.disabled,false,s);b.click();}};return ui;
}
function place(ui,p,t){ui.click(`[data-piece="${p}"]`);ui.click(`[data-target="${t}"]`);}
for(const game of GAMES)test(`${game.title} completes every real board and restores its full-Spark record`,t=>{
  const ui=setup(t,{route:'play?game='+game.id});
  for(const level of game.levels){
    for(const p of level.pieces){place(ui,p.id,p.answer);assert.match(ui.q('[data-pr-feedback]').textContent,/You did it/);assert.ok(!ui.q(`[data-piece="${p.id}"]`)||ui.q(`[data-piece="${p.id}"]`).disabled);}
    assert.ok(ui.q('[data-pr-next]'));ui.click('[data-pr-next]');
  }
  const moves=game.levels.reduce((sum,l)=>sum+l.pieces.length,0);
  assert.match(ui.host.textContent,/What we discovered/);assert.ok(ui.host.textContent.includes(`${moves*15} Sparks`));
  assert.equal(ui.read().status,'complete');assert.equal(ui.read().attempts.length,moves);assert.deepEqual(ui.scroll,[]);
});
test('practice teaches tap-to-move without recording or scoring and blocks the room behind it',t=>{
  const ui=setup(t,{seen:false});assert.ok(ui.q('[role="dialog"]'));
  ui.click('[data-piece="copper-wire"]');ui.click('[data-target="glass"]');assert.equal(ui.read().attempts.length,0);
  ui.click('[data-pr-practice-piece]');ui.click('[data-pr-practice-target]');assert.equal(ui.q('[data-pr-ready]').disabled,false);
  assert.equal(ui.read().points,0);ui.click('[data-pr-ready]');assert.equal(ui.q('[role="dialog"]'),null);
  assert.equal(ui.win.localStorage.getItem(GUIDE),'seen');ui.click('[data-pr-guide]');assert.ok(ui.q('[role="dialog"]'));
});
test('wrong/right feedback, exact evidence, duplicate protection and resume agree',t=>{
  const ui=setup(t);place(ui,'copper-wire','glass');assert.equal(ui.q('[data-pr-feedback]').dataset.kind,'wrong');assert.match(ui.q('[data-pr-flash]').textContent,/✕/);
  ui.click('[data-target="metals"]');assert.equal(ui.q('[data-pr-feedback]').dataset.kind,'correct');assert.match(ui.q('[data-pr-flash]').textContent,/10 Sparks/);
  assert.equal(ui.read().points,10);assert.equal(ui.read().attempts.length,2);assert.equal(ui.read().attempts[0].targetId,'glass');
  ui.q('[data-piece="copper-wire"]').click();ui.click('[data-target="metals"]');assert.equal(ui.read().points,10);
  ui.cleanup();const again=mountPlayroom(ui.host,{route:'play?game=materials'});assert.equal(ui.q('[data-pr-points]').textContent,'10');assert.equal(ui.q('[data-piece="copper-wire"]').disabled,true);again();
});
test('hints remain one per stage and can be closed with Escape',t=>{
  const ui=setup(t);ui.click('[data-pr-help]');assert.equal(ui.read().hints.length,1);
  ui.host.dispatchEvent(new ui.win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(ui.q('[role="dialog"]'),null);
  ui.click('[data-pr-help]');ui.click('[data-pr-close]');assert.equal(ui.read().hints.length,1);
  place(ui,'copper-wire','metals');assert.equal(ui.read().points,10);
});
test('neutral target taps do not count and storage failure does not prevent play',t=>{
  const ui=setup(t,{storageFail:true});ui.click('[data-target="glass"]');assert.equal(ui.q('[data-pr-feedback]').dataset.kind,'neutral');
  place(ui,'copper-wire','metals');assert.equal(ui.q('[data-pr-points]').textContent,'15');assert.equal(ui.q('[data-pr-save]').hidden,false);
});
test('opt-in vibration is gated by motion preference and cancelled during cleanup',t=>{
  const ui=setup(t,{haptic:true});place(ui,'copper-wire','glass');assert.deepEqual(ui.vibrations,[]);
  ui.click('[data-pr-guide]');ui.click('[data-pr-haptics]');ui.click('[data-pr-skip]');ui.click('[data-target="metals"]');assert.deepEqual(ui.vibrations,[35]);
  ui.click('[data-pr-motion]');place(ui,'screen-glass','glass');assert.deepEqual(ui.vibrations,[35,0]);ui.cleanup();assert.equal(ui.vibrations.at(-1),0);
});
test('dragging a practice star succeeds and missed actual drops stay neutral',t=>{
  const ui=setup(t,{seen:false});
  function pointer(node,type,x,y){const event=new ui.win.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y});node.dispatchEvent(event);}
  let piece=ui.q('[data-pr-practice-piece]');ui.win.document.elementFromPoint=()=>ui.q('[data-pr-practice-target]');
  pointer(piece,'pointerdown',10,10);pointer(piece,'pointermove',100,30);assert.ok(ui.win.document.querySelector('.pr-drag-ghost'));
  pointer(piece,'pointerup',100,30);assert.equal(ui.q('[data-pr-ready]').disabled,false);assert.equal(ui.read().attempts.length,0);
  // Click suppression lasts briefly after a drag; use Escape to leave practice.
  ui.host.dispatchEvent(new ui.win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  piece=ui.q('[data-piece="copper-wire"]');ui.win.document.elementFromPoint=()=>null;
  pointer(piece,'pointerdown',10,10);pointer(piece,'pointermove',100,30);pointer(piece,'pointerup',100,30);
  assert.equal(ui.read().attempts.length,0);assert.equal(ui.q('[data-pr-feedback]').dataset.kind,'neutral');assert.equal(ui.win.document.querySelector('.pr-drag-ghost'),null);
});
test('abort removes child mode, pointer ghost, modal and handlers',t=>{
  const ui=setup(t,{seen:false});ui.controller.abort();assert.equal(ui.win.document.body.classList.contains('playroom-child'),false);assert.equal(ui.q('[role="dialog"]'),null);
  const before=ui.win.localStorage.getItem(PLAYROOM_KEY);ui.q('[data-pr-help]').click();assert.equal(ui.win.localStorage.getItem(PLAYROOM_KEY),before);
});
test('hub offers both new games and preserves the original workshop',t=>{
  const ui=setup(t,{route:'games'});for(const href of ['#clue-lab','#play?game=materials','#play?game=care','#learn'])assert.ok(ui.q(`.pr-game-cards a[href="${href}"]`));
  ui.click('[data-pr-guide]');ui.click('[data-pr-skip]');assert.equal(ui.read(),undefined);
});
test('unknown game links open the chooser without creating a record',t=>{
  const ui=setup(t,{route:'play?game=unknown'});assert.ok(ui.q('.pr-hub'));assert.equal(ui.read(),undefined);
});

function reachStage(id){let s=createGame('materials');while(currentLevel(s).id!==id){for(const p of currentLevel(s).pieces)s=attemptMove(s,p.id,p.answer).state;s=advanceGame(s);}return s;}
test('material names appear after a successful match while the factory context stays visible',t=>{
  const ui=setup(t),piece=gameById('materials').levels[0].pieces.find(p=>p.id==='copper-wire');
  assert.ok(ui.q('[data-piece="copper-wire"]').textContent.includes(piece.label));
  assert.ok(!ui.q('[data-piece="copper-wire"]').textContent.includes(piece.revealedLabel));
  assert.match(ui.q('[data-pr-board]').textContent,/Factory only/i);
  place(ui,piece.id,piece.answer);assert.ok(ui.q('[data-piece="copper-wire"]').textContent.includes(piece.revealedLabel));
});
test('the battery picture needs adult-led battery collection and records an incorrect factory choice',t=>{
  const before=reachStage('battery-stop'),ui=setup(t,{initialSessions:[before]});
  place(ui,'battery-picture','factory');assert.equal(ui.read().points,before.points);assert.equal(ui.q('[data-pr-feedback]').dataset.kind,'wrong');
  ui.click('[data-target="battery-dropoff"]');assert.equal(ui.read().points,before.points+10);assert.ok(ui.q('[data-pr-next]'));
  assert.equal(ui.read().attempts.at(-2).targetId,'factory');
});
test('rubbish shows lost materials and allows a scored retry to whole-phone drop-off',t=>{
  const before=reachStage('phone-choice'),ui=setup(t,{initialSessions:[before]});
  place(ui,'old-phone','rubbish');assert.ok(ui.q('[data-materials-landfill]'));assert.equal(ui.read().points,before.points);
  ui.click('[data-target="ewaste-dropoff"]');assert.equal(ui.read().points,before.points+10);assert.equal(ui.q('[data-materials-landfill]'),null);
  ui.click('[data-pr-next]');assert.ok(ui.q('a[href="#learn?game=fix-it"]'));assert.ok(ui.q('a[href="#action?kind=recycle"]'));
  assert.equal(ui.read().status,'complete');
});
test('a new materials adventure leaves the earlier saved round and its evidence intact',t=>{
  let old=createGame('materials',{contentVersion:1});old=attemptMove(old,'copper-wire','metals').state;
  const ui=setup(t,{initialSessions:[old]}),records=loadGames(ui.win.localStorage);
  assert.equal(records.length,2);assert.equal(records[0].points,15);assert.equal(records[0].contentVersion,1);
  assert.equal(records[0].attempts[0].text,old.attempts[0].text);assert.equal(ui.read().contentVersion,2);assert.equal(ui.read().points,0);
});
