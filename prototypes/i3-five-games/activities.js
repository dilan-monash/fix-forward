/** A single catalogue keeps landing, chooser and tutorial destinations in sync.
 * Ages and timings are authored suggestions, not age gates or measured results. */
import {activityArt, deviceArt} from './tutorial-art.js';

export const GAME_LIST = Object.freeze([
  {id:'fix-it',title:'Fix-it Station',href:'#learn?game=fix-it',tutorialHref:'#howto?game=fix-it',ageMin:7,ageMax:12,minutes:[5,10],mode:'story',label:'A good first game',description:'Follow the clues. Give each item a next chapter: repair, reuse or recycle.',lesson:'Why the same next step does not fit every item.',verb:'Start here',icon:'laptop'},
  {id:'materials',title:'Materials Rescue',href:'#learn?game=materials',tutorialHref:'#howto?game=materials',ageMin:7,ageMax:12,minutes:[8,12],mode:'move',label:'Sort + create',description:'Sort pretend materials, see what they can become and find the right collection route.',lesson:'Useful materials can return, while real electronics stay whole.',verb:'Rescue materials',icon:'wire'},
  {id:'care',title:'Care Crew',href:'#learn?game=care',tutorialHref:'#howto?game=care',ageMin:7,ageMax:12,minutes:[5,8],mode:'move',label:'Move + discover',description:'Give Pip’s rooms a little care. Move pretend objects and see the room change.',lesson:'Small care habits and adult help can keep useful things in use.',verb:'Join the crew',icon:'cup'},
  {id:'scrapworks',title:'Scrapworks',href:'#scrapworks',tutorialHref:'#howto?game=scrapworks',ageMin:10,ageMax:12,minutes:[10,15],mode:'strategy',label:'Plan + manage',description:'Run a pretend recovery hub. Read the clues, spot danger signs and spend repair tokens wisely.',lesson:'Safety and the item’s condition come before a recovery plan.',verb:'Run the hub',icon:'kettle'},
  {id:'choices',title:'Circular Choices',href:'#learn?game=choices',tutorialHref:'#howto?game=choices',ageMin:7,ageMax:12,minutes:[5,10],mode:'story',label:'Think + explain',description:'Work through everyday stories. Make a choice and discover why, with grown-up reading help if needed.',lesson:'Explain how care, repair, reuse and recycling fit different situations.',verb:'Try the stories',icon:'toaster'},
].map(game=>Object.freeze({...game,minutes:Object.freeze(game.minutes)})));
const modes={story:'Stories & decisions',move:'Moving & sorting',strategy:'Planning & strategy'};
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function filterGames({age='any',time='any',mode='any'}={}) {
  return GAME_LIST.filter(game=>(age==='any'||Number(age)>=game.ageMin&&Number(age)<=game.ageMax)
    &&(mode==='any'||mode===game.mode)
    &&(time==='any'||time==='short'&&game.minutes[1]<=8||time==='medium'&&game.minutes[1]>8&&game.minutes[1]<=12||time==='long'&&game.minutes[1]>12));
}
function homeActivityIcon(id){
  const paths={
    'fix-it':'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    materials:'<path d="m12 3 8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10M8 5l8 4"/>',
    care:'<path d="M12 21s-8-5-8-11a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 6-8 11-8 11z"/><path d="m8 12 3 3 5-6"/>',
    scrapworks:'<rect x="3" y="7" width="18" height="12" rx="4"/><path d="M7 11v4m-2-2h4M15.5 11.5h.01M18 14.5h.01"/>',
    choices:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg>`;
}
export function activityCard(game,{home=false}={}) {
  if(home){
    // Home has a simple editorial card, without the game mascot or toy scene.
    // The same catalogue supplies its routes, ages, timing and learning goal.
    const description=game.id==='care'?'Explore three pretend rooms. Move objects, make space and discover everyday care habits.':game.description;
    return `<article class="ffa-card ffa-home-card" data-game-card="${game.id}"><span class="ffa-home-icon">${homeActivityIcon(game.id)}</span><div class="ffa-meta"><span>Ages ${game.ageMin}–${game.ageMax}</span><span>${game.minutes.join('–')} min</span></div><h3>${game.title}</h3><p>${description}</p><div class="ffa-card-actions"><a class="ffa-play" href="${game.href}">Play <span class="ffa-sr-only">${game.title}</span><span aria-hidden="true">→</span></a><a class="ffa-howto" href="${game.tutorialHref}">How to play<span class="ffa-sr-only"> ${game.title}</span></a></div></article>`;
  }
  return `<article class="ffa-card" data-game-card="${game.id}"><div class="ffa-card-art"><span class="ffa-card-label">${game.label}</span>${activityArt(game.id)}</div><div class="ffa-card-body"><div class="ffa-meta"><span>Ages ${game.ageMin}–${game.ageMax}</span><span>About ${game.minutes.join('–')} min</span></div><h3>${game.title}</h3><p>${game.description}</p><details class="ffa-lesson"><summary>What we’ll discover</summary><p>${game.lesson}</p></details><div class="ffa-card-actions"><a class="ffa-play" href="${game.href}">${game.verb}<span aria-hidden="true">↗</span></a><a class="ffa-howto" href="${game.tutorialHref}">How to play<span class="ffa-sr-only"> ${game.title}</span></a></div></div></article>`;
}

/** A scoped finder can be mounted inside the home page or the full chooser. */
export function mountActivityFinder(host,{signal,home=false}={}) {
  if(signal?.aborted)return()=>{};
  const win=host.ownerDocument.defaultView,controller=new win.AbortController();
  const filters={age:'any',time:'any',mode:'any'};
  host.innerHTML=`<div class="ffa-finder"><details class="ffa-filter-panel" ${!home&&win.innerWidth>700?'open':' '}><summary>Find a game for your family <span>Age, time &amp; way to play</span></summary><form class="ffa-filters" aria-label="Find a learning game"><label>Child’s age<select name="age" aria-label="Child’s age"><option value="any">All suggested ages</option>${[7,8,9,10,11,12].map(age=>`<option value="${age}">${age} years</option>`).join('')}</select></label><label>Time to explore<select name="time" aria-label="Time to explore"><option value="any">Any amount of time</option><option value="short">A short start · up to 8 min</option><option value="medium">A little longer · 9–12 min</option><option value="long">Take your time · 13–15 min</option></select></label><label>How they like to play<select name="mode" aria-label="How they like to play"><option value="any">All ways to play</option>${Object.entries(modes).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><button class="ffa-reset" type="button" data-reset-filters hidden>Clear filters</button></form></details><div class="ffa-results-top"><p class="ffa-result-count" role="status" aria-live="polite"></p><p>Ages and times are suggestions. No timer. Go at your pace.</p></div><div class="ffa-grid"></div></div>`;
  function render(){const games=filterGames(filters);host.querySelector('.ffa-result-count').textContent=`${games.length} ${games.length===1?'game':'games'} to explore`;host.querySelector('[data-reset-filters]').hidden=Object.values(filters).every(value=>value==='any');host.querySelector('.ffa-grid').innerHTML=games.length?games.map(game=>activityCard(game,{home})).join(''):`<div class="ffa-empty"><span aria-hidden="true">⌕</span><h3>A different starting point?</h3><p>No game matches all three filters. Try another age, time or way to play.</p><button class="ffa-play" type="button" data-reset-filters>Show all five games</button></div>`;}
  function clear(){Object.keys(filters).forEach(key=>filters[key]='any');host.querySelectorAll('select').forEach(select=>select.value='any');render();}
  host.addEventListener('change',event=>{if(event.target.matches('select')&&Object.hasOwn(filters,event.target.name)){filters[event.target.name]=event.target.value;render();}},{signal:controller.signal});
  host.addEventListener('click',event=>{if(event.target.closest('[data-reset-filters]'))clear();},{signal:controller.signal});
  host.querySelector('form').addEventListener('submit',event=>event.preventDefault(),{signal:controller.signal});
  render();
  const cleanup=()=>{controller.abort();signal?.removeEventListener('abort',cleanup);};signal?.addEventListener('abort',cleanup,{once:true});return cleanup;
}

const tutorials={
  'fix-it':{title:'Give an item its next chapter.',first:'Read the clue before you choose.',action:'Look at the clue',clue:'This pretend laptop works. An adult checked it, removed personal data and found someone who wants it.',question:'Where could this useful laptop go?',choices:[['repair','Repair'],['reuse','Reuse'],['recycle','Recycle']],answer:'reuse',success:'Reuse fits: it works, has been checked and is wanted.',retry:'It already works and someone wants it. Which option keeps it in use?',finish:'In the game, follow each new clue. A different item may need a different next step.',outcome:'A useful laptop. A new home.'},
  materials:{title:'Find the treasure in a material.',first:'Start with one pretend factory piece.',action:'Select the curly wire',clue:'This pretend wire is copper: a metal. Factory pieces here are pictures; keep real devices closed.',question:'Which material group fits copper?',choices:[['glass','Glass'],['metal','Metals'],['plastic','Plastics']],answer:'metal',success:'Copper is a metal. Recovered copper can become new cable.',retry:'Use the material clue: copper belongs with metals.',finish:'The game continues from sorting to new uses, then to safe collection routes for batteries and whole devices.',outcome:'Sorted copper → new cable.'},
  care:{title:'Make a little space for care.',first:'Notice what is close to the laptop.',action:'Select the drink',clue:'A drink is beside the pretend laptop. Keeping drinks away helps prevent spills around electronics.',question:'Where is a better place for this pretend drink?',choices:[['laptop','Beside the laptop'],['tray','The tray away from electronics']],answer:'tray',success:'More space, less chance of a spill. The laptop’s space is clear.',retry:'Choose the place away from the electronics.',finish:'Move an object, then tap its new place—or drag it. Watch each pretend room change. Adults handle real appliances.',outcome:'A clear desk. A useful habit.'},
  scrapworks:{title:'Inspect first. Make a plan.',first:'A recovery plan begins with the clues.',action:'Inspect this practice item',clue:'For this practice example, a qualified repairer has confirmed a suitable safe repair. Two pretend repair tokens are available.',question:'Which plan follows that assessment?',choices:[['rubbish','Send it to rubbish'],['repair','Use the repair plan · 2 tokens']],answer:'repair',success:'The assessed repair fits. You used the two pretend tokens in this example.',retry:'The assessment says a suitable safe repair is possible. Use that clue before spending the tokens.',finish:'In Scrapworks, inspect the actual item and its hazards before choosing. Tokens are game resources, not real prices.',outcome:'A considered plan. A second chance.'},
  choices:{title:'Choose a next step—and know why.',first:'Look for what the story tells you.',action:'Read this short story',clue:'This pretend device cannot be safely repaired. An adult has removed personal data and confirmed that a specialist e-waste service accepts it.',question:'What fits this story?',choices:[['rubbish','Ordinary rubbish'],['ewaste','Accepted e-waste service']],answer:'ewaste',success:'The accepted specialist service is the next step when safe repair and reuse are no longer possible.',retry:'The story names a service that accepts the device. Electronics do not belong in ordinary rubbish.',finish:'Each story has its own clue. Read the explanation after your choice and discuss the reason together.',outcome:'The right service. Materials recovered.'},
};

function tutorialRoute(route,game){
  if(typeof route==='string'){const [name,query='']=route.replace(/^#/,'').split('?');return{name,game:game||new URLSearchParams(query).get('game')};}
  return{name:route?.name||route?.page||route?.path||'learn',game:game||route?.params?.get?.('game')||route?.game};
}
export function mountActivities(host,{route='learn',game,signal}={}) {
  if(signal?.aborted)return()=>{};
  const parsed=tutorialRoute(route,game);
  if(parsed.name==='howto')return mountTutorial(host,parsed.game,{signal});
  host.innerHTML=`<div class="ffa-page"><header class="ffa-heading"><p class="ffa-kicker">LEARN TOGETHER · AGES 7–12</p><h1>Little games.<br><span>Useful discoveries.</span></h1><p>Five ways to explore what happens next. Start with a story, move things around, or make a plan. There’s no rush.</p></header><aside class="ffa-first"><span class="ffa-first-symbol" aria-hidden="true">↗</span><div><strong>New here? Start at Fix-it Station.</strong><p>Follow one clue, choose a next step and talk about why.</p></div><a href="#howto?game=fix-it">Show me how <span aria-hidden="true">→</span></a></aside><section aria-label="Choose a learning game" data-activity-finder></section><aside class="ffa-parent-note"><div><p class="ffa-kicker">THE CONVERSATION IS PART OF THE GAME</p><h2>“What clue helped you decide?”</h2><p>After playing, ask your child to explain one choice. Look at the saved learning feedback together where the activity provides it.</p></div><a class="ffa-play" href="#parents">For parents <span aria-hidden="true">↗</span></a></aside></div>`;
  return mountActivityFinder(host.querySelector('[data-activity-finder]'),{signal});
}

/** Tutorials are tiny practice scenes. Nothing is timed or added to game scores.
 * Progress follows a real button/keyboard action; motion never carries a clue alone. */
export function mountTutorial(host,id,{signal}={}) {
  if(signal?.aborted)return()=>{};
  const game=GAME_LIST.find(item=>item.id===id);
  if(!game){host.innerHTML='<section class="ffa-page ffa-empty"><h1>Choose a game to explore.</h1><p>Each of the five games has a guided practice.</p><a class="ffa-play" href="#learn">See all five games →</a></section>';return()=>{};}
  const guide=tutorials[game.id],win=host.ownerDocument.defaultView,controller=new win.AbortController();
  let step=0,unlocked=0,revealed=false,solved=false,feedback='',paused=Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches),disposed=false;
  function render(focus=false){
    host.innerHTML=`<section class="fft-page" data-paused="${paused}" aria-labelledby="fft-title"><nav class="fft-nav" aria-label="Tutorial navigation"><a href="#learn">← All five games</a><button type="button" data-tutorial-motion aria-pressed="${paused}" aria-label="Pause tutorial motion">Motion ${paused?'off':'on'}</button></nav><header class="fft-heading"><p class="ffa-kicker">HOW TO PLAY · ${game.title.toUpperCase()}</p><h1 id="fft-title">${guide.title}</h1><p>A little practice before the game. Try it at your pace.</p></header><ol class="fft-steps" aria-label="Practice steps">${['Notice the clue','Try a next step','Take it into the game'].map((label,index)=>`<li><button type="button" data-tutorial-step="${index}" ${index>unlocked?'disabled':''} ${step===index?'aria-current="step"':''}><span>${index+1}</span>${label}</button></li>`).join('')}</ol><div class="fft-practice"><div class="fft-scene ${solved?'is-solved':''}" data-scene-step="${step}"><span class="fft-scene-label">A PRETEND PRACTICE SCENE</span><div class="fft-scene-art">${activityArt(game.id,{solved:solved&&step>0})}</div>${solved&&step>0?`<div class="fft-outcome"><span aria-hidden="true">✓</span><strong>${guide.outcome}</strong></div>`:`<div class="fft-object">${deviceArt(game.icon)}<span>${game.id==='materials'?'A curly copper wire':game.id==='care'?'A drink near the laptop':game.id==='scrapworks'?'An item with a repair assessment':game.id==='choices'?'A device at its end of life':'A laptop that still works'}</span></div>`}<span class="fft-scene-caption">Pictures here. Adult help for real items.</span></div><div class="fft-guide"><p class="ffa-kicker">STEP ${step+1} OF 3</p><h2 tabindex="-1">${step===0?guide.first:step===1?guide.question:'You’re ready to explore.'}</h2>${step===0?`<p>Start by looking. The clue tells you more than the item’s appearance.</p><button class="ffa-play fft-main" type="button" data-tutorial-reveal ${revealed?'disabled':''}>${revealed?'Clue found ✓':guide.action}</button>${revealed?`<div class="fft-clue" role="status"><strong>Your clue</strong><p>${guide.clue}</p></div>`:''}`:step===1?`<div class="fft-clue"><strong>Keep the clue in mind</strong><p>${guide.clue}</p></div><div class="fft-options" role="group" aria-label="Try a next step">${guide.choices.map(([value,label])=>`<button type="button" data-tutorial-choice="${value}" ${solved?'disabled':''}>${label}</button>`).join('')}</div><div class="fft-feedback" role="status" aria-live="polite" data-correct="${solved}">${feedback?escape(feedback):'Choose an option. You can try again.'}</div>`:`<p>${guide.finish}</p><div class="fft-clue"><strong>A question to bring along</strong><p>“What clue helped me decide?”</p></div><p class="fft-practice-note">This was a practice example. Your game starts fresh.</p><a class="ffa-play fft-main" href="${game.href}">Play ${game.title} <span aria-hidden="true">↗</span></a>`}<div class="fft-controls">${step>0?'<button type="button" data-tutorial-back>← Back</button>':'<span>Use touch, mouse or keyboard.</span>'}${step<2?`<button class="fft-next" type="button" data-tutorial-next ${(step===0&&!revealed)||(step===1&&!solved)?'disabled':''}>Next step →</button>`:'<button type="button" data-tutorial-restart>Practise again ↻</button>'}</div></div></div><p class="fft-footer">Prefer to jump in? <a href="${game.href}">Open ${game.title}</a> · No timer, no score for this practice.</p></section>`;
    if(focus)host.querySelector('.fft-guide h2')?.focus({preventScroll:true});
  }
  host.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled||disposed)return;
    if(button.hasAttribute('data-tutorial-motion')){paused=!paused;host.querySelector('.fft-page').dataset.paused=String(paused);button.setAttribute('aria-pressed',String(paused));button.textContent=`Motion ${paused?'off':'on'}`;return;}
    if(button.hasAttribute('data-tutorial-reveal')){revealed=true;unlocked=Math.max(unlocked,1);render();host.querySelector('[data-tutorial-next]')?.focus({preventScroll:true});return;}
    if(button.hasAttribute('data-tutorial-choice')){solved=button.dataset.tutorialChoice===guide.answer;feedback=solved?guide.success:guide.retry;if(solved)unlocked=2;const choice=button.dataset.tutorialChoice;render();host.querySelector(solved?'[data-tutorial-next]':`[data-tutorial-choice="${choice}"]`)?.focus({preventScroll:true});return;}
    if(button.hasAttribute('data-tutorial-next')){step=Math.min(step+1,unlocked);render(true);return;}
    if(button.hasAttribute('data-tutorial-back')){step=Math.max(step-1,0);render(true);return;}
    if(button.hasAttribute('data-tutorial-step')){step=Math.min(Number(button.dataset.tutorialStep),unlocked);render(true);return;}
    if(button.hasAttribute('data-tutorial-restart')){step=0;unlocked=0;revealed=false;solved=false;feedback='';render(true);}
  },{signal:controller.signal});
  render();const cleanup=()=>{disposed=true;controller.abort();signal?.removeEventListener('abort',cleanup);};signal?.addEventListener('abort',cleanup,{once:true});return cleanup;
}
