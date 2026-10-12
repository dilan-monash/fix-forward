import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountScrapworks,loadScrapworksJournal,saveScrapworksJournal,replayScrapworks,SCRAPWORKS_JOURNAL_KEY} from './scrapworks.js';
import {LEVELS,ITEMS,SAVE_KEY,bestScore,readSave} from './reference/scrapworks-engine.js';
import {deviceArt,townArt} from './scrapworks-art.js';

function setup(t,{stars={},route='scrapworks',storageFail=false}={}) {
  const dom=new JSDOM('<main></main>',{url:'http://scrapworks.test/'}),win=dom.window,host=win.document.querySelector('main');
  win.localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,stars}));
  win.matchMedia=()=>({matches:true});
  const awards=[],learning=[],nav=[],scroll=[];
  win.HTMLElement.prototype.scrollIntoView=function(){scroll.push(this);};
  if(storageFail)win.Storage.prototype.setItem=()=>{throw new Error('Full');};
  const controller=new win.AbortController();
  const cleanup=mountScrapworks(host,{route,signal:controller.signal,onNavigate:value=>nav.push(value),onAward:(...args)=>awards.push(args),onLearn:value=>learning.push(value)});
  t.after(()=>{cleanup();win.close();});
  return {win,host,awards,learning,nav,scroll,cleanup,controller,q:s=>host.querySelector(s),click:s=>{const button=host.querySelector(s);assert.ok(button,s);assert.notEqual(button.disabled,true,s);button.click();},rounds:()=>loadScrapworksJournal(win.localStorage),current:()=>loadScrapworksJournal(win.localStorage).map(replayScrapworks).find(value=>!value.complete)};
}
function choice(ui,destination){ui.click(`[data-dest="${destination}"]`);}
function pointer(ui,node,type,x,y){const event=new ui.win.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y});node.dispatchEvent(event);}
function optimal(level) {
  const choose=(index,tokens)=>{
    if(index===level.items.length)return {points:0,routes:[]};
    const item=ITEMS[level.items[index]],options=item.hazard?[['hold',3,0]]:item.condition==='working'?[['reuse',4,0]]:item.condition==='end_of_life'?[['recycle',3,0]]:[['recycle',1,0],...(tokens>=item.repairCost?[['repair',3+item.lifeBonus,item.repairCost]]:[])];
    return options.map(([route,points,cost])=>{const rest=choose(index+1,tokens-cost);return {points:points+rest.points,routes:[route,...rest.routes]};}).sort((a,b)=>b.points-a.points)[0];
  };return choose(0,level.tokens);
}
function finishLevel(ui,level) {
  const plan=optimal(level);
  for(let i=0;i<level.items.length;i++){
    const item=ITEMS[level.items[i]];
    if(item.personalData&&!item.hazard)ui.click('[data-clear]');
    choice(ui,plan.routes[i]);
    assert.ok(ui.q('[data-next]'));
    ui.click('[data-next]');
  }
  return plan;
}

test('map preserves original stars and unlocks while offering exactly eight shifts',t=>{
  const ui=setup(t,{stars:{1:3,2:2}});
  assert.equal(ui.win.document.body.classList.contains('ff-game-mode'),true);
  assert.equal(ui.host.querySelectorAll('[data-level]').length,9,'eight map cards plus start button');
  assert.equal(ui.q('[data-level="3"]').disabled,false);
  assert.equal(ui.q('[data-level="4"]').disabled,true);
  assert.deepEqual(readSave(ui.win.localStorage).stars,{1:3,2:2});
  ui.click('[data-nav]');assert.deepEqual(ui.nav,['#howto?game=scrapworks']);
});

