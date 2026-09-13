// ILLUSTRATION LIBRARY: returns SVG strings to app.js and postcard.js.
// All coordinates and colours are authored here; no image service or classifier runs.
// Named q-* groups connect to play-effects.css. Callers provide visible text and controls.
// Original local illustrations for authored picture stories. The surrounding UI
// supplies accessible names; SVGs never carry a factual assessment of an item.
// Shared palette keeps every character, badge and exported postcard visually consistent.
const C = Object.freeze({ ink: '#112858', cream: '#fff8e9', teal: '#22796b', mint: '#b9d9c1', coral: '#e99a7a', gold: '#f4c45d', blue: '#91b8e8', pale: '#d8e9f6', paper: '#fffdf7' });
// Escape dynamic attribute/caption values before inserting them into SVG markup.
const escapeAttribute = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
// Create an SVG canvas; group() places a smaller drawing inside that canvas.
const svg = (body, viewBox = '0 0 240 220', className = '') => `<svg xmlns="http://www.w3.org/2000/svg" class="quest-art ${escapeAttribute(className)}" viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const group = (body, x = 0, y = 0, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})">${body}</g>`;
// Motion wrappers sit inside position/scale wrappers. CSS must never replace an
// SVG's authored positioning transform when a story detail is revealed.
const motionGroup = (className, body) => `<g class="${className}">${body}</g>`;
// Reusable visual primitives: a ground shadow, sparkle, and expression-dependent face.
const shadow = (x = 120, y = 200, width = 85) => `<ellipse cx="${x}" cy="${y}" rx="${width}" ry="9" fill="${C.ink}" opacity=".08" stroke="none"/>`;
const star = (x, y, scale = 1, fill = C.gold) => group(`<path d="m0-11 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="${fill}" stroke="none"/>`, x, y, scale);
const face = (expression = 'happy', x = 120, y = 126, scale = 1) => group(motionGroup('q-character-face', expression === 'thinking'
  ? `<path d="m-27-15 11-3m23 3 11 2"/><ellipse cx="-20" cy="-5" rx="3" ry="5" fill="${C.ink}"/><ellipse cx="19" cy="-5" rx="3" ry="5" fill="${C.ink}"/><path d="M-5 15q8-5 15-1"/>`
  : expression === 'success'
    ? `<path d="m-26-3 6-5 6 5m27 0 6-5 6 5"/><path d="M-11 11q11 23 22 0z" fill="${C.coral}"/><ellipse cx="-32" cy="9" rx="7" ry="4" fill="${C.coral}" stroke="none"/><ellipse cx="32" cy="9" rx="7" ry="4" fill="${C.coral}" stroke="none"/>`
    : `<ellipse cx="-20" cy="-5" rx="3" ry="5" fill="${C.ink}"/><ellipse cx="20" cy="-5" rx="3" ry="5" fill="${C.ink}"/><path d="M-10 11q10 13 20 0"/><ellipse cx="-31" cy="9" rx="7" ry="4" fill="${C.coral}" stroke="none"/><ellipse cx="31" cy="9" rx="7" ry="4" fill="${C.coral}" stroke="none"/>`), x, y, scale);

// Draw Pip/the toaster; damaged and guide flags select warning marks or a greeting arm.
function toaster(expression, damaged = false, guide = false) {
  const greeting = guide && !damaged ? motionGroup('q-pip-arm', `<path d="M41 139q-22 2-24-20" stroke-width="5"/><path d="M17 120q-12 0-13-9-1-4 4-3l5 4-1-13q0-5 4-4l3 15 4-11q3-5 5-1l-1 17q-2 8-10 5z" fill="${C.cream}" stroke-width="2"/>`) : '';
  return `${shadow()}${greeting}<path d="M51 179v15h17v-15m91 0v15h17v-15" fill="${C.ink}"/><path d="M174 160h21q18 0 18 18v4"/><path d="M210 184v6h12v-9h-12m3-5v-6m6 6v-6" fill="${C.cream}"/>
    <rect x="39" y="63" width="151" height="121" rx="30" fill="${C.pale}"/><path d="M51 73q3-12 21-12h83q16 0 23 12" fill="${C.blue}"/><rect x="67" y="49" width="96" height="15" rx="7" fill="${C.cream}"/><path d="M78 55h74"/><path d="M41 153h148v9q-4 22-27 22H69q-23 0-28-22z" fill="${C.blue}"/><path d="M183 92h15v31h-15" fill="${C.teal}"/><circle cx="169" cy="136" r="6" fill="${C.gold}"/>${face(expression, 111, 112, .9)}<path d="M57 88v34" stroke="${C.paper}" stroke-width="6"/>
    ${damaged ? `<path d="m208 163 9 4m-9 5 9 4" stroke="${C.coral}" stroke-width="6"/><path d="m196 157-3-6m25 6 5-5" stroke="${C.coral}"/>` : ''}`;
}

