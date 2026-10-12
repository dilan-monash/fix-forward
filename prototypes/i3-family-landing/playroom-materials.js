/** Materials Rescue is an illustrated sorting floor, not a disassembly guide.
 * The shell owns input, points and learning evidence. These pictures only show
 * the engine's pieces, their destinations and the result of accepted moves. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const safeId = value => String(value ?? 'item').replace(/[^a-z0-9_-]/gi, '-');

/** Original vector miniatures retain the depth of physical toy pieces. */
function materialShape(kind, prefix) {
  const id = safeId(prefix);
  const definitions = `<defs><linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7fff9"/><stop offset=".4" stop-color="#bbcfd0"/><stop offset="1" stop-color="#6e8d95"/></linearGradient><linearGradient id="${id}-copper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffd59b"/><stop offset=".4" stop-color="#e09a56"/><stop offset="1" stop-color="#a85a3a"/></linearGradient><linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d7f9ec"/><stop offset="1" stop-color="#76b3c4"/></linearGradient><linearGradient id="${id}-plastic" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffcda0"/><stop offset="1" stop-color="#dc845b"/></linearGradient><linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe9a3"/><stop offset=".55" stop-color="#e9b43d"/><stop offset="1" stop-color="#b58123"/></linearGradient></defs>`;
  let shape;
  if (kind === 'copper') {
    shape = `<path d="M33 102c-21-12-13-58 18-58 36 0 44 64 13 67-29 3-36-49-9-55 31-6 51 59 25 66-32 9-51-41-26-56 29-18 54 21 55 47" fill="none" stroke="#975136" stroke-width="15" stroke-linecap="round"/><path d="M33 98c-21-12-13-58 18-58 36 0 44 64 13 67-29 3-36-49-9-55 31-6 51 59 25 66-32 9-51-41-26-56 29-18 54 21 55 47" fill="none" stroke="url(#${id}-copper)" stroke-width="11" stroke-linecap="round"/><path d="m29 82 4 16m69-8 7 19" stroke="#ffe7bd" stroke-width="3" stroke-linecap="round"/>`;
  } else if (kind === 'aluminium') {
    shape = `<path d="m42 28 83 11 5 12-22 91-87-13-6-12Z" fill="#68858a"/><path d="m42 24 83 11-24 95-85-13Zm6 18-15 61 52 8 16-62Z" fill="url(#${id}-metal)" fill-rule="evenodd" stroke="#829da0" stroke-width="2"/><path d="m43 29 75 10M23 113l74 11" fill="none" stroke="#f9fff7" stroke-width="3"/><circle cx="47" cy="34" r="2" fill="#6f898a"/><circle cx="113" cy="44" r="2" fill="#6f898a"/><circle cx="90" cy="120" r="2" fill="#6f898a"/>`;
  } else if (kind === 'steel') {
    shape = `<g transform="rotate(37 72 78)"><path d="M64 54h20v65l-10 15-10-15Z" fill="#748d95" stroke="#526f79" stroke-width="2"/><path d="m66 65 17-6m-17 18 17-6m-17 18 17-6m-17 18 17-6m-17 18 17-6" stroke="#d7e6e6" stroke-width="5"/><ellipse cx="74" cy="51" rx="29" ry="13" fill="#718c92"/><path d="M45 41v11c0 18 58 18 58 0V41" fill="url(#${id}-metal)"/><ellipse cx="74" cy="41" rx="29" ry="13" fill="#e2edeb" stroke="#91aaaa" stroke-width="2"/><path d="M59 41h30M74 34v14" stroke="#688188" stroke-width="5" stroke-linecap="round"/></g>`;
  } else if (kind === 'glass') {
    shape = `<path d="m35 30 91 14-25 95-91-16Z" fill="#5d99aa"/><path d="m35 25 91 14-26 95-91-16Z" fill="url(#${id}-glass)" stroke="#a8d8d3" stroke-width="3"/><path d="m45 33 24 4-39 75-12-2Zm44 7 14 2-38 80-15-3Z" fill="#f5fff7" opacity=".66"/><path d="m35 29 84 13" stroke="#f4fff9" stroke-width="3"/><circle cx="93" cy="119" r="3" fill="#f1fff8"/>`;
  } else if (kind === 'plastic') {
    shape = `<path d="m37 32 83 12 9 15-18 76-84-11-13-15Z" fill="#b36b4b"/><path d="m37 24 79 12c10 2 15 10 12 20l-16 65c-2 8-7 10-14 9l-72-12c-10-2-15-11-12-21l16-63c1-6 4-11 7-10Z" fill="url(#${id}-plastic)" stroke="#c5845c" stroke-width="2"/><path d="m48 46 48 8m-51 3 48 8m-51 3 48 8m-51 3 48 8" stroke="#bc7855" stroke-width="5" stroke-linecap="round"/><circle cx="39" cy="37" r="3" fill="#ffe1b6"/><circle cx="111" cy="49" r="3" fill="#ffe1b6"/><circle cx="31" cy="102" r="3" fill="#ffe1b6"/><circle cx="101" cy="115" r="3" fill="#ffe1b6"/>`;
  } else if (kind === 'lens') {
    shape = `<ellipse cx="75" cy="94" rx="52" ry="42" fill="#518591"/><ellipse cx="72" cy="84" rx="52" ry="42" fill="#a6d7d4" stroke="#6d9faa" stroke-width="4"/><ellipse cx="72" cy="84" rx="42" ry="34" fill="url(#${id}-glass)" stroke="#e6fff0" stroke-width="4"/><path d="M45 101c-21-28-3-46 25-46M79 110c26-6 33-19 29-34" fill="none" stroke="#f5fff8" stroke-width="7" stroke-linecap="round" opacity=".8"/><ellipse cx="84" cy="65" rx="9" ry="5" fill="#f8fff4" transform="rotate(-22 84 65)"/>`;
  } else if (kind === 'button') {
    shape = `<path d="m31 50 62-15 25 26v44l-63 19-25-26Z" fill="#a85f45"/><path d="m31 42 62-15 25 27-1 38-63 18-25-24Z" fill="url(#${id}-plastic)" stroke="#bd7756" stroke-width="3"/><path d="m39 46 51-12 18 19-54 16Z" fill="#ffdcb0"/><path d="m54 70 1 31M65 79l34-10" fill="none" stroke="#d29169" stroke-width="3"/><path d="m68 45 16 5m-6-11-3 17" stroke="#a66347" stroke-width="5" stroke-linecap="round"/>`;
  } else if (kind === 'battery') {
    // A picture frame keeps this a digital sorting decision, never a handling task.
    shape = `<rect x="19" y="24" width="111" height="111" rx="13" fill="#fffbe6" stroke="#9db8a4" stroke-width="3"/><path d="M26 43V32h11m76 0h10v11M26 116v11h11m76 0h10v-11" fill="none" stroke="#c3d2b5" stroke-width="2"/><g transform="rotate(18 75 78)"><rect x="61" y="35" width="26" height="11" rx="3" fill="#7f9290"/><rect x="52" y="44" width="44" height="74" rx="10" fill="#477c72"/><path d="M52 55q22 9 44 0v22H52Z" fill="#f0c36e"/><path d="M63 51h23m-12-7v14" stroke="#fff3bf" stroke-width="3" stroke-linecap="round"/><path d="m72 84-7 15h11l-5 14 16-22H77l4-7" fill="#d7efd3"/></g><path d="m105 114 7-7 11 15h-21Z" fill="#a2c5a4"/><circle cx="106" cy="103" r="3" fill="#ddb865"/>`;
  } else if (kind === 'phone') {
    shape = `<path d="m43 17 53 7c9 1 13 6 12 14l-8 99c-1 7-6 10-13 9l-50-7c-8-1-12-7-11-15l8-96c0-7 4-12 9-11Z" fill="#244f49"/><path d="m43 16 51 7c6 1 10 5 9 12l-8 96c-1 7-4 9-10 8l-48-7c-6-1-9-5-8-12l8-94c0-7 2-11 6-10Z" fill="#528879" stroke="#2c5d54" stroke-width="2"/><path d="m44 34 48 6-6 79-48-6Z" fill="#bce5d4"/><path d="m49 40 18 2-25 62-3 0Zm25 4 9 1-24 65-10-1Z" fill="#edffef" opacity=".55"/><path d="M66 80c-14-20 20-27 21-31 5 24-5 36-21 31Z" fill="#619d69"/><path d="M56 94c12-8 17-21 21-31" fill="none" stroke="#477850" stroke-width="3" stroke-linecap="round"/><path d="m59 29 15 2" stroke="#c2e3cc" stroke-width="3" stroke-linecap="round"/><circle cx="61" cy="123" r="4" fill="#b3d6c4"/>`;
  } else if (kind === 'gold') {
    shape = `<path d="m33 46 82 12-12 58-81-12Z" fill="#856123"/><path d="m34 40 81 12-12 57-81-12Z" fill="url(#${id}-gold)" stroke="#c8942d" stroke-width="2"/><path d="m44 42-10 55m28-52-10 55m28-52-10 55m28-52-10 55" stroke="#fff0b2" stroke-width="10"/><path d="m27 93 77 12-3 17-78-12Z" fill="#b6852c"/><path d="m31 99-2 13m20-10-2 13m20-10-2 13m20-10-2 13" stroke="#efd27d" stroke-width="7"/>`;
  } else {
    shape = `<path d="m31 45 68-14 27 22-17 64-71 13-22-23Z" fill="url(#${id}-metal)" stroke="#8ea9a7" stroke-width="3"/>`;
  }
  return `${definitions}<ellipse cx="73" cy="136" rx="52" ry="10" fill="#254e3915"/>${shape}`;
}

