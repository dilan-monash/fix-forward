/** Exercise actual challenge decisions and lifecycle using fictional fixture stories. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountLearning, SORTING_ITEMS, CHOICE_QUESTIONS, CITY_ROUNDS } from './learning.js';

function setup(t,route='learn',options={}) {
  const dom=new JSDOM('<main></main>',{url:'http://learning.test/'});
  const host=dom.window.document.querySelector('main'),routes=[],awards=[],learned=[];
  const cleanup=mountLearning(host,{route,onNavigate:route=>routes.push(route),onAward:(...args)=>awards.push(args),onLearn:item=>learned.push(item),...options});
  t.after(()=>{cleanup();dom.window.close();});
  return {dom,host,routes,awards,learned,cleanup,query:selector=>host.querySelector(selector),click:selector=>{const node=host.querySelector(selector);assert.ok(node,selector);node.click();}};
}
function completeQuiz(ui,items){for(const item of items){ui.click(`[data-answer="${item.answer}"]`);ui.click('[data-next]');}}

test('the hub exposes three playable modes with the reference mode names and no locked progress',t=>{
  const ui=setup(t);
  assert.match(ui.host.textContent,/Choose your challenge/);
  assert.match(ui.host.textContent,/BEGINNER MODE/);
  assert.match(ui.host.textContent,/INTERMEDIATE MODE/);
  assert.match(ui.host.textContent,/ADVANCED MODE/);
  assert.equal(ui.host.querySelectorAll('[data-game]').length,3);
  for(const id of ['fix-it','choices','city'])ui.click(`[data-game="${id}"]`);
  assert.deepEqual(ui.routes,['learn?game=fix-it','learn?game=choices','learn?game=city']);
  assert.equal(ui.host.querySelector('button[disabled],a[aria-disabled="true"]'),null);
  assert.match(ui.host.textContent,/Aim for 8 out of 10 first answers/);
});

test('Circular Choices starts with the reference laptop/cousin story and four semantic answer buttons',t=>{
  const ui=setup(t,'learn?game=choices');
  assert.match(ui.host.textContent,/Your family has an old laptop that still works/);
  assert.match(ui.host.textContent,/Your cousin needs one for school/);
  const buttons=[...ui.host.querySelectorAll('[data-answer]')];
  assert.equal(buttons.length,4);
  assert.ok(buttons.every(button=>button.tagName==='BUTTON'&&button.type==='button'));
  assert.match(buttons[0].textContent,/Give it to your cousin/);
  assert.match(buttons[0].textContent,/Wipe personal data first/);
});

test('a wrong answer can be retried without creating first-answer sparks and retains keyboard focus',t=>{
  const ui=setup(t,'learn?game=choices');
  ui.click('[data-answer="1"]');
  assert.match(ui.host.textContent,/Take another look/);
  assert.equal(ui.query('[data-next]'),null);
  assert.equal(ui.dom.window.document.activeElement,ui.query('[data-answer="1"]'));
  assert.equal(ui.awards.length,0);
  ui.click('[data-answer="0"]');
  assert.match(ui.query('.challenge-progress').textContent,/Sparks 0/);
  assert.equal(ui.awards[0][1],0);
  assert.equal(ui.dom.window.document.activeElement,ui.query('[data-next]'));
});

test('a resolved item cannot score twice and starts the next item at a focused question heading',t=>{
  const ui=setup(t,'learn?game=fix-it');
  ui.click('[data-answer="reuse"]');
  ui.click('[data-answer="reuse"]');
  assert.equal(ui.awards.length,1);
  assert.match(ui.query('.challenge-progress').textContent,/Sparks 5/);
  ui.click('[data-next]');
  assert.match(ui.query('.challenge-progress').textContent,/Item 2 \/ 10/);
  assert.equal(ui.dom.window.document.activeElement,ui.query('h2'));
  assert.equal(ui.query('[data-next]'),null);
});

test('all ten sorting stories finish with an honest first-answer score',t=>{
  const ui=setup(t,'learn?game=fix-it');
  assert.equal(SORTING_ITEMS.length,10);
  completeQuiz(ui,SORTING_ITEMS);
  assert.match(ui.query('.challenge-result-score').textContent,/10 \/ 10 first answers/);
  assert.match(ui.host.textContent,/reached the 8 out of 10 practice goal/);
  assert.equal(new Set(ui.awards.map(([id])=>id)).size,11);
  assert.ok(ui.query('[data-restart]'));
});

test('all ten choice questions finish and replay does not award the same achievements again',t=>{
  const ui=setup(t,'learn?game=choices');
  assert.equal(CHOICE_QUESTIONS.length,10);
  completeQuiz(ui,CHOICE_QUESTIONS);
  const awards=ui.awards.length;
  ui.click('[data-restart]');
  assert.match(ui.query('.challenge-progress').textContent,/Question 1 \/ 10/);
  assert.match(ui.query('.challenge-progress').textContent,/Sparks 0/);
  completeQuiz(ui,CHOICE_QUESTIONS);
  assert.equal(ui.awards.length,awards);
});

test('city budgets disable unaffordable projects and complete five fictional rounds',t=>{
  const ui=setup(t,'learn?game=city');
  assert.equal(CITY_ROUNDS.length,5);
  for(let round=0;round<4;round++){ui.click('[data-city="0"]');assert.equal(ui.query('[data-city="1"]').disabled,true);ui.click('[data-next]');}
  assert.match(ui.query('.city-scoreboard').textContent,/19 tokens left/);
  assert.equal(ui.query('[data-city="0"]').disabled,true);
  assert.equal(ui.query('[data-city="1"]').disabled,false);
  ui.click('[data-city="0"]');
  assert.equal(ui.query('[data-next]'),null);
  ui.click('[data-city="1"]');ui.click('[data-next]');
  assert.match(ui.host.textContent,/9 of 100 tokens/);
  assert.equal(ui.host.querySelectorAll('.city-projects li').length,5);
  assert.match(ui.host.textContent,/fictional game values, not measured environmental savings/);
});

test('city has an always affordable zero-cost route through all five rounds',t=>{
  const ui=setup(t,'learn?game=city');
  for(let round=0;round<5;round++){ui.click('[data-city="2"]');ui.click('[data-next]');}
  assert.match(ui.host.textContent,/100 of 100 tokens/);
  assert.match(ui.query('.challenge-result-score').textContent,/0 city points/);
  ui.click('[data-restart]');
  assert.match(ui.query('.city-scoreboard').textContent,/Round 1 of 5/);
  assert.match(ui.query('.city-scoreboard').textContent,/100 tokens left/);
});

test('an already-aborted mount leaves newer route content intact',t=>{
  const dom=new JSDOM('<main><h1>Newer route</h1></main>');
  t.after(()=>dom.window.close());
  const host=dom.window.document.querySelector('main'),controller=new AbortController();controller.abort();
  const cleanup=mountLearning(host,{route:'learn?game=city',signal:controller.signal});
  assert.equal(host.innerHTML,'<h1>Newer route</h1>');cleanup();
});

test('cleanup and external abort remove click handlers and unknown games fall back to the hub',t=>{
  const controller=new AbortController();
  const ui=setup(t,'learn?game=unknown',{signal:controller.signal});
  assert.match(ui.host.textContent,/Choose your challenge/);
  controller.abort();ui.click('[data-game="choices"]');
  assert.equal(ui.routes.length,0);ui.cleanup();
  const game=setup(t,'learn?game=choices');game.cleanup();game.click('[data-answer="0"]');
  assert.equal(game.awards.length,0);assert.equal(game.query('[data-next]'),null);
});
