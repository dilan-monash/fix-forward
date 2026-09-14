/**
 * Quest's fixed educational story bank, shared by the UI, engine and tests.
 * Mission/card IDs are saved on the device: keep them stable when editing copy.
 * mission.conceptIds and card.conceptId refer to CONCEPTS; sourceIds refer to
 * SOURCES; locationId refers to LOCATIONS. artworkId names local art.js drawings.
 * Clue/action/slot/reflection-option IDs belong to their mission. Each accepted
 * plan maps every slot ID to an allowed action ID; reflection.correctId names
 * one of its two picture options. The engine reads these IDs, not label wording.
 */
// Original educational fiction, not imported product records or safety certificates.
// The source register records general rules; the story supplies each item's condition.
// "reviewed" means checked against the listed sources during implementation, not
// approval by a safety professional, the course, or a study involving children.
// Historical review date for these rules, not a live claim that sources remain current.
const CHECKED_AT = "2026-09-13";

// Source metadata supports the parent guide and build-time review. No URLs are fetched
// during play. Design references explain interaction choices, not appliance answers.
export const SOURCES = [
  {
    id: "esv-home", title: "Using electricity safely", publisher: "Energy Safe Victoria",
    url: "https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely",
    jurisdiction: "Victoria, Australia", licence: null, checkedAt: CHECKED_AT,
    rule: "Faulty appliances and damaged cords must not be used. Appliance repairs require a qualified repair technician or licensed electrician. Children should not play with electrical cords.",
  },
  {
    id: "esv-secondhand", title: "Electrical appliances", publisher: "Energy Safe Victoria",
    url: "https://www.energysafe.vic.gov.au/community-safety/buying-safe-appliances/electrical-appliances",
    jurisdiction: "Victoria, Australia", licence: null, checkedAt: CHECKED_AT,
    rule: "Second-hand electrical equipment requires appropriate Australian approval, an undamaged condition and qualified testing. A story's completed adult checks are fictional evidence only.",
  },
  {
    id: "merri-ewaste", title: "E-waste", publisher: "Merri-bek City Council",
    url: "https://www.merri-bek.vic.gov.au/living-in-merri-bek/waste-and-recycling/bins-and-collection-services/ewaste/",
    jurisdiction: "Merri-bek, Victoria, Australia", licence: null, checkedAt: CHECKED_AT,
    rule: "Electrical items need an appropriate e-waste pathway when no longer wanted or working. Consider repair or reuse first, and confirm the receiving service's item acceptance. E-waste is excluded from household bins.",
  },
  {
    id: "merri-paper", title: "Mixed recycling bins", publisher: "Merri-bek City Council",
    url: "https://www.merri-bek.vic.gov.au/living-in-merri-bek/waste-and-recycling/bins-and-collection-services/recycling-bins/",
    jurisdiction: "Merri-bek, Victoria, Australia", licence: null, checkedAt: CHECKED_AT,
    rule: "Merri-bek lists cardboard, office paper and newspapers as accepted mixed recycling. This game uses separate, clean examples and teaches only that limited material group.",
  },
  {
    id: "merri-glass", title: "Glass recycling bins", publisher: "Merri-bek City Council",
    url: "https://www.merri-bek.vic.gov.au/glass-bins",
    jurisdiction: "Merri-bek, Victoria, Australia", licence: null, checkedAt: CHECKED_AT,
    rule: "The glass collection accepts bottles and jars and excludes several other glass products. This does not establish acceptance of an appliance jug; the game's answer remains ask for local guidance.",
  },
  {
    id: "cfa-battery", title: "Charging and battery safety", publisher: "Country Fire Authority",
    url: "https://www.cfa.vic.gov.au/plan-prepare/fires-in-the-home/charging-and-battery-safety",
    jurisdiction: "Victoria, Australia", licence: null, checkedAt: CHECKED_AT,
    rule: "Swelling or bulging is a battery warning sign. Damaged devices need appropriate safety and disposal guidance. The child flow stops at leaving it alone and alerting a grown-up; it teaches no handling procedure.",
  },
  {
    id: "sv-reuse", title: "Minimise your e-waste", publisher: "Sustainability Victoria",
    url: "https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste/minimise-your-e-waste",
    jurisdiction: "Victoria, Australia", licence: null, checkedAt: CHECKED_AT,
    rule: "Working electronics can be reused by someone who needs them, and repair can be considered for faulty items. Neither every item nor every receiving organisation is suitable.",
    retrievalNote: "Search retrieval supplied the page text; direct opening returned HTTP 403. The scored reuse rule is also supported by the opened Merri-bek and Energy Safe sources.",
  },
  {
    id: "unicef-ritec", title: "Responsible Innovation in Technology for Children", publisher: "UNICEF Innocenti", designReference: true,
    url: "https://www.unicef.org/innocenti/projects/responsible-innovation-technology-children",
    jurisdiction: "International design research", licence: null, checkedAt: CHECKED_AT,
    rule: "Design reference for player choice, mastery, creativity and connection. It does not validate this prototype or establish improved learning, retention or behaviour.",
    retrievalNote: "The primary project page was opened during the local parent-guide refresh. Its methods include studies with ages 6–12 and 7–13; it does not prescribe Quest's 7–12 design scope. Used as design rationale, never as an appliance scoring rule.",
  },
  {
    id: "w3c-dragging", title: "Understanding SC 2.5.7: Dragging Movements", publisher: "W3C Web Accessibility Initiative", designReference: true,
    url: "https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html",
    jurisdiction: "International web accessibility guidance", licence: null, checkedAt: CHECKED_AT,
    rule: "Dragging functionality needs a simple pointer alternative unless dragging is essential. Keyboard support is also required for keyboard access; it does not replace the pointer alternative.",
  },
];