function materialArt(kind, prefix) {
  return `<svg viewBox="0 0 150 155" aria-hidden="true" focusable="false">${materialShape(kind, prefix)}</svg>`;
}

function insideSvg(art) { return art.slice(art.indexOf('>') + 1, art.lastIndexOf('</svg>')); }

/** The second level shows possible uses, not a promise about any real service. */
function newObjectArt(kind, complete, prefix) {
  const id = safeId(prefix), ink = complete ? '#31584a' : '#85a795';
  let shape;
  if (kind === 'cable') {
    shape = `<path d="M55 102C16 102 8 52 46 40c53-18 96 43 58 76-28 25-78-2-56-35 21-33 71 8 48 34" fill="none" stroke="${complete?'#356d60':'#a4bdae'}" stroke-width="18" stroke-linecap="round"/><path d="M55 98C16 98 8 48 46 36c53-18 96 43 58 76" fill="none" stroke="${complete?'#79b59b':'#dce7dc'}" stroke-width="8" stroke-linecap="round"/><path d="m48 100 10-1 6 14-13 5Z" fill="${complete?'#edc989':'#c6d6c9'}"/><rect x="91" y="105" width="22" height="31" rx="6" fill="${ink}"/><path d="M97 129v9m10-9v9" stroke="${complete?'#d9a451':'#9cb3a7'}" stroke-width="5"/>`;
  } else if (kind === 'bike') {
    shape = `<g fill="#fffbed" stroke="${ink}" stroke-width="6"><circle cx="36" cy="105" r="26"/><circle cx="119" cy="105" r="26"/></g><g fill="none" stroke="${complete?'#e4a65b':'#a9c0ae'}" stroke-width="7" stroke-linejoin="round"><path d="m37 105 23-43 26 42H37l43-33h25l14 34M86 104l17-49"/></g><path d="m52 58 20-1m28-5 15-1 6 8" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><circle cx="85" cy="104" r="6" fill="${ink}"/><path d="m85 104 11 10h8" stroke="${ink}" stroke-width="4" fill="none"/><g stroke="${complete?'#b9cec4':'#d1dfd2'}" stroke-width="1.5"><path d="m36 82 0 46m-23-23h46m60-23v46m-23-23h46"/></g>`;
  } else {
    shape = `<path d="m28 94 10 42m72-42 14 42" stroke="${ink}" stroke-width="9" stroke-linecap="round"/><path d="m24 96 10-45m88 44-4-45" stroke="${ink}" stroke-width="7"/><path d="m22 53 95-1 2 20-98 2Zm-5 28 105-1 9 17-119 2Z" fill="${complete?'#79ae94':'#c2d5c2'}" stroke="${complete?'#548f77':'#99b39f'}" stroke-width="3"/><path d="m27 59 83-1M22 86l96-1" stroke="${complete?'#bbd9b7':'#e2ecdc'}" stroke-width="4" stroke-linecap="round"/><circle cx="29" cy="64" r="2" fill="${ink}"/><circle cx="111" cy="63" r="2" fill="${ink}"/>`;
  }
  return `<svg viewBox="0 0 155 155" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}-platform" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${complete?'#eff8cd':'#e9f0e3'}"/><stop offset="1" stop-color="${complete?'#b0cc98':'#c6d6c5'}"/></linearGradient></defs><ellipse cx="78" cy="141" rx="71" ry="10" fill="#254e3914"/><path d="M8 130v8c0 18 138 18 138 0v-8" fill="url(#${id}-platform)"/><ellipse cx="77" cy="130" rx="69" ry="14" fill="${complete?'#e7f3cb':'#f0f5e9'}"/><g class="pr-materials-invention-shape" ${complete?'':'opacity=".65"'}>${shape}</g>${complete?'<g class="pr-materials-art-stars" fill="#edb645"><path d="m18 22 3 8 9 3-9 3-3 8-3-8-8-3 8-3Z"/><path d="m134 29 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/></g>':''}</svg>`;
}

