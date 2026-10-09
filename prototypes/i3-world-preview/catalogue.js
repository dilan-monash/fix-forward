/** The catalogue is teaching content, not a service manual or a model-specific diagnosis.
 * IDs deliberately match the named meshes in world-engine.js so a tap on a mesh
 * and a tap on its accessible text button open exactly the same explanation. */
export const SOURCES = {
  grid: 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2026',
  safety: 'https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely',
  energy: 'https://www.energy.gov.au/households/household-guides/reduce-energy-bills',
  ewaste: 'https://www.environment.vic.gov.au/household-waste-recycling/ewaste',
};

/** Scope 2 grid factors, kg CO2e/kWh: DCCEEW NGA Factors 2026, Table 1.
 * This is generation associated with grid use, NOT a product's whole-life footprint. */
export const GRID_FACTORS = Object.freeze({
  VIC: { label: 'Victoria', factor: 0.74 },
  NSW: { label: 'NSW / ACT', factor: 0.60 },
  QLD: { label: 'Queensland', factor: 0.65 },
  SA: { label: 'South Australia', factor: 0.21 },
  WA: { label: 'WA (SWIS grid)', factor: 0.45 },
});

/** Keep part creation readable: ID maps to 3D geometry; text explains its job and material. */
const part = (id, name, job, material) => ({ id, name, job, material });

/** Power and daily minutes below are editable EXAMPLE SCENARIOS, not measured values
 * or claims about an average appliance. The impact screen labels this clearly. */
