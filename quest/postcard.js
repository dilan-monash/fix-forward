/**
 * Build a self-contained SVG keepsake from a fictional story and fixed design IDs.
 * This module only returns markup and a filename. app.js handles the child's
 * explicit local download, while engine.js gates saved designs to finished stories.
 * Artwork is embedded from art.js: the exported picture needs no external assets.
 */
import { scene } from './art.js';
import { validThemes, validStickers } from './postcard-options.js';
// Re-export the shared choice lists for callers building postcard controls.
export { validThemes, validStickers, POSTCARD_THEMES, POSTCARD_STICKERS } from './postcard-options.js';

// Fixed colours keep every theme local and prevent saved data becoming SVG styling.
const palettes = Object.freeze({
  sunshine: { surround: '#f4c45d', paper: '#fff9ec', ink: '#142c53', accent: '#bd6247', soft: '#ffe3a6', stamp: '#22796b' },
  starlight: { surround: '#26375c', paper: '#182b4a', ink: '#fff7df', accent: '#b4cfed', soft: '#35476a', stamp: '#f4c45d' },
  mint: { surround: '#91bfaa', paper: '#f0f8e9', ink: '#143e37', accent: '#27776c', soft: '#cae3cd', stamp: '#aa593e' }
});
// Normalise authored text for XML: remove forbidden controls and repeated whitespace.
const text = value => (typeof value === 'string' ? value : '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').replace(/\s+/g, ' ').trim();
// Escape XML characters whenever story text is inserted into SVG text or metadata.
const escape = value => text(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));

// Fit an authored heading into at most two short lines on the fixed-size postcard.
function headingLines(value) {
  const words = text(value).slice(0, 150).split(' ');
  const lines = [''];
  for (const word of words) {
    const current = lines.at(-1);
    if (current && `${current} ${word}`.length > 39 && lines.length === 1) lines.push(word);
    else lines[lines.length - 1] = current ? `${current} ${word}` : word;
  }
  return lines.map(line => line.length > 46 ? `${line.slice(0, 43).trimEnd()}…` : line);
}

// Return local decorative paths for a previously validated sticker and colour palette.
function stickerArt(sticker, palette) {
  const paths = {
    star: '<path d="m0-31 10 20 23 4-17 17 4 23L0 22l-20 11 4-23-17-17 23-4Z"/><path d="m-9 7 7 7 14-17" fill="none"/>',
    leaf: '<path d="M-25 21Q-42-23 26-29q17 57-22 61-14 2-29-11Z"/><path d="m-25 31 39-43m-26 29-2-20m12 7 18-1" fill="none"/>',
    spark: '<path d="m0-33 9 22 22 9-22 9L0 33-9 11l-22-9 22-9Z"/><path d="m34-26 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" stroke="none"/><path d="M-32 29h-10m5-5v10" fill="none"/>'
  };
  return `<g data-postcard-mark="${sticker}" transform="translate(789 523) rotate(10)" stroke="${palette.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle r="52" fill="${palette.paper}"/><circle r="45" fill="${palette.soft}" stroke="${palette.accent}" stroke-dasharray="2 7"/><g fill="${palette.stamp}">${paths[sticker]}</g></g>`;
}

/**
 * Return a 900 by 640 SVG string from a mission and optional theme/sticker/before.
 * Invalid design IDs use defaults. before changes only the pictured story phase;
 * neither generating the image nor viewing either phase awards game progress.
 */
