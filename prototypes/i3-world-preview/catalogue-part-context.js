/**
 * Part-level planet and care notes for the original twelve Explore lessons.
 * The existing job/material text and geometry stay intact. This explicit
 * appliance ID -> part ID mapping lets catalogue.js enrich each original part
 * without accidentally borrowing advice from a similarly named appliance.
 * Planet notes are qualitative: they are not lifecycle carbon calculations.
 */
const note = (impact, care) => ({ impact, care });

export const ORIGINAL_PART_CONTEXT = {
  kettle: {
    body: note('Heating more water needs more energy. Keeping a useful chamber in good condition also preserves its materials.', 'An adult follows the minimum and maximum fill marks and the exact descaling guide. Do not use a cracked chamber.'),
    lid: note('An intact lid is one small part that helps the whole kettle do its job.', 'Steam and the lid can burn. An adult follows the opening and cleaning instructions after cooling.'),
    handle: note('A strong handle helps a useful kettle stay in service; it is not only decoration.', 'Do not use a loose or damaged handle. Tell an adult rather than trying to glue it during play.'),
    heater: note('This is where electricity becomes heat. The energy experiment compares power and heating time.', 'Explore the digital element only. Leave real heating and electrical parts enclosed.'),
    base: note('The base mixes plastics, metals and wiring that need an accepted e-waste collection route.', 'Keep it dry and do not immerse it. An adult follows the manual for external care.'),
  },
  fan: {
    grille: note('A sound guard helps the whole fan remain suitable to use. A broken guard is not just a cosmetic issue.', 'Keep fingers and objects outside. Tell an adult about damage and leave the real grille attached.'),
    blades: note('Moving air helps people feel cooler. Running a fan for an empty room does not cool the furniture.', 'Do not touch real moving blades. An adult follows the manual for any cleaning.'),
    motor: note('Metal and wiring inside the motor have recovery value through specialist e-waste services.', 'Leave the motor enclosure closed. A fault needs suitable service advice.'),
    base: note('A stable, durable support protects the rest of the fan from falls.', 'Use the surface and placement directed by the maker. Do not prop up a broken stand.'),
  },
  toaster: {
    body: note('A durable shell protects the hot working parts and helps the appliance stay useful.', 'An adult switches off, unplugs and lets it cool before suitable external cleaning.'),
    slots: note('Heating bread uses electricity. The setting should suit the food, rather than repeating unnecessary cycles.', 'Never put fingers, forks or other tools into a real toaster. Tell an adult if food is stuck.'),
    lever: note('A lasting mechanism can keep the rest of a toaster useful for more breakfasts.', 'Do not force a stuck lever or try to bypass its movement. Ask an adult to check the problem.'),
    'crumb-tray': note('Suitable crumb care helps the toaster keep working as intended; it is not a measured carbon saving.', 'Only an adult follows the tray-cleaning instructions after unplugging and cooling.'),
  },
  blender: {
    jug: note('An approved replacement jug may keep a working motor base useful instead of replacing every part.', 'Follow the fill and temperature limits. An adult checks how this jug can be washed.'),
    lid: note('Keeping the correct lid and seal can help the blender remain useful.', 'Do not run the blender with a missing or damaged lid. Follow its fitting instructions with an adult.'),
    blades: note('Steel has material value, but sharp pieces need the collection service’s handling advice.', 'Blades remain sharp when still. An adult disconnects power and follows the cleaning guide.'),
    motor: note('Copper and other metals inside a motor are useful resources. Suitable repair depends on the fault and model.', 'Leave the real motor closed. Do not test a faulty blender by repeatedly starting it.'),
    base: note('The mixed electrical base needs an appropriate e-waste route at the end of its useful life.', 'Never immerse the electrical base. An adult follows its external-cleaning instructions.'),
  },
  microwave: {
    body: note('Keeping a suitable appliance useful protects materials already used to make its enclosure and electronics.', 'Never remove a real microwave’s outer cover. Dangerous stored electrical energy may remain after unplugging.'),
    door: note('A durable, working door is essential to the whole oven; a lit display does not prove it is safe.', 'Stop using a damaged door or seal and ask for professional advice. Never alter latches or interlocks.'),
    turntable: note('A manufacturer-approved replacement tray may keep the rest of a suitable microwave useful.', 'An adult follows the tray’s cleaning instructions. Do not use cracked glass or an improvised tray.'),
    control: note('Time and power choices change electricity use. Cooking output watts and electrical input watts differ.', 'Use food and container instructions suitable for this model. Leave the real control panel closed.'),
  },
  vacuum: {
    body: note('A working motor and durable housing may remain useful when a separate hose or filter needs attention.', 'Keep the real housing closed. Unless the model is rated for liquids, do not use it to pick up water.'),
    bin: note('A reusable dust bin serves many cleaning sessions. Emptying as instructed helps preserve the air route.', 'An adult follows the fill line and emptying instructions, with power disconnected as directed.'),
    filter: note('The correct filter and suitable care can help the cleaner do its job without replacing the whole appliance.', 'Only wash a filter if its own guide permits it. Follow all drying instructions before reuse.'),
    hose: note('A compatible replacement hose may keep the useful motor and body in service.', 'Do not pull the machine by its hose or force tools into it. An adult checks damage or blockages as directed.'),
    nozzle: note('A suitable head can help the same cleaner work on different approved surfaces.', 'Keep fingers and hair away from moving brushes. An adult disconnects power before model-approved care.'),
  },
  hairdryer: {
    body: note('A sound case protects useful heating and moving components.', 'Keep it away from baths, basins and other water. An adult stops use if the body is damaged.'),
    motor: note('The motor uses electricity to move air and contains metals suitable for specialist recovery.', 'Explore the digital motor only. Leave the real electrical enclosure closed.'),
    filter: note('A clear inlet supports airflow. This lesson does not assign an invented energy-saving percentage to cleaning.', 'Do not cover the inlet. An adult follows the exact guide for external lint cleaning after unplugging and cooling.'),
    handle: note('Durable controls and a protected lead can keep the same dryer useful.', 'Do not pull the lead or use damaged switches. An adult follows the model’s storage guidance.'),
    nozzle: note('Keeping the correct attachment can avoid replacing a useful dryer for a missing small part.', 'It can stay hot after switch-off. Let an adult follow the fitting and cooling instructions.'),
  },
  laptop: {
    screen: note('Protecting a useful display may avoid replacing a whole computer early.', 'Keep sharp objects away. An adult follows the screen-cleaning guide and checks any cracked surface.'),
    keyboard: note('Care around keys can help keep the computer useful for another learner.', 'Keep drinks away and do not force stuck keys. Follow the maker’s cleaning guidance.'),
    battery: note('Battery materials require resources to make. At end of life an adult finds an accepted device and battery collection route.', 'Leave it enclosed. Stop using a swollen, leaking or damaged battery device and seek manufacturer advice.'),
    body: note('A sturdy case and clear air paths protect the parts already inside. Personal data also needs care before reuse.', 'Use a suitable firm surface with clear vents. An adult backs up and removes personal data before handover.'),
  },
  ricecooker: {
    body: note('A lasting body protects the working parts through many meals.', 'The removable bowl’s washing rules do not apply to the electrical body. Do not immerse it.'),
    lid: note('A working lid and clear steam pathway help the cooker do its intended job.', 'Hot steam can burn. An adult follows opening, cooling and lid-cleaning instructions.'),
    bowl: note('Protecting the coating or finding an approved replacement bowl may keep the whole cooker useful.', 'Use suitable utensils and gentle care for its coating. An adult follows the fill marks and cleaning guide.'),
    control: note('Cooking and keeping warm use electricity in different ways. Avoid treating them as identical power modes.', 'An adult selects a mode using the food and product instructions. Leave internal controls closed.'),
    base: note('This heating surface turns electricity into heat. Its materials stay with the appliance for specialist collection.', 'Do not open the electrical heating section. An adult follows instructions for a clean, dry bowl fitted correctly.'),
  },
  airfryer: {
    body: note('A durable body and clear air openings help protect the useful heating system.', 'Do not block vents or immerse the electrical body. An adult follows the required clearances.'),
    basket: note('A suitable coating and an approved replacement basket may help the appliance remain useful.', 'Let it cool before care. An adult checks permitted tools and whether this basket is dishwasher-safe.'),
    handle: note('An intact handle helps the basket remain usable; a damaged handle needs attention.', 'Do not lift with a loose handle or touch hot food and metal. An adult handles a fault.'),
    control: note('Time, temperature and heater cycling affect use; temperature is not a wattage measurement.', 'Use settings suitable for the food and model. Do not open the real control panel.'),
    heater: note('The heater and fan use electricity to move heat around food. A measured average gives a better estimate than a peak rating.', 'Leave the real heating assembly enclosed. An adult arranges appropriate help for unusual behaviour.'),
  },
  coffeemachine: {
    body: note('Keeping a suitable machine working preserves the resources in its heating, pumping and control parts.', 'Do not open the real enclosure. An adult stops use and seeks advice for an unexpected leak.'),
    tank: note('A reusable tank serves many refills. An approved spare may keep other working parts useful.', 'An adult follows this tank’s fill and cleaning guidance; do not borrow another model’s routine.'),
    spout: note('Suitable outlet care helps the machine deliver drinks as intended.', 'Hot liquid and the outlet can burn. An adult follows cooling and cleaning instructions.'),
    tray: note('A washable reusable tray catches drips without becoming a disposable part after each drink.', 'An adult checks any full marker and follows emptying and cleaning instructions.'),
    control: note('Brew, warm-up and standby modes use different amounts of electricity.', 'Use only the descaling programme and products specified for this model, managed by an adult.'),
  },
  mixer: {
    body: note('A working motor contains useful metals that may remain in service through many recipes.', 'Keep the real motor head closed. An adult disconnects power before care or attachment changes.'),
    bowl: note('A durable bowl can serve for many mixes; a compatible spare may avoid replacing the whole appliance.', 'Check the cleaning method for this bowl’s metal, glass or ceramic surface. Follow capacity limits.'),
    beaters: note('Compatible replacement attachments can sometimes extend the useful life of the mixer.', 'Keep hands, hair and utensils away while moving. An adult unplugs before changing or cleaning tools.'),
    control: note('Motor draw changes with speed and load, so maximum rated power is not a constant measurement.', 'An adult follows the recipe and manual’s speed and running-time limits. Do not force controls.'),
    base: note('A stable support protects the bowl and moving mechanism from unnecessary damage.', 'Use a stable surface as directed. Do not use a mixer with damaged supports or missing feet without suitable advice.'),
  },
};
