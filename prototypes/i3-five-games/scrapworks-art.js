// Friendly exterior drawings reused from the original Scrapworks; no disassembly imagery.
const ART = {
  tablet: '<rect x="30" y="16" width="60" height="88" rx="8" fill="#dceffa"/><rect x="36" y="24" width="48" height="68" rx="3" fill="#fff"/><circle cx="60" cy="98" r="3"/>',
  phone: '<rect x="38" y="14" width="44" height="92" rx="9" fill="#e7e0f5"/><rect x="43" y="24" width="34" height="68" rx="3" fill="#fff"/><path d="M54 99h12"/>',
  laptop: '<rect x="24" y="24" width="72" height="50" rx="5" fill="#dceffa"/><rect x="30" y="30" width="60" height="38" rx="2" fill="#fff"/><path d="M14 80h92l-8 12H22z" fill="#c9d8e6"/>',
  headphones: '<path d="M28 70V58a32 32 0 0 1 64 0v12" fill="none"/><rect x="20" y="66" width="18" height="30" rx="7" fill="#d9efd8"/><rect x="82" y="66" width="18" height="30" rx="7" fill="#d9efd8"/>',
  player: '<rect x="14" y="44" width="92" height="34" rx="5" fill="#e3e6ea"/><path d="M24 60h40"/><circle cx="88" cy="61" r="7" fill="#fff"/>',
  keyboard: '<rect x="12" y="40" width="96" height="42" rx="6" fill="#f0e9fc"/>' + [0, 1, 2].map(r => [0, 1, 2, 3, 4, 5, 6].map(c => `<rect x="${19 + c * 12.5}" y="${47 + r * 11}" width="8" height="7" rx="1.5" fill="#fff"/>`).join('')).join(''),
  speaker: '<rect x="34" y="16" width="52" height="88" rx="10" fill="#fff0dd"/><circle cx="60" cy="46" r="11" fill="#fff"/><circle cx="60" cy="80" r="16" fill="#fff"/><circle cx="60" cy="80" r="5"/>',
  controller: '<path d="M30 46h60a18 18 0 0 1 17 24l-5 14a10 10 0 0 1-17 2l-6-8H41l-6 8a10 10 0 0 1-17-2l-5-14a18 18 0 0 1 17-24z" fill="#dceffa"/><path d="M34 58v12m-6-6h12"/><circle cx="82" cy="60" r="3"/><circle cx="90" cy="68" r="3"/>',
  printer: '<rect x="32" y="16" width="56" height="26" rx="2" fill="#fff"/><rect x="16" y="40" width="88" height="40" rx="6" fill="#e3e6ea"/><rect x="32" y="70" width="56" height="30" rx="2" fill="#fff"/><path d="M40 82h40M40 90h28"/>',
  lamp: '<path d="M44 104h32M60 104V70l20-30" fill="none"/><path d="M68 26l30 10-12 20z" fill="#fbf4d9"/><circle cx="60" cy="70" r="4"/>',
  radio: '<rect x="16" y="40" width="88" height="56" rx="8" fill="#fff0dd"/><path d="M30 40 78 18"/><circle cx="44" cy="68" r="14" fill="#fff"/><path d="M70 58h22M70 68h22M70 78h22"/>',
  powerbank: '<rect x="30" y="24" width="60" height="78" rx="10" fill="#d9efd8"/><path d="M50 18h20"/><path d="M62 48l-8 16h12l-8 16" fill="none"/>',
  watch: '<rect x="46" y="10" width="28" height="22" rx="4" fill="#e3e6ea"/><rect x="46" y="88" width="28" height="22" rx="4" fill="#e3e6ea"/><rect x="36" y="30" width="48" height="60" rx="12" fill="#e7e0f5"/><rect x="43" y="38" width="34" height="44" rx="7" fill="#fff"/><path d="M60 50v12l7 5"/>',
  monitor: '<rect x="14" y="18" width="92" height="62" rx="5" fill="#e3e6ea"/><rect x="20" y="24" width="80" height="50" rx="2" fill="#fff"/><path d="M52 80v14m16-14v14M40 98h40"/>',
  camera: '<rect x="16" y="38" width="88" height="58" rx="9" fill="#fbf4d9"/><path d="M40 38l6-12h28l6 12" fill="#fbf4d9"/><circle cx="60" cy="67" r="17" fill="#fff"/><circle cx="60" cy="67" r="7"/>',
  ereader: '<rect x="30" y="12" width="60" height="96" rx="7" fill="#e3e6ea"/><rect x="36" y="20" width="48" height="70" rx="2" fill="#fff"/><path d="M42 32h36M42 42h36M42 52h28M42 62h36"/><path d="M52 98h16"/>',
  charger: '<rect x="38" y="20" width="44" height="40" rx="6" fill="#fff"/><path d="M50 20V8m20 12V8M60 60v14c0 14 22 10 22 24v10" fill="none"/>',
  router: '<rect x="14" y="62" width="92" height="30" rx="7" fill="#dceffa"/><path d="M32 62 24 26m64 36 8-36"/><circle cx="34" cy="77" r="3"/><circle cx="46" cy="77" r="3"/><circle cx="58" cy="77" r="3"/>',
  mouse: '<rect x="38" y="24" width="44" height="76" rx="22" fill="#f0e9fc"/><path d="M60 24v26M38 50h44"/>',
  console: '<rect x="14" y="44" width="92" height="40" rx="8" fill="#e7e0f5"/><path d="M26 64h36"/><circle cx="88" cy="64" r="6" fill="#fff"/>',
  remote: '<rect x="44" y="10" width="32" height="100" rx="12" fill="#e3e6ea"/><circle cx="60" cy="28" r="5" fill="#fff"/>' + [0, 1, 2, 3].map(r => `<circle cx="53" cy="${48 + r * 13}" r="3"/><circle cx="67" cy="${48 + r * 13}" r="3"/>`).join(''),
  battery: '<rect x="24" y="30" width="72" height="66" rx="9" fill="#ffe3c2"/><path d="M40 30v-8h14v8m12 0v-8h14v8M48 63h24M60 51v24"/>',
};
export function deviceArt(name) {
  return `<svg viewBox="0 0 120 120" fill="none" stroke="#16283c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART[name] || ART.tablet}</svg>`;
}