// Three illustrated places used by mission selection, scenes and decoration slots.
export const LOCATIONS = [
  { id: "home", title: "Home Corner", subtitle: "Meet Pip and Flo. Find a clue.", artworkId: "home" },
  { id: "studio", title: "Story Studio", subtitle: "Read the clues. Choose what happens next.", artworkId: "studio" },
  { id: "station", title: "Sorting Station", subtitle: "Match each picture to a place.", artworkId: "station" },
];

// Reusable ideas earned once across stories/cards. Each idea also unlocks one fixed
// decoration ID; multiple ideas can intentionally unlock the same kind of decoration.
export const CONCEPTS = [
  {"id":"reuse","title":"Another home","text":"Flo: My checks were done, and Bea wanted a fan. An item you don't need might help someone else.","artworkId":"fan","decoration":"tree"},
  {"id":"assessment","title":"Find out before deciding","text":"Flo: Quiet doesn't tell us what went wrong. Jo, a qualified repairer, can find out more.","artworkId":"fan","decoration":"flowers"},
  {"id":"warning","title":"Asking is helping","text":"Pip: You can help without fixing anything. Leave the appliance alone. Tell an adult you trust about the warning.","artworkId":"toaster-damaged","decoration":"flag"},
  {"id":"repair","title":"A repairer's clue","text":"Pip: Jo says a repair is possible. Sam chooses it. Jo will do the work. The repair isn't finished yet.","artworkId":"kettle","decoration":"bench"},
  {"id":"collection","title":"Ask before collection","text":"Flo: E-waste means electrical items people no longer want or use. Sam asks the collection place if it takes this item.","artworkId":"kettle","decoration":"tree"},
  {"id":"packaging","title":"An item and its box","text":"Pip: The toaster and box need different plans. Our story follows Merri-bek's rules. Clean cardboard goes with paper.","artworkId":"cardboard","decoration":"flowers"},
  {"id":"battery","title":"A warning changes the plan","text":"Flo: A bulging battery is a warning. Leave the device alone. Tell a trusted adult, who gets official advice.","artworkId":"battery-shaver","decoration":"flag"},
  {"id":"uncertainty","title":"We can say: we don't know","text":"Pip: We can say we don't know. Ask a trusted adult for the local answer. A shape alone isn't enough.","artworkId":"glass-jug","decoration":"bench"},
];

// Build a clue with a short pocket label and percentage coordinates on its scene.
const clue = (id, title, text, artworkId, x, y) => ({ id, title, shortLabel: title, text, artworkId, x, y });
// Keep each selectable picture's visible label and answer-specific feedback together.
const action = (id, label, feedback, artworkId) => ({ id, label, feedback, artworkId });
// Most stories need one decision; a mission can replace this with two separate slots.
const nextSlot = [{ id: "next", label: "What happens next?" }];
// Add shared authoring metadata and a feedback lookup; mission fields may override
// the default slot list. This helper labels reviewed content; the validator checks it.
const authored = (mission) => ({
  authored: true,
  contentOrigin: "Original authored educational scenario",
  contentReviewStatus: "reviewed",
  slots: nextSlot,
  ...mission,
  feedbackByAction: Object.fromEntries(mission.allowedActions.map((item) => [item.id, item.feedback])),
});