const BIN_PALETTES = {
  metal: ['#f5cc7b','#d6a758','#ffe7aa'],
  glass: ['#9ed3d5','#70acae','#d4eeee'],
  plastic: ['#c5d7a0','#99b477','#e6f0c8'],
};

/** Colourful toy bins belong to this pretend factory; their labels are not home disposal rules. */
function binArt(target, collected = []) {
  const [front, side, rim] = BIN_PALETTES[target.kind] || BIN_PALETTES.metal;
  const miniatures = collected.slice(0,4).map((piece, index) => `<g transform="translate(${28+index*22} 9) scale(.30)">${materialShape(piece.kind, `collected-${target.id}-${piece.id}`)}</g>`).join('');
  return `<svg viewBox="0 0 180 165" aria-hidden="true" focusable="false"><ellipse cx="89" cy="155" rx="73" ry="9" fill="#254e3915"/><path d="m16 42 13-19 135 1 0 25-15 92-18 11-99-4Z" fill="${side}"/><path d="m29 24 118 1 15 20-17 98-107-3-21-93Z" fill="${front}" stroke="${side}" stroke-width="2"/><path d="m30 27 114 1 12 16-128-1Z" fill="#466756"/><path d="m15 40 143 1 7 10-153-1Z" fill="${rim}"/><path d="m20 55 14 81 104 3" fill="none" stroke="${rim}" stroke-width="3" opacity=".85"/>${miniatures}<rect x="44" y="73" width="88" height="43" rx="11" fill="#fffdf0"/><path d="m62 95 10-9 10 9-10 9Zm32-7h20m-20 8h20m-20 8h13" fill="none" stroke="#47715b" stroke-width="3" stroke-linecap="round"/><path d="M39 140v10m92-8v9" stroke="#547660" stroke-width="8" stroke-linecap="round"/></svg>`;
}

