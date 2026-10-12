/** INTERVIEW: an ordinary #link -> hashchange -> renderRoute -> feature mount.
 * The shell owns the shared identity, history, learning record and optional sound.
 * Each feature returns cleanup so canvas rendering and old listeners stop on navigation. */
import { readProgress, saveProgress, addAward, addLesson, totalSparks } from './progress.js';

const host = document.querySelector('#preview-app');
const main = document.querySelector('#main');
let storage;
try { storage = localStorage; } catch { /* The site remains usable without persistent storage. */ }
const progress = readProgress(storage);
let cleanup = () => {};
let generation = 0;
let audio;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Keep icons tiny and local. These describe controls; appliances themselves are real 3D meshes. */
function icon(name) {
  const paths = {
    cube:'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10M7 4l10 6"/>',
    repair:'<path d="M15 3a6 6 0 0 0-7 7l-6 7 5 5 7-7a6 6 0 0 0 7-7l-5 4-4-4z"/>',
    shield:'<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6zM8 12l3 3 5-6"/>',
    recycle:'<path d="m9 4 3-2 4 7m-1-5 2 5-5 1M20 11l2 4-4 7h-5m5-5-5 5 5 1M9 21H4l-3-7 3-5m-4 1 4-1 2 5"/>',
    leaf:'<path d="M21 3C9 1 1 8 4 16c5 9 19 2 17-13ZM5 19l12-12M9 14v-5m4 1h5"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    heart:'<path d="M12 21 3 12C-3 5 6-1 12 6c6-7 15-1 9 6z"/>',
  };
  return `<svg viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}

/** The landing gives practical adult tasks the same visual priority as discovery.
 * Hero art is an interactive canvas, not a video download or a flattened 3D-looking image. */
function homeMarkup() {
  return `<section class="home-hero page-width"><div class="hero-story"><p class="eyebrow light"><span class="status-dot"></span> EVERYDAY OBJECTS. BETTER POSSIBILITIES.</p><h1>Good things<br>deserve a<br><em>second chapter.</em></h1><p class="hero-description">Understand what’s inside. Care for what you own. Find a better next step when something goes wrong.</p><div class="hero-actions"><a class="button lime" href="#action">Find my next step ${icon('arrow')}</a><a class="button glass" href="#explore">Step into the 3D world ${icon('cube')}</a></div><p class="hero-note">For appliance owners, curious minds and families learning together.</p></div><div class="hero-scene"><div class="scene-overline"><span><i class="status-dot"></i> THE EVERYDAY WORLD</span><span>REAL-TIME 3D</span></div><canvas id="home-world" aria-label="Interactive 3D room of twelve everyday appliances. Drag to look around, or use Explore in 3D."></canvas><div class="scene-loading" data-world-loading><span class="loading-orbit"></span><p>Opening your everyday world…</p></div><div class="scene-bottom"><span>${icon('cube')} Drag to look. Pick an appliance.</span><a href="#explore" aria-label="Enter the appliance world">↗</a></div><span class="floating-world-label"><span class="tiny-orbit" aria-hidden="true"></span> A closer look changes everything.</span></div></section>
  <div class="principle-strip page-width"><span><b>01</b> Understand your appliance</span><span><b>02</b> Make it last longer</span><span><b>03</b> Choose its next chapter</span></div>
  <section class="action-launch page-width" aria-labelledby="action-title"><div class="section-heading"><div><p class="eyebrow">PRACTICAL HELP, WHEN YOU NEED IT</p><h2 id="action-title">Something needs attention?<br><span>Let’s find your next step.</span></h2></div><p>Start with what you know.<br>You don’t need to play a game to get help.</p></div><div class="action-launch-grid"><a class="launch-card" href="#action?kind=recall"><span class="launch-icon">${icon('shield')}</span><span class="card-number">01</span><h3>Check a recall</h3><p>Use the brand and model to look for an official product notice.</p><span class="text-link">Check my appliance <b>↗</b></span></a><a class="launch-card" href="#action?kind=repair"><span class="launch-icon">${icon('repair')}</span><span class="card-number">02</span><h3>Find repair help</h3><p>See what to ask a repairer and find a useful starting point nearby.</p><span class="text-link">Explore repair options <b>↗</b></span></a><a class="launch-card" href="#action?kind=recycle"><span class="launch-icon">${icon('recycle')}</span><span class="card-number">03</span><h3>Recycle responsibly</h3><p>Electrical items need the right collection point. Check before visiting.</p><span class="text-link">Find the right place <b>↗</b></span></a><a class="launch-card care-card" href="#explore?appliance=kettle&tab=care"><span class="launch-icon">${icon('leaf')}</span><span class="card-number">04</span><h3>Care for what you own</h3><p>Small habits, useful maintenance tips and a better understanding of your item.</p><span class="text-link">Make a little care count <b>↗</b></span></a></div></section>
  <section class="explore-editorial page-width"><div class="editorial-text"><p class="eyebrow">MORE THAN WHAT MEETS THE EYE</p><h2>Every appliance<br>has an <em>inside story.</em></h2><p>Explore twelve familiar appliances. Turn one around. Separate its digital parts. See what they do, how to care for them and what powers your everyday routine.</p><div class="editorial-tags"><span>360° exploration</span><span>Digital parts view</span><span>AR on compatible devices</span></div><a href="#explore" class="button primary">Enter FF Lens ${icon('arrow')}</a></div><div class="explore-directory"><a href="#explore?appliance=kettle"><span>01 / KITCHEN</span><strong>From the first<br>cup of the day.</strong><div class="orbital-graphic" aria-hidden="true"><i></i><i></i><i></i><b>360°</b></div><span class="directory-link">Kettle · Toaster · Blender · Microwave <b>↗</b></span></a><a href="#explore?appliance=laptop"><span>02 / EVERYDAY LIFE</span><strong>To the things<br>we rely on.</strong><div class="material-blocks" aria-hidden="true"><i></i><i></i><i></i></div><span class="directory-link">Fan · Vacuum · Hair dryer · Laptop <b>↗</b></span></a></div></section>
  <section class="impact-teaser page-width"><div class="impact-visual" aria-hidden="true"><span class="impact-axis">LESS GUESSWORK. MORE UNDERSTANDING.</span><div class="energy-bars"><i style="--bar:24%"></i><i style="--bar:41%"></i><i style="--bar:35%"></i><i style="--bar:62%"></i><i style="--bar:46%"></i><i style="--bar:81%"></i><i style="--bar:57%"></i></div><span class="impact-unit">Energy <b>→</b> CO₂e</span></div><div><p class="eyebrow">SEE WHAT YOUR EVERYDAY USE ADDS UP TO</p><h2>Small habits.<br>A clearer picture of impact.</h2><p>Adjust power and time to compare electricity use and estimated emissions. See the assumptions and sources behind the numbers.</p><a class="text-link" href="#explore?appliance=kettle&tab=impact">Explore the impact calculator ${icon('arrow')}</a></div></section>
  <section class="together-panel page-width"><div><p class="eyebrow">SOMETHING TO DISCOVER TOGETHER</p><h2>A child asks “why?”<br>You both find a better way.</h2><p>Turn a familiar object into a shared discovery. Then bring that thinking into a real decision at home.</p><a href="#learn" class="button secondary">Find a family activity ${icon('arrow')}</a></div><div class="family-loop"><article><span>LOOK</span><strong>What does this part do?</strong><p>Explore an appliance in 3D.</p></article><i aria-hidden="true">↘</i><article><span>THINK</span><strong>Does broken mean rubbish?</strong><p>Use the story’s clue to choose.</p></article><i aria-hidden="true">↗</i><article><span>ACT</span><strong>What could we do with ours?</strong><p>Find a next step with an adult.</p></article></div></section>`;
}

/** WebGL arrives after the text and links, so an older device still has useful navigation. */
async function mountHome(token) {
  host.innerHTML = homeMarkup();
  const canvas = host.querySelector('#home-world');
  const notice = host.querySelector('[data-world-loading]');
  let world;
  let disposed = false;
  cleanup = () => { disposed = true; world?.dispose(); };
  try {
    const { createWorld } = await import('./world-engine.js');
    if (disposed || token !== generation) return;
    world = await createWorld(canvas,{mode:'hero',onSelectAppliance:id => onNavigate(`explore?appliance=${encodeURIComponent(id)}`)});
    if (disposed || token !== generation) { world.dispose(); return; }
    notice.hidden = true;
  } catch(error) {
    console.warn('Local 3D scene could not initialise', error);
    if (!disposed) notice.innerHTML = '<p>The 3D view could not start on this device.</p><a class="button secondary" href="#explore">Explore parts, care and impact →</a>';
  }
}

/** This is the parent purpose view, not a separate branded application. */
function parentsMarkup() {
  return `<section class="page-width parents-page"><p class="eyebrow">FOR PARENTS AND CURIOUS FAMILIES</p><h1>Useful for your home.<br><em>Meaningful for their future.</em></h1><p class="lead">“Throw it away” is only one possible ending. FixForward helps your family understand the other possibilities, and gives adults a practical place to begin.</p><div class="parent-two"><article><span class="large-index">01</span><h2>When you have an appliance problem.</h2><p>Start in Take action. Enter the item’s details for a recall check, explore repair and recycling sources, or save a next-step plan. No game is required.</p><a class="button primary" href="#action">Get practical help →</a></article><article><span class="large-index">02</span><h2>When a child wants to know why.</h2><p>Explore a digital appliance together. See how parts work and compare energy use. In sorting, the story changes the decision: working, repairable and beyond repair are different situations.</p><a class="button secondary" href="#learn">Choose a shared activity →</a></article></div><blockquote>“What could we find out before deciding?”<cite>A question for an eight-year-old. A useful habit for all of us.</cite></blockquote><div class="parent-faq"><h2>A few things you may want to know.</h2><details><summary>What do children actually learn?</summary><p>They connect parts to jobs, use clues rather than appearances, and learn that reuse, repair and specialist recycling have different purposes. Short questions ask them to apply what they noticed.</p></details><details><summary>Does this teach children to repair appliances?</summary><p>No. Parts separate only in the digital model. Real appliances stay closed. Children can explain an idea; an adult handles care, recalls and contact with a qualified repairer.</p></details><details><summary>Are the carbon numbers measured?</summary><p>No. The impact view calculates an illustrative use-phase estimate from power, time, frequency and a visible electricity factor. It does not claim to know an appliance’s manufacturing footprint or count a verified emissions saving.</p></details><details><summary>What does AR need?</summary><p>A compatible phone or tablet browser, a secure connection and the device’s permission. The 3D view remains available where AR is unsupported.</p></details><details><summary>Is there automatic sound or a child account?</summary><p>No automatic sound. Optional activity sounds start after a tap. Fix-it Station has its own music and sounds, which also wait for a tap and have Music and Sounds buttons to turn them off. Discoveries stay in this browser, without names, child accounts or a public leaderboard.</p></details></div></section>`;
}

/** Learning is recorded as ideas rather than claimed environmental outcomes. */
function journalMarkup() {
  const path = lesson => ['share','reuse'].includes(lesson.pathway) ? 'reuse' : ['recycle','dispose'].includes(lesson.pathway) ? 'recycle' : 'repair';
  return `<section class="page-width journal-page"><p class="eyebrow">MY SPACE</p><div class="section-heading"><div><h1>Ideas worth<br><em>bringing home.</em></h1><p class="lead">Keep a discovery. Explain a choice. Take the next step together.</p></div><div class="journal-count"><span>✧</span><strong>${totalSparks(progress)}</strong><small>Sparks from completed activities</small></div></div><div class="journal-grid">${progress.lessons.map(lesson => `<article><p class="eyebrow">${escape(lesson.appliance || 'A useful discovery')}</p><h2>${escape(lesson.title)}</h2><p>${escape(lesson.detail)}</p><a href="#action?kind=${path(lesson)}&appliance=${encodeURIComponent(lesson.appliance || 'Kettle')}&from=learn" class="text-link">Consider a family next step ↗</a></article>`).join('') || '<article class="journal-empty"><span>✧</span><h2>Your first discovery is waiting.</h2><p>Open an appliance in 3D or try a sorting challenge. A useful idea is the real reward.</p><a href="#explore" class="button primary">Explore something familiar →</a></article>'}</div><div class="journal-adult-link"><div><h2>Have a real appliance to sort out?</h2><p>Your adult next-step plan lives in Take action.</p></div><a class="button secondary" href="#action">Open my action workspace →</a></div><p class="small muted">Saved on this browser only. Sparks mark activities, not measured learning or verified environmental impact.</p></section>`;
}

/** External links support explicit claims; operational data and model capability
 * are never replaced with fabricated successful results in this local preview. */
function sourcesMarkup() {
  return `<section class="page-width sources-page"><p class="eyebrow">SOURCES &amp; APPROACH</p><h1>A clearer picture.<br><em>Honest about its limits.</em></h1><div class="source-grid"><article><h2>Recall information</h2><p>A photograph can suggest an item category, when recognition is validated. Brand and model identifiers are separate. Confirm any notice with the official source.</p><a href="https://www.productsafety.gov.au/recalls" target="_blank" rel="noopener">Product Safety Australia ↗</a></article><article><h2>Energy and CO₂e</h2><p>The calculator shows electricity-use estimates from visible assumptions. Its emissions factor and publication year are linked inside the impact view. No product lifecycle footprint is invented.</p><a href="#explore?tab=impact">See calculations and sources →</a></article><article><h2>Care and e-waste</h2><p>Care suggestions are general. Follow the exact manufacturer guide for your model. Real repairs need the right person. An adult checks what a collection site accepts.</p><a href="https://www.environment.vic.gov.au/household-waste-recycling/ewaste" target="_blank" rel="noopener">Victorian Government e-waste guidance ↗</a></article><article><h2>Data availability</h2><p>Recall and location tools use the available reference records. When records cannot be reached, we show that clearly and link to official sources. Photo suggestions remain paused while accuracy is reviewed.</p><p>Digital models are simplified educational illustrations, not model-specific disassembly guides.</p></article><article><h2>3D and augmented reality</h2><p>Original geometry is rendered with locally hosted Three.js. WebXR AR requires a compatible device and secure context. Desktop checks cannot establish real-device placement accuracy.</p><a href="https://threejs.org/" target="_blank" rel="noopener">Three.js · MIT licence ↗</a></article><article><h2>Learning records</h2><p>Local learning cards and next-step plans belong to this browser. No name, child account, public ranking or verified carbon-saving total is collected.</p><a href="#parents">How families can use FixForward →</a></article></div></section>`;
}

/** The same short sound vocabulary works across activities. It is off by default
 * and independent of screen animation, to avoid competing for attention. */
function playSound(kind='tap') {
  if (!progress.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ||= new Audio(); audio.resume().catch(()=>{});
    const notes = /win|success|correct/.test(kind) ? [523,659,784] : /wrong|retry/.test(kind) ? [294,262] : [440];
    notes.forEach((frequency,index) => { const osc=audio.createOscillator(), gain=audio.createGain(), start=audio.currentTime+index*.08; osc.frequency.value=frequency; gain.gain.setValueAtTime(.035,start); gain.gain.exponentialRampToValueAtTime(.001,start+.14); osc.connect(gain); gain.connect(audio.destination); osc.start(start); osc.stop(start+.16); osc.onended=()=>{osc.disconnect();gain.disconnect();}; });
  } catch { /* Visible feedback remains the primary interaction response. */ }
}

function updateToolbar() {
  const total=totalSparks(progress); document.querySelector('#spark-total').textContent=total;
  document.querySelector('#spark-pocket').setAttribute('aria-label',`My space, ${total} sparks`);
  document.querySelector('#sound-toggle').setAttribute('aria-pressed',String(progress.sound));
  document.querySelector('#sound-toggle').setAttribute('aria-label',progress.sound?'Turn off activity sounds':'Turn on activity sounds');
  document.querySelector('#sound-label').textContent=progress.sound?'Sound on':'Sound off';
}

/** Stable IDs prevent repeated clicks/replays earning the same reward twice. */
function onAward(id,amount,origin) {
  if (!addAward(progress,id,amount)) return false;
  saveProgress(storage,progress); updateToolbar();
  const to=document.querySelector('#spark-pocket').getBoundingClientRect(), from=origin?.getBoundingClientRect?.() || {left:innerWidth/2,top:innerHeight/2,width:0,height:0};
  if (!reducedMotion.matches && Element.prototype.animate) for(let i=0;i<6;i++) { const star=document.createElement('span'); star.className='flying-spark'; star.textContent='✧'; star.style.left=`${from.left+from.width/2}px`; star.style.top=`${from.top+from.height/2}px`; document.querySelector('#reward-layer').append(star); star.animate([{transform:'translate(0,0) scale(.4)',opacity:0},{transform:`translate(${(i-2)*20}px,-50px) scale(1.2)`,opacity:1,offset:.25},{transform:`translate(${to.left+to.width/2-from.left-from.width/2}px,${to.top+to.height/2-from.top-from.height/2}px) scale(.25)`,opacity:0}],{duration:800+i*35,delay:i*25,easing:'ease-in-out'}).finished.catch(()=>{}).finally(()=>star.remove()); }
  document.querySelector('#announcement').textContent=`${amount} Sparks earned. ${totalSparks(progress)} in your space.`;
  return true;
}
function onLearn(lesson) { if (addLesson(progress,lesson)) saveProgress(storage,progress); }

/** Old sorting callbacks are translated at this boundary, keeping their tested
 * behaviour while linking them into the new shared action/explore experience. */
function onNavigate(value) {
  const [original,query='']=String(value||'home').replace(/^#\/?/,'').split('?');
  const params=new URLSearchParams(query);
  let name=original;
  if(name==='services')name='action';
  if(name==='recall'){name='action';params.set('kind','recall');}
  if(name==='lens')name='explore';
  const route=name+(params.size?'?'+params.toString():'');
  if (!/^(home|explore|action|learn|sort|scrapworks|parents|journal|sources)(\?|$)/.test(route)) return;
  if (location.hash.slice(1)===route) renderRoute(); else location.hash=route;
}

/** Hash routes do not reach Flask, so unknown links need an explicit recovery screen. */
function notFoundMarkup() {
  document.title='Page not found | FixForward';
  return '<section class="page-width route-loading"><p class="eyebrow">404 · PAGE NOT FOUND</p><h1>Let’s find your way.</h1><p>This page does not exist. Your saved discoveries are still here.</p><a class="button primary" href="#home">Back to home →</a><a class="text-link" href="#action">Find an appliance next step →</a></section>';
}

/** A generation token prevents a delayed module/model replacing a newer route.
 * Native hashes keep Back/Forward working without a custom navigation stack. */
async function renderRoute() {
  const token=++generation; cleanup(); cleanup=()=>{};
  // A route can be left before an asynchronous 3D mount has finished. Give that
  // mount a cancellation signal immediately, not only after its promise returns.
  const routeController=new AbortController();
  cleanup=()=>routeController.abort();
  const route=location.hash.slice(1).replace(/^\//,'')||'home', name=route.split('?')[0];
  document.body.dataset.route=name;
  const nav=['sort','scrapworks'].includes(name)?'learn':name;
  document.querySelectorAll('[data-nav]').forEach(a=>a.dataset.nav===nav?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
  document.title=`${({home:'Give good things a longer life.',explore:'Explore in 3D',action:'Take action',learn:'Learn together',sort:'Sorting station',scrapworks:'Scrapworks',parents:'For families',journal:'My space',sources:'Sources & approach'})[name]||'Home'} | FixForward`;
  const context={route,onNavigate,onLearn,onAward,playSound,signal:routeController.signal};
  try {
    if(name==='home') { mountHome(token); }
    else if(['explore','action','sort','learn','scrapworks'].includes(name)) {
      host.innerHTML='<section class="page-width route-loading" role="status"><span class="loading-orbit"></span><p>Opening your next step…</p></section>';
      // Learn opens the challenge hub; its Fix-it Station address (learn?game=fix-it)
      // opens the 3D workshop game, and Scrapworks is the strategy game for older children.
      const fixit=name==='learn'&&new URLSearchParams(route.split('?')[1]||'').get('game')==='fix-it';
      if(fixit)document.title='Fix-it Station | FixForward';
      const module=await import(fixit?'./fixit.js':name==='explore'?'./explore.js':name==='action'?'./action.js?v=i3-photo-review-v4':name==='learn'?'./learning.js':name==='scrapworks'?'./scrapworks.js':'../i3-family-preview/sorting.js');
      if(token!==generation)return;
      const mounted=await (fixit?module.mountFixit(host,context):name==='explore'?module.mountExplore(host,context):name==='action'?module.mountAction(host,context):name==='learn'?module.mountLearning(host,context):name==='scrapworks'?module.mountScrapworks(host,context):module.mountSorting(host,context));
      if(token!==generation){mounted?.();return;}
      cleanup=()=>{routeController.abort();mounted?.();};
    } else host.innerHTML=name==='parents'?parentsMarkup():name==='journal'?journalMarkup():name==='sources'?sourcesMarkup():notFoundMarkup();
  } catch(error) {
    if(token!==generation)return;
    console.error('Preview route could not open',error);
    host.innerHTML='<section class="page-width route-loading"><h1>Let’s start from here.</h1><p>This view could not open. Your saved discoveries are still on this browser.</p><a class="button primary" href="#home">Back home →</a></section>';
  }
  if(token===generation){scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}
}

// Bind shell controls once. Feature modules attach and dispose their own handlers.
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus({preventScroll:true});main.scrollIntoView({block:'start'});});
document.querySelector('#sound-toggle').addEventListener('click',()=>{progress.sound=!progress.sound;saveProgress(storage,progress);updateToolbar();if(progress.sound)playSound();else audio?.suspend().catch(()=>{});});
window.addEventListener('hashchange',renderRoute);
window.addEventListener('pagehide',()=>{cleanup();audio?.close().catch(()=>{});});
updateToolbar();renderRoute();
