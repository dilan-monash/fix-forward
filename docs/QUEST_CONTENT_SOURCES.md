# FixForward Quest: authored content and source register

Checked during implementation on **13 September 2026 (Australia/Sydney)**. The playable records live in [quest/content.js](../quest/content.js). They are original educational fiction adapted from the user's eight scenario seeds, not imported datasets, actual household records, product recall results or safety certificates. No crowdsourced submissions, Google Maps listings or website scraper supplies the game.

`contentReviewStatus: "reviewed"` means the general scored rule was compared with the sources below during implementation. It does **not** mean a qualified safety professional, teaching team, human research participant or course assessor has approved the content. Human review and the course's required AI acknowledgement remain separate responsibilities.

## What the sources establish

The machine-readable source records retain the exact URL, title, publisher, jurisdiction, checked date and a short rule. `licence: null` means no applicable redistribution licence was established during this review; it does not mean public domain. The game uses original scenarios and short paraphrases with links, and imports none of the sources' artwork or datasets.

| ID | Source and publisher | Jurisdiction | Rule used and limits |
|---|---|---|---|
| `esv-home` | [Using electricity safely — Energy Safe Victoria](https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely) | Victoria | Faulty appliances and damaged cords are unsuitable for use; qualified repair personnel handle repairs. Child story actions stop at leaving the item alone and telling a grown-up. The source's adult instructions are not reproduced as child tasks. |
| `esv-secondhand` | [Electrical appliances — Energy Safe Victoria](https://www.energysafe.vic.gov.au/community-safety/buying-safe-appliances/electrical-appliances) | Victoria | Second-hand equipment needs appropriate checks, including qualified testing. A working appearance does not prove suitability for reuse. The scenarios explicitly supply completed adult checks rather than asking children to perform them. |
| `merri-ewaste` | [E-waste — Merri-bek City Council](https://www.merri-bek.vic.gov.au/living-in-merri-bek/waste-and-recycling/bins-and-collection-services/ewaste/) | Merri-bek, Victoria | Electrical items have distinct collection pathways. The page discusses repair/reuse and instructs residents to confirm item acceptance with receiving services. No listed location is treated as universal acceptance. |
| `merri-paper` | [Mixed recycling bins — Merri-bek City Council](https://www.merri-bek.vic.gov.au/living-in-merri-bek/waste-and-recycling/bins-and-collection-services/recycling-bins/) | Merri-bek, Victoria | The accepted list includes cardboard, office paper and newspapers. Only clean, separate, unambiguous examples of those materials receive fixed paper/cardboard answers. |
| `merri-glass` | [Glass recycling bins — Merri-bek City Council](https://www.merri-bek.vic.gov.au/glass-bins) | Merri-bek, Victoria | Bottles and jars are distinguished from other glass products. The page does not confirm an appliance jug's destination. The jug's scored answer is to seek local information, not a claimed rubbish, glass-bin or e-waste destination. |
| `cfa-battery` | [Charging and battery safety — Country Fire Authority](https://www.cfa.vic.gov.au/plan-prepare/fires-in-the-home/charging-and-battery-safety) | Victoria | Bulging/swelling is a warning. Ordinary sorting stops, the child leaves the device alone and alerts a grown-up, and the grown-up obtains official guidance. The game gives no handling, removal or transport procedure. |
| `sv-reuse` | [Minimise your e-waste — Sustainability Victoria](https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste/minimise-your-e-waste) | Victoria | Background support for reuse and considering repair. Search retrieval supplied page text; direct opening returned HTTP 403. Reuse scoring also has the directly opened Merri-bek and Energy Safe sources. Claims about prices or repair-cafe suitability were not imported. |
| `unicef-ritec` | [Responsible Innovation in Technology for Children — UNICEF Innocenti](https://www.unicef.org/innocenti/projects/responsible-innovation-technology-children) | International | Design rationale for choice, mastery, creativity and connection. Search retrieval returned the project/framework text, but direct opening timed out. This is not evidence that FixForward Quest improves retention, learning or behaviour. |
| `w3c-dragging` | [Understanding SC 2.5.7: Dragging Movements — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | International | A simple pointer alternative must accompany dragging; keyboard access is a separate concern. This reference alone does not establish WCAG conformance of the complete game. |

All nine entries have the actual checked date **2026-09-13**. Direct page access succeeded for the seven sources other than the two explicitly qualified above. The UNICEF and W3C records are marked `designReference: true`; the content validator rejects a scored item supported only by design references.

## Local context and the collection boundary

Collection Station uses **Merri-bek, Victoria** as its initial local example. Its three destinations are teaching decisions, not a model of the entire council bin service. “Paper and cardboard recycling” covers the cited accepted materials within Merri-bek mixed recycling. “E-waste collection” means a grown-up must find a service accepting that exact item; it is not a household bin. “Ask a grown-up” acknowledges a warning or missing information.

Ordinary electrical cards explicitly have a completed fictional adult assessment, with repair and reuse ruled out for that particular story. They are ready for collection planning. The four exception cards visibly say **WARNING** or **MISSING** and are not in that ready group. A missing report never silently becomes a negative repair assessment.

No fixed recycling answer is supplied for food, appliance glass, batteries with warning signs or ambiguous plastics. The glass jug remains unresolved even after a successful mission. A shaver is an electric appliance, a kettle has its electrical base/cord, and cardboard packaging is separate from the appliance. Repeated silhouettes deliberately have different conditions.

## The eight complete authored stories

| Mission ID | Evidence supplied by the fiction | Accepted decision | Sources |
|---|---|---|---|
| `flo-next-home` | Working fan; completed adult reuse checks; willing new household | Adults arrange the handover | `esv-secondhand`, `merri-ewaste`, `sv-reuse` |
| `quiet-fan` | Stopped fan; no cause assessment | Adult arranges qualified assessment | `esv-home`, `merri-ewaste` |
| `pip-damaged-cable` | Cable damage already reported in the picture; grown-up available | Leave item alone and tell grown-up | `esv-home` |
| `kettle-second-chance` | Qualified repairer's report allows repair; owner chooses it | Adult arranges the agreed repair; outcome says work is not yet done | `esv-home`, `merri-ewaste` |
| `kettle-last-chapter` | Particular kettle will not be repaired or reused; receiving acceptance unknown | Adult finds and checks an accepting service | `merri-ewaste` |
| `moving-day-box` | Toaster's adult reuse plan; separate clean cardboard; local rule | Toaster to adult-arranged reuse, cardboard to paper/cardboard recycling | `esv-secondhand`, `merri-paper`, `merri-ewaste` |
| `bulging-gadget` | Reported battery warning; normal collection paused | Leave item alone; tell grown-up who obtains official guidance | `cfa-battery` |
| `mystery-glass-jug` | Appliance glass rather than bottle/jar; acceptance unknown | Grown-up checks the exact local answer | `merri-glass` |

Each record contains two or three clues, one or two slots, action-specific feedback, an accepted plan, a wrong-choice retry opportunity, an explicit scene outcome, help text, a discussion prompt and source IDs. The moving-day slots identify **items**, not chronological steps; placing either correct tile first is valid. No arbitrary action ordering determines its answer.

The cooperative variation belongs to `kettle-second-chance`: one person considers the character/owner's need while a companion reveals the fictional repairer's report. A solo player can reveal the same evidence; adult availability is not a gate to progress.

## Twelve initial sorting cards

| Card ID | Distinct story condition | Answer | Concept |
|---|---|---|---|
| `kettle-ready` | Electrical kettle/base, assessed, collection plan needed | E-waste collection | Check acceptance |
| `toaster-ready` | Toaster's assessment completed; repair/reuse ruled out | E-waste collection | Check acceptance |
| `fan-ready` | Fan's assessment completed; no repair/reuse plan | E-waste collection | Check acceptance |
| `shaver-ready` | Electric shaver, assessed, no reported warning | E-waste collection | Check acceptance |
| `toaster-box` | Clean empty cardboard, separate from toaster | Paper/cardboard | Separate packaging |
| `kettle-box` | Clean cardboard carton, separate from kettle | Paper/cardboard | Separate packaging |
| `office-paper` | Plain clean office paper, no plastic sleeve | Paper/cardboard | Identify material |
| `newspaper` | Clean dry newspaper, no attached bag | Paper/cardboard | Identify material |
| `shaver-warning` | Bulging battery warning | Ask grown-up | Stop for warning |
| `fan-unassessed` | Quiet fan with missing assessment | Ask grown-up | Seek assessment |
| `jug-unknown` | Appliance glass with unknown local acceptance | Ask grown-up | Accept uncertainty |
| `toaster-unknown` | Working note but no adult assessment/pathway | Ask grown-up | Establish reuse evidence |

The fixed bank supplies deterministic reviewed variants. The run selector may vary the five chosen cards, but it must not create new combinations of conditions or repeat the same card within a round. Guessing “fan means e-waste” fails on the unassessed fan. The sorting fiction does not label every broken appliance as rubbish.

## Review and AI-use handover

The team's existing [AI-use acknowledgement](../AI_USE_ACKNOWLEDGEMENT.md) remains the governing draft and still requires student review against the actual Moodle wording. For this change, record **OpenAI Codex assistance on 13 September 2026** for scenario adaptation, source comparison, illustration/code support, tests and documentation. Do not claim a student personally authored or clinically validated AI-assisted material. Preserve the original build brief/conversation as prompt evidence if the course requests it; keep secrets and unrelated private information out of that record.

The focused [content tests](../test/quest-content.test.js) check traceable accepted plans, missing/draft sources, design-only source misuse, stream boundaries, deliberate condition differences, cooperative solo access, and prohibited real-handling/impact language. They do not replace a human safety/content review or observed usability sessions. Use the course's consent and research process before involving children. No educational effectiveness study has occurred.

Before adding another scored rule, record its exact evidence, context and check date, distinguish authored story facts from imported data, and review the accepted alternatives. If the source does not settle an answer, author an explicit uncertainty scenario or omit that answer. Never infer recall clearance, universal acceptance, professional qualification, free repairs, a repair price or environmental savings from incomplete evidence.
