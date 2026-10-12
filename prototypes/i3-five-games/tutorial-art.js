/** Original, lightweight illustrations. These are pictures, not live 3D scenes. */
const devices = {
  laptop: '<rect x="34" y="25" width="112" height="76" rx="9" fill="#123b36"/><rect x="42" y="33" width="96" height="60" rx="4" fill="#cce9df"/><path d="m24 105 132 0 15 16H10Z" fill="#84aca0"/><path d="M72 105h36l5 6H68Z" fill="#edf8f1"/><path d="m78 63 10 10 20-23" fill="none" stroke="#346d57" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
  kettle: '<path d="M117 39c44-4 42 61 8 62" fill="none" stroke="#446e61" stroke-width="12"/><path d="M54 47 26 34l19 48" fill="#84b7a2"/><path d="M64 31h42l19 61q4 26-17 27H57q-21-1-17-27Z" fill="#bfe4cc"/><rect x="62" y="24" width="47" height="11" rx="5" fill="#346d57"/><path d="M82 18v7" stroke="#346d57" stroke-width="8" stroke-linecap="round"/><rect x="46" y="120" width="77" height="8" rx="4" fill="#123b36"/><rect x="74" y="54" width="15" height="42" rx="7" fill="#edf8f1"/>',
  toaster: '<path d="M40 40q0-16 18-16h60q20 0 20 17v61H40Z" fill="#b9ddeb"/><rect x="35" y="91" width="109" height="19" rx="8" fill="#57879a"/><rect x="58" y="16" width="63" height="14" rx="7" fill="#274f5c"/><rect x="70" y="10" width="38" height="13" rx="5" fill="#fff"/><circle cx="68" cy="64" r="5" fill="#123b36"/><circle cx="112" cy="64" r="5" fill="#123b36"/><path d="M78 80q11 10 22 0" fill="none" stroke="#123b36" stroke-width="4" stroke-linecap="round"/><path d="M46 112v6m89-6v6" stroke="#123b36" stroke-width="8" stroke-linecap="round"/>',
  wire: '<path d="M40 93c-35-57 86-110 100-49 10 45-84 66-82 12 3-31 67-38 62-4-3 20-31 20-24 5" fill="none" stroke="#a86237" stroke-width="14" stroke-linecap="round"/><path d="M40 93c-35-57 86-110 100-49" fill="none" stroke="#dba16b" stroke-width="5" stroke-linecap="round"/><path d="m39 92 14 25m84-51 13 23" stroke="#e5c48a" stroke-width="7" stroke-linecap="round"/>',
  cup: '<path d="M116 45h12c29 0 25 38-4 39" fill="none" stroke="#598a77" stroke-width="11"/><path d="M49 35h72l-7 73q-26 14-56 0Z" fill="#c4e2d3"/><ellipse cx="85" cy="35" rx="36" ry="9" fill="#37644f"/><path d="M73 63h24m-12-12v24" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
};
export function deviceArt(kind='laptop', label='') {
  return `<svg viewBox="0 0 180 140" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'}><ellipse cx="90" cy="127" rx="72" ry="7" fill="#123b360d"/>${devices[kind]||devices.laptop}</svg>`;
}
export function activityArt(id,{solved=false}={}) {
  let art = id==='materials' ? `<path d="M24 102h212" stroke="#85ad99" stroke-width="18" stroke-linecap="round"/><path d="M24 103h212" stroke="#d4e7d9" stroke-width="8" stroke-dasharray="9 12"/><g transform="translate(9 1) scale(.6)">${devices.wire}</g><path d="m151 24 37-7 24 31-10 37-42-6Z" fill="#aed5e0"/><path d="m172 25 13 48m13-44-11 42" stroke="#fff" stroke-width="4"/><rect x="84" y="125" width="83" height="51" rx="10" fill="#bde876"/><path d="m104 141 14-7 0 12Zm26-7 15 9-15 8" fill="none" stroke="#315d46" stroke-width="3"/><path d="M127 152v13" stroke="#315d46" stroke-width="3"/>`
  : id==='care' ? `<path d="M29 116h204v11H29Z" fill="#aac5b8"/><path d="M44 127v41m173-41v41" stroke="#72977f" stroke-width="8"/><g transform="translate(30 21) scale(.7)">${devices.laptop}</g><g transform="translate(159 47) scale(.42)">${devices.cup}</g><path d="m168 37 11-14m10 28 18-4" stroke="#668c66" stroke-width="4" stroke-linecap="round"/>`
  : id==='scrapworks' ? `<path d="M22 92 82 42 132 72 178 39 238 89v65H22Z" fill="#d6e8e0"/><path d="M22 92 82 42v112H22m110-82 46-33v115h-46" fill="#b5d1c4"/><rect x="160" y="85" width="39" height="43" rx="4" fill="#fff"/><path d="m75 119 15-14 19 13-7 17H82Z" fill="#759987"/><circle cx="57" cy="142" r="17" fill="#bde876"/><circle cx="113" cy="142" r="17" fill="#bde876"/><path d="M82 85V68m-8 8h16" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="m181 116 7-12-14 0 7 12m0 3v2" fill="none" stroke="#50765f" stroke-width="2"/>`
  : id==='choices' ? `<circle cx="130" cy="97" r="65" fill="none" stroke="#b1d5bb" stroke-width="17" stroke-dasharray="95 41"/><path d="m160 22 22 3-9 20M197 135l-6 22-18-14M66 139l-18-14 19-11" fill="#709b7c"/><g transform="translate(66 41) scale(.72)">${devices.toaster}</g>`
  : `<g transform="translate(38 14) scale(.94)">${devices.laptop}</g><circle cx="213" cy="42" r="22" fill="#bde876"/><path d="m202 42 8 8 14-18" fill="none" stroke="#315d46" stroke-width="4" stroke-linecap="round"/><path d="M31 149h198" stroke="#b4cec0" stroke-width="3" stroke-dasharray="5 7"/><circle cx="52" cy="150" r="9" fill="#c9e0ee"/><circle cx="130" cy="150" r="9" fill="#bde876"/><circle cx="208" cy="150" r="9" fill="#d0dec6"/>`;
  // The completed practice changes the picture, so the effect of the choice
  // remains visible even with animation paused.
  if(solved&&id==='materials')art='<ellipse cx="121" cy="153" rx="70" ry="9" fill="#a9c8ae55"/><path d="M169 108q48 2 33 38h-30" stroke="#426d5b" stroke-width="10" fill="none" stroke-linecap="round"/><rect x="72" y="62" width="100" height="71" rx="15" fill="#b58154"/><path d="M91 66v62m17-62v62m17-62v62m17-62v62m17-62v62" stroke="#dfb489" stroke-width="10"/><ellipse cx="72" cy="98" rx="16" ry="48" fill="#638d79"/><ellipse cx="174" cy="98" rx="16" ry="48" fill="#779f89"/><ellipse cx="174" cy="98" rx="6" ry="21" fill="#d8e9d9"/>';
  if(solved&&id==='care')art=`<path d="M18 118h143v11H18Z" fill="#aac5b8"/><path d="M34 129v38m113-38v38" stroke="#72977f" stroke-width="8"/><g transform="translate(21 28) scale(.72)">${devices.laptop}</g><rect x="181" y="133" width="66" height="14" rx="7" fill="#7ea68d"/><g transform="translate(176 62) scale(.42)">${devices.cup}</g><path d="M170 47v110" stroke="#a1c49b" stroke-width="2" stroke-dasharray="5 6"/><path d="m190 42 14 0-6-7m6 7-6 7" stroke="#618e63" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const badge=solved?'<circle cx="218" cy="31" r="20" fill="#bde876"/><path d="m209 31 6 6 12-14" fill="none" stroke="#315d46" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>':'';
  return `<svg viewBox="0 0 260 190" aria-hidden="true" data-art-solved="${solved}"><circle cx="130" cy="93" r="84" fill="#edf6ef"/>${art}${badge}</svg>`;
}

/** The family home uses everyday devices, without a game character. Its blue
 * illustration palette is independent of the unchanged tutorial toy artwork. */
export function heroArt() {
  const palette={'#123b36':'#16283c','#cce9df':'#d8eaff','#84aca0':'#8eaccb','#edf8f1':'#fff','#346d57':'#176dc4','#446e61':'#426788','#84b7a2':'#8bb5dc','#bfe4cc':'#c9e4fa'};
  const blueDevice=kind=>Object.entries(palette).reduce((art,[from,to])=>art.replaceAll(from,to),devices[kind]);
  return `<svg class="ffh-story-svg" viewBox="0 0 620 520" role="img" aria-label="A kettle and a working laptop illustrate how a clue can lead to repair, reuse or responsible recycling.">
    <path d="M80 382C-6 225 170 64 310 98S613 186 531 356 169 522 80 382" fill="#eaf3ff"/>
    <circle cx="507" cy="111" r="76" fill="#fff2be" opacity=".72"/>
    <path d="M181 185C174 97 414 79 445 184M473 274C480 386 314 446 221 368" fill="none" stroke="#97b6d5" stroke-width="3" stroke-dasharray="6 9"/>
    <path d="m432 171 14 16 7-21m-214 189-23 9 20 12" fill="none" stroke="#97b6d5" stroke-width="3" stroke-linecap="round"/>
    <g class="ffh-art-first"><rect x="38" y="170" width="246" height="218" rx="26" fill="#16283c0a"/><rect x="32" y="161" width="246" height="218" rx="26" fill="#fff" stroke="#d7e3ef"/>
      <g transform="translate(69 174) scale(.9)">${blueDevice('kettle')}</g><circle cx="240" cy="193" r="20" fill="#fff0b8"/><text x="240" y="200" text-anchor="middle" font-size="22" fill="#16283c" font-family="Arial">?</text>
      <text x="60" y="323" font-size="15" font-family="Arial" fill="#4a5a6b">THE LITTLE QUESTION</text><text x="60" y="351" font-size="19" font-weight="600" font-family="Arial" fill="#16283c">“What happens next?”</text>
    </g>
    <g class="ffh-art-next"><rect x="308" y="65" width="269" height="254" rx="27" fill="#16283c0a"/><rect x="302" y="57" width="269" height="254" rx="27" fill="#fff" stroke="#d7e3ef"/>
      <g transform="translate(351 90) scale(.94)">${blueDevice('laptop')}</g><rect x="338" y="224" width="198" height="51" rx="25" fill="#e0f0ff"/><path d="m354 249 8 8 13-17" fill="none" stroke="#176dc4" stroke-width="3" stroke-linecap="round"/><text x="388" y="255" font-family="Arial" font-size="18" fill="#16283c" font-weight="600">A new chapter</text>
    </g>
    <g class="ffh-art-possibilities" transform="translate(297 350)"><rect width="263" height="121" rx="23" fill="#fff" stroke="#d7e3ef"/>
      <text x="24" y="30" font-family="Arial" font-size="13" font-weight="600" fill="#4a5a6b">ONE ITEM. DIFFERENT POSSIBILITIES.</text>
      <g transform="translate(25 48)"><rect width="58" height="36" rx="11" fill="#fff1be"/><path d="m17 25 14-14m-3-4 8 0 0 8m-13 4-7-7" fill="none" stroke="#b5821e" stroke-width="3" stroke-linecap="round"/><text x="29" y="57" text-anchor="middle" font-size="12" fill="#4a5a6b" font-family="Arial">Repair</text></g>
      <g transform="translate(103 48)"><rect width="58" height="36" rx="11" fill="#e0f0ff"/><path d="M15 13h26l-6-5m6 5-6 5M41 25H15l6-5m-6 5 6 5" fill="none" stroke="#176dc4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><text x="29" y="57" text-anchor="middle" font-size="12" fill="#4a5a6b" font-family="Arial">Reuse</text></g>
      <g transform="translate(181 48)"><rect width="58" height="36" rx="11" fill="#eee7fa"/><path d="M24 10q5-7 10 0l5 8m-7-3 7 3 2-7M40 24q-1 7-8 7h-9m5-5-5 5 5 5M17 27q-7-3-3-9l5-8m1 7-1-7-7 2" fill="none" stroke="#7056a0" stroke-width="2.4" stroke-linejoin="round"/><text x="29" y="57" text-anchor="middle" font-size="12" fill="#4a5a6b" font-family="Arial">Recycle</text></g>
    </g>
    <path d="m73 92 0 20m-10-10h20m460 327v15m-8-8h16M270 34v14m-7-7h14" stroke="#c7a34c" stroke-width="3" stroke-linecap="round"/><circle cx="574" cy="353" r="7" fill="#f4c431"/>
  </svg>`;
}
