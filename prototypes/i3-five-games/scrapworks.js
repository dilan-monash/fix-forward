// A new presentation around the original, unchanged Scrapworks rules. The story
// assessment is revealed on arrival; real devices are never diagnosed here.
import {LEVELS, ITEMS, DESTINATIONS, levelById, createShift, currentItem, inspect,
  clearData, applyChoice, isShiftComplete, bestScore, starsFor, readSave, writeSave,
  recordStars, isUnlocked, restoredCount} from './reference/scrapworks-engine.js';
import {deviceArt, townArt, destinationIcon} from './scrapworks-art.js';

export const SCRAPWORKS_JOURNAL_KEY = 'fixforward.scrapworks-five-games.v1';
const MAX_ROUNDS = 20, MAX_EVENTS = 200, MAX_TOTAL = 500;
const LABELS = {reuse:'New owner',repair:'Repair café',recycle:'Specialist recycling',hold:'Adult safety help',bin:'Household rubbish'};
const HINTS = {reuse:'Pass on something that works',repair:'Use tokens for a story repair',recycle:'Recover useful materials',hold:'Leave it alone. Tell an adult.',bin:'Does this belong here?'};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const starMarkup = count => `<span class="sw5-stars" aria-label="${count} of 3 stars">${[1,2,3].map(n=>`<span class="${n<=count?'is-on':''}" aria-hidden="true">★</span>`).join('')}</span>`;
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);

function reply(entry, destination, result, tokens) {
  if (!result.ok) {
    const reason = result.reason;
    const text = reason==='bin' ? 'Electronics stay out of rubbish. Choose a useful next stop.'
      : reason==='hazard' ? 'Stop! Leave the real item alone. Tell an adult.'
      : reason==='data' ? 'Private photos or accounts remain. Ask our story adult first.'
      : reason==='tokens' ? `This repair needs ${entry.repairCost} tokens. You have ${tokens}. Recycling stays open.`
      : reason==='no-hazard' ? 'Our story adult checked this item. Find its useful next stop.'
      : entry.condition==='working' ? 'It already works! Someone else could use it.'
      : entry.condition==='end_of_life' ? 'Our story repairer cannot fix it. Recover its materials.'
      : 'It needs a repair before someone else can use it.';
    return {kind:'wrong',text,parentText:result.message};
  }
  const tradeoff = destination==='recycle' && entry.condition!=='end_of_life' && !entry.hazard;
  const text = destination==='hold' ? 'Good stop. Our adult arranges specialist help. Leave real items alone.'
    : destination==='reuse' ? 'Still useful! This item is ready for a new owner.'
    : destination==='repair' ? 'Our story repairer fixed it. It works again!'
    : tradeoff ? 'Materials recovered. Keeping it useful could earn more Sparks.'
    : 'Useful materials recovered! Specialists handled this whole story device.';
  return {kind:tradeoff?'tradeoff':'correct',text,parentText:result.message};
}