// A small illustrated town grows a new tree, garden or light after each item.
// These are game decorations, not calculated environmental savings.
export function townArt(restored = 0, additions = 0) {
  const houses = [[230,150,0],[330,110,1],[435,145,2],[525,110,3],[310,240,4],[440,245,5],[530,225,6],[190,250,7]];
  return `<svg viewBox="0 0 660 340" class="sw5-town" role="img" aria-label="Your story town: ${restored} restored places and ${additions} new details this shift"><defs><linearGradient id="sw5-sky" x2="0" y2="1"><stop stop-color="#e6f5eb"/><stop offset="1" stop-color="#f7fafc"/></linearGradient></defs><rect width="660" height="340" rx="26" fill="url(#sw5-sky)"/><circle cx="565" cy="55" r="27" fill="#e1ed9e"/><path d="M50 160Q180 10 365 100T680 120V340H0Z" fill="#d7eadb"/><path d="M150 215 375 85 642 239 407 363Z" fill="#bad6c3"/><path d="M140 211 405 365 650 224" fill="none" stroke="#88b59b" stroke-width="14"/><path d="M228 270 478 126M311 150 565 296" fill="none" stroke="#f2f0d7" stroke-width="18"/>${houses.map(([x,y,i]) => {const active=i<restored||i<Math.ceil(additions/2);return `<g transform="translate(${x} ${y})" class="sw5-building ${active?'is-lit':''}"><path d="M-29 0 0 17 29 0V-37L0-54-29-37Z" fill="${active?'#f9fbef':'#c0d1c7'}"/><path d="M0 17 29 0V-37L0-20Z" fill="${active?'#a7ceb6':'#a1b8ac'}"/><path d="M-36-36 0-61 36-37 0-15Z" fill="${active?'#365e48':'#7f9a8b'}"/><path d="M-17-15-7-9V3l-10-6Z" fill="${active?'#e5f49c':'#97b0a1'}"/><path d="M9-9 20-15V-3L9 3Z" fill="${active?'#e5f49c':'#8ca899'}"/></g>`;}).join('')}${Array.from({length:8},(_,i)=>{const x=245+(i%4)*78,y=190+Math.floor(i/4)*108;return `<g transform="translate(${x} ${y})" class="sw5-town-detail ${i<additions?'is-grown':''}" opacity="${i<additions?1:.18}"><path d="M0 2v-24" stroke="#577d5e" stroke-width="5"/><ellipse cy="-29" rx="14" ry="19" fill="${i%2?'#7da96c':'#b7d96b'}"/><ellipse cx="-5" cy="-35" rx="7" ry="11" fill="#dce99e"/><ellipse cy="8" rx="15" ry="4" fill="#769d80" opacity=".2"/></g>`;}).join('')}<path d="M425 60h40m-27-8h24M125 82h45m-35-8h28" stroke="#fff" stroke-width="9" stroke-linecap="round"/></svg>`;
}

export function destinationIcon(destination) {
  const paths = {
    reuse: '<path d="M7 15h18v14H7zM5 11h22v6H5zM16 11v18"/><path d="M16 11C5 11 8 2 13 6l3 5c11 0 8-9 3-5z"/>',
    repair: '<path d="m12 19-7 7 3 3 8-8a9 9 0 0 0 11-12l-5 5-4-4 5-5a9 9 0 0 0-11 14Z"/>',
    recycle: '<path d="m10 9 5-7 6 10M16 10l5 2 2-6M25 17l4 9H17m3-4-3 4 4 4M12 26H3l6-11m1 5-1-5-5 1"/>',
    hold: '<path d="m16 2 12 5v9c0 7-12 14-12 14S4 23 4 16V7Z"/><path d="M16 9v9m0 4v1"/>',
    bin: '<path d="M8 10h16l-2 19H10ZM5 10h22M12 6h8m-7 8v10m6-10v10"/>'
  };
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[destination]||paths.reuse}</svg>`;
}