function factoryArt() {
  return '<svg viewBox="0 0 230 180" aria-hidden="true" focusable="false"><ellipse cx="117" cy="166" rx="101" ry="9" fill="#254e3915"/><path d="M36 74V39h22v37m108-18V21h19v37" fill="#8ca894" stroke="#5a7c67" stroke-width="3"/><path d="m18 87 45-26v26l46-26v26l46-26v26h57v65H18Z" fill="#d9c799" stroke="#9da476" stroke-width="3"/><path d="M28 97h170v12H28Z" fill="#f4dc95"/><path d="m32 97 12 12m12-12 12 12m12-12 12 12m12-12 12 12m12-12 12 12m12-12 12 12m12-12 12 12" stroke="#859774" stroke-width="5"/><rect x="35" y="119" width="47" height="24" rx="5" fill="#b7d8c0" stroke="#789b7c" stroke-width="3"/><rect x="151" y="119" width="43" height="24" rx="5" fill="#b7d8c0" stroke="#789b7c" stroke-width="3"/><path d="M101 157v-38h32v38" fill="#6c8c70"/><rect x="85" y="42" width="95" height="26" rx="5" fill="#f9f1d6" stroke="#a9b28e" stroke-width="2"/><path d="m103 55 5 5 9-11m14 5h32" fill="none" stroke="#5b8263" stroke-width="4" stroke-linecap="round"/></svg>';
}

