// Static UI definitions. Public recall, repair and location records come from
// the backend. Fallback data arrays stay empty so an outage can never create a
// false safety/recall or service result from stale demo data.
export const META = Object.freeze({
  releaseVersion: "iteration-1-v1.6.0-usability-lab",
  dataVersion: "public-data-unavailable",
  retrievalDate: "See About the information"
});

export const FAMILIES = Object.freeze([
  {
    id: "heating-simple-cooking",
    name: "Heating & simple cooking",
    hint: "Kettles, toasters, sandwich presses and rice cookers",
    icon: "♨",
    categories: ["Kettle", "Rice cooker", "Sandwich press", "Toaster"]
  },
  {
    id: "motorised-kitchen",
    name: "Motorised kitchen",
    hint: "Blenders, mixers and food processors",
    icon: "◉",
    categories: ["Blender", "Food processor", "Mixer"]
  },
  {
    id: "complex-kitchen",
    name: "Complex kitchen",
    hint: "Coffee machines, air fryers and microwaves",
    icon: "◫",
    categories: ["Air fryer", "Coffee machine", "Microwave"]
  },
  {
    id: "cleaning",
    name: "Cleaning",
    hint: "Vacuum cleaners and steam cleaners",
    icon: "✦",
    categories: ["Steam cleaner", "Vacuum cleaner"]
  },
  {
    id: "personal-care",
    name: "Personal care",
    hint: "Hair dryers, straighteners and shavers",
    icon: "◇",
    categories: ["Hair dryer", "Shaver", "Straightener"]
  },
  {
    id: "air-treatment",
    name: "Air treatment",
    hint: "Fans, portable heaters, dehumidifiers and portable air conditioners",
    icon: "◎",
    categories: ["Dehumidifier", "Fan", "Portable air conditioner", "Portable heater"]
  }
]);

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

// The Open Repair Alliance evidence uses broader categories than the UI. These
// mappings are disclosed to users in the expandable "How we got this" panel.
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

// The visible questions are intentionally written for ordinary household users.
// Several older technical questions are combined where the same user action is
// appropriate, reducing the safety check while keeping conservative routing.
export const SAFETY_SIGNS = Object.freeze([
  ["burning", "Have you seen smoke, fire or smelled burning?"],
  ["electrical", "Have you felt a shock, seen sparks, or found exposed/damaged wires?"],
  ["plug", "Is the plug or power cord melted, scorched or badly damaged?"],
  ["power", "Does it keep tripping the power, or make new popping/buzzing sounds?"],
  ["heat", "Is it getting much hotter than normal?"],
  ["water", "Has water or moisture got into it?"],
  ["battery", "Is the battery swollen, leaking or damaged?"]
]);

export const SAFETY_RULES = Object.freeze({
  burning: Object.freeze({
    severity: "critical",
    explanation: "Smoke, fire or a burning smell can mean dangerous overheating or an electrical fault."
  }),
  electrical: Object.freeze({
    severity: "critical",
    explanation: "A shock, visible sparks or exposed wiring can create serious electric-shock or fire risk."
  }),
  plug: Object.freeze({
    severity: "critical",
    explanation: "A melted, scorched or badly damaged plug or cord can be unsafe to keep using."
  }),
  power: Object.freeze({
    severity: "caution",
    explanation: "Repeated power trips or new popping/buzzing sounds can point to a fault that should be checked."
  }),
  heat: Object.freeze({
    severity: "caution",
    explanation: "Unusual heat can have several causes. Stop and get it checked if it is severe, worsening or comes with smoke or smell."
  }),
  water: Object.freeze({
    severity: "critical",
    explanation: "Water or moisture around electrical equipment can be dangerous. Do not switch on a wet appliance."
  }),
  battery: Object.freeze({
    severity: "critical",
    explanation: "A swollen, leaking or damaged battery can create fire and chemical hazards."
  })
});