export function postcard(mission, { theme = 'sunshine', sticker = 'star', before = false } = {}) {
  const story = mission && typeof mission === 'object' ? mission : {};
  theme = validThemes.includes(theme) ? theme : 'sunshine';
  sticker = validStickers.includes(sticker) ? sticker : 'star';
  const palette = palettes[theme];
  const isBefore = before === true;
  const line = text(story.postcardLine) || text(story.outcome?.title) || 'A next chapter found';
  const sentence = /[.!?…]$/.test(line) ? line : `${line}.`;
  const title = text(story.title) || 'A FixForward picture story';
  const lines = headingLines(line);
  // Place the existing scene as nested SVG, preserving its own coordinate system.
  const picture = scene(story.locationId || 'home', story.artworkId || 'fan', isBefore ? null : story.outcome?.scene || 'story-complete')
    .replace('<svg ', '<svg x="59" y="158" width="782" height="382" preserveAspectRatio="xMidYMid meet" ');
  const phase = isBefore ? 'WHERE OUR STORY BEGAN' : 'A NEXT CHAPTER, CHOSEN BY YOU';
  const skyMarks = theme === 'starlight'
    ? '<path d="m817 98 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm-38-41 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/><circle cx="745" cy="109" r="3"/>'
    : theme === 'mint'
      ? '<path d="M807 109q-23-28 10-42 20 25-10 42Zm-19-22q-25 4-30-18 24-5 30 18Z"/>'
      : '<circle cx="805" cy="97" r="18"/><path d="M805 66v-9m0 71v9m-31-40h-9m71 0h9m-61-22-6-6m50 50 6 6m-6-50 6-6m-50 50-6 6" fill="none" stroke-width="3"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640" role="img" aria-labelledby="quest-postcard-title quest-postcard-description" data-postcard-palette="${theme}">
  <title id="quest-postcard-title">${escape(title)} — story postcard</title>
  <desc id="quest-postcard-description">${escape(sentence)} ${isBefore ? 'The fictional scene before the choice.' : 'The fictional scene after the story choice.'} A ${theme} postcard with a ${sticker} sticker. An in-game keepsake, not a real appliance assessment.</desc>
  <rect width="900" height="640" rx="28" fill="${palette.surround}"/>
  <path d="M28 29h844v582H28Z" fill="${palette.paper}"/>
  <rect x="39" y="40" width="822" height="558" rx="10" fill="none" stroke="${palette.accent}" stroke-width="2" stroke-dasharray="9 7"/>
  <g font-family="Trebuchet MS, Arial, sans-serif" fill="${palette.ink}">
    <text x="60" y="73" font-size="13" font-weight="700" letter-spacing="2.5">FIXFORWARD QUEST · STORY POSTCARD</text>
    <text x="60" y="112" font-size="29" font-weight="700">${lines.map((lineText, index) => `<tspan x="60" dy="${index ? 32 : 0}">${escape(lineText)}</tspan>`).join('')}</text>
    <g fill="${palette.stamp}" stroke="${palette.stamp}">${skyMarks}</g>
    <rect x="55" y="154" width="790" height="390" rx="7" fill="#fff8e9" stroke="${palette.accent}" stroke-width="2"/>
    ${picture}
    <g transform="translate(680 189) rotate(7)" fill="${palette.paper}" stroke="${palette.stamp}"><rect width="139" height="61" rx="6" stroke-width="2" stroke-dasharray="5 3"/><text x="69.5" y="25" text-anchor="middle" font-size="11" font-weight="700" fill="${palette.stamp}" stroke="none" letter-spacing="1">PICTURE STORY</text><text x="69.5" y="44" text-anchor="middle" font-size="12" font-weight="700" fill="${palette.stamp}" stroke="none">${isBefore ? 'BEFORE THE CLUES' : 'NEXT CHAPTER'}</text></g>
    <path d="m79 149 82-9 3 23-82 9Z" fill="${palette.soft}" opacity=".9"/>
    ${stickerArt(sticker, palette)}
    <text x="62" y="568" font-size="12" font-weight="700" letter-spacing="1.4">${phase}</text>
    <text x="62" y="591" font-size="12">An on-screen adventure. Real appliances need adult help.</text>
  </g>
</svg>`;
}

/** Make a safe local filename from a bounded story ID, never names or arbitrary paths. */
export function postcardFilename(mission) {
  const id = typeof mission?.id === 'string' && /^[a-z][a-z0-9-]{0,59}$/.test(mission.id) ? mission.id : 'story';
  return `fixforward-quest-${id}.svg`;
}