/** A closed item goes to adults at a designated service, never to a home bin. */
function collectionArt(kind, recovered = false, prefix = 'collection') {
  const battery = kind === 'battery', id = safeId(prefix);
  return `<svg viewBox="0 0 240 180" aria-hidden="true" focusable="false"><ellipse cx="121" cy="165" rx="108" ry="9" fill="#254e3915"/><path d="M105 58h112v104H105Z" fill="#b9d7bd" stroke="#74997f" stroke-width="3"/><path d="m95 55 20-28h91l20 28Z" fill="#5c927d"/><path d="M99 53h123v11H99Z" fill="#e9c97c"/><rect x="110" y="31" width="96" height="24" rx="5" fill="#fff6d6"/><text x="158" y="48" text-anchor="middle" fill="#325b49" font-family="system-ui,sans-serif" font-weight="850" font-size="12">${battery?'BATTERIES':'E-WASTE'}</text><rect x="116" y="73" width="88" height="50" rx="6" fill="#edf5d9"/><circle cx="178" cy="82" r="10" fill="#dca17b"/><path d="M168 80q9-23 21 0" fill="#4f6b55"/><path d="M162 117V101q17-18 32 0v16" fill="#eca959"/><path d="m168 102 10 9 10-9" fill="none" stroke="#fff0bd" stroke-width="3"/><rect x="108" y="117" width="104" height="13" rx="4" fill="#6e9680"/><path d="M159 140h35m-29 9h23" stroke="#70947b" stroke-width="4" stroke-linecap="round"/><circle cx="65" cy="87" r="12" fill="#b87953"/><path d="M53 86q-2-28 23-16l3 16-8-10-19 5Z" fill="#3c5146"/><path d="M48 139v-34q17-16 33 0v34" fill="#6f9fc0"/><path d="m53 137-3 26m25-26 5 26" stroke="#466f6c" stroke-width="9" stroke-linecap="round"/><path d="m81 109 19 15" stroke="#b87953" stroke-width="8" stroke-linecap="round"/><circle cx="30" cy="116" r="9" fill="#bd805c"/><path d="M21 115q-2-18 17-12l3 10-12-5Z" fill="#405648"/><path d="M19 148v-18q11-11 23 0v18" fill="#e9b851"/><path d="m23 147-2 16m16-16 3 16" stroke="#6b8969" stroke-width="7" stroke-linecap="round"/><path d="m41 132 9-12" stroke="#bd805c" stroke-width="6" stroke-linecap="round"/>${battery?'<rect x="119" y="91" width="29" height="23" rx="4" fill="#eac17d" stroke="#bb9358" stroke-width="2"/><rect x="130" y="95" width="8" height="14" rx="2" fill="#518174"/><path d="M132 93h4" stroke="#518174" stroke-width="2"/>':'<g transform="translate(111 68) scale(.29)">'+materialShape('phone',id+'-whole')+'</g>'}${recovered?`<g class="pr-materials-art-stars"><g transform="translate(170 104) scale(.29)">${materialShape('copper',id+'-copper')}</g><g transform="translate(200 104) scale(.25)">${materialShape('gold',id+'-gold')}</g><path d="m39 46 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm172 40 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#e4b346"/></g>`:''}</svg>`;
}

function rubbishArt() {
  return '<svg viewBox="0 0 230 180" aria-hidden="true" focusable="false"><ellipse cx="115" cy="164" rx="80" ry="10" fill="#254e3915"/><path d="M81 58 70 34l25 4 21-7 15 25c17 11 49 67 38 89-9 18-93 18-107 0-15-20 6-73 19-87Z" fill="#a4ad96" stroke="#778b75" stroke-width="3"/><path d="m78 57 53 1m-49 12-11 51m41-48 24 69" stroke="#bec8ae" stroke-width="7" stroke-linecap="round"/><rect x="71" y="90" width="86" height="35" rx="8" fill="#ecedd8"/><path d="M87 103h52m-45 9h38" stroke="#7f9277" stroke-width="4" stroke-linecap="round"/></svg>';
}