// Draw Flo/the fan. Only the guide version receives character greeting hooks.
function fan(expression, guide = false) {
  // Only Flo the guide can greet with a blade turn. The quiet/unassessed fan
  // object stays still, so motion cannot accidentally suggest it now works.
  const blades = motionGroup(guide ? 'q-flo-blades' : 'q-fan-blades', `<path d="M120 85q-40-8-30-36t32-5q14 13-2 41m0 0q8-40 36-30t5 32q-13 14-41-2m0 0q40 8 30 36t-32 5q-14-13 2-41m0 0q-8 40-36 30t-5-32q13-14 41 2" fill="${C.mint}" stroke-width="2"/>`);
  return `${shadow(120, 201, 64)}<path d="M111 149v35h-20q-14 0-16 16h90q-2-16-16-16h-20v-35" fill="${C.mint}"/><path d="M116 171h8"/><circle cx="120" cy="85" r="69" fill="${C.teal}"/><circle cx="120" cy="85" r="60" fill="${C.cream}"/>${blades}<circle cx="120" cy="85" r="28" fill="${C.gold}"/>${face(expression, 120, 83, .54)}<path d="M67 68q4-18 18-28" stroke="${C.paper}" stroke-width="4"/><circle cx="120" cy="192" r="3" fill="${C.ink}"/>`;
}

// Draw the kettle with the requested fictional character expression.
function kettle(expression) {
  return `${shadow()}<path d="M156 73h23q25 0 25 29v22q0 27-31 27h-13v-19h10q15 0 15-13V99q0-10-11-10h-18" fill="${C.coral}"/><path d="m72 105-36-17 15 43 18 10" fill="${C.gold}"/><path d="M84 57h56q10 5 13 21l19 85q3 20-20 20H78q-23 0-18-23l18-89q2-10 6-14z" fill="${C.gold}"/><path d="M78 71h71M95 55v-8h32v8" fill="${C.coral}"/><path d="M141 92v47" stroke="${C.paper}" stroke-width="10"/><path d="M138 101h6m-6 12h6m-6 12h6" stroke-width="2"/>${face(expression, 105, 127, .72)}<path d="M64 183h105l10 12H55z" fill="${C.teal}"/><path d="M176 190h26q15 0 15 11v5"/><path d="M207 205h17v9h-17zM210 205v-5m10 5v-5" fill="${C.cream}"/><path d="M79 91l-9 55" stroke="${C.paper}" stroke-width="5"/>`;
}

// Draw a shaver; the bulging flag shows a still warning picture, never a safe-to-use result.
function shaver(expression, bulging = false) {
  return `${shadow(120, 203, 52)}<path d="M91 86h57l-8 99q-1 16-20 16t-21-16z" fill="${C.blue}"/>
    ${bulging ? `<path d="M135 117q37 20 12 54l-7 7 3-61z" fill="${C.coral}"/><path d="m163 127 10-3m-10 20 12 1m-14 17 10 6" stroke="${C.coral}"/>` : '<path d="M109 113v58m10-58v58m10-58v58" opacity=".35"/>'}
    <path d="m80 43 7 48h66l7-48q-39-20-80 0z" fill="${C.teal}"/><rect x="79" y="39" width="83" height="27" rx="10" fill="${C.pale}"/><path d="M91 46v11m8-11v11m8-11v11m8-11v11m8-11v11m8-11v11m8-11v11m8-11v11" stroke-width="2"/><circle cx="120" cy="145" r="10" fill="${C.cream}"/><path d="M120 138v6m-5-3a7 7 0 1 0 10 0" stroke-width="2"/><circle cx="120" cy="179" r="3" fill="${C.teal}"/>${bulging ? `<circle cx="182" cy="83" r="22" fill="${C.gold}"/><path d="M182 73v13m0 7v1" stroke-width="4"/>` : ''}`;
}

// Draw open or closed packaging, reused in stories and the sorting activity.
function box(open = true) {
  return `${shadow(119, 200, 81)}<path d="m43 91 71-26 84 25-75 30z" fill="${C.gold}"/><path d="m43 91 80 29v75l-80-30z" fill="${C.coral}"/><path d="m123 120 75-30v75l-75 30z" fill="${C.gold}"/><path d="m76 103 76-27 15 5-76 28v37l-15-6z" fill="${C.cream}"/>
    ${open ? `<path d="m43 91-20-29 72-25 19 28zm71-26 26-31 80 25-22 31zm-71 26 80 29-21 32-76-29zm80 29 75-30 22 32-77 32z" fill="${C.coral}"/><path d="m34 119 64 26m51 2 61-24" stroke="${C.gold}" stroke-width="4"/>` : ''}<path d="m141 156 18-7m-18 17 31-12" stroke-width="2"/>`;
}

// Draw a paper/cardboard picture, optionally using the newspaper variant.
function paper(newspaper = false) {
  return `${shadow()}<path d="m60 43 129 9-12 145-133-9z" fill="${C.blue}"/><path d="m47 35 128-6 15 147-129 7z" fill="${C.paper}"/><path d="m60 52 94-5m-92 16 65-4" stroke-width="5"/>
    ${newspaper ? `<path d="m64 83 40-2 3 43-39 2z" fill="${C.mint}"/><path d="m78 111 8-14 13 17"/><path d="m120 82 39-2m-38 13 39-2m-38 13 39-2m-38 13 39-2m-93 26 97-5m-95 17 97-5" stroke-width="3"/>` : `<path d="m68 89 37-2m-35 19 88-4m-86 20 88-5m-86 21 61-3" stroke="${C.blue}" stroke-width="5"/><path d="m143 77 8 8 15-18" stroke="${C.teal}" stroke-width="4"/>`}`;
}

