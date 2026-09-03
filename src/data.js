// Frontend-only UI fixtures. Replace this module with a backend data adapter
// when the public-data pipeline and API contract are ready.
export const META = Object.freeze({
  releaseVersion: "iteration-1-v1.0.0",
  dataVersion: "frontend-ui-fixture-2026-09-01",
  retrievalDate: "1 September 2026"
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

export const RECALLS = Object.freeze([
  {
    id: "accc-2018-16575",
    family: "heating-simple-cooking",
    category: "Kettle",
    title: "KitchenAid Electric Kettle 1.7L",
    published: "21 February 2018",
    noticeUrl: "https://www.productsafety.gov.au/search-consumer-product-recalls/kitchenaid-electric-kettle-17l",
    identifyingNote: "Affected serial numbers begin YA342XXXXX through YA724XXXXX. Compare the model and serial number on the official notice.",
    source: "ACCC Product Safety"
  }
]);

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

export const REPAIR_EVIDENCE = Object.freeze({
  status: "insufficient",
  statistics: Object.freeze([]),
  barriers: Object.freeze([]),
  context: Object.freeze({
    sampleSize: 305649,
    geography: "Global community repair events; not a representative Australian household sample",
    confidenceLevel: "Insufficient category-level evidence",
    source: "Open Repair Alliance full dataset",
    updated: "October 2025",
    limitation: "Self-selected items brought to community repair events. No approved category mapping or denominator is available in this frontend fixture, so it cannot predict whether a specific appliance will be repairable."
  })
});

export const LOCATIONS = Object.freeze([
  { area: "Brunswick", pathway: "repair", name: "Repair Café directory", type: "Community repair search", address: "Search for current events near Brunswick", contact: "Check organiser details before travelling", url: "https://www.repaircafe.org/en/visit/", verified: false, verificationStatus: "directory-only" },
  { area: "Brunswick", pathway: "dispose", name: "Victorian e-waste drop-off finder", type: "Official disposal search", address: "Search for current drop-off points near Brunswick", contact: "Confirm the facility accepts your appliance before visiting", url: "https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste", verified: false, verificationStatus: "directory-only" },
  { area: "Footscray", pathway: "repair", name: "Repair Café directory", type: "Community repair search", address: "Search for current events near Footscray", contact: "Check organiser details before travelling", url: "https://www.repaircafe.org/en/visit/", verified: false, verificationStatus: "directory-only" },
  { area: "Footscray", pathway: "dispose", name: "Victorian e-waste drop-off finder", type: "Official disposal search", address: "Search for current drop-off points near Footscray", contact: "Confirm the facility accepts your appliance before visiting", url: "https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste", verified: false, verificationStatus: "directory-only" }
]);