export const CATALOGUE = [
  {
    id: 'kettle', name: 'Kettle', category: 'Kettle', room: 'Kitchen', colour: '#759b82', watts: 2000, minutes: 6,
    question: 'What changes when we boil only the water we need?',
    summary: 'A small daily habit, a useful look at heat and energy.',
    parts: [
      part('body', 'Water chamber', 'Holds the water while it heats. Its markings help an adult choose the right amount.', 'A kettle may use steel, glass and plastic. The mix varies by model.'),
      part('lid', 'Lid', 'Covers the opening while water heats. Steam and the lid can be hot.', 'Often plastic or steel. Small parts still belong with the appliance at end of life.'),
      part('handle', 'Handle', 'Gives a place to hold the kettle. It does not make hot water safe to handle.', 'Often a heat-resistant plastic; material details vary.'),
      part('heater', 'Heating element', 'Turns electrical energy into heat. Here you can see it in a digital model only.', 'Metal conducts heat. Real heating parts must not be opened or touched.'),
      part('base', 'Power base', 'Connects the kettle to electricity. Water and electrical connections must stay apart.', 'A mix of plastic, metal contacts and wiring.'),
    ],
    care: [
      ['Use the right amount', 'Fill with only the amount needed, while staying between your model’s minimum and maximum marks.'],
      ['Follow the manual for scale', 'Follow your model’s descaling instructions if mineral build-up appears. Cleaning methods vary.'],
      ['Keep the base dry', 'Follow the manual for cleaning. Do not immerse the power base or open its electrical enclosure.'],
    ],
    challenge: { question: 'One cup is needed. Which choice uses less energy?', choices: ['Boil only what is needed, above the minimum mark', 'Fill it to the top every time'], correct: 0, explanation: 'Heating less water needs less energy. An adult still follows the kettle’s minimum fill mark.' },
    energyTip: 'Heating less water can reduce boiling time. Try changing the minutes to compare two hypothetical routines.',
  },
  {
    id: 'fan', name: 'Fan', category: 'Fan', room: 'Living', colour: '#d7b679', watts: 50, minutes: 240,
    question: 'Does a fan cool an empty room?', summary: 'Discover moving air, a motor and a better everyday habit.',
    parts: [
      part('grille', 'Protective grille', 'A barrier around the moving blades. Keep fingers and objects away.', 'Usually metal or plastic; leave it attached on a real fan.'),
      part('blades', 'Blades', 'Push air as they turn. The breeze helps people feel cooler.', 'Light metal or plastic, shaped to move air.'),
      part('motor', 'Motor', 'Changes electrical energy into movement.', 'Contains metal and wiring that specialist recycling can recover.'),
      part('base', 'Stand and base', 'Keeps the fan upright on a stable surface.', 'Often mixed plastic and metal.'),
    ],
    care: [
      ['Let air move freely', 'Keep the fan on a stable surface, with space around it. Do not cover the grille.'],
      ['Care without opening', 'Follow the manual for external dust cleaning after switching off and unplugging. Keep the real protective grille attached unless the manual directs otherwise.'],
      ['Switch off when leaving', 'A fan moves air; it does not lower an empty room’s temperature like air conditioning.'],
    ],
    challenge: { question: 'Everyone leaves the room. What is the useful next step?', choices: ['Leave the fan running for the furniture', 'Ask an adult to switch it off'], correct: 1, explanation: 'The breeze helps people feel cooler. An empty room does not need that breeze.' },
    energyTip: 'Compare hours used while people are present. Switching off an unneeded fan avoids that electricity use.',
  },
  {
    id: 'toaster', name: 'Toaster', category: 'Toaster', room: 'Kitchen', colour: '#bca0ce', watts: 1000, minutes: 4,
    question: 'What does the crumb tray do?', summary: 'A familiar breakfast object with several different materials.',
    parts: [
      part('body', 'Outer body', 'Surrounds the heating parts. It may be hot during and after use.', 'Often a steel shell with plastic controls.'),
      part('slots', 'Bread slots', 'Guide bread towards the heaters. Never put tools or fingers into a real toaster.', 'Heating wires and metal supports sit inside.'),
      part('lever', 'Lever', 'Lowers the bread to begin toasting.', 'A small handle connects to an internal mechanism.'),
      part('crumb-tray', 'Crumb tray', 'Collects small crumbs below the bread.', 'Often a removable metal tray; access and care depend on the manual.'),
    ],
    care: [
      ['Keep it clear', 'Use it away from curtains and follow the manual’s clearance guidance.'],
      ['Look after the crumb tray', 'Follow the manual for cleaning the tray after unplugging and cooling.'],
      ['No tools in the slots', 'If food is stuck or it behaves oddly, stop using it and follow the manufacturer’s guidance. Do not poke tools into the slots.'],
    ],
    challenge: { question: 'Bread is stuck. What should a child do?', choices: ['Stop and tell an adult', 'Use a fork to reach it'], correct: 0, explanation: 'A toaster can be hot and has electrical parts. A child should stop and ask for help.' },
    energyTip: 'Power and toasting time both affect electricity use. This is an example, not a recommendation to undercook food.',
  },
  {
    id: 'blender', name: 'Blender', category: 'Blender', room: 'Kitchen', colour: '#ba795c', watts: 500, minutes: 2,
    question: 'Why should a lid stay in place?', summary: 'Follow energy from the motor to moving food.',
    parts: [
      part('jug', 'Jug', 'Holds the food or drink. Fill marks help an adult avoid overfilling.', 'Often glass or plastic; check the model’s material guidance.'),
      part('lid', 'Lid', 'Keeps food inside during use. Safety features differ by model.', 'Usually plastic with a flexible seal.'),
      part('blades', 'Blades', 'Cut and mix food as the motor turns them. They can be sharp even when still.', 'Steel can be recovered through suitable recycling, but do not remove blades yourself.'),
      part('motor', 'Motor', 'Turns electricity into rotation for the blades.', 'Copper wiring and metal sit inside the motor housing.'),
      part('base', 'Motor base', 'Holds the controls and electrical parts.', 'Mixed materials need an appropriate e-waste route.'),
    ],
    care: [
      ['Use the model’s limits', 'Check fill limits and which foods your blender is designed to handle in the manual.'],
      ['Protect the motor base', 'Never immerse the electrical base. Follow the model’s cleaning instructions.'],
      ['Keep hands away from blades', 'Unplug before cleaning and follow the manufacturer’s guidance for sharp parts. Blades remain sharp when still.'],
    ],
    challenge: { question: 'The jug looks clean. Are the blades safe for fingers?', choices: ['Yes, if they are not moving', 'No, they can still be sharp'], correct: 1, explanation: 'Sharp parts can cut even when they are still. Let an adult handle cleaning.' },
    energyTip: 'A short time at higher power can use less energy than a long time at lower power. Compare watts × time.',
  },
  {
    id: 'microwave', name: 'Microwave', category: 'Microwave', room: 'Kitchen', colour: '#7899ad', watts: 1200, minutes: 10,
    question: 'What if the door is damaged?', summary: 'See why some faults need a professional, not an experiment.',
    parts: [
      part('body', 'Outer enclosure', 'Keeps the internal components enclosed. Those parts are for trained people only.', 'Steel, wiring and electronics; never open the real enclosure.'),
      part('door', 'Door', 'Works with safety interlocks so cooking stops when opened. Damage needs professional assessment.', 'Glass, mesh, metal and plastic work together.'),
      part('turntable', 'Turntable', 'Rotates food to help heat it more evenly. Not all models have one.', 'Often glass, with a separate support underneath.'),
      part('control', 'Controls', 'Choose a time and power setting. Displayed cooking power may differ from electricity input power.', 'Buttons or electronics sit behind the front panel.'),
    ],
    care: [
      ['Keep the enclosure closed', 'Never remove the cover. Internal components can remain hazardous after unplugging.'],
      ['Check food and containers', 'Use microwave-suitable containers and cooking instructions appropriate for your model.'],
      ['Treat door damage seriously', 'Stop using a damaged door or seal and arrange professional advice. Cleaning cannot repair damage.'],
    ],
    challenge: { question: 'The door is damaged but the light still works. What next?', choices: ['Stop using it and ask for professional help', 'Keep using it because the light works'], correct: 0, explanation: 'One working feature cannot prove an appliance is safe. A damaged door needs expert assessment.' },
    energyTip: 'Use electrical input watts from the rating label, not advertised cooking-output watts. Cycling power makes estimates approximate.',
  },
  {
    id: 'vacuum', name: 'Vacuum', category: 'Vacuum cleaner', room: 'Living', colour: '#ca855c', watts: 700, minutes: 15,
    question: 'Could a full dust bin make cleaning harder?', summary: 'Follow air through the cleaner and see why care matters.',
    parts: [
      part('body', 'Motor housing', 'Contains the motor that creates airflow.', 'Mixed plastics, wiring and metal.'),
      part('bin', 'Dust bin', 'Collects dirt. A fill line helps show when it needs emptying.', 'Often plastic; bagged vacuums use a different system.'),
      part('filter', 'Filter', 'Traps particles as air passes through. Care rules differ across filters.', 'Some can be washed; others cannot. The manual decides.'),
      part('hose', 'Hose', 'Carries air and dirt from the head to the cleaner.', 'Flexible plastic with model-specific fittings.'),
      part('nozzle', 'Floor head', 'Guides dirt and air in from the floor.', 'Usually plastic, sometimes with a rotating brush.'),
    ],
    care: [
      ['Watch the fill line', 'Empty the bin or replace the bag at the point and in the way your manual describes.'],
      ['Know your filter', 'Check whether your filter is washable and follow its drying instructions. Some filters must stay dry.'],
      ['Keep water out', 'Only a vacuum specifically rated for liquids should pick them up. Do not assume a household cleaner can.'],
    ],
    challenge: { question: 'A filter looks dirty. What is the useful first step?', choices: ['Wash every filter the same way', 'Check its manual with an adult'], correct: 1, explanation: 'Filters differ. Washing the wrong kind can damage it; the model’s care instructions matter.' },
    energyTip: 'Estimate from active cleaning time. Care can help performance, but this calculator does not invent a percentage saved by cleaning.',
  },
  {
    id: 'hairdryer', name: 'Hair dryer', category: 'Hair dryer', room: 'Bathroom', colour: '#bd8290', watts: 1600, minutes: 8,
    question: 'Why does air need a clear way in?', summary: 'One object combines movement, heat and airflow.',
    parts: [
      part('body', 'Body', 'Encloses the heating and moving parts.', 'Heat-resistant plastic surrounds electrical parts.'),
      part('motor', 'Fan motor', 'Moves air past the heating section and out of the nozzle.', 'Contains metal and wiring.'),
      part('filter', 'Air inlet', 'Lets air enter. Keep it clear while the dryer is used.', 'A grille or mesh may collect lint; follow the manual for care.'),
      part('handle', 'Handle and controls', 'Lets the user hold the dryer and choose settings.', 'Plastic switches connect to electrical components.'),
      part('nozzle', 'Nozzle', 'Directs the warm air. It may be hot during and after use.', 'Usually heat-resistant plastic.'),
    ],
    care: [
      ['Keep away from water', 'Do not use or leave a hair dryer near a bath, basin or other water.'],
      ['Leave the inlet clear', 'Avoid blocking the air intake. Check your model’s manual for lint cleaning.'],
      ['Unplug after use', 'Switch off, unplug and let it cool before storage. Stop using damaged equipment.'],
    ],
    challenge: { question: 'Where is a sensible place to store it after cooling?', choices: ['Somewhere dry and away from water', 'On the edge of the bath'], correct: 0, explanation: 'Electricity and water are a dangerous combination. Keep electrical items away from water.' },
    energyTip: 'Heat settings change power use. The editable watts value is a scenario, not a measurement of your dryer.',
  },
  {
    id: 'laptop', name: 'Laptop', category: 'Laptop', room: 'Study', colour: '#899c8c', watts: 50, minutes: 240,
    question: 'What needs to happen before a laptop finds a new home?', summary: 'A device can have another life, while your information stays private.',
    parts: [
      part('screen', 'Screen', 'Turns electronic signals into the pictures and words you see.', 'Glass, metals and electronic layers need specialist recovery.'),
      part('keyboard', 'Keyboard', 'Sends key presses to the computer.', 'Plastic keys sit above electronic circuits.'),
      part('battery', 'Battery', 'Stores energy for use away from a socket. Do not open, bend or puncture a battery.', 'Battery chemistry and handling vary; damaged batteries need specialist advice.'),
      part('body', 'Computer body', 'Holds circuits and cooling pathways. Air vents help heat escape.', 'A mix of metals, plastics and electronic components.'),
    ],
    care: [
      ['Give vents some space', 'Use a firm surface so air vents stay clear. Follow the maker’s temperature guidance.'],
      ['Care for the battery', 'If a battery swells, leaks or seems damaged, stop using the device and seek manufacturer advice.'],
      ['Prepare for another owner', 'Back up and securely erase personal data before reuse or recycling. Follow the manufacturer’s reset guidance for your device.'],
    ],
    challenge: { question: 'A working laptop is going to another family. What else matters?', choices: ['Only making the outside look clean', 'An adult backing up and removing personal data'], correct: 1, explanation: 'A second life is useful, but personal information needs protection before the device changes hands.' },
    energyTip: 'Actual laptop draw varies with charging, screen and workload. Use a measured value if available; charger ratings are not constant use.',
  },
  // These four models broaden kitchen discovery without changing the shared
  // 3D -> care -> impact -> adult-action route. Their wattages remain examples.
  {
    id: 'ricecooker', name: 'Rice cooker', category: 'Rice cooker', room: 'Kitchen', colour: '#84aaba', watts: 700, minutes: 25,
    question: 'Why is the removable bowl different from the electrical body?',
    summary: 'Meet the bowl, heat and controls behind a familiar shared meal.',
    parts: [
      part('body', 'Outer body', 'Holds the electrical and heating parts around the cooking bowl.', 'Usually a mix of plastic and metal. Keep the electrical body out of water.'),
      part('lid', 'Lid', 'Covers the rice as it cooks. Escaping steam and the lid can be very hot.', 'Glass, metal or plastic depending on the model.'),
      part('bowl', 'Cooking bowl', 'Holds the rice and water. Its marked levels help the user follow the cooking instructions.', 'Often coated metal. The finish needs care suitable for that coating.'),
      part('control', 'Cooking control', 'Selects or indicates a cooking mode. Warm and cook are different jobs.', 'A switch or electronic controls connect to internal components.'),
      part('base', 'Heating base', 'Transfers heat into the bowl. The real electrical parts stay enclosed.', 'Contains a metal heating surface and electrical connections.'),
    ],
    care: [
      ['Know what can be washed', 'Unplug and let it cool. Follow the manual for the removable bowl and lid; never immerse the electrical body.'],
      ['Protect the bowl’s surface', 'Use the utensils and cleaning tools recommended for your bowl’s coating. Avoid scraping away its finish.'],
      ['Check the fit before use', 'Follow the manual for seating a clean, dry bowl in the cooker. Keep steam outlets clear during cooking.'],
    ],
    careSource: { label: 'Example rice cooker care manual · Breville', url: 'https://www.breville.com/content/dam/breville/au/en/assets/miscellaneous/instruction-manual/cookers/BRC550-instruction-manual.pdf' },
    challenge: { question: 'The bowl can be washed. Does that mean the whole cooker can go in water?', choices: ['Yes, every part can be washed the same way', 'No, the electrical body needs different care'], correct: 1, explanation: 'Parts have different jobs and care needs. The bowl’s cleaning rule does not apply to the electrical body.' },
    energyTip: 'Cooking and keep-warm modes draw different power. Estimate one mode at a time using its power and active time; this example is not a whole-day measurement.',
  },
  {
    id: 'airfryer', name: 'Air fryer', category: 'Air fryer', room: 'Kitchen', colour: '#95a8bd', watts: 1500, minutes: 20,
    question: 'What needs to happen before an air fryer is cleaned?',
    summary: 'Discover how hot air, a basket and careful habits work together.',
    parts: [
      part('body', 'Outer body', 'Houses the heater, fan and controls. Air needs space to flow around its vents.', 'Metal and heat-resistant plastic surround electrical components.'),
      part('basket', 'Food basket', 'Holds food while hot air moves around it. Fill limits depend on the model.', 'Often coated metal. The coating needs suitable utensils and cleaning.'),
      part('handle', 'Drawer handle', 'Gives a place to pull the basket drawer. Hot food and other surfaces still need care.', 'Usually heat-resistant plastic attached to the drawer.'),
      part('control', 'Time and temperature controls', 'Set a cooking routine. A selected temperature is not the same thing as power in watts.', 'Buttons, dials or a screen connect to the controller inside.'),
      part('heater', 'Heating assembly', 'Turns electricity into heat while a fan moves the hot air. Explore it digitally only.', 'Metal heating parts and wiring remain enclosed on the real appliance.'),
    ],
    care: [
      ['Let it cool first', 'Switch off, unplug and allow hot parts to cool before following the model’s cleaning instructions.'],
      ['Care for the basket', 'Check which removable parts can be washed and which cleaning tools are suitable. Do not assume every part is dishwasher-safe.'],
      ['Give the vents room', 'Follow the manual’s placement and clearance guidance. Do not block air openings or immerse the electrical body.'],
    ],
    careSource: { label: 'Example air fryer care guidance · Philips', url: 'https://acc.usa.philips.com/c-f/XC000012903/how-to-clean-my-philips-airfryer' },
    challenge: { question: 'Cooking has finished. Is the basket ready for a child to wash straight away?', choices: ['No, it can still be hot; an adult follows the cleaning guide', 'Yes, turning it off makes it cool immediately'], correct: 0, explanation: 'Turning something off does not remove its heat straight away. An adult lets it cool and follows its care instructions.' },
    energyTip: 'The heater cycles during cooking, so rated watts × the whole cooking time can overestimate use. Replace the example with measured average power if available.',
  },
  {
    id: 'coffeemachine', name: 'Coffee machine', category: 'Coffee machine', room: 'Kitchen', colour: '#a997be', watts: 1200, minutes: 8,
    question: 'Does every coffee machine use the same cleaning routine?',
    summary: 'Follow water through a machine and learn why its model matters.',
    parts: [
      part('body', 'Machine body', 'Contains the components that heat and move water. Keep the real enclosure closed.', 'Metal, plastic, tubing and electronics work together.'),
      part('tank', 'Water tank', 'Stores water for making a drink. Its fill and care instructions belong to the specific model.', 'Often a removable plastic container; some models use a different water supply.'),
      part('spout', 'Coffee outlet', 'Directs the prepared drink into a cup. The liquid and outlet can be hot.', 'Metal or plastic connects to the internal water pathway.'),
      part('tray', 'Drip tray', 'Catches drips below the cup. Some have a marker to show when the tray is full.', 'Usually removable plastic or metal parts.'),
      part('control', 'Drink controls', 'Choose a drink or a maintenance programme. Symbols and sequences differ between models.', 'Buttons or electronic controls send instructions to the machine.'),
    ],
    care: [
      ['Use your model’s cleaning guide', 'Follow the manual for the water tank, drip tray and drink outlets. Let hot parts cool and isolate power as directed.'],
      ['Descale the instructed way', 'Use the descaling product, amounts and rinse programme specified for your model. Another machine’s routine may not apply.'],
      ['Treat leaks as a reason to check', 'Stop using a machine with an unexpected leak or damaged lead and seek appropriate advice. Do not open its enclosure to investigate.'],
    ],
    careSource: { label: 'Example model-specific descaling guide · De’Longhi', url: 'https://support.delonghi.com/en/magnifica-evo-ecam29X.5X/Descaling-guide-f790' },
    challenge: { question: 'A friend shares a descaling routine for a different model. What should your family do first?', choices: ['Use it because all coffee machines are identical', 'Find the guide for their own model'], correct: 1, explanation: 'Models can need different amounts, steps and rinses. Matching the model helps your family find the right instructions.' },
    energyTip: 'Heating, brewing and standby are different modes. This example estimates active use only; it does not include all-day standby or every warm-up cycle.',
  },
  {
    id: 'mixer', name: 'Mixer', category: 'Mixer', room: 'Kitchen', colour: '#bd8c75', watts: 300, minutes: 8,
    question: 'What is the useful first step before cleaning moving parts?',
    summary: 'See how a motor, mixing tool and bowl work as a team.',
    parts: [
      part('body', 'Motor head', 'Houses the motor that turns the mixing tool. It stays closed on the real appliance.', 'Metal, plastic and wiring form the drive assembly.'),
      part('bowl', 'Mixing bowl', 'Holds ingredients beneath the mixing tool. Capacity limits depend on the recipe and model.', 'Often steel, glass or ceramic, with different cleaning requirements.'),
      part('beaters', 'Mixing tool', 'Moves through ingredients to mix them. Keep hands, hair and utensils clear while it moves.', 'Usually coated or uncoated metal; care differs between attachments.'),
      part('control', 'Speed control', 'Changes how fast the motor turns. A faster setting is not right for every mixture.', 'A lever, dial or electronic control connects to the drive.'),
      part('base', 'Support base', 'Supports the mixer and bowl on a steady surface.', 'Often heavy metal with feet that help keep it stable.'),
    ],
    care: [
      ['Switch off and unplug', 'Disconnect power before cleaning or changing attachments, following your model’s instructions.'],
      ['Check each attachment', 'Use the cleaning method approved for your bowl and mixing tools. Coatings and materials may need different care.'],
      ['Respect capacity and speed', 'Follow the manual’s quantity, speed and running-time limits. Stop and seek advice if the mixer behaves unusually.'],
    ],
    careSource: { label: 'Example mixer cleaning guidance · KitchenAid', url: 'https://producthelp.kitchenaid.com/Countertop_Appliances/Stand_Mixers/Mini_3.5_Quart_Tilt-Head_Stand_Mixer/Cleaning_and_Maintenance/How_to_Clean_the_Stand_Mixer' },
    challenge: { question: 'The mixer has stopped. Before cleaning or changing its tool, what should an adult do?', choices: ['Switch off and unplug, then follow the manual', 'Reach into the bowl while it stays connected'], correct: 0, explanation: 'Disconnecting power helps prevent an unexpected start. The adult follows the model’s cleaning and attachment instructions.' },
    energyTip: 'Motor power varies with speed and load. This editable example uses constant power for clarity; measured average use would be more accurate.',
  },
];

/** Accept an ID or a familiar appliance label from a family-to-adult route. */
export function findAppliance(value) {
  const needle = String(value || '').toLowerCase();
  return CATALOGUE.find(item => [item.id, item.name.toLowerCase(), item.category.toLowerCase()].includes(needle)) || CATALOGUE[0];
}

/** Pure calculation: watts -> kW, minutes -> hours, then kWh -> kg CO2e.
 * Reject invalid/blank entries instead of displaying a misleading zero. */
export function calculateImpact({ watts, minutes, days, factor }) {
  const raw = [watts, minutes, days, factor];
  if (raw.some(value => value === '' || value === null || value === undefined)) return null;
  const values = raw.map(Number);
  if (values.some(value => !Number.isFinite(value) || value < 0)) return null;
  const [w, m, d, f] = values;
  if (w > 10000 || m > 1440 || d > 366 || f > 5) return null;
  const kwh = (w / 1000) * (m / 60) * d;
  return { kwh, kgCO2e: kwh * f };
}
