/**
 * Twenty additional Explore lessons. These are simplified teaching models, not
 * service diagrams: opening a digital model never asks a family to open the real
 * enclosure. Part IDs are the contract with the registered Explore 3D models.
 *
 * Watts and minutes are editable teaching scenarios, not measured averages or
 * lifecycle footprints. Rechargeable products use wall-charging time; machines
 * that cycle explain why rated watts across a whole day would be misleading.
 * Care sources are examples for the named product family. The exact model's
 * manual always decides which external parts can be cleaned and how.
 */
const part = (id, name, job, material) => ({ id, name, job, material });
const source = (label, url) => ({ label, url });

// Reuse a verified manufacturer reference where the same advice applies to two
// devices; keeping these URLs here makes future content reviews straightforward.
const APPLE_CARE = source('Example phone and tablet care · Apple', 'https://support.apple.com/en-au/103258');
const ENERGY_SAFETY = source('Electrical appliance safety · Energy Safe Victoria', 'https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely');

export const EXPANDED_CATALOGUE = [
  {
    id: 'refrigerator', name: 'Refrigerator', category: 'Refrigerator', room: 'Kitchen', colour: '#7dabb0', watts: 40, minutes: 1440,
    question: 'Why does a fridge door need a good seal?',
    summary: 'Follow heat out of the fridge, while food stays cool inside.',
    parts: [
      part('cabinet', 'Insulated cabinet', 'Slows heat moving into the cold space. A fridge moves heat out; it does not make cold from nothing.', 'Metal and plastic surround insulation. Specialist recycling handles this mix.'),
      part('door', 'Door', 'Closes the cold space. Leaving it open lets warmer room air enter.', 'Usually an insulated metal-and-plastic panel.'),
      part('shelves', 'Shelves', 'Support food so your family can organise and find it.', 'Glass, plastic or metal; designs and weight limits differ.'),
      part('compressor', 'Compressor', 'Moves refrigerant around a sealed cooling system to help carry heat away.', 'A motor, metal tubing and refrigerant. Leave the real system sealed.'),
      part('seal', 'Door seal', 'The soft strip helps stop warm air slipping through the closed door.', 'Flexible material needs gentle, model-specific care.'),
      part('control', 'Temperature control', 'Helps the fridge keep its set temperature. The cooling system runs as needed.', 'Sensors and electronic or mechanical controls vary by model.'),
    ],
    care: [
      ['Close the door fully', 'Choose what you need, then close the door. Tell an adult if food or a damaged seal stops it closing.'],
      ['Keep the seal clean', 'An adult follows the manual to wipe the seal and inside surfaces. Avoid sharp tools and harsh cleaners.'],
      ['Leave cooling parts alone', 'Do not open the cabinet, bend pipes or reach behind it. A cooling fault needs suitable professional help.'],
    ],
    careSource: source('Example refrigerator cleaning guide · Samsung', 'https://www.samsung.com/ae/support/home-appliances/how-to-properly-clean-your-samsung-refrigerator/'),
    challenge: { question: 'Food is inside the fridge. Which energy habit makes sense?', choices: ['Turn the fridge off overnight', 'Keep it running and close its door properly'], correct: 1, explanation: 'Food needs cold storage. Careful door use helps; switching off a fridge with food inside is not an energy game.' },
    energyTip: 'This uses an invented 40 W average over 24 hours, not the compressor rating. For a better example, divide your model’s annual label kWh by 8.76 to get average watts, then use 1,440 minutes. Actual use and room conditions differ.',
  },
  {
    id: 'food_processor', name: 'Food processor', category: 'Food processor', room: 'Kitchen', colour: '#91b5b2', watts: 600, minutes: 3,
    question: 'Why use a food pusher instead of fingers?',
    summary: 'Discover a motor, a bowl and the difference between useful and dangerous openings.',
    parts: [
      part('base', 'Motor base', 'Holds the motor that turns the blade or attachment.', 'Plastic, metal and wiring stay inside the closed base.'),
      part('bowl', 'Work bowl', 'Holds the ingredients while they are chopped or mixed.', 'Often clear plastic; fill limits and cleaning rules vary.'),
      part('lid', 'Lid', 'Keeps ingredients inside. Many machines require it to be fitted before starting.', 'Plastic with model-specific catches or safety interlocks.'),
      part('blade', 'Cutting blade', 'Slices or chops as it turns. The edges remain sharp when still.', 'Steel cutting edges need careful adult handling.'),
      part('pusher', 'Food pusher', 'Guides food down the feed tube while keeping fingers out.', 'Usually a shaped plastic tool made for that machine.'),
      part('control', 'Speed controls', 'Choose a speed or short pulse for different ingredients.', 'Buttons or dials connect to internal controls.'),
    ],
    care: [
      ['Keep fingers out', 'An adult uses the supplied pusher and follows the lid and bowl instructions. Never reach into the feed opening.'],
      ['Disconnect before care', 'An adult switches off and unplugs before cleaning or changing attachments. Still blades can cut.'],
      ['Different parts, different care', 'Check which bowl and lid parts may be washed. The motor base must not go into water.'],
    ],
    careSource: source('Example food processor care · KitchenAid', 'https://producthelp.kitchenaid.com/Countertop_Appliances/Food_Processors_and_Choppers/Food_Processor/9_Cup/Cleaning_and_Care/Cleaning_the_Base_and_Attachments_-_Food_Processor'),
    challenge: { question: 'A piece of food will not go down. What should a child do?', choices: ['Stop and ask an adult to use the proper pusher', 'Push it with a finger'], correct: 0, explanation: 'The pusher has a job: helping keep hands away from the blade. Never put fingers into that opening.' },
    energyTip: 'This example counts three minutes of active processing. Motor draw changes with speed and food; it is not the energy used by every recipe.',
  },
  {
    id: 'sandwich_press', name: 'Sandwich press', category: 'Sandwich press', room: 'Kitchen', colour: '#cfaa79', watts: 1500, minutes: 8,
    question: 'Is a switched-off cooking plate already cool?',
    summary: 'Explore two heated plates and why waiting can be part of good care.',
    parts: [
      part('body', 'Outer body', 'Supports the cooking plates and encloses the electrical parts.', 'Metal and heat-resistant plastic surround wiring.'),
      part('plates', 'Cooking plates', 'Transfer heat into the sandwich from above and below.', 'Often coated metal. The coating can be damaged by scratching.'),
      part('hinge', 'Hinge', 'Lets the top plate move up and down. Keep fingers away from the closing gap.', 'Usually metal with model-specific height adjustments.'),
      part('handle', 'Handle', 'Gives an adult a place to lift the upper plate.', 'Often heat-resistant plastic; nearby surfaces can still burn.'),
      part('control', 'Heat control', 'Controls or shows heating. A light going out does not prove the plates are cool.', 'A thermostat, indicator or dial varies between models.'),
    ],
    care: [
      ['Cool before cleaning', 'An adult switches off, unplugs and lets the press cool before following its care instructions.'],
      ['Protect the plates', 'Use only utensils and cleaning tools suitable for the coating. Do not scrape it with sharp metal.'],
      ['Keep electricity dry', 'Do not immerse the press or lead in water. An adult checks the model’s instructions for wiping surfaces.'],
    ],
    careSource: source('Example sandwich press manual · Breville', 'https://www.breville.com/content/dam/breville/us/assets/miscellaneous/instruction-manual/grills-sandwich-makers/BSG600-instruction-manual.pdf'),
    challenge: { question: 'The plug is out. Can you touch the plates straight away?', choices: ['Yes, electricity is the only thing that makes them hot', 'No, stored heat takes time to leave'], correct: 1, explanation: 'Hot metal stays hot after power is removed. Give it time to cool and let an adult handle care.' },
    energyTip: 'The heater may switch on and off. This constant-power example can overestimate a whole cooking session; use measured average power if available.',
  },
  {
    id: 'portable_heater', name: 'Portable heater', category: 'Portable heater', room: 'Living', colour: '#ce987d', watts: 1500, minutes: 60,
    question: 'Why must a heater have clear space around it?',
    summary: 'See electrical energy become heat, and spot where cloth does not belong.',
    parts: [
      part('body', 'Heater body', 'Holds the heating parts and directs warm air into the room.', 'Heat-resistant plastic or metal; surfaces may become hot.'),
      part('heater', 'Heating element', 'Changes electrical energy into heat. This is a digital inside view only.', 'Metal or ceramic heating parts belong inside the real enclosure.'),
      part('grille', 'Protective grille', 'Allows air through while forming a barrier around hot parts.', 'Usually metal or heat-resistant plastic. Do not cover it.'),
      part('control', 'Heat controls', 'Choose heat settings. Some heaters have a thermostat that cycles the heat.', 'Switches, sensors and controls differ by model.'),
      part('base', 'Base', 'Keeps the heater upright on the surface specified by its manual.', 'A stable support; safety switches are not permission for unsafe placement.'),
    ],
    care: [
      ['Keep clothes away', 'Never cover the heater or use it to dry clothing. Follow the manual’s clearances from furniture and curtains.'],
      ['Choose a dry, safe place', 'An adult chooses a stable location away from water and where people cannot trip over the lead.'],
      ['Pause before care', 'An adult switches off, unplugs and lets it cool before external cleaning. Leave the enclosure closed.'],
    ],
    careSource: ENERGY_SAFETY,
    challenge: { question: 'A wet jumper needs drying. Is the heater a good place to hang it?', choices: ['No, keep the heater clear', 'Yes, cover it to catch all the warmth'], correct: 0, explanation: 'Cloth can block airflow and get dangerously hot. A heater needs space, not a coat.' },
    energyTip: 'Try comparing 30 and 60 minutes at the same example power. Thermostats cycle, so rated power is not always the measured average.',
  },
  {
    id: 'portable_ac', name: 'Portable air conditioner', category: 'Portable air conditioner', room: 'Living', colour: '#8eb7c5', watts: 1000, minutes: 120,
    question: 'Where does the room’s heat go?',
    summary: 'Follow air and heat through a portable cooling system.',
    parts: [
      part('body', 'Outer case', 'Holds the cooling system. Vents need clear space for air to move.', 'Plastic panels enclose metal parts and electronics.'),
      part('filter', 'Air filter', 'Catches dust from air entering the machine.', 'Mesh or other filter material; cleaning rules vary.'),
      part('fan', 'Fan', 'Moves air through the cooling sections and back into the room.', 'Motor and blades stay behind protective panels.'),
      part('compressor', 'Compressor', 'Moves refrigerant through a sealed system that carries heat away.', 'Metal machinery and refrigerant require specialist handling.'),
      part('hose', 'Exhaust hose', 'In this single-hose example, carries warm exhaust air outside.', 'A flexible hose must be fitted as its manufacturer directs.'),
      part('control', 'Temperature controls', 'Tell the machine the cooling setting you want.', 'Buttons, sensors and electronics control different operating modes.'),
    ],
    care: [
      ['Keep air paths clear', 'Do not cover vents or crush the exhaust hose. An adult follows the installation and clearance instructions.'],
      ['Check the filter guide', 'An adult disconnects power and follows the exact filter-cleaning and drying instructions. Not every filter is washable.'],
      ['Keep cooling parts sealed', 'Do not open the case or alter refrigerant pipes. A fault needs appropriate service advice.'],
    ],
    careSource: source('Example portable air conditioner checks · De’Longhi', 'https://www.delonghi.com/en-us/faqs/Portable-air-conditioner/a/82395'),
    challenge: { question: 'The exhaust hose is bent shut. What is the useful response?', choices: ['Ignore it because the screen still lights up', 'Tell an adult so the setup can be checked'], correct: 1, explanation: 'The hose is part of the heat pathway. A working display does not mean that pathway is clear.' },
    energyTip: 'Use electrical input power, not the larger cooling-capacity number. Compressor cycling, weather and room size change real electricity use.',
  },
  {
    id: 'dehumidifier', name: 'Dehumidifier', category: 'Dehumidifier', room: 'Living', colour: '#98b7b2', watts: 250, minutes: 240,
    question: 'How can water from the air end up in a tank?',
    summary: 'Meet a compressor-style machine that collects moisture from room air.',
    parts: [
      part('body', 'Outer body', 'Holds the air pathway and protects the internal parts.', 'Plastic and metal surround a cooling system and electronics.'),
      part('filter', 'Air filter', 'Catches dust before air moves through the machine.', 'A filter’s care instructions depend on its material and model.'),
      part('coils', 'Cooling coils', 'In this example, cool air so some water vapour forms liquid drops.', 'Metal tubing is part of a sealed system. Other dehumidifier types work differently.'),
      part('fan', 'Air fan', 'Moves room air across the coils and out again.', 'A motor turns blades inside the protective case.'),
      part('tank', 'Water tank', 'Collects water removed from the air. A full-tank control can stop collection.', 'Usually plastic; collected water is not drinking water.'),
      part('control', 'Humidity controls', 'Set or show how much moisture is in the air.', 'Sensors and controls vary; a number is not a diagnosis of a building problem.'),
    ],
    care: [
      ['Leave space for airflow', 'Keep the air inlet and outlet clear. Follow the model’s placement instructions.'],
      ['Care for tank and filter', 'An adult unplugs and follows the manual for emptying, cleaning and drying user-accessible parts.'],
      ['Investigate damp with help', 'Tell an adult about ongoing damp or leaks. A dehumidifier does not repair their cause.'],
    ],
    careSource: source('Example filter and collection guidance · De’Longhi', 'https://www.delonghi.com/en-us/faqs/The-dehumidifier-tank-doesn%26apos%3Bt-collect-water.-Why-is-this/a/17462'),
    challenge: { question: 'The machine collects water, but the roof still leaks. Has the leak been fixed?', choices: ['No, the cause still needs attention', 'Yes, the tank has solved it'], correct: 0, explanation: 'Collecting moisture and fixing its source are different jobs. Tell an adult about the leak.' },
    energyTip: 'Humidity, temperature and compressor cycling affect use. This example is four hours at constant power, not a measured daily average or a promise to solve damp.',
  },
  {
    id: 'steam_cleaner', name: 'Steam cleaner', category: 'Steam cleaner', room: 'Bathroom', colour: '#d0af61', watts: 1500, minutes: 15,
    question: 'Can steam still be hot after the power is off?',
    summary: 'Discover water, heat and why pressure changes the care routine.',
    parts: [
      part('body', 'Outer body', 'Supports the tank and heating system. Keep the real enclosure closed.', 'Heat-resistant plastic surrounds metal parts and wiring.'),
      part('tank', 'Water tank', 'Holds water for making steam. Refill designs and safe procedures differ.', 'A container or boiler must only be handled as the manual directs.'),
      part('heater', 'Heating system', 'Turns electrical energy into heat to make steam.', 'Metal heating parts may stay hot after switch-off.'),
      part('hose', 'Steam hose', 'Carries steam from the machine towards the cleaning attachment.', 'Heat-resistant material must not be damaged or altered.'),
      part('nozzle', 'Cleaning nozzle', 'Directs steam towards a suitable surface. Never point it at people or pets.', 'A model-specific attachment; hot steam can scald.'),
      part('control', 'Steam controls', 'Start or limit steam flow. A safety lock may respond to pressure.', 'Switches and locks are not toys or proof that the machine is cool.'),
    ],
    care: [
      ['Let an adult manage steam', 'Keep away from the nozzle and hot surfaces. Do not test steam with your hand.'],
      ['Do not force a cap', 'Switch-off does not remove all heat or pressure. An adult follows the exact cooling and refilling instructions.'],
      ['Use the right care routine', 'Water type, descaling and cloth care differ by model. Do not copy another machine’s chemical amounts or steps.'],
    ],
    careSource: source('Example steam cleaner guidance · Kärcher Australia', 'https://www.kaercher.com/au/services/home-garden-support/home-garden-product-faqs/faq-steam-cleaner.html'),
    challenge: { question: 'The cap will not open after switching off. What next?', choices: ['Pull harder until it opens', 'Leave it alone and ask an adult to check the manual'], correct: 1, explanation: 'Heat or pressure may remain. A locked cap is a reason to stop, not a puzzle to force open.' },
    energyTip: 'Warm-up and steam delivery are different stages. This example counts 15 minutes at constant input power; a real heater may cycle.',
  },
  {
    id: 'washing_machine', name: 'Washing machine', category: 'Washing machine', room: 'Bathroom', colour: '#8bafd0', watts: 500, minutes: 60,
    question: 'Why check pockets before starting a wash?',
    summary: 'Follow clothes, water and movement through a familiar laundry machine.',
    parts: [
      part('cabinet', 'Cabinet', 'Supports the machine and keeps moving and electrical parts enclosed.', 'A metal structure with plastic and electronic parts.'),
      part('drum', 'Clothes drum', 'Turns the clothes during washing and spins to remove some water.', 'Often stainless steel; holes let water move through.'),
      part('door', 'Door and seal', 'Closes the clothes opening. The lock helps keep it shut during unsafe stages.', 'Glass, plastic and a flexible seal in this front-loading example.'),
      part('drawer', 'Detergent drawer', 'Feeds the correct washing products into the selected cycle.', 'Usually plastic; compartments and amounts vary.'),
      part('motor', 'Drive motor', 'Turns electrical energy into drum movement.', 'Metal and wiring stay inside the real machine.'),
      part('control', 'Programme controls', 'Choose a wash suited to the fabric and load.', 'Sensors and electronics coordinate water, movement and sometimes heat.'),
    ],
    care: [
      ['Check the pockets', 'Help an adult look for coins, tissues and small objects before clothes go in. Follow the loading limit.'],
      ['Use the right amount', 'An adult matches detergent and cycle to the manual and clothing labels. More detergent is not always better.'],
      ['Follow the cleaning programme', 'An adult checks the exact door, drawer and drum-care instructions. Leave internal panels closed and do not force a locked door.'],
    ],
    careSource: source('Example washing machine care · Samsung Australia', 'https://www.samsung.com/au/support/home-appliances/clean-door-and-drum/'),
    challenge: { question: 'You find coins in a pocket before the wash. What should happen?', choices: ['Leave them in for a free clean', 'Take them out before the clothes go in'], correct: 1, explanation: 'Loose hard objects can damage the machine or clothes. A pocket check is a small useful care habit.' },
    energyTip: 'This uses an invented 500 W average for one 60-minute daily wash. Heating and spinning draw different power. Use measured kWh per cycle or a matching energy-label programme for a better estimate; this excludes water impacts.',
  },
  {
    id: 'clothes_dryer', name: 'Clothes dryer', category: 'Clothes dryer', room: 'Bathroom', colour: '#a4bad0', watts: 1000, minutes: 60,
    question: 'Why is a small lint filter a big deal?',
    summary: 'Discover how air, heat and a turning drum help clothes dry.',
    parts: [
      part('cabinet', 'Cabinet', 'Supports the dryer and encloses its working parts.', 'Metal and plastic surround wiring and the air system.'),
      part('drum', 'Turning drum', 'Lifts and moves clothes so air can reach different areas.', 'A metal cylinder with internal lifters.'),
      part('door', 'Door', 'Keeps clothes inside during drying.', 'Glass or plastic with a seal and latch.'),
      part('filter', 'Lint filter', 'Catches loose fibres. A blocked filter can restrict airflow.', 'Fine mesh needs the model’s cleaning routine.'),
      part('airflow', 'Air and heat system', 'Moves moisture away from clothes. Vented, condenser and heat-pump dryers work differently.', 'Fans, heaters or a sealed heat-pump system depend on the model.'),
      part('control', 'Drying controls', 'Choose a programme and may sense when clothes are dry.', 'Dials, sensors and electronics coordinate the cycle.'),
    ],
    care: [
      ['Remember the lint filter', 'An adult cleans the filter after each use, following the manual. Put it back correctly before the next load.'],
      ['Keep the air route clear', 'Do not block vents. An adult checks the installation and model-specific condenser or hose care.'],
      ['Check what may be dried', 'Follow clothing labels, load limits and the manual. Some fabrics and contaminated items are unsuitable for a dryer.'],
    ],
    careSource: ENERGY_SAFETY,
    challenge: { question: 'The lint filter is full. What is the useful next step?', choices: ['Ask an adult to clean it as the manual says', 'Run another load and hope it clears itself'], correct: 0, explanation: 'Air needs a clear route. Filter care supports drying and safety; more running time is not a fix.' },
    energyTip: 'The 1,000 W average and 60 minutes are a made-up cycle. Heat-pump and other dryer types differ greatly. Compare measured kWh per load; drying on a line when suitable avoids the dryer’s electricity for that load.',
  },
  {
    id: 'sewing_machine', name: 'Sewing machine', category: 'Sewing machine', room: 'Study', colour: '#b9a9cd', watts: 60, minutes: 20,
    question: 'Could a few stitches give clothing another life?',
    summary: 'See how two threads and a moving needle can join fabric.',
    parts: [
      part('body', 'Machine body', 'Supports the sewing mechanism and encloses its drive parts.', 'Plastic and metal surround a motor and moving links.'),
      part('needle', 'Needle', 'Carries the top thread through the fabric. Its sharp point needs care.', 'A small steel tool; an adult handles fitting and replacement.'),
      part('bobbin', 'Bobbin', 'Holds a lower thread that joins with the upper thread in this lockstitch example.', 'A small spool, usually plastic or metal, matched to the machine.'),
      part('spool', 'Top thread spool', 'Supplies the upper thread through the threading path.', 'Thread is wound around a plastic, card or other spool.'),
      part('handwheel', 'Handwheel', 'Moves the mechanism by hand when used as the manual directs.', 'A wheel connects to internal moving parts.'),
      part('control', 'Stitch and speed controls', 'Choose the stitch or speed. A foot control may start the motor.', 'Dials, electronics or a pedal vary between machines.'),
    ],
    care: [
      ['Learn with supervision', 'Keep fingers away from the needle and moving parts. An adult teaches use of the specific machine.'],
      ['Disconnect before care', 'An adult switches off and unplugs before cleaning or changing the needle. Do not press the pedal during care.'],
      ['Follow the lint routine', 'An adult follows the model’s cleaning guide for thread fluff. Do not add oil unless that guide calls for it.'],
    ],
    careSource: source('Example sewing machine care · Brother', 'https://support.brother.com/g/b/sp/faqend.aspx?c=au&faqid=faqh00000095_004&lang=en&prod=hf_xl21202220eas'),
    challenge: { question: 'A shirt has a small loose seam. Which idea is worth asking about?', choices: ['It must go in the bin straight away', 'Ask whether a suitable repair could keep it useful'], correct: 1, explanation: 'Some clothing can be repaired. An adult can help decide whether stitching suits this fabric and damage.' },
    energyTip: 'Count motor-running time rather than the whole time spent planning a project. This estimates electricity only; it does not calculate a garment’s footprint or a guaranteed repair saving.',
  },
  {
    id: 'smartphone', name: 'Smartphone', category: 'Smartphone', room: 'Study', colour: '#93a8c4', watts: 10, minutes: 60,
    question: 'What should happen before a phone gets a new owner?',
    summary: 'Discover a pocket computer, its stored energy and the value of a second life.',
    parts: [
      part('screen', 'Touchscreen', 'Shows pictures and senses your touches.', 'Glass and electronic layers need specialist recycling.'),
      part('case', 'Protective body', 'Holds and protects the tightly packed parts.', 'Metal, glass or plastic vary by design.'),
      part('battery', 'Rechargeable battery', 'Stores energy between charges. Never open, bend or puncture a real battery.', 'Usually a lithium-ion battery; damaged batteries need specialist advice.'),
      part('board', 'Circuit board', 'Connects chips that process information and communicate.', 'A board carries tiny metal connections and electronic components.'),
      part('camera', 'Camera module', 'Uses a lens and sensor to turn light into an image.', 'Glass or plastic optics sit with electronic parts.'),
      part('port', 'Charging connection', 'Connects charging equipment. Some phones can also charge wirelessly.', 'Small metal contacts need to stay free of liquid and damage.'),
    ],
    care: [
      ['Clean gently', 'Disconnect accessories and follow the maker’s screen-cleaning guide. Do not spray liquid into openings.'],
      ['Notice battery changes', 'If the body bulges or the battery appears damaged, stop using it and tell an adult. Do not press it flat or open it.'],
      ['Prepare a private handover', 'Before reuse or recycling, an adult backs up data and follows the maker’s account-removal and reset instructions.'],
    ],
    careSource: APPLE_CARE,
    challenge: { question: 'A working phone is being passed on. What matters besides cleaning it?', choices: ['An adult protecting and removing personal information', 'Leaving every account signed in'], correct: 0, explanation: 'A useful second life should not share your family’s private messages, photos or accounts.' },
    energyTip: 'This is one imaginary hour of wall charging at an average 10 W, not one hour of phone use. A charger’s maximum rating is not constant draw. Making the phone is outside this calculation.',
  },
  {
    id: 'tablet', name: 'Tablet', category: 'Tablet', room: 'Study', colour: '#a99ac7', watts: 15, minutes: 60,
    question: 'Can the same tablet help more than one person?',
    summary: 'Look behind a large touch screen without opening a real device.',
    parts: [
      part('screen', 'Touchscreen', 'Shows your work, games and stories, and detects touches.', 'Glass and fine electronic layers make up the display.'),
      part('case', 'Outer body', 'Supports the screen and protects the inside parts.', 'Often metal or plastic with glass at the front.'),
      part('battery', 'Rechargeable battery', 'Stores energy for use away from a socket.', 'A sealed battery must not be bent, punctured or opened.'),
      part('board', 'Circuit board', 'Connects the processor, storage and other electronic parts.', 'Tiny components and metals need an appropriate e-waste route.'),
      part('speaker', 'Speakers', 'Turn electrical signals into the sound you hear.', 'Small magnets, coils and moving surfaces create sound.'),
      part('port', 'Charging port', 'Connects a compatible charging cable or accessory.', 'Small contacts can be harmed by liquid, dirt or forcing a plug.'),
    ],
    care: [
      ['Protect the screen', 'Use a suitable case and follow the manufacturer’s cleaning guide. Keep drinks away from the device and charger.'],
      ['Use matching charging gear', 'An adult checks that cables and chargers are compatible and undamaged. Stop using swollen or damaged equipment.'],
      ['Plan its next user', 'An adult can check whether it still meets someone’s needs, then protect data before a handover.'],
    ],
    careSource: APPLE_CARE,
    challenge: { question: 'The tablet still works, but you want a newer one. Which question is useful?', choices: ['Can it still meet our needs or help another person?', 'Can we put it in ordinary rubbish today?'], correct: 0, explanation: 'A device may still be useful. Checking its condition and needs can reveal options before replacement or recycling.' },
    energyTip: 'This example is 60 minutes of charging at an invented 15 W wall average. Playing time and charging time are different; manufacturing and mobile-network impacts are excluded.',
  },
  {
    id: 'television', name: 'Television', category: 'Television', room: 'Living', colour: '#8fabc1', watts: 80, minutes: 120,
    question: 'Does an empty room need the television on?',
    summary: 'Follow a signal into a picture, sound and an everyday energy choice.',
    parts: [
      part('screen', 'Display panel', 'Turns electrical signals into moving pictures.', 'Thin glass and electronic layers differ between LCD and OLED screens.'),
      part('frame', 'Frame and back', 'Supports the screen and keeps the electronic parts enclosed.', 'Plastic and metal surround delicate layers and circuits.'),
      part('board', 'Signal board', 'Processes incoming pictures, sound and controls.', 'A circuit board carries chips and metal connections.'),
      part('power', 'Power supply', 'Changes incoming electricity into supplies the internal parts can use.', 'Internal electrical components stay enclosed, even when unplugged.'),
      part('speakers', 'Speakers', 'Turn audio signals into moving air that we hear.', 'Magnets, coils and thin moving surfaces make sound.'),
      part('stand', 'Stand', 'Supports the television in the correct setup for its model.', 'Metal or plastic supports need proper installation and stability.'),
    ],
    care: [
      ['Be gentle with the screen', 'An adult turns off and unplugs before cleaning as directed. Use the recommended cloth, without hard pressure or direct spray.'],
      ['Give it a stable home', 'An adult follows the installation and anti-tip instructions. Do not climb furniture or pull the screen.'],
      ['Leave room for air', 'Keep vents clear and the real back cover closed. Faults need suitable service advice.'],
    ],
    careSource: source('Example TV care · Sony', 'https://www.sony.com/electronics/support/televisions-projectors-lcd-tvs/articles/00167099'),
    challenge: { question: 'Nobody is watching. What is a useful choice?', choices: ['Leave the TV playing to an empty sofa', 'Ask to switch it off when it is no longer needed'], correct: 1, explanation: 'A screen uses electricity while showing pictures. An empty sofa does not need a programme.' },
    energyTip: 'Screen size, brightness and content change power. This example covers active watching only; standby, networking and streaming infrastructure are not included.',
  },
  {
    id: 'headphones', name: 'Headphones', category: 'Headphones', room: 'Study', colour: '#b3a1c7', watts: 3, minutes: 30,
    question: 'Why protect the soft cushions as well as the electronics?',
    summary: 'Explore a wireless pair: tiny movements make the sounds you hear.',
    parts: [
      part('headband', 'Headband', 'Holds the two ear cups in place.', 'Plastic or metal may support a padded covering.'),
      part('cushions', 'Ear cushions', 'Make the contact around your ears softer and help shape the sound.', 'Foam with fabric or another covering; cleaning rules differ.'),
      part('drivers', 'Sound drivers', 'Move very quickly to make sound waves.', 'Magnets, coils and thin moving surfaces work together.'),
      part('controls', 'Listening controls', 'Change volume or playback on this wireless example.', 'Buttons and electronic circuits send instructions.'),
      part('battery', 'Rechargeable battery', 'Stores energy for wireless listening. Passive wired headphones may have no battery.', 'A sealed battery needs specialist handling at end of life.'),
    ],
    care: [
      ['Let them dry', 'Follow the model’s guide for sweat and surface cleaning. Do not soak headphones or charge them while damp.'],
      ['Store without squashing', 'Use a suitable case or safe place. Avoid crushing the cups, stretching hinges or pulling cables.'],
      ['Check repair options', 'An adult can ask whether worn cushions or cables have approved replacements before replacing the whole pair.'],
    ],
    careSource: source('Example wireless headphone care · Sony', 'https://www.sony.com/electronics/support/articles/00354941'),
    challenge: { question: 'The sound works, but a cushion is worn. Which question could help?', choices: ['Is there an approved replacement cushion for this model?', 'Must every part be thrown away?'], correct: 0, explanation: 'One worn part does not always end the whole product’s life. An adult can check what the maker supports.' },
    energyTip: 'This example counts 30 minutes of charging at 3 W average input. It does not count listening time directly. Wired passive headphones use energy through the connected device instead.',
  },
  {
    id: 'games_console', name: 'Games console', category: 'Games console', room: 'Study', colour: '#819aac', watts: 150, minutes: 60,
    question: 'What helps a busy console lose extra heat?',
    summary: 'Meet the computer behind a game and find its important air pathway.',
    parts: [
      part('case', 'Console case', 'Protects the electronics and guides air through vents.', 'Plastic and metal surround the internal components.'),
      part('board', 'Main board', 'Connects chips that run the game and produce its pictures.', 'Many small components and metal pathways share a circuit board.'),
      part('fan', 'Cooling fan', 'Moves air to help carry heat away from working parts.', 'A motor and blades stay behind protective surfaces.'),
      part('storage', 'Game storage', 'Keeps installed games and saved information.', 'Electronic storage, or a drive in some models, needs data care before reuse.'),
      part('ports', 'Connection ports', 'Connect the display, power and supported accessories.', 'Different sockets have different jobs; plugs should not be forced.'),
      part('controller', 'Controller', 'Turns button presses and movements into game commands.', 'Plastic, electronics and sometimes a battery form a separate device.'),
    ],
    care: [
      ['Let air move', 'Keep the console’s vents clear and follow its clearance guide. A blanket or tight cupboard can block cooling.'],
      ['Use its shutdown steps', 'Save your game and follow the console’s power-off instructions before moving or disconnecting it.'],
      ['Care before passing it on', 'An adult follows external-cleaning, account-removal and reset guidance. Do not open the real power supply or cooling assembly.'],
    ],
    careSource: source('Example console ventilation guidance · PlayStation', 'https://www.playstation.com/en-us/support/hardware/ps5-console-noise/'),
    challenge: { question: 'A blanket covers the console’s vents. What is the useful response?', choices: ['Leave it there to keep the game warm', 'Tell an adult and keep the vents clear'], correct: 1, explanation: 'The game’s computer produces heat. Airflow helps carry it away; a blanket blocks that route.' },
    energyTip: 'Gameplay, menus, downloads and rest mode use different amounts. This example is one hour of active play and excludes the TV, controller charging and network services.',
  },
  {
    id: 'printer', name: 'Printer', category: 'Printer', room: 'Study', colour: '#a1b0b7', watts: 30, minutes: 10,
    question: 'What could you check before printing another copy?',
    summary: 'Follow a sheet through an inkjet-style printer and notice two kinds of resources.',
    parts: [
      part('body', 'Printer body', 'Supports the paper path and protects the moving and electronic parts.', 'Plastic, metal and electronics need a suitable e-waste route.'),
      part('paper', 'Paper tray', 'Holds sheets ready to enter the printer.', 'Usually plastic guides; paper size and limits matter.'),
      part('rollers', 'Paper rollers', 'Grip and move a sheet through the printing path.', 'Rubber-like surfaces on shafts can collect paper dust.'),
      part('cartridge', 'Ink cartridge', 'Supplies ink to make marks in this inkjet example. Laser printers use toner instead.', 'Plastic and ink or toner need the appropriate collection route.'),
      part('control', 'Print controls', 'Send or manage the print job and show messages.', 'Buttons, a screen and electronics vary by model.'),
    ],
    care: [
      ['Check the preview first', 'Look at the pages and number of copies before printing. Double-sided printing is useful when the job and printer allow it.'],
      ['Use suitable paper', 'An adult follows the paper size, type and loading guide. Do not force a jammed sheet or reach into moving parts.'],
      ['Choose model-specific care', 'Follow the maker’s exterior-cleaning and cartridge instructions. Ask about supported cartridge collection instead of putting it anywhere.'],
    ],
    careSource: source('Example printer exterior care · HP', 'https://support.hp.com/us-en/document/c02474857'),
    challenge: { question: 'You only need page 2. What should you check before pressing Print?', choices: ['Set the needed page and check the preview', 'Print every page three times just in case'], correct: 0, explanation: 'A quick preview can avoid unwanted pages and ink use. Electricity is only one resource involved.' },
    energyTip: 'This example uses an inkjet-style active draw. Laser printers may have high heating peaks. Paper, cartridges, standby and their production footprints are excluded; do not read this as the impact of a printed page.',
  },
  {
    id: 'straightener', name: 'Hair straightener', category: 'Straightener', room: 'Bathroom', colour: '#c291a4', watts: 50, minutes: 15,
    question: 'Why does a cooling styling tool still need a safe place?',
    summary: 'Discover heated plates and a simple habit that prevents damage.',
    parts: [
      part('arms', 'Outer arms', 'Support the plates and form the handle areas.', 'Heat-resistant plastic surrounds electrical parts.'),
      part('plates', 'Heated plates', 'Transfer heat to hair while an adult uses the tool.', 'Metal with model-specific coatings; hot plates can burn.'),
      part('hinge', 'Hinge', 'Lets the two arms open and close.', 'A small joint can pinch; do not force it.'),
      part('control', 'Heat controls', 'Switch or set the heat. Indicators do not make a hot plate safe to touch.', 'Sensors and switches vary across models.'),
      part('lead', 'Power lead', 'Carries electricity to this corded example.', 'Insulated wiring needs to stay undamaged and away from hot plates.'),
    ],
    care: [
      ['Cool in a suitable place', 'An adult switches off and unplugs after use, then lets it cool as its manual directs, away from children and flammable items.'],
      ['Clean only when cool', 'An adult follows the plate-cleaning instructions after complete cooling. Do not immerse the tool.'],
      ['Protect the cable', 'Avoid tight wrapping and pulling the lead. Stop using a damaged cable and seek appropriate advice.'],
    ],
    careSource: source('Example styling tool care · ghd', 'https://www.ghdhair.com/hairstyles/straight/spring-clean-your-beauty-tools'),
    challenge: { question: 'The straightener is unplugged but still hot. Where should it go?', choices: ['Into a pile of towels', 'A suitable heat-resistant place chosen by an adult'], correct: 1, explanation: 'Heat remains after unplugging. The cooling place matters for people, surfaces and fabrics.' },
    energyTip: 'Heating power changes as the tool warms and controls its temperature. This example uses 50 W average; avoid treating a maximum rating as continuous use.',
  },
  {
    id: 'shaver', name: 'Electric shaver', category: 'Shaver', room: 'Bathroom', colour: '#819ea9', watts: 5, minutes: 20,
    question: 'Does one washable shaver mean every shaver can get wet?',
    summary: 'Explore a small motor and why a model’s cleaning symbols matter.',
    parts: [
      part('body', 'Shaver body', 'Holds the motor, controls and battery in this cordless example.', 'Plastic and seals vary; not every model is washable.'),
      part('head', 'Shaving head', 'Guides hair towards moving cutters behind the protective surface.', 'Fine metal foils or guards cover sharp cutting parts.'),
      part('motor', 'Motor', 'Moves the cutters to trim hair.', 'A small motor contains metal and electrical wiring.'),
      part('battery', 'Battery', 'Stores energy between charges.', 'A sealed rechargeable cell needs specialist care, not home opening.'),
      part('control', 'Power control', 'Starts or stops the motor and may show charging status.', 'Buttons, lights and electronic connections vary by model.'),
    ],
    care: [
      ['Read the wash symbol', 'An adult checks the exact model’s guide before using water. A washable head does not mean the charger is washable.'],
      ['Protect the cutting surface', 'Follow the head-cleaning and drying instructions. Do not press on thin foils or put fingers near cutters.'],
      ['Use the proper charger', 'Keep charging equipment dry and undamaged. An adult seeks advice for unusual heat, swelling or damage.'],
    ],
    careSource: source('Example shaver care · Philips', 'https://www.philips.co.uk/c-f/XC000004469/how-do-i-clean-my-philips-shaver'),
    challenge: { question: 'A friend rinses their shaver. Can your family copy that automatically?', choices: ['No, first check the guide for this exact model', 'Yes, every electrical shaver is waterproof'], correct: 0, explanation: 'Products that look similar can have different water-protection rules. The model’s instructions decide.' },
    energyTip: 'This example is 20 minutes of wall charging at an invented 5 W average. It is not the electricity used by 20 minutes of shaving; charge losses and charging patterns vary.',
  },
  {
    id: 'electric_toothbrush', name: 'Electric toothbrush', category: 'Electric toothbrush', room: 'Bathroom', colour: '#8dbac2', watts: 1, minutes: 120,
    question: 'Which part is made to be replaced more often?',
    summary: 'Meet a moving brush head and a handle designed for repeated use.',
    parts: [
      part('handle', 'Handle', 'Holds the motor and power system while you brush.', 'Plastic and seals protect the parts; water rules are model-specific.'),
      part('head', 'Brush head', 'Moves bristles against the teeth. A compatible worn head can be replaced.', 'Plastic and bristles; collection options differ from the electrical handle.'),
      part('motor', 'Drive motor', 'Makes the brushing movement through the drive mechanism.', 'A small electrical motor moves or vibrates the head.'),
      part('battery', 'Battery', 'Stores energy for brushing away from the charger.', 'A rechargeable cell stays inside the real handle.'),
      part('charger', 'Charging stand', 'Transfers electricity into the battery through the model’s charging system.', 'Electrical parts in the stand need their own cleaning instructions.'),
    ],
    care: [
      ['Rinse as the guide says', 'Follow the model’s brush-head and handle-cleaning guide, then allow the recommended parts to dry.'],
      ['Care for the stand separately', 'An adult follows charger-cleaning instructions. A handle that can be rinsed does not mean the stand can be immersed.'],
      ['Keep the handle useful', 'Use compatible replacement heads when needed. Ask about the appropriate collection route when the electrical handle stops working.'],
    ],
    careSource: source('Example toothbrush and charger care · Oral-B', 'https://www.oralb.co.uk/en-gb/support/other-issues/my-toothbrush-is-moldy-or-has-a-moldy-smell'),
    challenge: { question: 'The bristles are worn but the handle works. What could your family check?', choices: ['Whether a compatible replacement head is available', 'Whether to throw away every part immediately'], correct: 0, explanation: 'The head and electrical handle have different jobs and lifetimes. A suitable replacement head can keep the handle useful.' },
    energyTip: 'This imaginary scenario counts 120 minutes of charging at 1 W. It is not a recommended charging schedule or two hours of brushing. Use measured wall energy or the maker’s charging guidance for your device.',
  },
  {
    id: 'cordless_drill', name: 'Cordless drill', category: 'Cordless drill', room: 'Study', colour: '#79a296', watts: 40, minutes: 60,
    question: 'Why must a battery and charger be a matching pair?',
    summary: 'Explore an adult’s tool digitally and follow energy into turning movement.',
    parts: [
      part('body', 'Tool body', 'Supports the working parts and provides a grip for an adult user.', 'Plastic and metal surround the drive and controls.'),
      part('chuck', 'Chuck', 'Holds a suitable drill or driver bit firmly.', 'Metal gripping parts turn with the bit; keep fingers away.'),
      part('motor', 'Motor', 'Changes stored electrical energy into rotation.', 'Metal, magnets and windings form the motor.'),
      part('gearbox', 'Gears', 'Change the speed and turning force sent to the chuck.', 'Enclosed gears and lubricant are not child-service parts.'),
      part('trigger', 'Trigger', 'Tells the tool to run. On many models it also controls speed.', 'A switch and electronics connect to the motor.'),
      part('battery', 'Battery pack', 'Stores energy for use away from a socket.', 'Cells and protective electronics must not be opened or damaged.'),
    ],
    care: [
      ['Explore here, ask in real life', 'This digital model is for learning. An adult handles the real drill, sharp bits and any adjustments.'],
      ['Use a compatible charger', 'An adult follows the manufacturer’s battery and charging instructions. Do not try a random charger that seems to fit.'],
      ['Store safely', 'An adult follows the manual to prevent accidental starts and stores the tool dry and out of children’s reach. Damaged batteries need specialist advice.'],
    ],
    careSource: source('Example cordless drill safety manual · Bosch', 'https://www.bosch-diy.com/storage/en-sa/easydrill-12-40384-original-pdf-362647-en-sa.pdf'),
    challenge: { question: 'Another charger’s plug fits. Does that prove it is the right charger?', choices: ['Yes, a fitting plug proves compatibility', 'No, an adult must check the maker’s compatibility instructions'], correct: 1, explanation: 'Shape is only one detail. Charging voltage and battery design also matter; use the equipment specified for the tool.' },
    energyTip: 'This example counts one hour of wall charging at 40 W average, not an hour of drilling. Battery capacity, charge losses and charger behaviour differ. It does not estimate the materials saved by a repair.',
  },
];