// Draw the glass-jug silhouette without assigning it a real household-bin destination.
function jug() {
  return `${shadow(118, 200, 61)}<path d="M158 70h25q22 0 22 22v35q0 22-25 22h-17l-2-19h13q10 0 10-10V94q0-5-9-5h-15" fill="${C.pale}"/><path d="m72 54-23-10 11 29 16 103q1 11 13 11h58q13 0 15-13l11-120z" fill="${C.pale}" fill-opacity=".6"/><path d="M75 58h97M82 89h22m-19 18h14m-12 18h22m-19 18h14"/><path d="M123 77v78" stroke="${C.paper}" stroke-width="11"/><path d="m79 186-5 10h88l-6-10" fill="${C.blue}"/><circle cx="191" cy="48" r="21" fill="${C.gold}"/><path d="M185 43a6 6 0 1 1 8 6q-3 1-3 5m0 6v1"/>`;
}

// Return the tree decoration drawing for the neighbourhood and postcards.
function tree() {
  return `<path d="M114 131v73m0-44-24-24m24 35 22-28" stroke-width="7"/><path d="M69 126q-28-19-6-48-4-36 32-39 18-35 48-11 34-2 39 32 31 24 6 50 0 38-40 37-27 20-48-1-19 4-31-20z" fill="${C.mint}"/><path d="M115 68v96m0-44-25-24m25 47 29-31" stroke="${C.teal}"/><circle cx="87" cy="71" r="7" fill="${C.gold}" stroke="none"/><circle cx="150" cy="91" r="7" fill="${C.coral}" stroke="none"/>`;
}

// Return the flower decoration drawing used by collection and creative screens.
function flowers() {
  return `${shadow(120, 207, 63)}<path d="m104 183-9-83m25 83 14-112m-7 114 37-59" stroke="${C.teal}" stroke-width="4"/><path d="M107 153q-32 1-29-25 25-4 29 25m21-12q-1-25 22-26 6 21-22 26" fill="${C.mint}"/>
    ${[[94,86,C.coral],[136,61,C.gold],[164,119,C.blue]].map(([x,y,color])=>group(`<path d="M0-9C-28-36-43 2-15 7c-15 30 26 35 25 8 32 6 24-34 2-21 3-28-30-22-22-2" fill="${color}" stroke-width="2"/><circle r="9" fill="${C.cream}" stroke-width="2"/>`,x,y,.8)).join('')}<path d="m78 176 10 31h59l10-31z" fill="${C.coral}"/>`;
}

// Return the bench decoration drawing; earning/placement rules live in engine.js.
function bench() {
  return `${shadow(120, 201, 83)}<path d="M64 146v54m114-54v54" stroke-width="7"/><path d="M50 99h140v21H50zm0 30h140v21H50z" fill="${C.coral}"/><path d="M49 165h143l15 16H34z" fill="${C.gold}"/><path d="M64 92v65m112-65v65" stroke-width="5"/>`;
}

// Return the flag decoration drawing; this helper has no saved state.
function flag() {
  return `${shadow(120, 204, 42)}<path d="M92 202V34" stroke-width="5"/><circle cx="92" cy="31" r="6" fill="${C.gold}"/><path d="M97 42q34-15 52 0t46 0v63q-31 15-49 0t-49 0z" fill="${C.coral}"/>${star(144,72,1.8,C.cream)}<path d="M69 207h48"/>`;
}

// Draw the fictional report/envelope; story text explains what its contents establish.
function evidence() {
  return `${shadow(120,200,65)}<rect x="60" y="38" width="121" height="154" rx="8" fill="${C.coral}"/><path d="M69 51h103v130H69z" fill="${C.paper}"/><rect x="96" y="30" width="49" height="25" rx="5" fill="${C.gold}"/><path d="m87 85 5 6 10-13m11 8h38m-64 28 5 6 10-13m11 8h38m-64 28 5 6 10-13m11 8h29" stroke="${C.teal}"/><path d="M108 163h30" stroke="${C.blue}"/>`;
}

// Draw an adult story character, optionally with a separate waving-hand motion group.
function person(expression = 'happy', greeting = false) {
  const rightHand = greeting ? motionGroup('q-neighbour-wave', `<path d="M163 141q25-5 22-31l-1-12q-1-5-5-2l-2 13-6-7q-4-2-5 2l10 17q0 8-13 8z" fill="${C.coral}"/>`) : `<path d="M162 140q12 21-5 24" fill="${C.coral}"/>`;
  return `${shadow(120, 210, 54)}<path d="M88 173v31h20l7-31m12 0 8 31h20l-5-31" fill="${C.ink}"/><path d="M98 89q-31 9-30 65l19 4 1 24h66l1-29 17-3q-4-53-34-61" fill="${C.teal}"/><path d="M101 93v15q19 15 35 0V91" fill="${C.coral}"/><ellipse cx="118" cy="63" rx="31" ry="36" fill="${C.coral}"/><path d="M85 60q-7-33 22-39 46-13 45 34-17-7-24-20-10 22-43 25z" fill="${C.ink}"/>${face(expression,117,64,.5)}<path d="M76 139q-7 35 12 23" fill="${C.coral}"/>${rightHand}`;
}