// A mission combines fictional evidence, permitted plans and an illustrated outcome.
// guideLines follow the attempt stages; learningGoal is for adults; childSummary is
// the short invitation. A reflection revisits evidence after completion, and a
// postcardLine closes the story. Neither fiction nor artwork diagnoses a real object.
export const MISSIONS = [
  authored({
    id: "flo-next-home", title: "Flo's next home", character: "flo", locationId: "home",
    applianceCategory: "fan", conceptIds: ["reuse"], variantGroup: "fan-conditions", difficulty: "gentle",
    learningGoal: "Connect completed reuse checks with a household that wants the item.",
    childSummary: "Find Flo a new home using two clues.",
    fictionalContext: "Flo is a fan. Her family no longer needs her. Bea wants a fan for her reading corner. Could Flo help?",
    guideLines: {
      intro: "I'd love a new reading spot. Can you help?",
      explore: "I've found two notes. Let's see what they say.",
      plan: "I need a choice that fits both clues.",
      success: "You found my match! Bea has room for me.",
      retry: "I'm still working. Which note gives me another home?",
      outcome: "I've found a new home. Which story will you try next?",
    },
    postcardLine: "A new home. A fresh breeze.",
    reflection: {
      prompt: "What helped Flo find a new home?",
      options: [
        { id: "empty-report", label: "No one had checked Flo.", artworkId: "empty-report" },
        { id: "checked-and-wanted", label: "Checks done. Bea wanted Flo.", artworkId: "fan" },
      ],
      correctId: "checked-and-wanted",
      explanation: "Flo's checks were done, and Bea wanted a fan. Both clues mattered.",
    },
    clues: [
      clue("adult-check", "Flo works", "Flo works. Sam, her adult owner, finished the checks for sharing her. Jo, a qualified repairer, checked her too.", "paper", 25, 64),
      clue("new-home", "Bea wants Flo", "Bea wants Flo in her home. Sam and Bea agree to plan Flo's move.", "fan", 70, 46),
    ],
    allowedActions: [
      action("handover", "Sam plans Flo's move to Bea", "Flo: My checks are done. Bea wants me. Sam can plan my move.", "person"),
      action("discard", "Send Flo for collection now", "Flo: I still work, and Bea wants me. Look at both notes again.", "fan"),
      action("guess-repair", "Book a repair for Flo", "Flo: Jo's check says I'm working. What could I do with Bea?", "evidence"),
    ],
    acceptedPlans: [{"next":"handover"}],
    outcome: { title: "A welcome for Flo", text: "Sam and Bea plan Flo's move. Flo joins Bea's reading corner. Your two clues found Flo a new home.", scene: "reuse" },
    helpText: "Flo: My checks are done. Bea wants a fan. What fits?",
    discussionPrompt: "What helped you choose a new home for Flo?", artworkId: "fan",
    sourceIds: ["esv-secondhand","merri-ewaste","sv-reuse"],
  }),
  authored({
    id: "quiet-fan", title: "The quiet fan", character: "flo", locationId: "home",
    applianceCategory: "fan", conceptIds: ["assessment"], variantGroup: "fan-conditions", difficulty: "gentle",
    learningGoal: "Notice missing evidence and seek a qualified repairer's check before deciding.",
    childSummary: "Find the missing clue in the quiet fan's story.",
    fictionalContext: "Flo finds another fan that has stopped working. Its folder should hold a note about its check. But the folder is empty! Who can find out why?",
    guideLines: {
      intro: "My fan friend has gone quiet. I wonder why.",
      explore: "I'm looking for a clue we don't have yet.",
      plan: "I can't guess the cause. Who could find out?",
      success: "You spotted the gap! We need a repairer's check.",
      retry: "I don't know which part is wrong. What clue is missing?",
      outcome: "Sam will ask Jo why the fan stopped. We can wait.",
    },
    postcardLine: "An empty folder. A good question.",
    reflection: {
      prompt: "What clue showed we needed more help?",
      options: [
        { id: "empty-report", label: "The report was empty.", artworkId: "empty-report" },
        { id: "ready-home", label: "A new home was ready.", artworkId: "person" },
      ],
      correctId: "empty-report",
      explanation: "The empty report meant nobody had checked the cause. Sam asks a qualified repairer before choosing the next step.",
    },
    clues: [
      clue("stopped", "Fan stopped", "The fan stopped working. Sam, its adult owner, does not know why.", "fan", 66, 46),
      // A blank folder must not borrow the green tick from a completed report.
      clue("no-report", "No check yet", "No qualified repairer has checked why it stopped. The picture cannot tell us if it can be repaired.", "empty-report", 27, 64),
    ],
    allowedActions: [
      action("assessment", "Sam asks a repairer to check", "Flo: Sam can ask Jo why it stopped. Jo is a qualified repairer.", "evidence"),
      action("new-motor", "Guess it needs a new motor", "Flo: Quiet doesn't tell us which part is wrong. Remember the empty folder?", "fan"),
      action("rubbish", "Decide the fan is rubbish", "Flo: We don't know why it stopped. A repair might still be possible.", "cardboard"),
    ],
    acceptedPlans: [{"next":"assessment"}],
    outcome: { title: "A question worth asking", text: "Sam asks Jo, a qualified repairer, to check the fan. We still don't know its next step. You found the missing clue.", scene: "assessment" },
    helpText: "Flo: The folder is empty. Sam can ask a qualified repairer.",
    discussionPrompt: "What do we still need to know about this fan?", artworkId: "fan",
    sourceIds: ["esv-home","merri-ewaste"],
  }),
  authored({
    id: "pip-damaged-cable", title: "Pip's damaged cable", character: "pip", locationId: "home",
    applianceCategory: "toaster", conceptIds: ["warning"], variantGroup: "toaster-conditions", difficulty: "gentle",
    learningGoal: "Recognise cable damage as a reason to leave an appliance alone and tell a trusted adult.",
    childSummary: "Spot Pip's warning and choose who can help.",
    fictionalContext: "Pip is a toaster. His picture shows a damaged cable. Sam is a trusted adult nearby. How can Pip get help?",
    guideLines: {
      intro: "I've got a warning to share. Who can help?",
      explore: "My cable damage is in the story. Use the picture clues.",
      plan: "I need someone to hear about this warning.",
      success: "You spoke up! That helps me.",
      retry: "My warning is still here. Who needs to hear it?",
      outcome: "I'm glad you told Sam. You didn't need to fix anything.",
    },
    postcardLine: "You spoke up. Pip was heard.",
    reflection: {
      prompt: "What clue meant Pip needed help?",
      options: [
        { id: "wanted-toaster", label: "Someone wanted a toaster.", artworkId: "person" },
        { id: "damaged-cable", label: "The cable was damaged.", artworkId: "toaster-damaged" },
      ],
      correctId: "damaged-cable",
      explanation: "The damaged cable was the warning. Leave Pip alone and tell a trusted adult.",
    },
    clues: [
      clue("damage", "Cable warning", "The story says Pip's cable is damaged. You don't need to check any real cable.", "toaster-damaged", 70, 61),
      clue("adult", "Sam can help", "Sam is a trusted adult. Leave Pip alone while Sam gets help.", "paper", 27, 46),
    ],
    allowedActions: [
      action("tell-adult", "Leave Pip alone; tell a trusted adult", "Pip: Leave me alone and tell Sam about my cable. You don't need to touch or fix anything.", "person"),
      action("secret", "Keep the warning a secret", "Pip: Sam needs to hear about the warning. You can tell Sam what the picture shows.", "paper"),
      action("handover", "Find Pip a new home now", "Pip: My cable needs help first. Leave me alone and tell Sam, a trusted adult.", "toaster"),
    ],
    acceptedPlans: [{"next":"tell-adult"}],
    outcome: { title: "Pip is heard", text: "You leave Pip alone and tell Sam about the cable. Sam gets help. You helped by speaking up.", scene: "help" },
    helpText: "Pip: Leave me alone. Tell an adult you trust about the warning.",
    discussionPrompt: "How did telling Sam help Pip?", artworkId: "toaster-damaged",
    sourceIds: ["esv-home"],
  }),
  authored({
    id: "kettle-second-chance", title: "The kettle's second chance", character: "pip", locationId: "studio",
    applianceCategory: "kettle", conceptIds: ["repair"], variantGroup: "kettle-conditions", difficulty: "connect",
    learningGoal: "Use a qualified repairer's report and the owner's choice to support a repair plan.",
    childSummary: "Read Kiki's repair note. What should happen next?",
    fictionalContext: "Kiki is a kettle. Jo, a qualified repairer, has checked her. Sam is her adult owner. Pip finds two notes about what could happen next.",
    guideLines: {
      intro: "I'm hoping this envelope has good news for Kiki.",
      explore: "I'll follow Jo's report. What does Kiki's owner want?",
      plan: "I need a choice that matches both notes.",
      success: "I see it too! Jo can repair Kiki. Sam wants that.",
      retry: "I'm reading Jo's note again. Does it match Sam's choice?",
      outcome: "I'm saving Kiki a place. The repair is still ahead.",
    },
    postcardLine: "One envelope. A second chance.",
    reflection: {
      prompt: "What did Jo's report tell us?",
      options: [
        { id: "repair-possible", label: "A repair was possible.", artworkId: "paper" },
        { id: "repair-finished", label: "The repair was finished.", artworkId: "kettle" },
      ],
      correctId: "repair-possible",
      explanation: "Jo said repair was possible, and Sam wanted it. A repair plan does not mean Kiki is fixed.",
    },
    clues: [
      clue("repair-report", "Jo can repair", "Jo is a qualified repairer. Jo checked Kiki and says she can be repaired. There is no price in this story.", "paper", 24, 47),
      clue("owner-choice", "Sam wants repair", "Sam, Kiki's adult owner, wants Jo to repair her. Jo will do the work.", "kettle", 67, 61),
    ],
    allowedActions: [
      action("repair", "Sam books Kiki's repair with Jo", "Pip: Jo says repair is possible. Sam wants it. We can choose a repair plan.", "evidence"),
      action("discard", "Send Kiki for collection", "Pip: Jo can repair Kiki, and Sam wants that. Try joining those two clues.", "kettle"),
      action("already-fixed", "Say Kiki is fixed already", "Pip: Jo says a repair is possible. The work isn't finished yet!", "kettle"),
    ],
    acceptedPlans: [{"next":"repair"}],
    outcome: { title: "Kiki has a repair plan", text: "Sam books Kiki's repair with Jo, the qualified repairer. Your choice fits both notes. Kiki's repair has not happened yet.", scene: "repair" },
    helpText: "Pip: Jo can repair Kiki. Sam wants that. Which plan fits?",
    discussionPrompt: "What two clues helped you choose Kiki's repair plan?", artworkId: "kettle",
    sourceIds: ["esv-home","merri-ewaste"],
    cooperative: {
      title: "Play together: the secret envelope",
      text: "Pip: Open Jo's report with a friend. Compare it with Sam's choice. Playing solo? Read the report yourself.",
      prompt: "Does Jo's report match what Sam wants?",
    },
  }),
  authored({
    id: "kettle-last-chapter", title: "The kettle's last chapter", character: "flo", locationId: "studio",
    applianceCategory: "kettle", conceptIds: ["collection"], variantGroup: "kettle-conditions", difficulty: "connect",
    learningGoal: "Check that a service accepts the exact electrical item before arranging collection.",
    childSummary: "Find out who can collect this kettle.",
    fictionalContext: "Flo finds another kettle. This one won't be used again. Sam found a place that collects electrical things. Will it take this kettle?",
    guideLines: {
      intro: "I've found another kettle. This one's story is different.",
      explore: "I have a report. I'm missing the collection service's answer.",
      plan: "I need a place that takes this exact kettle.",
      success: "You found the question! Sam needs the service's answer.",
      retry: "I'm still missing one answer. Will that place take this kettle?",
      outcome: "Sam will ask if that place takes this kettle.",
    },
    postcardLine: "A good route starts with a question.",
    reflection: {
      prompt: "Why did Sam need to ask?",
      options: [
        { id: "nearby-service", label: "The service was nearby.", artworkId: "kettle" },
        { id: "missing-answer", label: "The service had not answered.", artworkId: "missing-answer" },
      ],
      correctId: "missing-answer",
      explanation: "Sam didn't know if the service took this kettle. Nearby does not mean it takes every item.",
    },
    clues: [
      clue("final-report", "Check finished", "Jo, a qualified repairer, finished this kettle's check. It won't be repaired or used again. Sam, its adult owner, is planning its collection.", "paper", 25, 48),
      clue("acceptance", "Will they collect?", "Sam found a place that collects electrical items. Sam has not asked if it takes this kettle.", "kettle", 67, 63),
    ],
    allowedActions: [
      action("check-service", "Sam asks if they take this kettle", "Flo: Sam asks the collection place about this exact kettle. That comes before collection.", "person"),
      action("nearest", "Pick the nearest place", "Flo: A nearby place might not take this kettle. Sam needs to ask.", "kettle"),
      action("paper", "Choose paper recycling", "Flo: This is an electrical kettle. Its collection plan is different from paper.", "paper"),
    ],
    acceptedPlans: [{"next":"check-service"}],
    outcome: { title: "A plan for the next stop", text: "Sam plans to call an e-waste service. Collection waits until it says it takes this kettle.", scene: "collection" },
    helpText: "Flo: The report is done. Sam must ask who takes this kettle.",
    discussionPrompt: "Why does Sam need to ask the collection service?", artworkId: "kettle",
    sourceIds: ["merri-ewaste"],
  }),
  authored({
    id: "moving-day-box", title: "The moving-day box", character: "pip", locationId: "station",
    applianceCategory: "toaster", conceptIds: ["packaging","reuse"], variantGroup: "toaster-conditions", difficulty: "connect",
    learningGoal: "Use each item's condition and material to choose separate reuse and recycling plans.",
    childSummary: "Choose a plan for a toaster and its empty box.",
    fictionalContext: "Pip finds a toaster and its empty cardboard box. The toaster works. The box is clean. Do they need the same plan?",
    guideLines: {
      intro: "I've got a box-shaped puzzle. Where should each item go?",
      explore: "I'm following the toaster's note. What is the box made of?",
      plan: "I need one choice for each item. Either can go first.",
      success: "You split the puzzle! Each item has its own next stop.",
      retry: "I'm checking each space. The toaster and box need different choices.",
      outcome: "I've made two paths for two items. Moving-day puzzle solved!",
    },
    postcardLine: "One box. Two next chapters.",
    reflection: {
      prompt: "What helped you choose two plans?",
      options: [
        { id: "different-items", label: "A toaster and clean cardboard.", artworkId: "boxed-toaster" },
        { id: "same-box", label: "Both came in one box.", artworkId: "cardboard" },
      ],
      correctId: "different-items",
      explanation: "The checked toaster had a new home. The clean box followed our local cardboard recycling rule.",
    },
    clues: [
      clue("toaster-plan", "A new home", "The toaster works. Sam, its adult owner, finished the checks for sharing it. A qualified repairer checked it too. Bea wants it. Sam and Bea agree to plan its move.", "toaster", 30, 56),
      clue("empty-box", "Empty box", "The separate box is clean, plain cardboard. It has no food or plastic inside. Nobody needs the box now.", "cardboard", 74, 67),
      clue("local-note", "Recycling note", "This story uses Merri-bek's recycling rules. Clean cardboard goes with paper in mixed recycling.", "paper", 56, 33),
    ],
    slots: [{"id":"toaster","label":"Working toaster"},{"id":"cardboard","label":"Empty cardboard box"}],
    // Item slots may be filled in either order.
    allowedActions: [
      action("reuse", "Sam plans its move to Bea", "Pip: The toaster has finished checks and a new home. The empty box needs its own plan.", "person"),
      action("paper", "Paper and cardboard recycling", "Pip: The clean box fits our local cardboard rule. The electrical toaster needs a different plan.", "cardboard"),
      action("ewaste", "Choose e-waste collection", "Pip: The toaster's checks are done. Bea wants it. The box is clean cardboard. Try their other plans.", "toaster"),
    ],
    acceptedPlans: [{"toaster":"reuse","cardboard":"paper"}],
    outcome: { title: "Two items, two plans", text: "Sam plans the toaster's move to Bea. The empty box goes for paper and cardboard recycling. You chose a plan for each item.", scene: "separate" },
    helpText: "Pip: The checked toaster has a new home. The box is cardboard.",
    discussionPrompt: "Why did the toaster and its box need different plans?", artworkId: "boxed-toaster",
    sourceIds: ["esv-secondhand","merri-paper","merri-ewaste"],
  }),
  authored({
    id: "bulging-gadget", title: "The bulging gadget", character: "flo", locationId: "station",
    applianceCategory: "shaver", conceptIds: ["battery"], variantGroup: "shaver-conditions", difficulty: "connect",
    learningGoal: "Treat a bulging battery as a warning that needs trusted-adult and official guidance.",
    childSummary: "Spot a swollen battery. Who needs to know?",
    fictionalContext: "Flo sees a shaver with a battery warning. Its battery is bulging, which means swollen. Sam's usual collection plan must stop.",
    guideLines: {
      intro: "I'm pausing here. This picture has a battery warning.",
      explore: "I can use these picture clues. No real device is needed.",
      plan: "I need to leave it alone and get trusted help.",
      success: "You paused with me. The warning comes first.",
      retry: "I'm pausing the usual plan. What does the warning change?",
      outcome: "I've told Sam. Getting help was our next step.",
    },
    postcardLine: "Flo paused. You changed the plan.",
    reflection: {
      prompt: "What clue changed the plan?",
      options: [
        { id: "small-device", label: "The shaver was small.", artworkId: "shaver" },
        { id: "bulging-battery", label: "The battery was bulging.", artworkId: "battery-shaver" },
      ],
      correctId: "bulging-battery",
      explanation: "The bulging battery was the warning. Leave it alone and tell a trusted adult. Sam gets official advice.",
    },
    clues: [
      clue("bulging", "Swollen battery", "This picture shows a bulging battery. Bulging means swollen. Leave the device alone. You don't need to touch any real device.", "battery-shaver", 65, 51),
      // The helper picture invites telling Sam; a ticked paper could imply approval.
      clue("not-ready", "Stop and ask", "This shaver is not ready for normal collection. Tell Sam, a trusted adult. Sam needs official advice about the warning and handling.", "person", 25, 66),
    ],
    allowedActions: [
      action("official-help", "Leave it alone; tell a trusted adult", "Flo: Leave the device alone and tell Sam. Sam gets official advice about the warning.", "person"),
      action("normal-sort", "Use the usual collection plan", "Flo: The battery warning changes the plan. Normal sorting must wait for official advice.", "shaver"),
      action("paper", "Choose paper recycling", "Flo: This is an electrical device with a warning. Leave it alone and tell a trusted adult.", "paper"),
    ],
    acceptedPlans: [{"next":"official-help"}],
    outcome: { title: "The pause was the right move", text: "You leave the device alone and tell Sam, a trusted adult. Sam gets official advice about the warning and handling. The normal collection plan stays paused.", scene: "help" },
    helpText: "Flo: Leave it alone. Tell a trusted adult. Sam gets official advice.",
    discussionPrompt: "What clue made you pause the collection plan?", artworkId: "battery-shaver",
    sourceIds: ["cfa-battery"],
  }),
  authored({
    id: "mystery-glass-jug", title: "The mystery glass jug", character: "pip", locationId: "station",
    applianceCategory: "appliance-jug", conceptIds: ["uncertainty"], variantGroup: "glass-evidence", difficulty: "connect",
    learningGoal: "Notice that a material label alone does not confirm a local recycling destination.",
    childSummary: "Find out why this glass jug needs another clue.",
    fictionalContext: "Pip finds a glass jug from an appliance. A recycling list names bottles and jars. Does that tell us where this jug goes?",
    guideLines: {
      intro: "I've found a mystery with a handle. Where does it belong?",
      explore: "I'm reading the jug's story and our local list.",
      plan: "I can't find this jug on the list. Who could ask?",
      success: "You spotted the gap! We need this jug's own answer.",
      retry: "I'm not sure that list means every glass object.",
      outcome: "We don't know yet. Sam will ask about this jug.",
    },
    postcardLine: "A mystery jug. A useful question.",
    reflection: {
      prompt: "What clue showed we needed to ask?",
      options: [
        { id: "limited-list", label: "The list named bottles and jars.", artworkId: "glass-list" },
        { id: "glass-material", label: "The jug was made of glass.", artworkId: "glass-jug" },
      ],
      correctId: "limited-list",
      explanation: "The list named bottles and jars, not this appliance jug. Sam needs to ask about this exact kind.",
    },
    clues: [
      clue("jug-origin", "Appliance part", "This glass jug came from an appliance. It is not a drink bottle or a food jar.", "glass-jug", 65, 48),
      // Show the two listed shapes and keep the question-mark jug outside them.
      clue("missing-rule", "Jug not listed", "Merri-bek's glass list names bottles and jars. This appliance jug is not listed. We still need to ask about it.", "glass-list", 27, 65),
    ],
    allowedActions: [
      action("ask-local", "Ask a trusted adult to check locally", "Pip: Sam can ask the local service about this exact jug. You spotted the missing answer.", "person"),
      action("all-glass", "Choose one bin for all glass", "Pip: This jug is not a bottle or jar. We still need to ask if the service takes it.", "glass-jug"),
      action("paper", "Choose paper recycling", "Pip: The jug is glass, not paper. Its next stop is still unknown.", "paper"),
    ],
    acceptedPlans: [{"next":"ask-local"}],
    outcome: { title: "A useful question", text: "You ask Sam, a trusted adult, about the jug. Sam checks if the local service takes this exact kind. The jug's next stop stays undecided until then.", scene: "help" },
    helpText: "Pip: We need this jug's answer. Ask a trusted adult to check.",
    discussionPrompt: "What should Sam ask about this exact jug?", artworkId: "glass-jug",
    sourceIds: ["merri-glass"],
  }),
];

