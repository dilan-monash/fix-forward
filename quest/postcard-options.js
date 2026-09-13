/**
 * The complete set of saved postcard choices. Keep this small module independent
 * of artwork so engine validation and the SVG renderer share IDs without loading
 * drawing code into the state engine. Choices are fixed IDs, never child free text.
 */
// Palette IDs accepted by the editor, save reconstruction and postcard renderer.
export const validThemes = Object.freeze(['sunshine', 'starlight', 'mint']);
// Sticker IDs accepted by those same consumers.
export const validStickers = Object.freeze(['star', 'leaf', 'spark']);
// Public uppercase aliases refer to the same frozen lists, not separate registries.
export const POSTCARD_THEMES = validThemes;
export const POSTCARD_STICKERS = validStickers;