export const SAFETY_APPLICABILITY = Object.freeze({
  battery: Object.freeze(["Shaver"]),
  water: Object.freeze(["Kettle", "Rice cooker", "Coffee machine", "Steam cleaner", "Dehumidifier", "Portable air conditioner", "Shaver"]),
  heat: Object.freeze(["Kettle", "Toaster", "Sandwich press", "Rice cooker", "Coffee machine", "Air fryer", "Microwave", "Hair dryer", "Straightener", "Portable heater"])
});

// Human-first question copy. The main question stays short; the explanation and
// examples are hidden behind an info button so users who already understand it
// are not forced to read a paragraph before every answer.
export const SAFETY_HELP = Object.freeze({
  burning: Object.freeze({
    question: "Any smoke, fire or burning smell?",
    title: "What does this mean?",
    meaning: "Look for visible smoke or flame, or a new smell like burnt plastic or hot electrical parts.",
    example: "You do not need to turn the appliance on again to check.",
    pictogram: "🔥"
  }),
  electrical: Object.freeze({
    question: "Any shock, sparks or damaged wires?",
    title: "What does this mean?",
    meaning: "This includes a tingling/electric shock, a quick blue or white spark, or wire that you can see through damaged insulation.",
    example: "Only answer from something you already noticed. Do not touch a damaged wire to check it.",
    pictogram: "⚡"
  }),
  plug: Object.freeze({
    question: "Is the plug or power cord badly damaged?",
    title: "What should I look for?",
    meaning: "Look for melting, black/scorched marks, deep cuts, crushed cable or wire showing through.",
    example: "Small surface marks are different from exposed wire or melted plastic.",
    pictogram: "🔌"
  }),
  power: Object.freeze({
    question: "Does it trip the power or make new popping/buzzing sounds?",
    title: "What does this mean?",
    meaning: "Examples include the circuit breaker switching off repeatedly, a new loud buzz, crackle or popping sound.",
    example: "Do not keep resetting the power just to test the appliance.",
    pictogram: "💡"
  }),
  heat: Object.freeze({
    question: "Is it getting much hotter than normal?",
    title: "How hot is 'too hot'?",
    meaning: "Think about a new or unusual level of heat, especially if the casing, plug or cord becomes very hot.",
    example: "Normal cooking heat is different from unexpected heat in the plug, cord or outer casing.",
    pictogram: "🌡️"
  }),
  water: Object.freeze({
    question: "Has water or moisture got inside it?",
    title: "What counts as water getting inside?",
    meaning: "Examples include a spill into vents, the appliance being dropped in water, or visible moisture inside electrical parts.",
    example: "Do not switch on a wet appliance to see whether it still works.",
    pictogram: "💧"
  }),
  battery: Object.freeze({
    question: "Is the battery swollen, leaking or damaged?",
    title: "What should I look for?",
    meaning: "The case may look pushed outward, unusually rounded, split open, leaking or much hotter than usual while not in use.",
    example: "Do not press, puncture or open the battery to inspect it.",
    pictogram: "🔋"
  })
});

// Questions are deliberately prioritised by appliance instead of showing every
// generic warning to every user. Direct Repair/Compare/Recycle paths stay short;
// 'I'm not sure' can ask a slightly fuller set.
export const CATEGORY_SAFETY_PRIORITY = Object.freeze({
  "Kettle": Object.freeze(["water", "plug", "heat", "power"]),
  "Rice cooker": Object.freeze(["water", "plug", "heat", "power"]),
  "Sandwich press": Object.freeze(["plug", "heat", "power"]),
  "Toaster": Object.freeze(["plug", "heat", "power"]),
  "Blender": Object.freeze(["plug", "power"]),
  "Food processor": Object.freeze(["plug", "power"]),
  "Mixer": Object.freeze(["plug", "power"]),
  "Coffee machine": Object.freeze(["water", "plug", "heat", "power"]),
  "Air fryer": Object.freeze(["plug", "heat", "power"]),
  "Microwave": Object.freeze(["plug", "heat", "power"]),
  "Vacuum cleaner": Object.freeze(["plug", "power"]),
  "Steam cleaner": Object.freeze(["water", "plug", "power"]),
  "Hair dryer": Object.freeze(["plug", "heat", "power"]),
  "Straightener": Object.freeze(["plug", "heat", "power"]),
  "Shaver": Object.freeze(["battery", "water", "power"]),
  "Fan": Object.freeze(["plug", "power"]),
  "Portable heater": Object.freeze(["plug", "heat", "power"]),
  "Dehumidifier": Object.freeze(["water", "plug", "power"]),
  "Portable air conditioner": Object.freeze(["water", "plug", "power"])
});