// Translate a content artwork ID into a drawing; unknown IDs fall back to paper.
function object(id, expression = 'happy') {
  switch (id) {
    case 'pip': return toaster(expression, false, true);
    case 'toaster': return toaster(expression);
    case 'toaster-damaged': case 'damaged-toaster': return toaster(expression, true);
    case 'flo': return fan(expression, true);
    case 'fan': return fan(expression);
    case 'kettle': return kettle(expression);
    case 'shaver': return shaver(expression);
    case 'battery-shaver': return shaver(expression, true);
    case 'cardboard': case 'box': return box();
    case 'paper': return paper();
    case 'newspaper': return paper(true);
    case 'glass-jug': return jug();
    case 'boxed-toaster': return `${group(box(),-20,25,.85)}${group(toaster(expression),90,-7,.64)}`;
    case 'tree': return tree();
    case 'flowers': return flowers();
    case 'flag': return flag();
    case 'bench': return bench();
    case 'person': case 'grown-up': return person(expression);
    case 'evidence': case 'envelope': return evidence();
    default: return paper();
  }
}

// Wrap a named object in a decorative SVG and mark warning/guide groups for motion rules.
export function artwork(id, { expression = 'happy', className = '' } = {}) {
  const warning = ['toaster-damaged', 'damaged-toaster', 'battery-shaver'].includes(id);
  const objectClass = warning ? 'q-art-object q-warning-object' : ['pip', 'flo'].includes(id) ? 'q-art-object q-guide-character' : 'q-art-object';
  return svg(motionGroup(objectClass, object(id, expression)), '0 0 240 220', className);
}

// Allow only the four authored decoration IDs, then reuse the standard artwork wrapper.
export function decoration(id) {
  return artwork(['tree', 'flowers', 'flag', 'bench'].includes(id) ? id : 'flowers', { className: 'quest-decoration-art' });
}

// Keys must match content.js mission IDs so a completed story receives the correct stamp.
const STAMPS = Object.freeze({
  'flo-next-home': { art: 'fan', label: 'NEW HOME', color: C.mint, symbol: 'home' },
  'quiet-fan': { art: 'fan', label: 'GOOD QUESTION', color: C.blue, symbol: 'question' },
  'pip-damaged-cable': { art: 'toaster-damaged', label: 'ASKING HELPS', color: C.coral, symbol: 'conversation' },
  'kettle-second-chance': { art: 'kettle', label: 'REPAIR PLAN', color: C.gold, symbol: 'calendar' },
  'kettle-last-chapter': { art: 'kettle', label: 'NEXT STOP', color: C.mint, symbol: 'question' },
  'moving-day-box': { art: 'boxed-toaster', label: 'TWO STORIES', color: C.blue, symbol: 'paths' },
  'bulging-gadget': { art: 'battery-shaver', label: 'PAUSE & ASK', color: C.coral, symbol: 'conversation' },
  'mystery-glass-jug': { art: 'glass-jug', label: 'KEEP ASKING', color: C.gold, symbol: 'question' },
});

// Return a small visual summary such as a house, question or conversation bubble.
function storySymbol(kind) {
  if (kind === 'home') return `<path d="M-17 2 0-13 17 2M-12-1v18h24V-1M-4 17V7h8v10" fill="${C.cream}"/>`;
  if (kind === 'calendar') return `<rect x="-17" y="-13" width="34" height="32" rx="4" fill="${C.cream}"/><path d="M-17-3h34M-8-18v10m16-10v10m-17 19 5 4 10-9"/>`;
  if (kind === 'paths') return `<path d="M0 18V2m0 0q-15 0-15-14M0 2q15 0 15-14M-20-9l5-5 5 5m20 0 5-5 5 5" stroke="${C.teal}"/>`;
  if (kind === 'conversation') return `<path d="M-19-14h38v27H2l-9 7v-7h-12z" fill="${C.cream}"/><path d="M-7-1h1m6 0h1m6 0h1" stroke-width="4"/>`;
  return `<path d="M-8-6q0-13 13-10 13 4 2 13L0 2v6m0 8v1"/>`;
}

/** Original collectible picture stamp; its visible UI name belongs outside SVG.
 * The optional short caption is escaped and limited to keep the badge legible.
 * A stamp represents an authored story explored, never a safety certification.
 */