test('first item reveals its clue automatically with no mandatory inspect button',t=>{
  const ui=setup(t);ui.click('[data-level="1"]');
  assert.equal(ui.win.document.body.classList.contains('ff-game-mode'),true);
  assert.equal(ui.q('[data-inspect]'),null);
  assert.match(ui.q('[data-clue]').textContent,/Staff already reset/);
  assert.equal(ui.current().shift.inspected,true);
  assert.equal(ui.q('[data-score]').textContent,'0');
  assert.ok(ui.q('[data-device]'));
  assert.deepEqual(ui.scroll,[]);
});

test('wrong choices give immediate cross, preserve item and tokens, and log exact feedback',t=>{
  const ui=setup(t,{route:'scrapworks?shift=1'});
  choice(ui,'repair');
  assert.equal(ui.q('[data-feedback]').dataset.kind,'wrong');
  assert.match(ui.q('[data-feedback]').textContent,/✕.*already works/s);
  assert.equal(ui.q('[data-score]').textContent,'0');
  assert.equal(ui.q('[data-tokens]').textContent,'1');
  assert.equal(ui.q('[data-item-number]').textContent,'1');
  assert.equal(ui.q('[data-next]'),null);
  const event=ui.rounds()[0].events[0];
  assert.equal(event.destination,'repair');assert.equal(event.result.ok,false);
  assert.equal(event.result.text,ui.q('[data-feedback] p').textContent);
  choice(ui,'bin');assert.equal(ui.q('[data-dest="bin"]'),null);
  assert.match(ui.q('[data-feedback]').textContent,/stay out of rubbish/);
});

test('each successful route changes its scene and town immediately, then waits for Next',t=>{
  const ui=setup(t,{route:'scrapworks?shift=1'});
  choice(ui,'reuse');
  assert.equal(ui.q('[data-scene]').dataset.scene,'reuse');assert.ok(ui.q('.sw5-gift'));
  assert.equal(ui.q('[data-score]').textContent,'4');
  assert.match(ui.q('[data-feedback]').textContent,/✓.*\+4 Sparks.*Town detail added/s);
  assert.match(ui.q('.sw5-town-counter').textContent,/1 town detail/);
  assert.match(ui.q('[data-item-title]').textContent,/Library tablet/);
  assert.ok([...ui.host.querySelectorAll('[data-dest]')].every(button=>button.disabled));
  const count=ui.rounds()[0].events.length;ui.q('[data-dest="reuse"]').click();assert.equal(ui.rounds()[0].events.length,count);
  ui.click('[data-next]');assert.match(ui.q('[data-item-title]').textContent,/Headphones/);
  choice(ui,'repair');assert.ok(ui.q('.sw5-working'));assert.equal(ui.q('[data-tokens]').textContent,'0');
  assert.match(ui.q('.sw5-town-counter').textContent,/2 town details/);ui.click('[data-next]');
  choice(ui,'recycle');assert.ok(ui.q('.sw5-materials'));assert.equal(ui.q('[data-scene]').dataset.scene,'recycle');
  assert.match(ui.q('.sw5-town-counter').textContent,/3 town details/);
});

test('accepted recycling trade-off keeps the original lower score and immediate explanation',t=>{
  const ui=setup(t,{route:'scrapworks?shift=1'});choice(ui,'recycle');
  assert.equal(ui.q('[data-score]').textContent,'1');
  assert.equal(ui.q('[data-feedback]').dataset.kind,'tradeoff');
  assert.match(ui.q('[data-feedback]').textContent,/could earn more/);
  assert.equal(ui.rounds()[0].events[0].result.ok,true);
  assert.ok(ui.q('[data-next]'));
});

test('hazard precedence blocks data clearance and routes only to adult help',t=>{
  const ui=setup(t,{stars:{1:3,2:3},route:'scrapworks?shift=3'});
  assert.match(ui.q('[data-clue]').textContent,/bulging/);
  assert.equal(ui.q('[data-clear]'),null);
  choice(ui,'repair');assert.match(ui.q('[data-feedback]').textContent,/Leave the real item alone/);
  assert.equal(ui.q('[data-tokens]').textContent,'1');
  choice(ui,'hold');assert.equal(ui.q('[data-scene]').dataset.scene,'hold');assert.ok(ui.q('.sw5-safety'));
  assert.equal(ui.q('[data-score]').textContent,'3');
});

