// Static UI definitions. Public recall, repair and location records come from
// the backend; the fallback arrays below are intentionally empty so an API
// outage can never produce a false recall result from an old demo fixture.
export const META = Object.freeze({
  releaseVersion: "iteration-1-v1.2.0",
  dataVersion: "public-data-unavailable",
  retrievalDate: "Check the Sources page"
});

export const FAMILIES = Object.freeze([
  {
    id: "heating-simple-cooking",
    name: "Heating and simple cooking",
    hint: "Kettles, toasters, sandwich presses and rice cookers",
    categories: ["Kettle", "Toaster", "Sandwich press", "Rice cooker"]
  },
  {
    id: "motorised-kitchen",
    name: "Motorised kitchen",
    hint: "Blenders, mixers and food processors",
    categories: ["Blender", "Mixer", "Food processor"]
  },
  {
    id: "complex-kitchen",
    name: "Complex kitchen",
    hint: "Coffee machines, air fryers and microwaves",
    categories: ["Coffee machine", "Air fryer", "Microwave"]
  },
  {
    id: "cleaning",
    name: "Cleaning",
    hint: "Vacuum cleaners and steam cleaners",
    categories: ["Vacuum cleaner", "Steam cleaner"]
  },
  {
    id: "personal-care",
    name: "Personal care",
    hint: "Hair dryers, straighteners and shavers",
    categories: ["Hair dryer", "Straightener", "Shaver"]
  },
  {
    id: "air-treatment",
    name: "Air treatment",
    hint: "Fans, portable heaters, dehumidifiers and portable air conditioners",
    categories: ["Fan", "Portable heater", "Dehumidifier", "Portable air conditioner"]
  }
]);

// Stable machine-readable codes connect the UI labels to the database.
export const CATEGORY_CODE_BY_NAME = Object.freeze({
  "Kettle": "kettle",
  "Toaster": "toaster",
  "Sandwich press": "sandwich-press",
  "Rice cooker": "rice-cooker",
  "Blender": "blender",
  "Mixer": "mixer",
  "Food processor": "food-processor",
  "Coffee machine": "coffee-machine",
  "Air fryer": "air-fryer",
  "Microwave": "microwave",
  "Vacuum cleaner": "vacuum-cleaner",
  "Steam cleaner": "steam-cleaner",
  "Hair dryer": "hair-dryer",
  "Straightener": "straightener",
  "Shaver": "shaver",
  "Fan": "fan",
  "Portable heater": "portable-heater",
  "Dehumidifier": "dehumidifier",
  "Portable air conditioner": "portable-air-conditioner"
});

// The repair dataset uses broader categories than the interface. A null value
// means there is no defensible evidence mapping for that UI category yet.
export const EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY = Object.freeze({
  "kettle": "kettle",
  "toaster": "toaster",
  "sandwich-press": "rice_cooker_and_small_kitchen_appliances",
  "rice-cooker": "rice_cooker_and_small_kitchen_appliances",
  "blender": "blender_mixer_and_food_processor",
  "mixer": "blender_mixer_and_food_processor",
  "food-processor": "blender_mixer_and_food_processor",
  "coffee-machine": "coffee_machine",
  "air-fryer": "air_fryer_and_other_complex_kitchen",
  "microwave": "air_fryer_and_other_complex_kitchen",
  "vacuum-cleaner": "vacuum_cleaner",
  "steam-cleaner": "vacuum_cleaner",
  "hair-dryer": "hair_dryer",
  "straightener": "hair_and_beauty_appliances",
  "shaver": "hair_and_beauty_appliances",
  "fan": "fan",
  "portable-heater": null,
  "dehumidifier": "dehumidifier_and_portable_air_conditioner",
  "portable-air-conditioner": "dehumidifier_and_portable_air_conditioner"
});

export const RECALLS = Object.freeze([]);

export const SAFETY_SIGNS = Object.freeze([
  ["burning", "Burning smell, smoke or fire"],
  ["sparks", "Sparks or arcing"],
  ["heat", "Unusual overheating"],
  ["shock", "Electric shock or tingling"],
  ["wiring", "Exposed or damaged wiring"],
  ["plug", "Melted, scorched or damaged plug"],
  ["water", "Water or moisture damage"],
  ["battery", "Swollen, leaking or damaged battery"],
  ["trips", "Repeated circuit-breaker trips"],
  ["sound", "Sudden unusual buzzing, popping or crackling"]
]);

export const SAFETY_GROUPS = Object.freeze([
  {
    id: "obvious-danger",
    title: "Obvious danger signs",
    description: "Signs that may require immediate action",
    signIds: ["burning", "sparks", "shock", "wiring"]
  },
  {
    id: "power-heat",
    title: "Power and heat",
    description: "Changes around heat, plugs and electrical supply",
    signIds: ["heat", "plug", "trips"]
  },
  {
    id: "water-battery-sound",
    title: "Water, battery and sound",
    description: "Other warning signs you can safely observe",
    signIds: ["water", "battery", "sound"]
  }
]);

export const SOURCES = Object.freeze([
  { name: "ACCC Product Safety recalls", url: "https://www.productsafety.gov.au/recalls", use: "Official recall notices and verification" },
  { name: "Energy Safe Victoria", url: "https://www.energysafe.vic.gov.au/", use: "Electrical safety guidance" },
  { name: "Open Repair Alliance", url: "https://openrepair.org/open-data/downloads/", use: "Category-level repair evidence" },
  { name: "Victorian e-waste guidance", url: "https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste", use: "Responsible e-waste disposal guidance" }
]);

export const REPAIR_EVIDENCE = Object.freeze([]);

export const LOCATIONS = Object.freeze([]);