// These fixed story conditions are reviewed. No random conditions are combined.
// Checked collection cards and cards with missing clues share appliance pictures.
// Mark one complete authored condition; do not mix random warnings with fixed answers.
const sortItem = (item) => ({ authored: true, contentReviewStatus: "reviewed", ...item });
// Each card's condition determines ewaste, paper or ask. Shared silhouettes are
// deliberate: the child must use the evidence rather than guess from an appliance shape.
export const SORT_ITEMS = [
  sortItem({"id":"kettle-ready","title":"Kettle and electrical base","artworkId":"kettle","condition":"Jo, a qualified repairer, checked this kettle. It won't be repaired or used again. Plan its collection.","answer":"ewaste","clue":"Pip: The picture shows an electrical base and cord.","explanation":"Pip: Sam, the adult helper, checks the e-waste service first. It must accept this kettle and its base.","conceptId":"collection","sourceIds":["merri-ewaste"]}),
  sortItem({"id":"toaster-ready","title":"Toaster ready for collection","artworkId":"toaster","condition":"Jo, a qualified repairer, finished this toaster's check. It won't be repaired or used again. Plan its collection.","answer":"ewaste","clue":"Pip: This is the electrical toaster. Its box is separate.","explanation":"Pip: Sam, the adult helper, checks the e-waste service first. It must accept this toaster before collection.","conceptId":"collection","sourceIds":["merri-ewaste"]}),
  sortItem({"id":"fan-ready","title":"Fan with a finished report","artworkId":"fan","condition":"Jo, a qualified repairer, finished the fan's check. It won't be repaired or used again. Plan its collection.","answer":"ewaste","clue":"Flo: This fan already has a finished report.","explanation":"Flo: The report helps us choose. Sam checks which e-waste service accepts this fan.","conceptId":"collection","sourceIds":["merri-ewaste"]}),
  sortItem({"id":"shaver-ready","title":"Shaver ready for collection","artworkId":"shaver","condition":"Jo, a qualified repairer, checked this shaver. No warning signs were found. It won't be repaired or used again. Plan its collection.","answer":"ewaste","clue":"Flo: A shaver is electrical, even though it is small.","explanation":"Flo: You used the story clues. Sam checks which e-waste service accepts this shaver.","conceptId":"collection","sourceIds":["merri-ewaste"]}),
  sortItem({"id":"toaster-box","title":"Empty toaster box","artworkId":"cardboard","condition":"This is a clean, plain cardboard box. The toaster is separate. No food or plastic is inside.","answer":"paper","clue":"Pip: No toaster inside! What is the empty box made of?","explanation":"Pip: This box has its own path. Merri-bek accepts clean cardboard with paper in mixed recycling.","conceptId":"packaging","sourceIds":["merri-paper"]}),
  sortItem({"id":"kettle-box","title":"Empty kettle box","artworkId":"cardboard","condition":"This clean, plain cardboard box is empty. The kettle and all other packaging are separate.","answer":"paper","clue":"Pip: This box has no electrical parts. It is cardboard.","explanation":"Pip: You found the cardboard clue. Merri-bek accepts it with paper in mixed recycling.","conceptId":"packaging","sourceIds":["merri-paper"]}),
  sortItem({"id":"office-paper","title":"Clean office paper","artworkId":"paper","condition":"This office paper is clean. Nobody needs it now. It has no plastic cover.","answer":"paper","clue":"Flo: Follow the material clue. This is plain office paper.","explanation":"Flo: Paper has its own next stop. Merri-bek accepts this office paper in mixed recycling.","conceptId":"packaging","sourceIds":["merri-paper"]}),
  sortItem({"id":"newspaper","title":"Yesterday's newspaper","artworkId":"newspaper","condition":"This newspaper is clean and dry. No bag or other item is attached.","answer":"paper","clue":"Pip: A toaster picture is still printed on paper!","explanation":"Pip: You followed the material clue. Merri-bek accepts newspapers in mixed recycling.","conceptId":"packaging","sourceIds":["merri-paper"]}),
  sortItem({"id":"shaver-warning","title":"Shaver with a bulging battery","artworkId":"battery-shaver","condition":"The story has a warning: the shaver's battery is bulging. Its usual collection plan must stop.","answer":"ask","clue":"Flo: The battery warning changes the usual plan.","explanation":"Flo: Leave it alone and tell a trusted adult. Sam gets official advice about the warning.","conceptId":"battery","sourceIds":["cfa-battery"]}),
  sortItem({"id":"fan-unassessed","title":"Quiet fan, missing report","artworkId":"fan","condition":"A clue is missing. Nobody has checked why this fan stopped working. We don't know its next step.","answer":"ask","clue":"Flo: Quiet doesn't tell us what went wrong. What's missing?","explanation":"Flo: Ask a trusted adult for help. Sam can ask a qualified repairer to check the fan.","conceptId":"assessment","sourceIds":["esv-home","merri-ewaste"]}),
  sortItem({"id":"jug-unknown","title":"Glass jug from an appliance","artworkId":"glass-jug","condition":"A clue is missing. This glass jug came from an appliance. We don't know which local service takes it.","answer":"ask","clue":"Pip: This appliance jug is not a bottle or jar.","explanation":"Pip: Ask a trusted adult to check this exact jug. Sam needs the local service's answer.","conceptId":"uncertainty","sourceIds":["merri-glass"]}),
  sortItem({"id":"toaster-unknown","title":"Toaster with an unfinished story","artworkId":"toaster","condition":"A clue is missing. The note says this toaster works. Sam, its adult owner, hasn't checked its next plan. Its next use or collection is still undecided.","answer":"ask","clue":"Pip: A working toaster might find a new home. The checks aren't finished.","explanation":"Pip: Ask a trusted adult to help. Sam must check this toaster and its possible next use.","conceptId":"reuse","sourceIds":["esv-secondhand","merri-ewaste"]}),
];

