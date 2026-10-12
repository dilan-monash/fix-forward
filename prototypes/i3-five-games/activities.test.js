/** Exercise visitor actions, routes and cleanup rather than implementation shape. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {GAME_LIST,filterGames,mountActivities,mountTutorial} from './activities.js';
import {HOME_QUESTIONS,mountLanding} from './landing.js';

function ui(t,{route='learn',landing=false,reduced=false,aborted=false,width=1024}={}){
  const dom=new JSDOM('<!doctype html><main><p>Previous view</p></main><button id="outside">Outside</button>',{url:'http://five-games.test/'});
  const win=dom.window,host=win.document.querySelector('main'),controller=new win.AbortController();
  let plays=0,pauses=0;const observers=[];
  win.matchMedia=()=>({matches:reduced});win.innerWidth=width;
  win.HTMLMediaElement.prototype.play=function(){plays++;return Promise.resolve();};
  win.HTMLMediaElement.prototype.pause=function(){pauses++;};
  win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  win.HTMLDialogElement.prototype.close=function(){if(!this.open)return;this.removeAttribute('open');this.dispatchEvent(new win.Event('close'));};
  win.IntersectionObserver=class{constructor(fn){this.fn=fn;this.disconnected=false;observers.push(this);}observe(){}unobserve(){}disconnect(){this.disconnected=true;}};
  if(aborted)controller.abort();
  const cleanup=landing?mountLanding(host,{signal:controller.signal}):mountActivities(host,{route,signal:controller.signal});
  t.after(()=>{cleanup();win.close();});
  return{win,host,controller,cleanup,observers,get plays(){return plays;},get pauses(){return pauses;},q:selector=>host.querySelector(selector),click:selector=>host.querySelector(selector).click(),change:(name,value)=>{const select=host.querySelector(`select[name="${name}"]`);select.value=value;select.dispatchEvent(new win.Event('change',{bubbles:true}));}};
}
test('catalogue contains precisely the five agreed games and direct destinations',()=>{
  assert.deepEqual(GAME_LIST.map(game=>[game.id,game.href]),[['fix-it','#learn?game=fix-it'],['materials','#learn?game=materials'],['care','#learn?game=care'],['scrapworks','#scrapworks'],['choices','#learn?game=choices']]);
  assert.equal(GAME_LIST.every(game=>game.tutorialHref===`#howto?game=${game.id}`),true);
  assert.equal(GAME_LIST.some(game=>/clue|city/.test(game.id)),false);
});
test('finder combines age, time and play mode without mislabelling a long activity as short',()=>{
  assert.deepEqual(filterGames({age:'7',mode:'move'}).map(game=>game.id),['materials','care']);
  assert.deepEqual(filterGames({time:'short'}).map(game=>game.id),['care']);
  assert.deepEqual(filterGames({age:'10',time:'long',mode:'strategy'}).map(game=>game.id),['scrapworks']);
  assert.deepEqual(filterGames({age:'7',mode:'strategy'}),[]);
});
test('chooser responds to actual selects, explains empty results and resets all filters',t=>{
  const view=ui(t);assert.equal(view.host.querySelectorAll('[data-game-card]').length,5);
  view.change('age','7');view.change('mode','strategy');assert.match(view.q('.ffa-result-count').textContent,/0 games/);
  assert.match(view.q('.ffa-empty').textContent,/No game matches all three filters/);
  view.click('.ffa-empty [data-reset-filters]');assert.equal(view.host.querySelectorAll('[data-game-card]').length,5);
  assert.equal(view.q('select[name="age"]').value,'any');assert.equal(view.q('select[name="mode"]').value,'any');
});
test('all cards expose separate play and tutorial links plus useful learning details',t=>{
  const view=ui(t);
  for(const game of GAME_LIST){const card=view.q(`[data-game-card="${game.id}"]`);assert.equal(card.querySelector('.ffa-play').getAttribute('href'),game.href);assert.equal(card.querySelector('.ffa-howto').getAttribute('href'),game.tutorialHref);assert.match(card.querySelector('.ffa-lesson').textContent,/What we’ll discover/);assert.ok(card.textContent.includes(game.lesson));}
});
test('phone finder shows games first and keeps optional filters in a native disclosure',t=>{
  const view=ui(t,{width:390});assert.equal(view.q('.ffa-filter-panel').open,false);assert.equal(view.host.querySelectorAll('[data-game-card]').length,5);view.click('.ffa-filter-panel>summary');assert.equal(view.q('.ffa-filter-panel').open,true);view.change('time','short');assert.deepEqual([...view.host.querySelectorAll('[data-game-card]')].map(card=>card.dataset.gameCard),['care']);
});
test('tutorial requires observing a clue before the next step, then preserves it beside the choice',t=>{
  const view=ui(t,{route:'#howto?game=fix-it'});assert.equal(view.q('[data-tutorial-next]').disabled,true);assert.equal(view.q('[data-tutorial-step="1"]').disabled,true);
  view.click('[data-tutorial-reveal]');assert.match(view.q('.fft-clue').textContent,/removed personal data/);assert.equal(view.q('[data-tutorial-next]').disabled,false);
  view.click('[data-tutorial-next]');assert.match(view.q('.fft-clue').textContent,/someone who wants it/);assert.equal(view.q('[data-tutorial-next]').disabled,true);
});
test('a retry explains the clue, earns no completion and keeps keyboard focus on the choice',t=>{
  const view=ui(t,{route:'howto?game=fix-it'});view.click('[data-tutorial-reveal]');view.click('[data-tutorial-next]');view.click('[data-tutorial-choice="recycle"]');
  assert.match(view.q('[role="status"]').textContent,/already works/);assert.equal(view.q('[data-tutorial-next]').disabled,true);assert.equal(view.win.document.activeElement.dataset.tutorialChoice,'recycle');
  view.click('[data-tutorial-choice="reuse"]');assert.equal(view.q('[data-tutorial-next]').disabled,false);assert.equal(view.win.document.activeElement.dataset.tutorialNext,'');
  view.click('[data-tutorial-next]');assert.equal(view.q('.fft-main').getAttribute('href'),'#learn?game=fix-it');assert.match(view.q('.fft-practice-note').textContent,/game starts fresh/);
});
for(const [id,answer] of [['materials','metal'],['care','tray'],['scrapworks','repair'],['choices','ewaste']])test(`${id} has its own usable practice path and correct game handoff`,t=>{
  const view=ui(t,{route:`howto?game=${id}`});view.click('[data-tutorial-reveal]');view.click('[data-tutorial-next]');view.click(`[data-tutorial-choice="${answer}"]`);assert.equal(view.q('.fft-feedback').dataset.correct,'true');view.click('[data-tutorial-next]');assert.equal(view.q('.fft-main').getAttribute('href'),GAME_LIST.find(game=>game.id===id).href);
  view.click('[data-tutorial-restart]');assert.equal(view.q('[data-tutorial-next]').disabled,true);assert.equal(view.q('[data-tutorial-reveal]').disabled,false);
});
test('tutorial motion defaults to OS reduced motion and explicit toggle does not lose progress',t=>{
  const view=ui(t,{route:'howto?game=care',reduced:true});assert.equal(view.q('.fft-page').dataset.paused,'true');view.click('[data-tutorial-reveal]');view.click('[data-tutorial-motion]');assert.equal(view.q('.fft-page').dataset.paused,'false');assert.match(view.q('.fft-clue').textContent,/prevent spills/);view.click('[data-tutorial-motion]');assert.equal(view.q('.fft-page').dataset.paused,'true');
});
test('tutorial route objects work and untrusted unknown game names do not become markup',t=>{
  const view=ui(t,{route:{name:'howto',params:new URLSearchParams('game=materials')}});assert.match(view.q('h1').textContent,/treasure/);view.cleanup();mountTutorial(view.host,'<img src=x onerror=alert(1)>');assert.equal(view.host.querySelector('img'),null);assert.equal(view.q('a').getAttribute('href'),'#learn');
});
test('cleanup stops tutorial and finder listeners and leaves outside controls alone',t=>{
  const view=ui(t,{route:'howto?game=care'});view.cleanup();view.click('[data-tutorial-reveal]');assert.equal(view.q('.fft-clue'),null);assert.equal(view.win.document.querySelector('#outside').textContent,'Outside');
  const chooser=ui(t);chooser.controller.abort();chooser.change('age','7');chooser.change('mode','strategy');assert.equal(chooser.host.querySelectorAll('[data-game-card]').length,5);
});
test('already aborted mounts preserve the previous page',t=>{
  const view=ui(t,{aborted:true});assert.equal(view.host.textContent,'Previous view');const home=ui(t,{landing:true,aborted:true});assert.equal(home.host.textContent,'Previous view');
});
test('landing keeps teaching first, all five games and Explore on its own destination',t=>{
  const view=ui(t,{landing:true});assert.match(view.q('h1').textContent,/When something breaks/);assert.match(view.host.textContent,/For parents and children aged 7–12/);assert.equal(view.q('.ffh-hero-actions a').getAttribute('href'),'#learn');assert.equal(view.q('.ffh-explore a').getAttribute('href'),'#explore?view=world');assert.equal(view.host.querySelectorAll('[data-game-card]').length,5);assert.equal(view.host.querySelector('canvas,iframe'),null);assert.equal(view.plays,0);
});
test('film opens only on request, seeks authored chapters and stops on close and route cleanup',t=>{
  const view=ui(t,{landing:true});view.click('[data-film-open]');assert.equal(view.q('dialog').open,true);assert.equal(view.plays,1);view.click('[data-film-chapter="37.848"]');assert.equal(view.q('video').currentTime,37.848);assert.equal(view.plays,2);view.click('[data-film-close]');assert.equal(view.q('dialog').open,false);assert.ok(view.pauses>0);assert.equal(view.win.document.activeElement,view.q('[data-film-open]'));
  view.click('[data-film-open]');view.cleanup();assert.equal(view.q('dialog').open,false);assert.ok(view.observers.every(observer=>observer.disconnected));const plays=view.plays;view.click('[data-film-open]');assert.equal(view.plays,plays);
});
test('reduced motion leaves the full landing visible without reveal observers',t=>{
  const view=ui(t,{landing:true,reduced:true});assert.equal(view.observers.length,0);assert.equal(view.host.querySelector('[data-ffh-reveal][hidden]'),null);assert.match(view.host.textContent,/A useful place to start/);
});

test('home shows three readable learning questions as a semantic list',t=>{
  const view=ui(t,{landing:true});
  assert.equal(view.q('#ffh-questions-title').textContent,'Three questions your child will be able to answer');
  const questions=[...view.host.querySelectorAll('.ffh-questions>li')];
  assert.equal(questions.length,3);
  questions.forEach((question,index)=>{
    assert.equal(question.querySelector('h3').textContent,HOME_QUESTIONS[index].title);
    assert.equal(question.querySelector('p').textContent,HOME_QUESTIONS[index].copy);
    assert.equal(question.querySelector('.ffh-question-number').textContent,String(index+1));
  });
  assert.match(questions[1].textContent,/Never the household bin/);
});

test('home keeps all five compact activity destinations and excludes its game mascot',t=>{
  const view=ui(t,{landing:true});
  assert.equal(view.q('#ffh-activities-title').textContent,'Pick an activity for your child');
  assert.deepEqual([...view.host.querySelectorAll('[data-game-card]')].map(card=>card.dataset.gameCard),GAME_LIST.map(game=>game.id));
  for(const game of GAME_LIST){
    const card=view.q(`[data-game-card="${game.id}"]`);
    assert.equal(card.querySelector('.ffa-play').getAttribute('href'),game.href);
    assert.equal(card.querySelector('.ffa-howto').getAttribute('href'),game.tutorialHref);
    assert.ok(card.querySelector('.ffa-home-icon svg'));
    assert.equal(card.querySelector('.ffa-card-art'),null);
  }
  assert.doesNotMatch(view.host.textContent,/\bPip\b|Take action/i);
  assert.equal(view.q('.ffh-art-pip'),null);
  assert.equal(view.q('.ffh-hero-actions a[href="#decide"]').textContent.trim().startsWith('Get help'),true);
});

test('home filters start folded and still narrow the pastel cards and reset',t=>{
  const view=ui(t,{landing:true,width:1280});
  assert.equal(view.q('.ffa-filter-panel').open,false);
  view.click('.ffa-filter-panel>summary');
  view.change('time','short');
  assert.deepEqual([...view.host.querySelectorAll('[data-game-card]')].map(card=>card.dataset.gameCard),['care']);
  view.click('[data-reset-filters]');
  assert.equal(view.host.querySelectorAll('.ffa-home-card').length,5);
});