/** Part-level prompts adapt the reference prototype's purpose / planet / care
 * teaching structure. They describe material stewardship, not made-up grams of
 * CO2 saved by a part. Shared internal-part wording deliberately gives no real
 * disassembly steps. Explicit ID lookup makes a renamed 3D part fail clearly.
 */
const sealedCare = 'Explore it digitally. Leave the real enclosure closed; an adult arranges suitable service for a fault.';
const batteryCare = 'Leave the battery enclosed. Stop using a swollen or damaged device and tell an adult; do not press, puncture or open it.';
const batteryPlanet = 'Battery materials need resources to make. An adult finds an accepted collection service for the device and its battery.';
const boardPlanet = 'Tiny electronic parts mix several materials. Specialist e-waste collection can recover some of those resources.';
const motorPlanet = 'A working motor contains useful metals. A fault elsewhere does not automatically mean the whole product is waste.';
const notes = {
  refrigerator: {
    cabinet: ['Insulation slows unwanted heat gain. Protecting a useful fridge also protects the materials already used to make it.', 'Do not drill, cut or open insulated walls. Ask an adult about any damage.'],
    door: ['A properly closed door limits warm air entering the cold space.', 'Do not hang or climb on it. Tell an adult if it no longer closes properly.'],
    shelves: ['A suitable replacement shelf may let the rest of a working fridge stay in use.', 'An adult follows the shelf’s cleaning and weight guidance. Avoid sudden temperature changes to glass.'],
    compressor: ['Refrigerant equipment needs specialist recovery. It must not be cut open or treated like an ordinary metal box.', sealedCare],
    seal: ['A sound seal helps avoid unwanted warm-air leaks; this page does not assign a percentage energy saving.', 'An adult follows the manual for gentle seal cleaning and checks damage. Do not pull the seal loose.'],
    control: [boardPlanet, 'Ask an adult before changing temperature settings; keeping food suitably cold is the priority.'],
  },
  food_processor: {
    base: [motorPlanet, 'An adult unplugs before external care. Never immerse the electrical base.'],
    bowl: ['An approved replacement bowl can sometimes keep a working motor base useful.', 'Do not overfill or force its fittings. An adult checks which cleaning method suits the bowl.'],
    lid: ['An intact lid helps keep the whole machine usable. Approved spare parts depend on the model.', 'Do not force catches or bypass an interlock. Tell an adult if the lid cracks.'],
    blade: ['Steel has recovery value, but sharp parts need the collection service’s handling advice.', 'Keep fingers away even when still. An adult follows the attachment-cleaning guide.'],
    pusher: ['Keeping the correct small accessory can prevent replacing a whole useful machine.', 'Use only the intended pusher. Never replace it with fingers or an improvised tool.'],
    control: [boardPlanet, sealedCare],
  },
  sandwich_press: {
    body: ['A sound enclosure protects the working parts and helps the whole press remain useful.', 'The outside may be hot. An adult lets it cool before cleaning as directed.'],
    plates: ['Protecting a cooking surface can help avoid early replacement. This is not a quantified carbon saving.', 'Do not scratch the coating. An adult cleans only after unplugging and cooling.'],
    hinge: ['A lasting hinge keeps the plates aligned for their job.', 'Keep fingers out of the closing gap. Do not force the lid or adjust an internal hinge.'],
    handle: ['A sturdy handle is a useful part of keeping the press in service.', 'Do not pull a damaged handle. Nearby metal may still be hot.'],
    control: [boardPlanet, 'Do not assume an unlit indicator means cold plates. Leave real electrical controls enclosed.'],
  },
  portable_heater: {
    body: ['A sound body helps protect working parts. A cracked or damaged heater needs assessment, not decoration over the damage.', 'Keep fabric away and follow the model’s placement instructions.'],
    heater: ['Heating converts electricity into heat. At equal power, a longer running time uses more electricity.', sealedCare],
    grille: ['An intact grille is part of the product’s protective design.', 'Never cover it or put fingers and objects through it. A hot grille can burn.'],
    control: ['A thermostat can change how long heating runs; it does not make unsafe placement acceptable.', 'Let an adult choose settings. Do not bypass any protective control.'],
    base: ['A stable base protects people and the rest of the heater.', 'Keep it upright on the surface the manual specifies. Do not prop up a broken base.'],
  },
  portable_ac: {
    body: ['A durable case and available spare fittings can help the machine stay useful.', 'An adult moves it and follows clearance instructions. Do not block air openings.'],
    filter: ['Suitable filter care supports airflow. No exact electricity saving is claimed here.', 'An adult checks whether this filter may be washed and how it must dry before reuse.'],
    fan: [motorPlanet, sealedCare],
    compressor: ['This cooling system uses electricity and contains refrigerant that needs specialist handling at end of life.', sealedCare],
    hose: ['A sound, correctly installed hose helps the cooling system work as intended.', 'Do not crush, extend or change it without the maker’s approval. Ask an adult to check its fitting.'],
    control: [boardPlanet, 'An adult chooses suitable settings. Cooling capacity and electrical input power are different numbers.'],
  },
  dehumidifier: {
    body: ['Keeping a suitable machine useful preserves the resources in its case and working parts.', 'Keep it upright and leave the clearances specified in its manual.'],
    filter: ['A clear air route helps the machine do its job; the benefit is not a guaranteed percentage saving.', 'An adult follows the exact cleaning and drying rules. Do not assume every filter can be washed.'],
    coils: ['Refrigerant appliances need an appropriate specialist collection route.', 'Do not bend fins, cut pipes or open the sealed system.'],
    fan: [motorPlanet, sealedCare],
    tank: ['An intact reusable tank can serve through many collections of water.', 'An adult follows emptying and cleaning instructions. Do not drink the collected water.'],
    control: ['Using a suitable humidity setting changes operating time; a machine cannot repair a building leak.', 'Tell an adult about persistent damp or unusual readings rather than changing settings to hide the problem.'],
  },
  steam_cleaner: {
    body: ['Protecting the case and its fittings can help the machine remain useful.', 'Let an adult move and care for it. Hot water or steam may remain inside.'],
    tank: ['The same tank holds many refills; suitable care depends on the design and water conditions.', 'Never force a cap. An adult follows the exact cooling, pressure and refilling instructions.'],
    heater: ['Heating water needs electricity. Warm-up and active steam delivery may use different amounts.', sealedCare],
    hose: ['An approved replacement hose may keep other working parts useful.', 'Do not bend it sharply or use a damaged hose. An adult checks hot joints and leaks.'],
    nozzle: ['The correct attachment can make the same machine useful for different suitable surfaces.', 'Never point steam at people, pets or electrical equipment. Let an adult choose suitable surfaces.'],
    control: ['A working safety control is part of keeping the product fit for use.', 'Never defeat a lock or test steam with a hand. Switch-off does not prove pressure has gone.'],
  },
  washing_machine: {
    cabinet: ['A long-lasting structure can support many loads before the machine needs replacing.', 'Do not climb on the machine or remove a real panel.'],
    drum: ['A durable drum keeps useful material in service through many washes.', 'Check pockets with an adult. Never climb inside or reach into a moving drum.'],
    door: ['A sound door and seal help prevent leaks; repair options need model-specific advice.', 'Do not force a locked door. An adult follows the seal-cleaning guide.'],
    drawer: ['Using the suitable amount of detergent avoids adding more product than the wash needs.', 'An adult checks the right compartments and cleaning method. Keep washing products away from children.'],
    motor: [motorPlanet, sealedCare],
    control: ['Wash settings affect heat, time and water use. The right choice also depends on the clothing.', 'An adult chooses a cycle using the fabric labels and machine instructions.'],
  },
  clothes_dryer: {
    cabinet: ['A lasting cabinet protects the drum, air system and electronics.', 'Do not climb inside or remove panels. An adult follows installation instructions.'],
    drum: ['A suitable load lets the drum and air system do their job.', 'Follow clothing labels and the model’s loading limits with an adult.'],
    door: ['An intact latch and seal help the appliance keep working as designed.', 'Do not hang on the door or force a damaged latch.'],
    filter: ['A clear lint filter supports airflow and helps avoid unnecessary extra drying.', 'An adult cleans it after each use and refits it as the manual directs.'],
    airflow: ['Different heat systems have different electricity needs. A heat-pump system also needs specialist refrigerant handling.', 'Keep outside vents clear. Leave the real heater or sealed heat-pump system closed.'],
    control: ['A suitable programme can stop needless extra drying; the benefit depends on the model and load.', 'An adult matches the setting to the clothing care labels.'],
  },
  sewing_machine: {
    body: ['A well-kept sewing machine may help repair useful clothing rather than replace it.', 'Keep the case closed and the work area stable. An adult supervises real use.'],
    needle: ['The right replaceable needle can keep the machine useful for an appropriate fabric.', 'An adult disconnects power before changing a needle and follows the manual. Keep fingers clear.'],
    bobbin: ['A compatible reusable bobbin can hold thread for many projects.', 'An adult checks the correct bobbin type and cleaning instructions. Do not open internal panels.'],
    spool: ['Planning a repair can make useful use of fabric and thread already available.', 'Keep loose thread away from unintended moving parts. An adult follows the threading path.'],
    handwheel: ['A durable mechanism lets the same tool serve for longer.', 'Use only as the manual directs, with an adult. Movement here can move the sharp needle too.'],
    control: ['Running time depends on actual sewing, not all the time spent choosing fabric.', 'Do not press the foot control while an adult is cleaning or adjusting the machine.'],
  },
  smartphone: {
    screen: ['Protecting a useful screen may avoid replacing the whole phone early.', 'Keep sharp objects away. An adult follows the screen-cleaning guide and handles a cracked screen.'],
    case: ['A durable body and suitable cover help protect the resources inside.', 'Use a suitable protective case. Do not press a bulging body flat.'],
    battery: [batteryPlanet, batteryCare],
    board: [boardPlanet, sealedCare],
    camera: ['Small camera parts also contain useful materials; they belong with specialist device collection.', 'An adult follows lens-cleaning advice. Avoid scratching or poking the camera opening.'],
    port: ['An undamaged connection helps a working phone keep charging without early replacement.', 'Never force a cable or insert cleaning tools. An adult checks liquid or damage warnings.'],
  },
  tablet: {
    screen: ['A protected display can help the same tablet stay useful for another learner.', 'Avoid pressure, scratching and direct liquid spray; follow its cleaning guide.'],
    case: ['Looking after the body protects the components already inside.', 'A suitable cover helps with storage. Do not bend the tablet or press on a bulge.'],
    battery: [batteryPlanet, batteryCare],
    board: [boardPlanet, sealedCare],
    speaker: ['Magnets, metal and electronics are resources that suitable recovery can keep in use.', 'Keep liquids and sharp objects out of the speaker openings.'],
    port: ['A sound port can prevent a working device becoming hard to charge.', 'Use a compatible connector without forcing it. Ask an adult about damage or stuck dirt.'],
  },
  television: {
    screen: ['Display production uses materials and energy. Protecting a useful display can avoid early replacement.', 'An adult cleans gently with the approved cloth. Do not press hard or spray the screen directly.'],
    frame: ['A lasting enclosure protects a large, delicate display.', 'Leave the back closed. Do not lift or move a real television without an adult.'],
    board: [boardPlanet, sealedCare],
    power: [boardPlanet, 'Never open a real power-supply enclosure. Internal electrical hazards can remain after unplugging.'],
    speakers: ['A speaker’s magnets and metals belong with accepted e-waste collection at end of life.', 'Keep liquids and objects away from the openings. The real casing stays closed.'],
    stand: ['A secure, durable support helps avoid damaging a working screen.', 'An adult follows secure installation and anti-tip guidance. Never climb or pull on the television.'],
  },
  headphones: {
    headband: ['A durable band keeps the useful sound parts together.', 'Avoid twisting or stretching it beyond its intended movement.'],
    cushions: ['Approved replacement cushions may extend use without replacing all the electronics.', 'An adult checks the model’s cleaning or replacement advice; do not assume the pads can be soaked.'],
    drivers: ['Magnets and metals have recovery value through appropriate e-waste services.', 'Keep the real ear cups closed. Do not poke the thin sound surface.'],
    controls: [boardPlanet, 'Keep liquids out and avoid forcing stuck buttons. Ask an adult for suitable advice.'],
    battery: [batteryPlanet, batteryCare],
  },
  games_console: {
    case: ['A durable case protects electronics that may remain useful for years.', 'Keep outside vents clear. Do not cover the console with fabric.'],
    board: [boardPlanet, sealedCare],
    fan: ['Good airflow supports the system’s intended cooling; it does not create a measured carbon saving here.', 'An adult follows external dust-cleaning advice. Do not insert fingers or tools into vents.'],
    storage: ['Stored games and personal data need attention before the hardware goes to another person.', 'An adult backs up wanted saves, removes accounts and follows reset instructions before handover.'],
    ports: ['Looking after connections can keep a working console useful.', 'Match the cable to its socket and never force it. An adult checks damaged connections.'],
    controller: ['A supported spare cable or service option can sometimes avoid replacing the whole controller.', 'Follow its cleaning and battery guidance. Store it without pulling cables or crushing buttons.'],
  },
  printer: {
    body: ['A lasting case protects working printing parts and electronics.', 'An adult follows exterior-cleaning instructions. Keep liquids out of openings.'],
    paper: ['Checking page selection and using suitable paper can avoid unwanted sheets.', 'Stay within the tray limit. An adult aligns the paper guides without forcing them.'],
    rollers: ['A clear, suitable paper path can help avoid jams and wasted prints.', 'Do not reach into moving parts. An adult follows the exact model’s jam and cleaning instructions.'],
    cartridge: ['Cartridges may have a separate take-back route rather than the same bin as paper.', 'An adult checks compatibility and the local collection route. Do not open or spill cartridges.'],
    control: [boardPlanet, 'Check the on-screen message and ask an adult. Do not keep forcing a printer that reports a jam.'],
  },
  straightener: {
    arms: ['A sound handle and enclosure protect the useful heated parts.', 'Do not touch hot surfaces or use cracked equipment. An adult checks damage.'],
    plates: ['Suitable cleaning protects the coating and helps the same tool remain useful.', 'An adult lets them cool completely before following the cleaning instructions.'],
    hinge: ['A lasting joint keeps the plates together without replacing the whole tool.', 'Do not force the arms beyond their intended opening or put fingers into the gap.'],
    control: ['Temperature control changes heater running time, but does not remove heat immediately.', 'An indicator is not a touch test. Keep real electrical parts closed.'],
    lead: ['A protected lead helps avoid an otherwise useful tool becoming damaged.', 'Do not pull or tightly wrap the lead. An adult stops use if it is damaged.'],
  },
  shaver: {
    body: ['A durable, properly sealed body protects the working parts.', 'Follow this model’s water rules. Similar-looking products may not be equally washable.'],
    head: ['An approved replacement head may keep the rest of a suitable shaver useful.', 'An adult follows the head-cleaning guide. Protect thin foils and stay away from cutters.'],
    motor: [motorPlanet, sealedCare],
    battery: [batteryPlanet, batteryCare],
    control: [boardPlanet, 'Keep the real body closed. An adult checks unusual behaviour or charging warnings.'],
  },
  electric_toothbrush: {
    handle: ['A long-lasting handle can serve through several compatible brush heads.', 'Follow its water and drying instructions. Do not open the handle to investigate a fault.'],
    head: ['A replaceable head can keep a working handle useful; collection options for heads vary.', 'Use a compatible head and follow the maker’s cleaning and replacement guidance.'],
    motor: [motorPlanet, sealedCare],
    battery: [batteryPlanet, batteryCare],
    charger: ['The stand uses electricity during charging. Its real consumption depends on the design and battery state.', 'An adult cleans it as directed. Do not immerse it just because the brush head can be rinsed.'],
  },
  cordless_drill: {
    body: ['A durable body protects useful drive parts through many appropriate adult projects.', 'This is a digital lesson for children. An adult handles and stores the real tool.'],
    chuck: ['A serviceable chuck can sometimes keep the rest of a tool useful.', 'Leave real bits and adjustments to an adult. Bits may be sharp and can turn quickly.'],
    motor: [motorPlanet, sealedCare],
    gearbox: ['Durable gears transfer movement through many uses; service options depend on the actual tool.', sealedCare],
    trigger: [boardPlanet, 'Never test a real trigger as part of this lesson. An adult prevents accidental starts during care.'],
    battery: [batteryPlanet, batteryCare],
  },
};

// Fail during development if a geometry/content contract gains a part without
// its paired planet and care lesson, rather than silently showing the wrong tip.
for (const appliance of EXPANDED_CATALOGUE) {
  // Wall-charging time is distinct from time using a battery device. A fridge
  // scenario uses whole-day average draw, not a compressor's peak rating.
  if (['smartphone', 'tablet', 'headphones', 'shaver', 'electric_toothbrush', 'cordless_drill'].includes(appliance.id)) {
    appliance.energyMode = 'charging';
  } else if (appliance.id === 'refrigerator') {
    appliance.energyMode = 'continuous-average';
  }
  for (const itemPart of appliance.parts) {
    const detail = notes[appliance.id]?.[itemPart.id];
    if (!detail) throw new Error(`Missing Explore part notes: ${appliance.id}/${itemPart.id}`);
    [itemPart.impact, itemPart.care] = detail;
  }
}