test('private data needs an interactive story-adult step before reuse',t=>{
  const ui=setup(t,{stars:{1:3,2:3},route:'scrapworks?shift=3'});
  choice(ui,'hold');ui.click('[data-next]');
  assert.match(ui.q('[data-item-title]').textContent,/Family laptop/);
  choice(ui,'reuse');assert.match(ui.q('[data-feedback]').textContent,/Ask our story adult/);
  assert.equal(ui.q('[data-score]').textContent,'3');
  ui.click('[data-clear]');assert.equal(ui.q('[data-clear]'),null);
  assert.equal(ui.current().shift.dataCleared,true);
  assert.match(ui.q('[data-feedback]').textContent,/story adult dealt with/);
  choice(ui,'reuse');assert.equal(ui.q('[data-score]').textContent,'7');
  assert.deepEqual(ui.rounds()[0].events.map(event=>event.type),['route','next','route','data','route']);
});

test('repair planning exposes future costs and original token limits remain enforced',t=>{
  const ui=setup(t,{stars:{1:3,2:3,3:3,4:3},route:'scrapworks?shift=5'});
  ui.click('[data-plan]');assert.ok(ui.q('[role="dialog"]'));assert.match(ui.q('[role="dialog"]').textContent,/Headphones with a loose ear pad/);
  ui.win.document.dispatchEvent(new ui.win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  choice(ui,'repair');ui.click('[data-next]');choice(ui,'repair');ui.click('[data-next]');
  assert.equal(ui.q('[data-tokens]').textContent,'0');
  choice(ui,'repair');assert.equal(ui.q('[data-feedback]').dataset.kind,'wrong');assert.match(ui.q('[data-feedback]').textContent,/needs 2 tokens.*have 0/);
  assert.equal(ui.q('[data-item-number]').textContent,'3');
  choice(ui,'recycle');assert.ok(ui.q('[data-next]'));
});

test('all eight shifts retain the original optimal score and stars',t=>{
  const ui=setup(t);ui.click('[data-level="1"]');
  for(const level of LEVELS){
    if(level.id>1)ui.click(`[data-level="${level.id}"]`);
    const plan=finishLevel(ui,level);
    assert.equal(plan.points,bestScore(level.id));
    assert.match(ui.q('.sw5-result-score').textContent,new RegExp(`${plan.points} Sparks`));
    assert.equal(ui.win.document.activeElement,ui.q('.sw5-result-copy h2'));
    assert.equal(readSave(ui.win.localStorage).stars[level.id],3);
    assert.equal(ui.win.document.body.classList.contains('ff-game-mode'),true);
    assert.equal(ui.rounds().find(round=>round.levelId===level.id).events.filter(event=>event.type==='route').length,level.items.length);
  }
  assert.equal(ui.awards.length,8);assert.equal(ui.learning.length,8);
  assert.equal(ui.rounds().length,8);assert.ok(ui.rounds().every(round=>replayScrapworks(round).complete));
  assert.deepEqual(ui.scroll,[]);
});

test('replaying a shift never reduces saved stars or repeats a first-star award',t=>{
  const ui=setup(t,{stars:{1:3},route:'scrapworks?shift=1'});
  for(let i=0;i<4;i++){choice(ui,'recycle');ui.click('[data-next]');}
  assert.equal(readSave(ui.win.localStorage).stars[1],3);
  assert.equal(ui.awards.length,0);assert.equal(ui.learning.length,0);
});

test('resume restores the held outcome and private-data decision without skipping ahead',t=>{
  const ui=setup(t,{stars:{1:3,2:3},route:'scrapworks?shift=3'});
  choice(ui,'hold');ui.click('[data-next]');ui.click('[data-clear]');choice(ui,'reuse');
  ui.cleanup();const cleanup=mountScrapworks(ui.host);t.after(cleanup);
  ui.click('[data-resume]');
  assert.match(ui.q('[data-item-title]').textContent,/Family laptop/);
  assert.equal(ui.q('[data-score]').textContent,'7');assert.ok(ui.q('[data-next]'));
  ui.click('[data-next]');assert.match(ui.q('[data-item-title]').textContent,/Power bank/);
});

test('parent notes show exact choices and child feedback, not just a final score',t=>{
  const ui=setup(t,{route:'scrapworks?shift=1'});choice(ui,'repair');choice(ui,'reuse');ui.click('[data-map]');ui.click('[data-notes]');
  const modal=ui.q('[role="dialog"]');assert.match(modal.textContent,/1 choice to revisit/);
  assert.match(modal.textContent,/Library tablet → Repair café/);assert.match(modal.textContent,/Shown to child: It already works/);
  assert.match(modal.textContent,/Library tablet → New owner/);assert.match(modal.textContent,/clicking our story button does not erase a real device/);
  const before=ui.rounds()[0].events.length;ui.win.document.dispatchEvent(new ui.win.KeyboardEvent('keydown',{key:'1',bubbles:true}));assert.equal(ui.rounds()[0].events.length,before);
  ui.click('[data-close]');assert.equal(ui.q('[role="dialog"]'),null);
});

test('number keys choose destinations and N advances explicitly',t=>{
  const ui=setup(t,{route:'scrapworks?shift=1'});
  ui.win.document.dispatchEvent(new ui.win.KeyboardEvent('keydown',{key:'1',bubbles:true}));assert.ok(ui.q('[data-next]'));
  ui.win.document.dispatchEvent(new ui.win.KeyboardEvent('keydown',{key:'n',bubbles:true}));assert.equal(ui.q('[data-item-number]').textContent,'2');
  ui.win.document.dispatchEvent(new ui.win.KeyboardEvent('keydown',{key:'2',bubbles:true}));assert.equal(ui.q('[data-score]').textContent,'8');
});

test('direct parent route has a scrollable notebook and removes child viewport mode',t=>{
  const ui=setup(t,{route:'scrapworks?shift=1'});choice(ui,'repair');choice(ui,'reuse');ui.cleanup();
  ui.win.document.body.classList.add('ff-game-mode');
  const cleanup=mountScrapworks(ui.host,{route:'scrapworks?view=parents'});t.after(cleanup);
  assert.ok(ui.q('.sw5-parent-page'));assert.equal(ui.q('[role="dialog"]'),null);
  assert.equal(ui.win.document.body.classList.contains('ff-game-mode'),false);
  assert.match(ui.host.textContent,/Library tablet → Repair café/);
  assert.match(ui.host.textContent,/Library tablet → New owner/);
});

test('pointer drops share choice logic and misses are neutral with no recorded attempt',t=>{
  const ui=setup(t,{route:'scrapworks?shift=1'}),doc=ui.win.document;
  doc.elementFromPoint=()=>null;
  pointer(ui,ui.q('[data-device]'),'pointerdown',20,20);pointer(ui,ui.win,'pointermove',100,70);
  assert.ok(doc.querySelector('.sw5-drag-ghost'));pointer(ui,ui.win,'pointerup',100,70);
  assert.equal(doc.querySelector('.sw5-drag-ghost'),null);assert.equal(ui.rounds()[0].events.length,0);assert.equal(ui.q('[data-feedback]').dataset.kind,'neutral');
  doc.elementFromPoint=()=>ui.q('[data-dest="reuse"]');pointer(ui,ui.q('[data-device]'),'pointerdown',20,20);pointer(ui,ui.win,'pointermove',100,70);pointer(ui,ui.win,'pointerup',100,70);
  assert.equal(ui.q('[data-score]').textContent,'4');assert.ok(ui.q('[data-next]'));
});

test('cleanup and external abort remove drag ghosts and keyboard/click handlers',t=>{
  const ui=setup(t,{route:'scrapworks?shift=1'});
  pointer(ui,ui.q('[data-device]'),'pointerdown',20,20);pointer(ui,ui.win,'pointermove',100,70);
  assert.ok(ui.win.document.querySelector('.sw5-drag-ghost'));ui.controller.abort();assert.equal(ui.win.document.querySelector('.sw5-drag-ghost'),null);
  assert.equal(ui.win.document.body.classList.contains('ff-game-mode'),false);
  const html=ui.host.innerHTML;ui.q('[data-dest="reuse"]').click();ui.win.document.dispatchEvent(new ui.win.KeyboardEvent('keydown',{key:'1',bubbles:true}));assert.equal(ui.host.innerHTML,html);
  ui.cleanup();
});

test('storage unavailable permits play and clearly reports unsaved progress',t=>{
  const ui=setup(t,{storageFail:true,route:'scrapworks?shift=1'});
  assert.equal(ui.q('[data-save-warning]').hidden,false);choice(ui,'reuse');assert.equal(ui.q('[data-score]').textContent,'4');ui.click('[data-next]');assert.equal(ui.q('[data-item-number]').textContent,'2');
});

test('journal replay rejects tampered results, impossible order and unsupported actions',t=>{
  const ui=setup(t,{route:'scrapworks?shift=1'});choice(ui,'reuse');const original=ui.rounds()[0];
  for(const change of [r=>r.events[0].result.points=100,r=>r.events[0].result.text='Unsafe invented text',r=>r.events[0].destination='repair',r=>r.events[0].itemId='family-laptop',r=>r.events[0].type='hack',r=>r.events.unshift({type:'next',itemId:'library-tablet',at:new Date().toISOString()})]){const forged=structuredClone(original);change(forged);assert.equal(replayScrapworks(forged),null);}
  const copy=structuredClone(original);assert.deepEqual(replayScrapworks(copy).round,original);
  ui.win.localStorage.setItem(SCRAPWORKS_JOURNAL_KEY,'broken json');assert.deepEqual(loadScrapworksJournal(ui.win.localStorage),[]);
  assert.equal(readSave(ui.win.localStorage).stars[1],undefined);
});

test('journal is separate, bounded and a full round offers recovery',t=>{
  const ui=setup(t,{stars:{1:3},route:'scrapworks?shift=1'});
  const baseline=ui.win.localStorage.getItem(SAVE_KEY);
  for(let i=0;i<199;i++)choice(ui,'repair');
  assert.ok(ui.q('[data-restart]'));assert.equal(ui.rounds()[0].events.length,199);assert.equal(ui.q('[data-dest="reuse"]').disabled,true);
  ui.click('[data-restart]');choice(ui,'reuse');assert.equal(ui.q('[data-score]').textContent,'4');
  assert.equal(ui.win.localStorage.getItem(SAVE_KEY),baseline);
  const sample=ui.rounds().find(round=>round.events.length===199);
  const many=Array.from({length:25},(_,index)=>({...sample,id:`sample-${index}`,startedAt:new Date(Date.now()+index).toISOString()}));
  assert.equal(saveScrapworksJournal(ui.win.localStorage,many),true);assert.ok(loadScrapworksJournal(ui.win.localStorage).reduce((sum,round)=>sum+round.events.length,0)<=500);
  const empty=many.map(round=>({...round,events:[]}));saveScrapworksJournal(ui.win.localStorage,empty);assert.equal(loadScrapworksJournal(ui.win.localStorage).length,20);
});

test('every original item has exterior artwork and success growth is visible in SVG',()=>{
  for(const item of Object.values(ITEMS))assert.match(deviceArt(item.illustration),/<svg.*<.*(?:rect|path)/);
  assert.equal((townArt(0,0).match(/is-grown/g)||[]).length,0);
  assert.equal((townArt(0,3).match(/is-grown/g)||[]).length,3);
  assert.match(townArt(0,3),/3 new details this shift/);
});