export const SAFETY_PLAN_LIMITS = Object.freeze({ repair: 4, compare: 3, recycle: 2, guide: 5 });

export const SOURCES = Object.freeze([
  { name: "ACCC Product Safety recalls", url: "https://www.productsafety.gov.au/recalls", use: "Official Australian product safety and recall notices" },
  { name: "Energy Safe Victoria", url: "https://www.energysafe.vic.gov.au/", use: "Electrical safety guidance" },
  { name: "Open Repair Alliance", url: "https://openrepair.org/open-data/downloads/", use: "Category-level community repair outcomes" },
  { name: "Victorian e-waste guidance", url: "https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste", use: "Responsible e-waste guidance" },
  { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", use: "Base map tiles and map attribution for the prototype map" }
]);



// Published service-pricing examples used only as transparent cost context.
// They are deliberately kept separate because the providers use different
// service models; FixForward must not merge them into a fake repair quote.
export const COST_CONTEXT_SOURCES = Object.freeze([
  Object.freeze({
    id: "national-small-workshop",
    provider: "National Appliance Repairs",
    label: "Workshop drop-off inspection",
    amount: 99,
    note: "Standard small-appliance workshop inspection/diagnosis. Parts, extra labour and return delivery are quoted separately.",
    url: "https://www.nationalappliancerepairs.com.au/pricing/",
    retrieved: "2026-09-08"
  }),
  Object.freeze({
    id: "national-small-pickup",
    provider: "National Appliance Repairs",
    label: "Workshop pick-up inspection",
    amount: 198,
    note: "Standard small-appliance pick-up inspection/diagnosis. Parts, extra labour and return delivery are quoted separately.",
    url: "https://www.nationalappliancerepairs.com.au/pricing/",
    retrieved: "2026-09-08"
  }),
  Object.freeze({
    id: "onetouch-callout",
    provider: "One Touch Appliance Repairs",
    label: "Melbourne mobile call-out",
    amount: 129,
    note: "Published call-out/service fee. If a repair proceeds, labour including the call-out is published as capped at $229; parts are separate.",
    secondaryAmount: 229,
    url: "https://1touchappliancerepairs.com.au/services/",
    retrieved: "2026-09-08"
  })
]);

export const REPAIR_EVIDENCE = Object.freeze([]);
export const LOCATIONS = Object.freeze([]);

export const GOALS = Object.freeze([
  {
    id: "repair",
    icon: "🔧",
    title: "I want to repair it",
    description: "See how similar appliances have gone at repair events and find repair options near you.",
    cta: "Find repair options"
  },
  {
    id: "compare",
    icon: "⚖",
    title: "I want to compare costs",
    description: "Check whether a repair quote is worth comparing with the price of replacing the appliance.",
    cta: "Compare costs"
  },
  {
    id: "recycle",
    icon: "♻",
    title: "I want to recycle it",
    description: "Find places that take old electrical appliances for recycling and see them on a map.",
    cta: "Find recycling"
  },
  {
    id: "guide",
    icon: "🧭",
    title: "I’m not sure",
    description: "Answer a few simple questions and FixForward will show the options that fit your situation.",
    cta: "Help me decide"
  }
]);

// Kept in the public data contract for backward compatibility with v1.3.
// The goal-first UI no longer displays technical risk-group headings.
export const SAFETY_GROUPS = Object.freeze([]);
