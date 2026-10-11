/** A separate review shell combines the reviewed live beginner game with the
 * family activities. Route disposal stops cameras, animation and listeners. */
import {normaliseRoute} from './routes.js';
import {mountLanding} from './landing.js';
import {mountActivities,GAME_LIST} from './activities.js';
import {mountChoices} from './choices.js';
import {loadChoices} from './choices-engine.js';
import {loadGames} from '../i3-family-landing/playroom-engine.js';
import {readSave,learningRecord} from './reference/fixit-engine.js';
import {loadScrapworksJournal} from './scrapworks.js';
const host=document.querySelector('#preview-app'),main=document.querySelector('#main');
let cleanup=()=>{},controller=null,renderId=0,observer=null,storage;
try{storage=localStorage;}catch{/* Learning still works without persistence. */}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const navigate=route=>{location.hash=String(route).replace(/^#/,'');};
function parents(){
  const plays=loadGames(storage),choices=loadChoices(storage),fix=learningRecord(readSave(storage).history),scrap=loadScrapworksJournal(storage);
  const records={
    'fix-it':{href:'#parents?view=fix-it',text:`${fix.rounds} rounds recorded · ${fix.retried} items needed another try.`},
    materials:{href:'#parents?view=playroom',text:`${plays.filter(s=>s.gameId==='materials').length} rounds recorded. See each item, place and hint.`},
    care:{href:'#parents?view=playroom',text:`${plays.filter(s=>s.gameId==='care').length} rounds recorded. See which care moves needed support.`},
    scrapworks:{href:'#scrapworks?view=parents',text:`${scrap.length} shifts recorded. Review route choices, retries and trade-offs.`},
    choices:{href:'#parents?view=choices',text:`${choices.length} rounds recorded. Review every story and answer in order.`},
  };
  host.innerHTML=`<section class="ff-parent-page"><p class="eyebrow">FOR PARENTS &amp; GROWN-UPS</p><h1>Turn a tricky moment<br>into a conversation.</h1><p>Open a game’s record to see what your child tried, where they asked for help and which ideas you could revisit together.</p><p>Progress belongs to this browser on this device. No names, accounts or child profiles. These games show practice, not a diagnosis or a test of ability.</p><div class="ff-record-grid">${GAME_LIST.map(g=>`<a href="${records[g.id].href}"><span class="eyebrow">${esc(g.label||'LEARNING RECORD')}</span><h2>${esc(g.title)}</h2><p>${esc(records[g.id].text)}</p><strong>Open our learning record ↗</strong></a>`).join('')}</div><a class="ff-link-button" href="#learn">Choose an activity together →</a></section>`;
}
function info(name){host.innerHTML=name==='sources'?`<section class="ff-info-page"><p class="eyebrow">SOURCES &amp; APPROACH</p><h1>Curiosity, with care.</h1><p>Our games use fictional items and simplified stories. Children practise thinking; adults handle real electronics. Game points record moves, not carbon savings or proof that a real item is safe.</p><ul><li><a href="https://www.environment.vic.gov.au/household-waste-recycling/ewaste" target="_blank" rel="noopener">Victorian Government: batteries and electronic waste</a> — check accepted services rather than using household bins.</li><li><a href="https://www.productsafety.gov.au/consumers/handle-chemicals-and-poisons-safely/lithium-ion-batteries-guide" target="_blank" rel="noopener">ACCC Product Safety: lithium-ion batteries</a> — stop using damaged batteries and seek adult help.</li><li><a href="https://www.repaircafe.org/en/about/" target="_blank" rel="noopener">Repair Café: what happens at a repair event</a> — adults check local acceptance and repair options.</li></ul><p>Explore’s image model suggests a supported device type. You confirm it before any details appear. It cannot diagnose a fault or certify safety.</p><a class="ff-link-button" href="#learn">Explore the activities →</a></section>`:`<section class="ff-info-page"><p class="eyebrow">ONE WEBSITE · TWO WAYS TO HELP</p><h1>Learn together.<br>Make a useful next step.</h1><p>FixForward is for parents and children aged 7–12. Explore what our everyday devices are made of, practise caring for them, and discover why repair, reuse and responsible recycling matter.</p><p>When your family has a real broken item, a grown-up can use Decide to plan what to check next.</p><a class="ff-link-button" href="#learn">Learn together →</a> <a href="#decide">I have a real item</a></section>`;}
async function render(){
  const raw=normaliseRoute(location.hash);if(raw==='main'){main.focus();return;}
  const token=++renderId;controller?.abort();cleanup?.();observer?.disconnect();controller=new AbortController();cleanup=()=>{};
  const route=raw||'home',name=route.split('?')[0],params=new URLSearchParams(route.split('?')[1]||''),game=params.get('game'),view=params.get('view');
  document.body.classList.remove('ff-game-mode','playroom-child','playroom-motion-paused');document.body.dataset.route=name;
  document.querySelector('#announcement').textContent='';
  document.querySelector('#ff-nav').classList.remove('is-open');document.querySelector('.ff-menu').setAttribute('aria-expanded','false');
  const section=['games','howto','play','scrapworks','parents'].includes(name)?'learn':name;
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===section)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const options={route,onNavigate:navigate,signal:controller.signal,storage,playSound:()=>{},onLearn:()=>{},onAward:()=>{}};
  // Each game owns its exact learning record. We do not invent a cross-game
  // score: scores use different rules, and should not be added as a test grade.
  host.innerHTML='<p class="ff-loading" role="status">Getting things ready…</p>';
  try{
    let mount;
    if(name==='home')mount=()=>mountLanding(host,options);
    else if(name==='howto'||name==='games'||name==='learn'&&!game)mount=()=>mountActivities(host,options);
    else if((name==='learn'||name==='play')&&['materials','care'].includes(game)||name==='parents'&&view==='playroom'){const {mountPlayroom}=await import('../i3-family-landing/playroom.js');mount=()=>mountPlayroom(host,{...options,route:name==='parents'?'parents':'play?game='+game});}
    else if(name==='learn'&&game==='fix-it'||name==='parents'&&view==='fix-it'){const {mountFixit}=await import('./reference/fixit.js');mount=()=>{if(name!=='parents')document.body.classList.add('ff-game-mode');return mountFixit(host,{...options,initialView:name==='parents'?'parents':'hub'});};}
    else if(name==='learn'&&game==='choices'||name==='parents'&&view==='choices')mount=()=>mountChoices(host,options);
    else if(name==='scrapworks'||name==='learn'&&game==='scrapworks'){const {mountScrapworks}=await import('./scrapworks.js');mount=()=>mountScrapworks(host,options);}
    else if(name==='explore'){const {mountExplore}=await import('./explore.js');mount=()=>mountExplore(host,options);}
    else if(name==='decide'){const {mountDecide}=await import('./decide.js');mount=()=>mountDecide(host,options);}
    else if(name==='parents')mount=()=>parents();
    else if(['about','sources'].includes(name))mount=()=>info(name);
    else mount=()=>mountActivities(host,{...options,route:'learn'});
    if(token!==renderId)return;host.innerHTML='';const result=await mount();
    if(token!==renderId){if(typeof result==='function')result();return;}cleanup=typeof result==='function'?result:()=>{};
    host.classList.remove('ff-enter');void host.offsetWidth;host.classList.add('ff-enter');window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});
    if(window.IntersectionObserver){observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('ff-reveal');observer.unobserve(entry.target);}}),{threshold:.08});host.querySelectorAll('.ffh-section,.ffa-card,.ff-record-grid>a').forEach(el=>observer.observe(el));}
  }catch(error){if(token===renderId&&!controller.signal.aborted){host.innerHTML='<section class="ff-info-page"><h1>This page could not open.</h1><p>Try choosing the activity again.</p><a class="ff-link-button" href="#learn">Back to activities →</a></section>';console.error('Page could not open',error);}}
}
document.querySelector('.ff-menu').addEventListener('click',e=>{const open=document.querySelector('#ff-nav').classList.toggle('is-open');e.currentTarget.setAttribute('aria-expanded',String(open));});
// Site motion is on by default. CSS respects the device's reduced-motion setting.
window.addEventListener('hashchange',render);render();