function newRound(levelId) {
  return {id:`scrap-${globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`}`,levelId,startedAt:new Date().toISOString(),events:[]};
}

// Journal actions replay through the original engine, so stored scores cannot
// override rules. A Next action preserves the deliberate pause after success.
export function replayScrapworks(round) {
  try {
    if (!round || typeof round.id!=='string' || !round.id.length || round.id.length>120 || !levelById(round.levelId) || !Array.isArray(round.events) || round.events.length>MAX_EVENTS || !Number.isFinite(Date.parse(round.startedAt))) return null;
    const shift=createShift(round.levelId); inspect(shift);
    let outcome=null, feedback=null, complete=false;
    for (const event of round.events) {
      if (!event || !Number.isFinite(Date.parse(event.at)) || complete) return null;
      if (event.type==='next') {
        if (!outcome || event.itemId!==outcome.item.id) return null;
        outcome=null; feedback=null;
        if (isShiftComplete(shift)) complete=true; else inspect(shift);
      } else if (event.type==='data') {
        if (outcome || currentItem(shift)?.id!==event.itemId || shift.dataCleared || !clearData(shift)) return null;
        feedback={kind:'neutral',text:'Our story adult dealt with the private data. Choose a stop.'};
      } else if (event.type==='route') {
        if (outcome || event.itemId!==currentItem(shift)?.id || ![...DESTINATIONS,'bin'].includes(event.destination)) return null;
        const entry=currentItem(shift), tokens=shift.tokens, result=applyChoice(shift,event.destination);
        const words=reply(entry,event.destination,result,tokens);
        const canonical={ok:result.ok,reason:result.reason??null,points:result.points,cost:result.cost,...words};
        if (!same(canonical,event.result)) return null;
        feedback=words;
        if(result.ok)outcome={...result,item:entry,destination:event.destination,...words};
      } else return null;
    }
    return {round:{id:round.id,levelId:Number(round.levelId),startedAt:round.startedAt,events:round.events.map(event=>({...event}))},shift,outcome,feedback,complete};
  } catch {return null;}
}

function bounded(rounds) {
  let total=0; const seen=new Set();
  return (Array.isArray(rounds)?rounds:[]).map(replayScrapworks).filter(Boolean).map(value=>value.round).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).filter(round=>{
    if(seen.has(round.id)||seen.size>=MAX_ROUNDS||total+round.events.length>MAX_TOTAL)return false;
    seen.add(round.id);total+=round.events.length;return true;
  });
}
export function loadScrapworksJournal(storage) {
  try {const raw=storage?.getItem(SCRAPWORKS_JOURNAL_KEY);if(!raw||raw.length>1000000)return [];
    const data=JSON.parse(raw);return data?.version===1?bounded(data.rounds):[];
  } catch{return [];}
}
export function saveScrapworksJournal(storage,rounds) {
  try {if(!storage?.setItem||!Array.isArray(rounds))return false;storage.setItem(SCRAPWORKS_JOURNAL_KEY,JSON.stringify({version:1,rounds:bounded(rounds)}));return true;}catch{return false;}
}

export function mountScrapworks(host,{route='scrapworks',onNavigate,onAward=()=>{},onLearn=()=>{},signal,storage}={}) {
  if(signal?.aborted)return ()=>{};
  const doc=host.ownerDocument,win=doc.defaultView,controller=new win.AbortController();
  if(storage===undefined){try{storage=win.localStorage;}catch{storage=null;}}
  let save=readSave(storage),rounds=loadScrapworksJournal(storage),round=null,shift=null,outcome=null,feedback=null;
  let view='map',finished=null,storageFailed=false,modal=false,dragCleanup=null,disposed=false,returnFocus=null;
  const navigate=hash=>{dragCleanup?.();onNavigate?onNavigate(hash):win.location.hash=hash;};
  const focus=selector=>{const target=host.querySelector(selector);if(target?.matches('h1,h2'))target.setAttribute('tabindex','-1');target?.focus({preventScroll:true});};
  const persist=()=>{if(round){rounds=bounded([round,...rounds.filter(value=>value.id!==round.id)]);}storageFailed=!saveScrapworksJournal(storage,rounds);};
  const append=event=>{round.events.push({...event,at:new Date().toISOString()});persist();};
  const statusNote=()=>`<p class="sw5-save" data-save-warning ${storageFailed?'':'hidden'}>Progress cannot save in this browser. You can keep playing.</p>`;
  const header=(label='Build a brighter town')=>`<header class="sw5-header"><button class="sw5-back" data-${view==='play'||view==='results'?'map':'hub'} aria-label="${view==='play'||view==='results'?'Shift map':'All five games'}">←</button><div><span>FIXFORWARD · SCRAPWORKS</span><h1>${escape(label)}</h1></div><a href="#howto?game=scrapworks" data-nav>How to play <span aria-hidden="true">↗</span></a></header>`;
  const resumable=()=>rounds.map(replayScrapworks).find(value=>value&&!value.complete&&value.round.events.length>0);

  function renderMap(target='h1') {
    dragCleanup?.();view='map';outcome=null;feedback=null;modal=false;
    doc.body.classList.add('ff-game-mode');
    const resume=resumable();
    host.innerHTML=`<section class="sw5 sw5-map">${header()}<div class="sw5-map-hero"><div><p class="sw5-eyebrow">YOUR RECOVERY HUB</p><h2>Little choices.<br>A town full of possibilities.</h2><p>Give working things a new home. Help repair what can last. Bring your town to life, one item at a time.</p>${resume?`<button class="sw5-primary" data-resume>Continue shift ${resume.round.levelId} <span>→</span></button>`:'<button class="sw5-primary" data-level="1">Start your first shift <span>→</span></button>'}</div><figure>${townArt(restoredCount(save),0)}<figcaption>${restoredCount(save)} of 8 town places restored</figcaption></figure></div><ol class="sw5-shifts" aria-label="Eight shifts">${LEVELS.map(level=>`<li><button data-level="${level.id}" ${isUnlocked(save,level.id)?'':'disabled'}><span class="sw5-shift-number">${level.id}</span><strong>${escape(level.title)}</strong><small>${level.items.length} items · ${level.tokens} repair tokens</small>${isUnlocked(save,level.id)?starMarkup(save.stars[level.id]??0):'<span class="sw5-locked">Finish the previous shift</span>'}</button></li>`).join('')}</ol><footer class="sw5-map-footer"><p>No timer. Story items only. Sparks and town details are game rewards.</p><button class="sw5-text" data-notes>Grown-up notes</button></footer>${statusNote()}</section>`;
    host.querySelector('h1')?.setAttribute('tabindex','-1');focus(target);
  }

  function start(levelId,{resume=false}={}) {
    if(!isUnlocked(save,levelId))return;
    const existing=resume?resumable():null;
    if(existing){({round,shift,outcome,feedback}=existing);}else{round=newRound(levelId);shift=createShift(levelId);inspect(shift);outcome=null;feedback=null;persist();}
    view='play';finished=null;renderPlay();
  }

  function stage(entry) {
    const destination=outcome?.destination;
    return `<div class="sw5-stage ${outcome?'is-success':''} ${feedback?.kind==='wrong'?'is-wrong':''}" data-scene="${destination||'ready'}">${townArt(restoredCount(save),shift.results.length)}<span class="sw5-town-counter">${shift.results.length} town ${shift.results.length===1?'detail':'details'} added <span aria-hidden="true">✦</span></span><div class="sw5-podium"></div><button class="sw5-device" data-device ${outcome?'disabled':''} aria-label="${escape(entry.name)}. Drag to a destination, or choose a destination button.">${deviceArt(entry.illustration)}</button>${destination==='recycle'?'<div class="sw5-materials"><span>Metal</span><span>Plastic</span><i>✦</i></div>':''}${destination==='reuse'?'<div class="sw5-gift" aria-hidden="true"><i></i><b>♥</b></div>':''}${destination==='repair'?`<div class="sw5-repair-tool" aria-hidden="true">${destinationIcon('repair')}</div><div class="sw5-working" aria-hidden="true">✓</div>`:''}${destination==='hold'?`<div class="sw5-safety" aria-hidden="true">${destinationIcon('hold')}</div>`:''}${outcome?`<div class="sw5-impact"><span>+${outcome.points} <small>Sparks</small></span><p>${destination==='reuse'?'A new home awaits':destination==='repair'?'Working again!':destination==='hold'?'Adult help comes next':'A useful second life'}</p></div><div class="sw5-confetti" aria-hidden="true">${Array.from({length:8},(_,i)=>`<i style="--i:${i}">✦</i>`).join('')}</div>`:'<div class="sw5-scene-caption">A story item. A new possibility.</div>'}</div>`;
  }

  function renderPlay(target='[data-item-title]') {
    dragCleanup?.();
    doc.body.classList.add('ff-game-mode');
    const level=levelById(shift.levelId),entry=outcome?.item??currentItem(shift),at=outcome?shift.index:shift.index+1;
    // Leave room for the explicit Next action after an accepted choice.
    const limit=round.events.length>=MAX_EVENTS-1&&!outcome;
    const destinations=[...DESTINATIONS,...(level.tutorialBin&&!shift.binShown&&!outcome?['bin']:[])];
    const clue=entry.clue;
    host.innerHTML=`<section class="sw5 sw5-play">${header(`Shift ${level.id} · ${level.title}`)}<div class="sw5-hud"><span>Item <strong data-item-number>${at}</strong> / ${level.items.length}</span><div class="sw5-progress" aria-label="${shift.index} of ${level.items.length} items completed">${level.items.map((id,i)=>`<i class="${i<shift.index?'is-done':''}"></i>`).join('')}</div><span class="sw5-token">◈ <strong data-tokens>${shift.tokens}</strong> <small>repair tokens</small></span><span class="sw5-sparks">✦ <strong data-score>${shift.score}</strong> <small>Sparks</small></span></div><div class="sw5-workspace">${stage(entry)}<article class="sw5-clue"><p class="sw5-eyebrow">PIP’S STORY CLUE</p><h2 data-item-title tabindex="-1">${escape(entry.name)}</h2><p class="sw5-clue-text" data-clue>${escape(clue)}</p><div class="sw5-tags"><span>${entry.hazard?'⚠ Leave it alone':entry.condition==='working'?'✓ Still works':entry.condition==='minor_fault'?'↗ Can be repaired':'↗ Cannot be repaired'}</span>${entry.condition==='minor_fault'&&!entry.hazard?`<span>${entry.repairCost} ◈ repair cost · +${entry.lifeBonus} life bonus</span>`:''}</div>${entry.personalData&&!entry.hazard&&!outcome?`<div class="sw5-data"><span>${shift.dataCleared?'✓ Story adult dealt with data':'Private data needs adult help'}</span>${shift.dataCleared?'':`<button data-clear>Ask our story adult <span aria-hidden="true">→</span></button>`}</div>`:''}<p class="sw5-story-note">Fictional clues, already checked in our story. An adult handles real devices.</p>${level.id>=5?'<button class="sw5-text sw5-plan-link" data-plan>See this shift’s repair plan ↗</button>':''}</article></div><div class="sw5-destinations" role="group" aria-label="Choose the item’s next stop">${destinations.map((destination,i)=>`<button data-dest="${destination}" class="sw5-destination sw5-dest-${destination}" ${outcome||limit?'disabled':''}><span class="sw5-destination-icon">${destinationIcon(destination)}</span><span><strong>${LABELS[destination]}</strong><small>${HINTS[destination]}</small></span><kbd>${i+1}</kbd></button>`).join('')}</div><footer class="sw5-response" data-feedback data-kind="${feedback?.kind??'neutral'}" aria-live="polite" aria-atomic="true"><span class="sw5-response-symbol" aria-hidden="true">${feedback?.kind==='wrong'?'✕':outcome?'✓':'✦'}</span><div><strong>${limit?'Your journal is full':outcome?`+${outcome.points} Sparks · Town detail added`:feedback?.kind==='wrong'?'Try another plan':feedback?'Our story adult helped':'Where should it go?'}</strong><p>${limit?'Keep your record and start a fresh shift.':escape(feedback?.text??'Tap a place, or drag the story item. Read Pip’s clue to decide.')}</p></div>${outcome?`<button class="sw5-primary" data-next>${isShiftComplete(shift)?'Finish shift':'Next item'} →</button>`:limit?'<button class="sw5-primary" data-restart>New shift →</button>':''}</footer>${statusNote()}</section>`;
    focus(target);
  }

  function choose(destination) {
    if(view!=='play'||outcome||modal||round.events.length>=MAX_EVENTS-1)return;
    const entry=currentItem(shift),tokens=shift.tokens,result=applyChoice(shift,destination),words=reply(entry,destination,result,tokens);
    const canonical={ok:result.ok,reason:result.reason??null,points:result.points,cost:result.cost,...words};
    append({type:'route',itemId:entry.id,destination,result:canonical});
    feedback=words;
    if(result.ok)outcome={...result,item:entry,destination,...words};
    renderPlay(result.ok?'[data-next]':destination==='bin'?'[data-dest="reuse"]':`[data-dest="${destination}"]`);
  }
  function adultData() {
    if(view!=='play'||outcome||modal||round.events.length>=MAX_EVENTS-1||shift.dataCleared)return;
    const entry=currentItem(shift);
    if(clearData(shift)){append({type:'data',itemId:entry.id});feedback={kind:'neutral',text:'Our story adult dealt with the private data. Choose a stop.'};renderPlay('[data-dest="reuse"]');}
  }
  function next() {
    if(!outcome||modal)return;
    append({type:'next',itemId:outcome.item.id});outcome=null;feedback=null;
    if(isShiftComplete(shift)){
      const level=levelById(shift.levelId),earned=starsFor(shift.score,bestScore(level.id)),first=earned>=1&&!(save.stars[level.id]>=1);
      recordStars(save,level.id,earned);storageFailed=!writeSave(storage,save)||storageFailed;
      finished={level,earned};view='results';renderResults();
      if(first){onLearn({id:`scrapworks:level:${level.id}`,title:`Scrapworks · ${level.title}`,detail:`Finished the ${level.title.toLowerCase()} with ${earned} stars.`});onAward(`scrapworks:level:${level.id}`,10,host.querySelector('.sw5-stars'));}
    }else{inspect(shift);renderPlay();}
  }
  function renderResults() {
    doc.body.classList.add('ff-game-mode');
    const {level,earned}=finished;
    host.innerHTML=`<section class="sw5 sw5-results">${header('Look what your choices changed')}<div class="sw5-result-scene">${townArt(restoredCount(save),shift.results.length)}<div class="sw5-result-medal">✦</div></div><div class="sw5-result-copy"><p class="sw5-eyebrow">SHIFT ${level.id} COMPLETE</p><h2>${earned?'You helped the town grow.':'A little practice. A new plan.'}</h2>${starMarkup(earned)}<p class="sw5-result-score"><strong>${shift.score} Sparks</strong> · ${bestScore(level.id)} best possible</p><p>${earned?`The ${escape(level.town.toLowerCase())} is restored. Every item added something along the way.`:'Try again to earn a star. Your choices earn points; wrong tries cost no tokens.'}</p><div class="sw5-result-actions">${earned&&level.id<8?`<button class="sw5-primary" data-level="${level.id+1}">Next shift →</button>`:''}<button class="sw5-secondary" data-level="${level.id}">Play this shift again</button><button class="sw5-text" data-map>Town map</button></div><button class="sw5-text" data-notes>What did we learn? Grown-up notes ↗</button></div>${statusNote()}</section>`;focus('h2');
  }

  function closeModal() {host.querySelector('.sw5-overlay')?.remove();modal=false;if(returnFocus?.isConnected)returnFocus.focus();else focus('[data-item-title]');}
  function parentContent() {
    const records=rounds.map(replayScrapworks).filter(Boolean),events=records.flatMap(record=>record.round.events.filter(event=>event.type==='route'));
    const retries=events.filter(event=>!event.result.ok).length;
    return `<p class="sw5-eyebrow">GROWN-UP NOTES · THIS BROWSER</p><h2 id="sw5-modal-title">Talk through the choices.</h2><p>${records.length} saved ${records.length===1?'round':'rounds'} · ${retries} ${retries===1?'choice':'choices'} to revisit. These records describe play, not a test of your child’s ability.</p><p>Clues describe fictional assessments. Repair cafés cannot guarantee acceptance or repair. Adults handle real device safety and private data; clicking our story button does not erase a real device.</p><div class="sw5-journal">${records.length?records.map(record=>`<details ${record.round.id===round?.id?'open':''}><summary>Shift ${record.shift.levelId} · ${record.shift.score} Sparks · ${record.complete?'finished':'in progress'}</summary>${record.round.events.filter(event=>event.type!=='next').map(event=>event.type==='data'?`<article><strong>${escape(ITEMS[event.itemId].name)}</strong><p>Asked the story adult to deal with private data.</p></article>`:`<article class="${event.result.ok?'':'is-retry'}"><strong>${escape(ITEMS[event.itemId].name)} → ${LABELS[event.destination]}</strong><small>${event.result.ok?'Accepted choice':'Try again'} · ${event.result.points} Sparks</small><p><b>Shown to child:</b> ${escape(event.result.text)}</p><p><b>Why:</b> ${escape(event.result.parentText)}</p></article>`).join('')||'<p>No choices yet.</p>'}</details>`).join(''):'<p>Play a shift to see the choices here.</p>'}</div><p>Try together: Which item could still be useful? Which needed adult help? How did you choose where to spend tokens?</p>`;
  }
  function renderParents() {
    view='parents';doc.body.classList.remove('ff-game-mode');
    host.innerHTML=`<section class="sw5 sw5-parent-page">${header('Your Scrapworks learning notebook')}<article class="sw5-parent-content">${parentContent()}<a class="sw5-primary" href="#scrapworks" data-nav>Back to Scrapworks →</a></article></section>`;
    host.querySelector('h1')?.setAttribute('tabindex','-1');focus('h1');
  }
  function showModal(kind) {
    dragCleanup?.();modal=true;returnFocus=doc.activeElement;
    let content;
    if(kind==='plan'){
      const level=levelById(shift.levelId);
      content=`<p class="sw5-eyebrow">PLAN YOUR REPAIR TOKENS</p><h2 id="sw5-modal-title">Which repairs can help most?</h2><p>You have ${shift.tokens} tokens left. Compare cost and life bonus. These are game choices, not real repair prices.</p><ul class="sw5-plan">${level.items.slice(shift.index).map(id=>ITEMS[id]).filter(entry=>entry.condition==='minor_fault'&&!entry.hazard).map(entry=>`<li><strong>${escape(entry.name)}</strong><span>${entry.repairCost} tokens · +${entry.lifeBonus} life bonus</span></li>`).join('')}</ul><p>In real life, an adult checks repair options. A repair café may not accept or fix every item.</p>`;
    }else{
      content=parentContent();
    }
    host.insertAdjacentHTML('beforeend',`<div class="sw5-overlay"><section class="sw5-modal" role="dialog" aria-modal="true" aria-labelledby="sw5-modal-title"><button class="sw5-modal-close" data-close aria-label="Close">×</button>${content}<button class="sw5-primary" data-close>Back to play</button></section></div>`);focus('.sw5-modal [data-close]');
  }

  function click(event) {
    const button=event.target.closest('button,a[data-nav]');if(!button||!host.contains(button)||button.disabled)return;
    if(modal&&!button.closest('.sw5-modal'))return;
    if(button.matches('[data-nav]')){event.preventDefault();navigate(button.getAttribute('href'));}
    else if(button.matches('[data-hub]'))navigate('#games');
    else if(button.matches('[data-map]'))renderMap();
    else if(button.matches('[data-level]'))start(Number(button.dataset.level));
    else if(button.matches('[data-resume]'))start(resumable()?.round.levelId,{resume:true});
    else if(button.matches('[data-dest]'))choose(button.dataset.dest);
    else if(button.matches('[data-clear]'))adultData();
    else if(button.matches('[data-next]'))next();
    else if(button.matches('[data-restart]'))start(shift.levelId);
    else if(button.matches('[data-notes]'))showModal('notes');
    else if(button.matches('[data-plan]'))showModal('plan');
    else if(button.matches('[data-close]'))closeModal();
  }
  function key(event) {
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(modal){
      if(event.key==='Escape'){event.preventDefault();closeModal();}
      if(event.key==='Tab'){const buttons=[...host.querySelectorAll('.sw5-modal button,.sw5-modal summary')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}}
      return;
    }
    if(view!=='play'||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName??''))return;
    const key=event.key.toLowerCase();
    if(outcome&&key==='n'){event.preventDefault();next();}
    else if(!outcome&&/^[1-5]$/.test(key)){const button=host.querySelectorAll('[data-dest]')[Number(key)-1];if(button){event.preventDefault();button.click();}}
    else if(key==='a'){event.preventDefault();adultData();}
  }
  function pointer(event) {
    const source=event.target.closest('[data-device]');
    if(!source||outcome||modal||view!=='play'||event.button!==0||event.isPrimary===false)return;
    dragCleanup?.();const start={x:event.clientX,y:event.clientY},drag=new win.AbortController();let ghost=null,over=null;
    const targetAt=(x,y)=>{const target=doc.elementFromPoint?.(x,y)?.closest?.('[data-dest]:not(:disabled)');return target&&host.contains(target)?target:null;};
    const finish=()=>{drag.abort();ghost?.remove();source.classList.remove('is-dragging');over?.classList.remove('is-over');dragCleanup=null;};dragCleanup=finish;
    win.addEventListener('pointermove',move=>{
      if(move.pointerId!==event.pointerId)return;
      if(!ghost&&Math.hypot(move.clientX-start.x,move.clientY-start.y)<7)return;
      move.preventDefault();
      if(!ghost){ghost=source.cloneNode(true);ghost.className='sw5-drag-ghost';ghost.removeAttribute('data-device');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;doc.body.append(ghost);source.classList.add('is-dragging');}
      ghost.style.left=`${move.clientX}px`;ghost.style.top=`${move.clientY}px`;const target=targetAt(move.clientX,move.clientY);if(target!==over){over?.classList.remove('is-over');over=target;over?.classList.add('is-over');}
    },{signal:drag.signal,passive:false});
    win.addEventListener('pointerup',up=>{if(up.pointerId!==event.pointerId)return;const target=ghost&&targetAt(up.clientX,up.clientY),moved=!!ghost;finish();if(target)choose(target.dataset.dest);else if(moved){feedback={kind:'neutral',text:'That drop missed a place. Try again, or tap a place.'};renderPlay('[data-device]');}},{signal:drag.signal});
    win.addEventListener('pointercancel',finish,{signal:drag.signal});
  }

  const cleanup=()=>{if(disposed)return;disposed=true;dragCleanup?.();controller.abort();signal?.removeEventListener('abort',cleanup);host.querySelector('.sw5-overlay')?.remove();doc.body.classList.remove('ff-game-mode');};
  signal?.addEventListener('abort',cleanup,{once:true});
  host.addEventListener('click',click,{signal:controller.signal});host.addEventListener('pointerdown',pointer,{signal:controller.signal});doc.addEventListener('keydown',key,{signal:controller.signal});
  const params=new URLSearchParams(String(route).split('?')[1]??''),requested=Number(params.get('shift'));
  if(params.get('view')==='parents')renderParents();else if(levelById(requested)&&isUnlocked(save,requested))start(requested);else renderMap();
  return cleanup;
}