/** A gentle cutaway shows missed resources, without suggesting children open phones. */
function landfillArt() {
  return `<svg viewBox="0 0 360 170" aria-hidden="true" focusable="false"><path d="M12 69c49 0 47-25 87-19 30 4 44 15 68 5s33-3 55 8c46 19 62-25 123 4v88H12Z" fill="#c2a37c"/><path d="M12 78c46-5 65-20 100-10 56 15 81-5 115 11 45 18 87-7 118 0" fill="none" stroke="#ddc29b" stroke-width="14"/><path d="M12 112c53 19 75-17 127 2 57 20 108-13 150 4 18 7 33 10 56 2" fill="none" stroke="#ad8d68" stroke-width="8"/><path d="M12 66c51 0 50-25 87-17 35 7 48 10 68 5s40 1 59 12c36 17 67-26 119-1" fill="none" stroke="#88aa78" stroke-width="11" stroke-linecap="round"/><g transform="translate(74 59) rotate(14 30 40) scale(.53)">${materialShape('phone','landfill-whole-phone')}</g><circle cx="220" cy="109" r="43" fill="#fff5d9" stroke="#977b57" stroke-width="3" stroke-dasharray="5 4"/><g transform="translate(179 77) scale(.38)">${materialShape('copper','landfill-copper')}</g><g transform="translate(213 81) scale(.34)">${materialShape('gold','landfill-gold')}</g><path d="m146 112 29-1" stroke="#f5e1b9" stroke-width="3" stroke-dasharray="5 4"/><circle cx="292" cy="47" r="20" fill="#fff0cf" stroke="#bd9455" stroke-width="2"/><path d="m284 39 16 16m0-16-16 16" stroke="#a17a40" stroke-width="4" stroke-linecap="round"/></svg>`;
}

function checkMark() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function conveyorPiece(piece, completed, selected) {
  const done = Boolean(completed[piece.id]);
  const label = done ? piece.revealedLabel || piece.label : piece.label;
  return `<button type="button" class="pr-materials-piece ${done?'is-delivered':''} ${selected===piece.id?'is-selected':''}" data-piece="${escape(piece.id)}" data-kind="${escape(piece.kind)}" aria-pressed="${selected===piece.id}" aria-label="${escape(label)}${done?', delivered':''}" ${done?'disabled':''}><span class="pr-materials-token-art">${materialArt(piece.kind, `piece-${piece.id}`)}</span><strong>${escape(label)}</strong><span class="pr-materials-piece-check" ${done?'':'hidden'}>${checkMark()}</span></button>`;
}

function materialsHeader({building = false, service = false, phone = false, finished, delivered, count}) {
  const title = service ? (phone ? 'Whole-phone mission' : 'Battery stop') : (building ? 'Possible new uses' : 'Factory materials');
  return `<header class="pr-materials-header"><span class="pr-materials-station-name"><i aria-hidden="true"></i>${title}<span class="pr-materials-factory-tag">${service?'With an adult':'Factory only'}</span></span><span class="pr-materials-counter" aria-label="${delivered} of ${count} pieces delivered">${finished?checkMark():''}<b>${delivered} / ${count}</b></span><div class="pr-materials-whole-banner"><svg viewBox="0 0 20 24" aria-hidden="true"><rect x="5" y="2" width="11" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8 11 2 2 4-4M9 18h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><strong>Real electronics stay whole.</strong></div></header>`;
}

function serviceTargetArt(target, complete) {
  if (target.kind === 'rubbish' || target.id === 'rubbish') return rubbishArt();
  if (target.kind === 'factory' || target.id === 'factory') return factoryArt();
  return collectionArt(target.kind,complete,`target-${target.id}`);
}