// Return a collectible story stamp from a stable mission ID and optional short caption.
export function passportStamp(id, label) {
  const stamp = Object.hasOwn(STAMPS, id) ? STAMPS[id] : { art: 'paper', label: 'A DISCOVERY', color: C.mint, symbol: 'question' };
  const edge = Array.from({ length: 48 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 24;
    const radius = index % 2 ? 91 : 97;
    return `${(110 + Math.cos(angle) * radius).toFixed(2)},${(108 + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(' ');
  const caption = escapeAttribute(String(label ?? stamp.label).slice(0, 24));
  const body = `<polygon points="${edge}" fill="${stamp.color}"/><circle cx="110" cy="108" r="81" fill="${C.cream}" stroke-dasharray="2 6" stroke-width="2"/><path d="M63 164q47 15 94 0" stroke="${stamp.color}" stroke-width="15"/>${group(object(stamp.art, 'happy'),48,34,.52)}<circle cx="155" cy="65" r="23" fill="${stamp.color}"/>${group(storySymbol(stamp.symbol),155,64,.65)}${star(48,111,.5,stamp.color)}${star(173,133,.5,stamp.color)}<text x="110" y="174" text-anchor="middle" fill="${C.ink}" stroke="none" font-family="inherit" font-size="10.5" font-weight="800" letter-spacing=".5">${caption}</text>`;
  return svg(motionGroup('q-passport-ink', body), '0 0 220 220', 'q-passport-stamp');
}

// Choose the central clue, Sparks or level illustration; scoring is outside this file.
function rewardPicture(kind) {
  if (kind === 'points') return `<circle cx="160" cy="68" r="42" fill="${C.gold}"/><circle cx="160" cy="68" r="33" stroke="${C.coral}" stroke-width="3"/>${star(160,67,2.15,C.cream)}<path d="m134 44 5-4m-8 12 2-3" stroke="${C.cream}" stroke-width="4"/>`;
  if (kind === 'level') return `<path d="M110 44q27-12 50 2 24-14 50-2v59q-25-10-50 3-25-13-50-3z" fill="${C.blue}"/><path d="M116 34q26-9 44 5 19-14 44-5v59q-23-8-44 5-20-13-44-5z" fill="${C.cream}"/><path d="M160 39v59m-32-43 20 5m-20 10 20 5m-20 10 20 5" stroke="${C.teal}" stroke-width="2"/>${star(182,63,1.75,C.gold)}<path d="M186 84v24l8-5 6 7V88" fill="${C.coral}"/>`;
  return `<path d="m127 29 52-4 20 20 5 61-72 5z" fill="${C.cream}"/><path d="m179 25 2 23 18-3" fill="${C.gold}"/><path d="m141 45 20-2m-19 14 23-2m-21 32 33-3" stroke="${C.blue}" stroke-width="3"/><circle cx="168" cy="69" r="17" fill="${C.mint}"/><path d="m160 69 5 5 11-12m16 22 13 13" stroke-width="4"/>`;
}

/** A small illustrated response to a local game event, not an impact claim.
 * The root UI owns the visible/live text and point value; this SVG is decorative.
 */
// Assemble a decorative reward token and escape any optional short label.
export function rewardBurst({ kind = 'clue', label = '' } = {}) {
  const event = ['clue','points','level'].includes(kind) ? kind : 'clue';
  const color = event === 'clue' ? C.mint : event === 'points' ? C.gold : C.blue;
  const shortLabel = String(label).slice(0, 34);
  const caption = escapeAttribute(shortLabel);
  const ribbonWidth = Math.min(256, Math.max(132, shortLabel.length * 6.3 + 24));
  const ribbonLeft = 160 - ribbonWidth / 2;
  const ribbonRight = 160 + ribbonWidth / 2;
  const trail = `<path class="q-reward-path" pathLength="1" d="M54 103q-12-43 28-58 24-9 30-1M212 41q46-1 51 30 4 18-15 27" stroke="${color}" stroke-width="4"/>`;
  const accents = motionGroup('q-reward-accents', `${star(70,85,.85,C.coral)}${star(247,53,.85,color)}<circle cx="232" cy="106" r="5" fill="${C.teal}" stroke="none"/>`);
  const token = motionGroup('q-reward-token', `<circle cx="160" cy="68" r="51" fill="${color}" opacity=".3" stroke="none"/>${rewardPicture(event)}`);
  const ribbon = `<path d="M${ribbonLeft} 127l-10 10 10 10H${ribbonRight}l10-10-10-10z" fill="${C.cream}" stroke="${color}" stroke-width="2"/>${caption ? `<text x="160" y="141" text-anchor="middle" fill="${C.ink}" stroke="none" font-family="inherit" font-size="12" font-weight="800">${caption}</text>` : `<path d="M132 137h56" stroke="${color}" stroke-width="3"/>`}`;
  return svg(`${trail}${accents}${token}${ribbon}`, '0 0 320 160', `q-reward-art q-reward-${event}`);
}

// Choose the level's sprout, compass, workshop or map drawing.
function levelMotif(level) {
  if (level === 1) return `<path d="M0 11V-3m0 7q-18-2-15-14Q1-12 0 4m0-5q0-15 16-14Q19-2 0-1" fill="${C.mint}" stroke="${C.teal}" stroke-width="2"/>`;
  if (level === 2) return `<circle r="17" fill="${C.cream}" stroke-width="2"/><path d="m-7 9 4-13 11-6-4 13z" fill="${C.blue}" stroke-width="2"/><circle r="2" fill="${C.ink}" stroke="none"/>`;
  if (level === 3) return `<path d="M-17 13V-9h34v22M-21-10 0-19l21 9M-5 13V0H5v13" fill="${C.cream}" stroke-width="2"/><path d="M-13-1h4m18 0h4" stroke="${C.coral}" stroke-width="3"/>`;
  return `<path d="m-21-11 14 4 14-6 14 4v28L7 15l-14 6-14-4z" fill="${C.cream}" stroke-width="2"/><path d="M-7-7v28M7-13v28m-21-9 10 4 14-8" stroke="${C.teal}" stroke-width="2"/>${star(16,-13,.8,C.gold)}`;
}

/** Four numbered local-game medallions. Levels are supplied by the game engine;
 * decoration artwork never computes rewards or makes a claim about ability.
 */
// Clamp the supplied level to 1-4 and return its numbered decorative medallion.
export function levelBadge(level = 1) {
  const parsed = Number(level);
  const number = Number.isFinite(parsed) ? Math.max(1, Math.min(4, Math.trunc(parsed))) : 1;
  const colors = [C.mint,C.blue,C.coral,C.gold];
  const color = colors[number - 1];
  const sides = [24,8,32,12][number - 1];
  const edge = Array.from({length:sides},(_,index) => {
    const angle = -Math.PI/2 + index * Math.PI * 2 / sides;
    const radius = index % 2 && number !== 2 ? 57 : 63;
    return `${(80 + Math.cos(angle)*radius).toFixed(2)},${(75 + Math.sin(angle)*radius).toFixed(2)}`;
  }).join(' ');
  const ribbons = motionGroup('q-level-ribbons', `<path d="m44 118-5 43 19-10 11 13 5-45m12 0 5 45 12-13 19 10-6-44" fill="${color}"/><path d="m51 137-3 12m62-12 3 12" stroke="${C.cream}" stroke-width="3"/>`);
  const medallion = motionGroup('q-level-medallion', `<polygon points="${edge}" fill="${color}"/><circle cx="80" cy="75" r="49" fill="${C.cream}"/><circle class="q-level-ring" pathLength="1" cx="80" cy="75" r="44" stroke="${color}" stroke-width="2"/>${group(levelMotif(number),80,42,.64)}<text x="80" y="105" text-anchor="middle" fill="${C.ink}" stroke="none" font-family="inherit" font-size="53" font-weight="900">${number}</text><path d="M55 114h50" stroke="${color}" stroke-width="3"/>`);
  const marks = motionGroup('q-level-accents', `${star(19,111,.65,color)}${star(141,37,.65,C.gold)}`);
  return svg(`${ribbons}${medallion}${marks}`, '0 0 160 180', `q-level-badge q-level-${number}`);
}

// Background primitives and building outlines reused by the world and story endings.
const cloud = (x, y, scale = 1) => group(motionGroup('q-world-cloud', `<path d="M0 23q-4-19 17-19 10-27 31-9 25-6 25 18 21-1 22 19H0z" fill="${C.paper}" stroke="none"/>`), x, y, scale);
const shrub = (x,y,scale=1) => group(`<path d="M0 28q-10-29 17-28 12-27 32-4 25-15 33 15 15-3 16 17z" fill="${C.mint}" stroke="none"/><path d="M26 28V11m22 17V6m24 22V15" stroke="${C.teal}" stroke-width="2"/>`,x,y,scale);
const homeBuilding = () => `<path d="M82 182v142h185V180" fill="${C.cream}"/><path d="m63 183 108-93 114 93z" fill="${C.coral}"/><path d="m86 168 85-73 89 73"/><path d="M235 132V97h-26v13" fill="${C.coral}"/><path d="M145 325v-74q0-24 24-24t24 24v74" fill="${C.teal}"/><circle cx="181" cy="278" r="3" fill="${C.gold}" stroke="none"/><rect x="104" y="204" width="32" height="45" rx="6" fill="${C.pale}"/><path d="M120 205v43m-15-24h31"/><rect x="211" y="204" width="32" height="45" rx="6" fill="${C.pale}"/><path d="M227 205v43m-15-24h31"/><path d="M139 329h62v12h-62z" fill="${C.gold}"/><circle cx="171" cy="164" r="15" fill="${C.gold}"/><path d="M171 154v20m-10-10h20"/><path d="M92 321h43m70 0h53"/>`;
const studioBuilding = () => `<path d="M350 143h207v146H350z" fill="${C.pale}"/><path d="M341 143V95l110-37 115 37v48z" fill="${C.blue}"/><path d="M368 142v-33h164v33" fill="${C.cream}"/><path d="M368 143h164v12q-14 19-27 0-14 19-28 0-14 19-28 0-13 19-27 0-14 19-27 0-14 19-27 0z" fill="${C.coral}"/><path d="M373 170h66v71h-66z" fill="${C.cream}"/><path d="M406 170v71m-33-36h66"/><path d="M466 290v-85q0-27 29-27t28 27v85" fill="${C.teal}"/><path d="M482 205h27v35h-27z" fill="${C.gold}"/><circle cx="514" cy="256" r="3" fill="${C.gold}" stroke="none"/><path d="M368 267h77v10h-77zm8 10v17m61-17v17" fill="${C.coral}"/><circle cx="451" cy="97" r="17" fill="${C.gold}"/><path d="m442 97 6 6 12-15"/><path d="M458 294h74v11h-74z" fill="${C.gold}"/>`;
const stationBuilding = () => `<path d="M648 209h192v115H648z" fill="${C.cream}"/><path d="M633 208h219l-30-44H665z" fill="${C.teal}"/><path d="M650 208v117m184-117v117" stroke-width="7"/><path d="M671 238h72v85h-72z" fill="${C.blue}"/><path d="M666 236h82v13h-82z" fill="${C.pale}"/><path d="M699 266v9m15-9v9m-21 0h27v12q0 13-13 13t-14-13zM707 300v9"/><path d="M765 262h51v61h-51z" fill="${C.gold}"/><path d="M761 259h59v11h-59z" fill="${C.coral}"/><path d="m777 281 26 3-3 23-26-3z" fill="${C.cream}"/><path d="m780 289 15 2m-16 6 15 2" stroke-width="2"/><path d="M648 329h191v10H648z" fill="${C.mint}"/><circle cx="743" cy="184" r="13" fill="${C.cream}"/><path d="m738 184 4 4 7-9" stroke-width="2"/>`;

// Compose the three buildings, earned concept details and saved decorations into one world.
export function neighborhood({ unlocked = [], decorations = {} } = {}) {
  // Slots are stable: placing something at the station must not move it to
  // the first empty spot when the home and studio slots have no decoration.
  const placements = { home: [49,320,.42], studio: [388,345,.46], station: [775,315,.43] };
  const placedDecorations = Object.entries(placements).map(([slot, position]) => ['tree','flowers','flag','bench'].includes(decorations[slot]) ? group(object(decorations[slot]), ...position) : '').join('');
  return svg(`<path d="M0 0h900v480H0z" fill="${C.cream}" stroke="none"/><circle cx="749" cy="67" r="31" fill="${C.gold}" stroke="none"/>${cloud(74,58,.85)}${cloud(532,47,.7)}${cloud(793,110,.7)}
    <path d="M0 277Q78 133 228 221T519 184T900 256v224H0z" fill="#e2ebd9" stroke="none"/><path d="M0 340q198-93 414-34t486-9v183H0z" fill="#d5e4ca" stroke="none"/>
    <path d="M443 480q18-90 3-156m3 45q-138-29-278-9m276 5q150-39 313-6" stroke="#f3dec0" stroke-width="62"/><path d="M444 478q17-79 2-155m2 47q-151-22-276-8m276 5q166-29 312-7" stroke="${C.cream}" stroke-width="2" stroke-dasharray="2 15"/>
    ${group(tree(),-59,130,.64)}${group(tree(),731,59,.68)}${shrub(277,268,.64)}${shrub(580,266,.62)}${homeBuilding()}${studioBuilding()}${stationBuilding()}${shrub(11,314,.61)}${shrub(257,322,.58)}${shrub(555,284,.45)}${shrub(829,318,.69)}
    ${group(motionGroup('q-guide-character', toaster(unlocked.length ? 'success' : 'happy', false, true)),264,297,.48)}${group(motionGroup('q-guide-character', fan('happy', true)),517,321,.48)}<path d="m220 419 8-5m-3 8 9-5m474 24 8-5m-3 8 9-5m-616-6 8-5m-3 8 9-5" stroke="${C.teal}" stroke-width="2" opacity=".55"/>
    ${placedDecorations}${star(323,123,.55)}${star(608,97,.6)}${star(613,394,.7,C.coral)}${star(381,428,.5,C.coral)}`, '0 0 900 480', 'quest-neighborhood-art');
}

// Choose a Home, Studio or Station background using the authored location.
function missionBackdrop(location) {
  if (location === 'studio') return `<path d="M0 0h900v460H0z" fill="#e7eff3" stroke="none"/><path d="M0 322h900v138H0z" fill="#e0cfac" stroke="none"/><path d="M65 38h191v188H65z" fill="${C.cream}"/><path d="M82 55h157v152H82z" fill="${C.blue}"/><path d="M82 167q86-84 157-24v64H82z" fill="${C.mint}" stroke="none"/><path d="M160 55v152m-78-74h157"/><path d="M314 54h258v166H314z" fill="${C.coral}"/><path d="M332 72h222v132H332z" fill="${C.cream}"/><path d="m350 99 14 12 23-27m-37 65 14 12 23-27m15-35h126m-126 50h107" stroke="${C.teal}" stroke-width="4"/><path d="M688 110h131v11H688zm13 12v73m105-73v73M690 194h127v13H690z" fill="${C.teal}"/><path d="M716 164v28m20-22v22m23-32v32m23-25v25" stroke="${C.gold}" stroke-width="8"/>${group(flowers(),675,182,.46)}`;
  if (location === 'station') return `<path d="M0 0h900v460H0z" fill="#e6efe2" stroke="none"/>${cloud(104,34,.9)}${cloud(691,61,.8)}<circle cx="791" cy="46" r="26" fill="${C.gold}" stroke="none"/>${group(tree(),-80,80,1.02)}${group(tree(),706,80,1.06)}<path d="M0 331h900v129H0z" fill="#d3dfc4" stroke="none"/><path d="M132 303V134m639 169V134" stroke-width="12"/><path d="M91 133h720l-49-77H144z" fill="${C.teal}"/><path d="M107 132h685v15H107z" fill="${C.mint}"/><path d="M170 186h97v123h-97z" fill="${C.blue}"/><path d="M165 179h107v19H165z" fill="${C.pale}"/><path d="M207 223v12m22-12v12m-31 0h41v16q0 18-20 18t-21-18zM219 270v16"/><path d="M648 214h83v97h-83z" fill="${C.gold}"/><path d="M644 207h91v17h-91z" fill="${C.coral}"/><path d="m669 238 39 4-4 44-39-4z" fill="${C.cream}"/><path d="m676 250 21 2m-22 11 21 2"/>`;
  return `<path d="M0 0h900v460H0z" fill="${C.cream}" stroke="none"/><path d="M0 321h900v139H0z" fill="#e8d7b9" stroke="none"/><path d="M0 321h900" stroke="#c8b591"/><path d="M83 49h221v201H83z" fill="${C.coral}"/><path d="M96 62h195v175H96z" fill="${C.pale}"/><circle cx="248" cy="96" r="21" fill="${C.gold}" stroke="none"/><path d="M96 198q68-63 195-31v70H96z" fill="${C.mint}" stroke="none"/><path d="M192 62v175m-96-87h195"/><path d="M68 253h249" stroke-width="8"/><path d="M724 68h91v93h-91z" fill="${C.coral}"/><path d="M734 78h71v73h-71z" fill="${C.paper}"/>${star(769,114,2.1,C.gold)}<path d="M646 216h156v14H646zm12 15v91m132-91v91" fill="${C.teal}"/><path d="M671 179v35h18v-43h17v43h22v-34h18v34" fill="${C.blue}"/>${group(flowers(),734,124,.44)}${group(tree(),-45,217,.65)}`;
}

// Choose the visual report/phone/envelope associated with the story's next step.
function outcomeNote(kind) {
  const panel = `<rect x="60" y="38" width="121" height="154" rx="8" fill="${C.coral}"/><path d="M69 51h103v130H69z" fill="${C.paper}"/><rect x="96" y="30" width="49" height="25" rx="5" fill="${C.gold}"/>`;
  if (kind === 'repair') return `${panel}${group(storySymbol('calendar'),121,104,1.5)}<path class="q-story-written-line" pathLength="1" d="M88 157h61" stroke="${C.teal}" stroke-width="4"/>`;
  if (kind === 'assessment') return `${panel}<path d="M84 90h73v44H84z" fill="${C.pale}"/>${motionGroup('q-envelope-flap', '<path d="m84 90 36 27 37-27"/>')}${group(storySymbol('question'),122,157,.6)}`;
  if (kind === 'collection') return `${panel}${motionGroup('q-phone-handset', `<path d="m98 80-12 8q-2 31 34 44l10-11-11-12-8 6q-13-5-12-17l7-7z" fill="${C.mint}"/>`)}${group(storySymbol('question'),145,102,.7)}<path d="M88 158h62" stroke="${C.blue}"/>`;
  return `${panel}${group(storySymbol(kind === 'separate' ? 'paths' : 'conversation'),120,111,1.7)}<path d="M87 158h64" stroke="${C.blue}"/>`;
}

// Add the adult, planned route, report or separate packaging for a resolved fictional story.
function outcomeDetails(kind, artworkId) {
  const normalized = /reuse|handover|home/.test(kind) ? 'reuse' : /separate|packaging/.test(kind) ? 'separate' : ['assessment','repair','collection'].includes(kind) ? kind : 'help';
  const adult = group(motionGroup('q-outcome-adult', person('success')),651,175,.93);
  const note = group(motionGroup(`q-outcome-evidence q-evidence-${normalized}`, outcomeNote(normalized)),587,187,.61);
  const celebration = motionGroup('q-decision-sparkles', `${star(650,173,.85)}${star(816,277,.65,C.coral)}${star(589,158,.5,C.teal)}`);
  const nextHome = ['reuse','separate'].includes(normalized) ? `${group(motionGroup('q-outcome-home', homeBuilding()),26,151,.46)}${group(motionGroup('q-home-neighbour', person('success', true)),143,233,.43)}` : '';
  const route = ['reuse','separate'].includes(normalized) ? `<path d="M248 401q-64 1-84-48" stroke="${C.mint}" stroke-width="5"/><path class="q-story-route" pathLength="1" d="M248 401q-64 1-84-48" stroke="${C.teal}"/><path d="m159 362 5-10 9 6" stroke="${C.teal}"/>` : '';
  const packaging = normalized === 'separate' ? `${group(motionGroup('q-outcome-packaging', `${group(motionGroup('q-outcome-box', box(false)),-30,12,.75)}${group(motionGroup('q-outcome-paper', paper()),84,-7,.58)}`),528,322,.43)}<path class="q-story-route q-story-second-route" pathLength="1" d="M497 400h43" stroke="${C.teal}"/><path d="m533 394 8 6-8 6" stroke="${C.teal}"/>` : '';
  const message = normalized === 'help' ? group(motionGroup('q-help-message', `<path d="M-27-19h54v39H7L-5 31V20h-22z" fill="${C.cream}"/>${artworkId === 'glass-jug' ? group(storySymbol('question'),0,0,.6) : '<path d="M0-9V5m0 8v1" stroke-width="4"/>'}`),766,162,.85) : '';
  return motionGroup(`q-story-consequence q-consequence-${normalized}`, `${route}${nextHome}${adult}${note}${packaging}${message}${celebration}`);
}

// Compose the story background and appliance, with optional outcome details.
// An outcome changes the illustration; it does not diagnose or certify a real appliance.
export function scene(locationId, artworkId, outcome = null) {
  const location = /station|collection/.test(locationId) ? 'station' : /studio|second-chance/.test(locationId) ? 'studio' : 'home';
  const resolved = Boolean(outcome);
  const outcomeId = typeof outcome === 'string' ? outcome : outcome?.id || outcome?.actionId || outcome?.action || '';
  // A changed scene shows an adult taking responsibility. It does not imply
  // that the illustrated object has been certified safe by a player's answer.
  const warning = /damaged|battery/.test(artworkId);
  const picture = motionGroup(`q-story-object${warning ? ' q-warning-object' : ''}`, object(artworkId, resolved ? 'success' : warning ? 'thinking' : 'happy'));
  return svg(`${missionBackdrop(location)}<ellipse cx="458" cy="417" rx="260" ry="25" fill="${C.ink}" opacity=".06" stroke="none"/><path d="M266 362h339l24 24H242z" fill="${C.coral}"/><path d="M277 386v48m312-48v48" stroke-width="12"/><path d="M266 362h339" stroke="${C.cream}" stroke-width="4"/>${group(picture,293,110,1.26)}${resolved ? outcomeDetails(outcomeId, artworkId) : ''}`, '0 0 900 460', `quest-scene-art${resolved ? ' is-resolved' : ''}`);
}