/**
 * Check supplied content banks, or these defaults, and return readable error strings.
 * Tests can substitute broken records to prove missing links are caught. This is
 * build-time authoring validation, not a source fetch or real appliance assessment.
 */
export function validateQuestContent({ missions = MISSIONS, items = SORT_ITEMS, concepts = CONCEPTS, sources = SOURCES, locations = LOCATIONS } = {}) {
  const errors = [];
  // Collect IDs for cross-references while reporting missing or duplicate identifiers.
  const ids = (records, label) => {
    const found = new Set();
    for (const record of records) {
      if (!record?.id || found.has(record.id)) errors.push(`${label}: missing or duplicate id ${record?.id}`);
      found.add(record?.id);
    }
    return found;
  };
  const sourceIds = ids(sources, "source"), conceptIds = ids(concepts, "concept"), locationIds = ids(locations, "location");
  ids(missions, "mission"); ids(items, "sorting card");
  // Keep enough provenance for a future developer to review each rule and jurisdiction.
  for (const source of sources) {
    if (!/^https:\/\//.test(source.url || "") || !source.title || !source.publisher || !source.jurisdiction || !source.rule || !/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt || "") || !("licence" in source)) errors.push(`${source.id}: incomplete source provenance`);
  }
  // Every scoring record needs factual support; design guidance alone is insufficient.
  for (const record of [...missions, ...items]) {
    if (record.contentReviewStatus !== "reviewed" || record.authored !== true) errors.push(`${record.id}: only reviewed authored content may score`);
    if (!record.sourceIds?.length || record.sourceIds.some((id) => !sourceIds.has(id))) errors.push(`${record.id}: missing factual source`);
    if (!record.sourceIds?.some((id) => sources.some((source) => source.id === id && !source.designReference))) errors.push(`${record.id}: design references cannot supply a factual answer`);
    const referencedConcepts = record.conceptIds || [record.conceptId];
    if (!referencedConcepts.length || referencedConcepts.some((id) => !conceptIds.has(id))) errors.push(`${record.id}: unknown concept`);
  }
  // Verify story structure before the renderer/engine relies on its clue and plan IDs.
  for (const mission of missions) {
    if (!locationIds.has(mission.locationId)) errors.push(`${mission.id}: unknown location`);
    if (!Array.isArray(mission.clues) || mission.clues.length < 2 || mission.clues.length > 3) errors.push(`${mission.id}: expected two or three clues`);
    if (!Array.isArray(mission.slots) || mission.slots.length < 1 || mission.slots.length > 2) errors.push(`${mission.id}: expected one or two plan slots`);
    const actionIds = ids(mission.allowedActions || [], mission.id + " action"), slotIds = ids(mission.slots || [], mission.id + " slot");
    ids(mission.clues || [], mission.id + " clue");
    if (!["intro", "explore", "plan", "success", "retry", "outcome"].every((stage) => typeof mission.guideLines?.[stage] === "string" && mission.guideLines[stage].trim()) || !mission.postcardLine) errors.push(`${mission.id}: incomplete character dialogue`);
    if (mission.clues?.some((entry) => !entry.shortLabel || entry.shortLabel.trim().split(/\s+/).length > 3)) errors.push(`${mission.id}: clue pocket needs a short label`);
    if (!mission.learningGoal || !mission.childSummary || mission.childSummary.trim().split(/\s+/).length > 12) errors.push(`${mission.id}: needs a learning goal and short child summary`);
    // A reflection must offer two distinct illustrated answers with one known correct ID.
    const reflection = mission.reflection;
    if (!reflection?.prompt || !reflection.explanation || !Array.isArray(reflection.options) || reflection.options.length !== 2 || reflection.options.some((option) => !option.id || !option.label || !option.artworkId) || new Set(reflection.options.map((option) => option.id)).size !== 2 || new Set(reflection.options.map((option) => option.label)).size !== 2 || !reflection.options.some((option) => option.id === reflection.correctId)) errors.push(`${mission.id}: needs two distinct picture clues and one valid reflection answer`);
    if (!mission.allowedActions?.every((item) => item.label && item.feedback && item.artworkId) || !mission.helpText || !mission.outcome?.text || !mission.outcome?.title) errors.push(`${mission.id}: incomplete decision feedback`);
    if (!mission.acceptedPlans?.length) errors.push(`${mission.id}: no accepted plan`);
    // An accepted plan must cover exactly the authored slots using authored actions.
    for (const plan of mission.acceptedPlans || []) {
      if (Object.keys(plan).length !== slotIds.size || Object.entries(plan).some(([slotId, actionId]) => !slotIds.has(slotId) || !actionIds.has(actionId))) errors.push(`${mission.id}: invalid accepted plan`);
    }
  }
  // Sorting answers must include evidence and feedback, including the unresolved ask path.
  for (const item of items) if (!["ewaste", "paper", "ask"].includes(item.answer) || !item.condition || !item.clue || !item.explanation) errors.push(`${item.id}: incomplete sorting decision`);
  return errors;
}