/** The final two stages connect the pretend factory to safe whole-item choices. */
function renderService({level,completed,selected,result}) {
  const pieces = level.pieces || [], targets = level.targets || [];
  const delivered = pieces.filter(piece => completed[piece.id]).length;
  const finished = pieces.length > 0 && delivered === pieces.length;
  const phone = level.id === 'phone-choice';
  const landfill = phone && result?.correct === false && result?.targetId === 'rubbish';
  let outcome;
  if (landfill) {
    outcome = `<div class="pr-materials-outcome is-landfill" data-materials-landfill><span class="pr-materials-outcome-art">${landfillArt()}</span><strong>Useful materials can be lost.</strong><span>Your whole phone is still here. Try another place.</span></div>`;
  } else if (finished) {
    outcome = `<div class="pr-materials-outcome is-collected" data-materials-recovered><span class="pr-materials-outcome-art">${collectionArt(phone?'ewaste':'battery',phone,`outcome-${level.id}`)}</span><strong>${phone?'A whole phone. New possibilities!':'An adult helps it reach the right place.'}</strong><span>${phone?'Specialists may recover useful materials.':'Use a designated battery collection service.'}</span></div>`;
  } else {
    outcome = `<div class="pr-materials-outcome is-waiting"><span class="pr-materials-adult-art" aria-hidden="true"><svg viewBox="0 0 160 100"><ellipse cx="82" cy="92" rx="69" ry="6" fill="#487b6117"/><circle cx="56" cy="24" r="15" fill="#b97f57"/><path d="M41 24q-3-32 27-19l5 21-10-12-22 7Z" fill="#405b48"/><path d="M32 78V50q24-20 48 0v28" fill="#7ca9b4"/><path d="m44 76-2 17m27-17 3 17" stroke="#4f8077" stroke-width="9" stroke-linecap="round"/><circle cx="112" cy="51" r="11" fill="#bd845d"/><path d="M101 51q-2-23 21-14l3 14-12-9Z" fill="#405b48"/><path d="M97 85V68q15-16 30 0v17" fill="#e9be65"/><path d="m103 84-1 10m20-10 1 10" stroke="#73916b" stroke-width="7" stroke-linecap="round"/><path d="m79 54 19 15" stroke="#b97f57" stroke-width="7" stroke-linecap="round"/><path d="m131 24 4 8 9 3-9 3-4 9-3-9-8-3 8-3Z" fill="#e7b847"/></svg></span><strong>Make the choice together.</strong><span>${phone?'Keep the phone closed. Find its next stop.':'This is a picture. Ask an adult about real batteries.'}</span></div>`;
  }
  return `<section class="pr-materials is-service ${phone?'is-phone-route':'is-battery-route'} ${finished?'is-finished':''} ${landfill?'has-landfill':''}" data-materials-route="${escape(level.id)}" aria-label="${phone?'Choose a whole-phone collection service':'Choose a battery collection service'}"><div class="pr-materials-factory-wall" aria-hidden="true"><span></span><span></span></div>${materialsHeader({service:true,phone,finished,delivered,count:pieces.length})}<div class="pr-materials-delivery-stage"><div class="pr-materials-whole-item">${pieces.map(piece=>conveyorPiece(piece,completed,selected)).join('')}</div>${outcome}</div><div class="pr-materials-service-prompt"><span></span><strong>${finished?'A thoughtful choice!':'Choose its next stop'}</strong><span></span></div><div class="pr-materials-targets" style="--target-count:${targets.length}">${targets.map(target=>{
    const made = pieces.some(piece=>completed[piece.id] && piece.answer===target.id);
    return `<button type="button" class="pr-materials-target ${made?'is-made':''} ${selected?'is-ready':''}" data-target="${escape(target.id)}" data-kind="${escape(target.kind)}" aria-label="${escape(target.label)}${made?', complete':''}"><span class="pr-materials-target-art">${serviceTargetArt(target,made && phone)}</span><strong>${escape(target.label)}</strong><span class="pr-materials-target-note">${target.kind==='factory'?'Material sorting floor':target.kind==='rubbish'?'General rubbish':target.kind==='battery'?'Designated collection':'Whole electronics + adult'}</span>${made?`<span class="pr-materials-made-mark">${checkMark()}</span>`:''}</button>`;
  }).join('')}</div></section>`;
}

