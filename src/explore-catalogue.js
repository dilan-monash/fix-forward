/* Explore's learning catalogue is separate from Take action's appliance IDs.
 * All 32 types are local photo candidates once the v2 policy is calibrated.
 * Every reviewed type maps to its own 3D lesson. The vector row order stays unchanged.
 */
const definitions = [
  ["kettle", "Kettle", "Kitchen", "kettle"],
  ["toaster", "Toaster", "Kitchen", "toaster"],
  ["microwave", "Microwave", "Kitchen", "microwave"],
  ["refrigerator", "Refrigerator", "Kitchen", "refrigerator"],
  ["rice_cooker", "Rice cooker", "Kitchen", "ricecooker"],
  ["air_fryer", "Air fryer", "Kitchen", "airfryer"],
  ["blender", "Blender", "Kitchen", "blender"],
  ["food_processor", "Food processor", "Kitchen", "food_processor"],
  ["mixer", "Mixer", "Kitchen", "mixer"],
  ["coffee_machine", "Coffee machine", "Kitchen", "coffeemachine"],
  ["sandwich_press", "Sandwich press", "Kitchen", "sandwich_press"],
  ["television", "Television", "Living room", "television"],
  ["fan", "Fan", "Living room", "fan"],
  ["portable_heater", "Portable heater", "Living room", "portable_heater"],
  ["portable_ac", "Portable air conditioner", "Living room", "portable_ac"],
  ["dehumidifier", "Dehumidifier", "Living room", "dehumidifier"],
  ["laptop", "Laptop", "Study & play", "laptop"],
  ["tablet", "Tablet", "Study & play", "tablet"],
  ["smartphone", "Smartphone", "Study & play", "smartphone"],
  ["headphones", "Headphones", "Study & play", "headphones"],
  ["games_console", "Games console", "Study & play", "games_console"],
  ["printer", "Printer", "Study & play", "printer"],
  ["vacuum_cleaner", "Vacuum cleaner", "Care & cleaning", "vacuum"],
  ["steam_cleaner", "Steam cleaner", "Care & cleaning", "steam_cleaner"],
  ["washing_machine", "Washing machine", "Care & cleaning", "washing_machine"],
  ["clothes_dryer", "Clothes dryer", "Care & cleaning", "clothes_dryer"],
  ["hair_dryer", "Hair dryer", "Care & cleaning", "hairdryer"],
  ["straightener", "Hair straightener", "Care & cleaning", "straightener"],
  ["shaver", "Shaver", "Care & cleaning", "shaver"],
  ["electric_toothbrush", "Electric toothbrush", "Care & cleaning", "electric_toothbrush"],
  ["cordless_drill", "Cordless drill", "Workshop", "cordless_drill"],
  ["sewing_machine", "Sewing machine", "Workshop", "sewing_machine"],
];
export const EXPLORE_ITEMS32 = Object.freeze(definitions.map(([slug, label, group, worldId]) =>
  Object.freeze({ slug, label, group, worldId })));
// Explicit ordering is the text-vector row order. Do not sort this array in place.
const phaseOneSlugs = [
  "kettle", "toaster", "fan", "microwave", "blender", "rice_cooker", "air_fryer",
  "coffee_machine", "mixer", "vacuum_cleaner", "hair_dryer", "laptop",
  "smartphone", "tablet", "television", "washing_machine",
];
// Retain the original phase-one set for historical report readers, not the UI.
export const EXPLORE_ACTIVE_ITEMS16 = Object.freeze(phaseOneSlugs.map(slug =>
  EXPLORE_ITEMS32.find(item => item.slug === slug)));
export const EXPLORE_ITEMS = EXPLORE_ITEMS32;
// V2 reuses the exact existing vector order: first 16, then the remaining 16.
export const EXPLORE_ACTIVE_ITEMS = Object.freeze([
  ...EXPLORE_ACTIVE_ITEMS16,
  ...EXPLORE_ITEMS32.filter(item => !phaseOneSlugs.includes(item.slug)),
]);