/** Read-only rendering: accepted moves are always supplied by the game engine. */
export function renderMaterials({level, completed = {}, selected = null, result = null} = {}) {
  if (!level) return '';
  if (['battery-stop','phone-choice'].includes(level.id)) return renderService({level,completed,selected,result});
  const pieces = level.pieces || [], targets = level.targets || [];
  const building = level.id === 'build' || targets.some(target => ['cable','bike','bench'].includes(target.kind));
  const delivered = pieces.filter(piece => completed[piece.id]).length;
  const finished = pieces.length > 0 && delivered === pieces.length;
  return `<section class="pr-materials ${building?'is-building':'is-sorting'} ${finished?'is-finished':''}" aria-label="${building?'Build new possibilities':'Sort the digital factory materials'}"><div class="pr-materials-factory-wall" aria-hidden="true"><span></span><span></span><span></span></div>${materialsHeader({building,finished,delivered,count:pieces.length})}<div class="pr-materials-conveyor"><div class="pr-materials-belt" aria-hidden="true"><span></span></div><div class="pr-materials-pieces" style="--piece-count:${pieces.length}">${pieces.map(piece=>conveyorPiece(piece,completed,selected)).join('')}</div><span class="pr-materials-conveyor-end" aria-hidden="true"></span></div><div class="pr-materials-transfer" aria-hidden="true"><span></span><svg viewBox="0 0 22 22"><path d="M11 2v16m-6-6 6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><span></span></div><div class="pr-materials-targets">${targets.map(target=>{
    const assigned = pieces.filter(piece => piece.answer === target.id), collected = assigned.filter(piece => completed[piece.id]);
    const made = building && assigned.length > 0 && collected.length === assigned.length;
    return `<button type="button" class="pr-materials-target ${made?'is-made':''} ${selected?'is-ready':''}" data-target="${escape(target.id)}" data-kind="${escape(target.kind)}" aria-label="${escape(target.label)}${made?', complete':''}"><span class="pr-materials-target-art">${building?newObjectArt(target.kind,made,`object-${target.id}`):binArt(target,collected)}</span><strong>${escape(target.label)}</strong><span class="pr-materials-target-note">${building?(made?'A new possibility!':'Match a material'):(collected.length?`${collected.length} collected`:'Factory sorting')}</span>${made?`<span class="pr-materials-made-mark">${checkMark()}</span>`:''}</button>`;
  }).join('')}</div><div class="pr-materials-pip" aria-hidden="true"><img src="/prototypes/i3-family-landing/assets/pip.svg" alt=""/><span>${finished?'Nice teamwork!':building?'What could it become?':'Keep useful materials moving.'}</span></div></section>`;
}

/** A small original factory illustration for the game chooser. */
export function materialsArt() {
  return `<svg viewBox="0 0 440 260" role="img" aria-label="A toy factory with colourful sorting bins and new possibilities"><defs><linearGradient id="pr-materials-hub-floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#dceec6"/><stop offset="1" stop-color="#b4d19d"/></linearGradient></defs><ellipse cx="220" cy="234" rx="188" ry="18" fill="#244e3910"/><path d="m38 140 180-76 185 84-17 69-169 34-172-52Z" fill="url(#pr-materials-hub-floor)"/><path d="m52 137 165-66 172 78-168 65Z" fill="#f4f1d6"/><path d="m82 91 219 46-19 44-219-48Z" fill="#608d7c"/><path d="m81 81 220 46-19 45-220-48Z" fill="#8ab79c"/><path d="m95 91-15 28m47-22-15 28m47-22-15 28m47-22-15 28m47-22-15 28m47-22-15 28" stroke="#5b8c73" stroke-width="5"/><g transform="translate(85 42) scale(.42)">${materialShape('copper','hub-copper')}</g><g transform="translate(169 63) scale(.39)">${materialShape('glass','hub-glass')}</g><g transform="translate(247 78) scale(.40)">${materialShape('plastic','hub-plastic')}</g><g transform="translate(282 141) scale(.55)">${insideSvg(binArt({id:'hub-metal',kind:'metal'},[]))}</g><g transform="translate(107 128) scale(.62)">${insideSvg(newObjectArt('bike',true,'hub-bike'))}</g><path d="m321 48 4 11 11 4-11 4-4 11-4-11-11-4 11-4Zm-258 7 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#eac172"/></svg>`;
}
