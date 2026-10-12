# Explore 32: teaching content, provenance and energy assumptions

Content review: 10 October 2026. This document covers the 20 additional lessons in `prototypes/i3-world-preview/catalogue-expanded.js` and the source checks used while integrating the reference Explore experience. It does not claim that a photo identifies a model number, proves electrical safety, or measures an appliance's carbon footprint.

## What was reused and what was authored

The reference requested by the user is [FixForward prototype Explore](https://fixforward-i3-prototype.ashwood-juga-5492.chatgpt.site/explore/). Root recovered its source at commit `0694e329130550387bc5cbf2f428fb0dc85ec48a` into the ignored review directory `tmp/explore-3d/reference-source`.

The original `web/lab/devices.js` and `web/lab/extra-devices.js` were read. Their **part purpose / material / planet / care** teaching structure informed the new content. Existing ideas were adapted for smartphone, tablet-like electronics, headphones, television, refrigerator, washing machine, drill, toothbrush, portable air conditioner, heater and printer: protect useful parts, distinguish chargers from devices, keep real enclosures closed, check supported replacement accessories and protect personal data before reuse. New text uses the current app's IDs and manufacturer-reviewed wording rather than copying old `grown-up` copy throughout.

`catalogue-expanded.js` exports 20 entries with 113 named teaching parts. Every new part has `job`, `material`, `impact` and `care`. Each appliance also has three care tips, a comprehension question with an explanation, an energy caveat and a care-source link. `catalogue-part-context.js` adds explicit planet/care notes for the original 12 appliances and their 56 existing parts, drawing on their retained job, material and care content and the reference prototype's teaching structure. This gives 169 contextual parts across 32 appliances. Geometric and model-file provenance is handled by the model integration; this file does not assert that every new shape was downloaded from the reference.

These are generic, simplified models, not exact manufacturer assemblies. An inkjet printer does not describe every laser printer; a compressor dehumidifier does not describe a desiccant type; wireless headphones do not imply that wired headphones have batteries. Such distinctions appear in the relevant lessons. Digital separation of parts is **not a real disassembly activity**. No lesson instructs a child to remove a battery, open a power supply, release refrigerant, bypass an interlock or force a pressurised cap.

## Verified shared references

- [DCCEEW National Greenhouse Accounts Factors 2026](https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2026), [direct PDF](https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf), Table 1, printed page 10: verified scope 2 grid factors against the existing code. Victoria **0.74**, NSW/ACT **0.60**, Queensland **0.65**, South Australia **0.21**, WA SWIS **0.45 kg CO2e/kWh**. Existing factors were correct; no replacement was necessary. Scope 3 values in the neighbouring column are not added silently.
- [Australian Government appliance energy guidance](https://www.energy.gov.au/households/appliances): energy labels, settings, laundry and refrigeration habits. Example wattages below are authored scenarios, not numbers extracted from this source.
- [Energy rating labels](https://www.energy.gov.au/rebates/energy-rating-label): model-comparison and label-energy context.
- [Energy Safe Victoria: using electricity safely](https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely): water separation, damaged equipment and dryer lint-filter care. Product manuals supply exact model instructions.
- [ACCC lithium-ion battery guide](https://www.productsafety.gov.au/consumers/be-safe-around-the-home/safely-use-batteries-and-technology/lithium-ion-batteries-guide): stop using damaged or swollen battery equipment, use compatible chargers, avoid inappropriate disposal. The child-facing lesson stops at telling an adult and obtaining suitable advice; it does not reproduce transport, fire response or battery-removal procedures.
- [Sustainability Victoria: why e-waste cannot go in the bin](https://www.sustainability.vic.gov.au/circular-economy-and-recycling/at-home/recycling-at-home/e-waste/why-e-waste-cant-go-in-the-bin): recoverable materials and the value of accepted collection routes. The lessons do not claim that every material in every device is recoverable.
- [DCCEEW: refrigerant recovery at end of life](https://www.dcceew.gov.au/environment/protection/ozone/rac/local-government): controlled refrigerant recovery before applicable recycling/disposal, supporting the instruction to use appropriate specialist routes for cooling equipment. No procedure is presented for a family to perform.

## Appliance-specific reference checks

| New lesson | Primary reference and the bounded content it supports |
| --- | --- |
| Refrigerator | [Samsung refrigerator cleaning](https://www.samsung.com/ae/support/home-appliances/how-to-properly-clean-your-samsung-refrigerator/): gentle surface and door-seal care. Government energy guidance supports keeping food storage running and limiting avoidable open-door time. No temperature recommendation or food-safety diagnosis is invented. |
| Food processor | [KitchenAid base and attachment care](https://producthelp.kitchenaid.com/Countertop_Appliances/Food_Processors_and_Choppers/Food_Processor/9_Cup/Cleaning_and_Care/Cleaning_the_Base_and_Attachments_-_Food_Processor), [manufacturer manual](https://www.kitchenaid.com/content/dam/global/documents/202012/owners-manual-w11462548-reva.pdf): unplug before care, separate electrical base from washable parts, keep fingers out and use the proper pusher. Dishwasher advice is deliberately deferred to the actual model. |
| Sandwich press | [Breville BSG600 manual](https://www.breville.com/content/dam/breville/us/assets/miscellaneous/instruction-manual/grills-sandwich-makers/BSG600-instruction-manual.pdf): cool and unplug before cleaning, avoid scratching coated plates, do not immerse. Brand-specific reheating or chemical recipes are not copied into the lesson. |
| Portable heater | [Energy Safe Victoria](https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely) and [Fire and Rescue NSW advice](https://www.fire.nsw.gov.au/gallery/files/pdf/fire_news/firenews_2004_june.pdf): clear space, no clothing over heaters and appropriate dry placement. No universal clearance distance is invented; the manual specifies it. |
| Portable air conditioner | [De'Longhi airflow/filter/hose checks](https://www.delonghi.com/en-us/faqs/Portable-air-conditioner/a/82395), [installation requirements](https://www.delonghi.com/en-us/faqs/What-is-required-when-using-a-portable-air-conditioner/a/82380): air route, filter and exhaust-hose role. Electrical input is distinct from cooling capacity. |
| Dehumidifier | [De'Longhi collection/filter explanation](https://www.delonghi.com/en-us/faqs/The-dehumidifier-tank-doesn%26apos%3Bt-collect-water.-Why-is-this/a/17462), [DD-series manufacturer manual](https://www.delonghi.com/medias/DD30P-167918?context=bWFzdGVyfGRhbV9tYW51YWxzfDE5NDM1Nzh8YXBwbGljYXRpb24vcGRmfGFHRmhMMmd3Tnk4NE5EQXhNVGMwTmpJNU5UZ3pPQzlFUkRNd1VDMHhOamM1TVRnfDQ4OTg2ZDQ4OTY5NGRkNjE5MDIyZjg1ZjYxNGJkNGVkYjM4OWUyOGY3MTcwYmUyMWQ1MDM1MzVlMTM0NjhjZjM): filter restriction, tank care, disconnecting before cleaning. The lesson explicitly represents compressor cooling, not all dehumidifier designs. |
| Steam cleaner | [Kärcher Australia steam cleaner FAQ](https://www.kaercher.com/au/services/home-garden-support/home-garden-product-faqs/faq-steam-cleaner.html): residual heat/pressure and model-specific descaling. Detailed cap-release and chemical steps are intentionally not reproduced for children. |
| Washing machine | [Samsung Australia door/drum care](https://www.samsung.com/au/support/home-appliances/clean-door-and-drum/): checking pockets, gentle external care and using the exact model's cleaning cycle. No bleach recipe or internal pump-access steps are taught. |
| Clothes dryer | [Energy Safe Victoria](https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely) and [government appliance guidance](https://www.energy.gov.au/households/appliances): lint filter after use, clear airflow and line drying when suitable. Vented, condenser and heat-pump types are distinguished. |
| Sewing machine | [Brother domestic machine care](https://support.brother.com/g/b/sp/faqend.aspx?c=au&faqid=faqh00000095_004&lang=en&prod=hf_xl21202220eas): disconnect before care and model-specific lint cleaning. Needle/bobbin jobs are simplified; real needle removal or internal opening steps are not taught. |
| Smartphone, tablet | [Apple cleaning guidance](https://support.apple.com/en-au/103258), plus ACCC battery guidance above: appropriate cloths, no liquid in openings, separate care for device and charger. Different screen finishes need different cleaning; no chemical is universally prescribed. Account/data preparation remains an adult task. |
| Television | [Sony OLED/LCD care](https://www.sony.com/electronics/support/televisions-projectors-lcd-tvs/articles/00167099): gentle screen care, no direct liquid spray and external ventilation care. Installation and anti-tip instructions are delegated to the exact model. |
| Headphones | [Sony WH-1000XM6 care](https://www.sony.com/electronics/support/articles/00354941): moisture, drying and product-specific cushion care. Removal steps are not copied; whether cushions can be replaced must be checked for the actual pair. |
| Games console | [PlayStation cooling guidance](https://www.playstation.com/en-us/support/hardware/ps5-console-noise/): ventilation and external dust care. It does not validate every console's power use or permit opening another model. |
| Printer | [HP exterior/paper-path guidance](https://support.hp.com/us-en/document/c02474857): exterior care and model-specific cleaning. The geometric lesson is inkjet-style; a laser reference for external cleaning is not treated as an inkjet cartridge or mechanism diagram. |
| Straightener | [ghd styling-tool care](https://www.ghdhair.com/hairstyles/straight/spring-clean-your-beauty-tools): unplug and cool fully before cleaning. No universal temperature or treatment chemical is added. |
| Shaver | [Philips shaver care](https://www.philips.co.uk/c-f/XC000004469/how-do-i-clean-my-philips-shaver): model/head-specific cleaning; suitability for rinsing must be checked. The charger is not assumed washable. |
| Electric toothbrush | [Oral-B brush and charger care](https://www.oralb.co.uk/en-gb/support/other-issues/my-toothbrush-is-moldy-or-has-a-moldy-smell): brush/handle drying and separate stand-cleaning instructions. The activity teaches component life and care, not a dental treatment or universal brushing schedule. |
| Cordless drill | [Bosch EasyDrill 12 manual](https://www.bosch-diy.com/storage/en-sa/easydrill-12-40384-original-pdf-362647-en-sa.pdf), plus ACCC battery guidance: compatible charging and adult tool care. Children inspect only the digital model; no real drilling or battery-removal instructions are given. |

These references support general educational care boundaries. A source describing one manufacturer's model cannot certify another product, its condition, its material composition or repairability. Product-specific claims use “often”, “may”, “this example” or explicit instructions to check the actual manual.

## Energy and CO2e implementation contract

The shared calculator remains:

```text
input watts / 1000 × daily minutes / 60 × days = electricity kWh
electricity kWh × selected grid factor = kg CO2e
```

This is **operational grid electricity only**. It excludes production, transport, upstream fuel, grid losses, water, detergent, food, paper, network services, refrigerant leakage and disposal. `impact` text at part level is qualitative and never assigns unsupported carbon numbers to a material or a repair. “Can keep useful parts in use” is conditional, not a promise that every repair has a net environmental benefit.

`energyMode: 'charging'` identifies smartphone, tablet, headphones, shaver, electric toothbrush and cordless drill. Their watts mean an **invented average wall-charging input**, and minutes mean **daily charging time**, not usage time. The defaults are a teaching scenario, not recommended charging durations. Rated charger output and maximum input are not measured average wall draw.

`energyMode: 'continuous-average'` identifies the refrigerator. Its 40 W over 1,440 minutes is an invented whole-day average, **not a 40 W compressor running continuously and not a claimed average fridge**. An energy label's annual kWh can be converted to average watts as `annual kWh / 8.76`, assuming 365 days. This conversion preserves that label's test assumptions; it still does not measure a family's actual use. The lesson explicitly does not recommend switching off a fridge containing food.

Washing machine and dryer defaults represent invented average power during a cycle; their tips direct users towards measured/label cycle energy. Heaters, presses, cooling systems and other thermostatic appliances may cycle. A label's peak watts multiplied by a whole session can overestimate use. Energy tips explain this rather than reporting false precision.

## Local content validation

The module was imported directly with Node and its 20 unique IDs, 113 part records, three-tip care arrays, valid source URLs, challenge indices and positive scenario inputs were checked. Every named new part has job, material, planet and care copy. All six charging devices and the continuous-average fridge have their required energy modes. The original-part context map was also matched against `MODEL_PARTS` for all 12 original appliances and 56 parts, with nonempty care/impact copy on each. Integration, rendering, accessibility and full-regression results belong to the release report; this content check alone does not verify the browser or deployment.


## Geometry integration and local validation

`models-expanded-large.js` adapts the reference's fridge and washer from
`web/immersive/parts-models.js`, and heater / portable AC from
`web/immersive/extra-geometry.js`. `models-expanded-devices.js` adapts its phone,
headphone, television, toothbrush, drill and printer geometry patterns. Inline
comments identify commit `0694e329130550387bc5cbf2f428fb0dc85ec48a`. New geometry
adds the missing appliances and semantic teaching groups. The original twelve
local models remain intact. The recovered Site was read, not changed or published.

All geometry uses the existing vendored Three.js and existing part lifecycle:
`createAppliance(id)` creates groups, `world-engine.js` rotates/raycasts/separates
them, and `explore.js` uses those same part IDs to display lessons. The twenty
new geometry modules total 49,393 bytes (14,965 bytes with gzip); no external 3D
file or texture download is needed. Only the selected close-up model is created
when switching items. The original twelve-item room overview is retained.

Local review evidence on 10 October 2026:

- All 32 real models were selected through the browser's item picker without a
  renderer error. A contact sheet rendered every whole and separated model:
  32/32 passed in each view, zero render errors, 482,831 triangles across all32.
- All 169 parts have matching mesh/content IDs and purpose/material/care/planet
  text. Geometry tests enforce finite vertices, anchors, solid part geometry,
  floor bounds, camera bounds and fewer than 100,000 triangles per item.
- Browser tablet viewport: 820 ? 1180, no horizontal overflow; fridge separation
  exposes six numbered targets. This is emulation, not a physical touchscreen test.
- Browser fridge example: 40 average W ? 24 hours ? 30 days = 28.8 kWh;
  Victoria's 0.74 factor gives 21.31 kg CO2e. Labels explicitly say average power
  and daily plugged-in time. This verifies arithmetic, not real device emissions.
- `npm.cmd run check`: 558 passed, zero failures/skips.
- Prototype tests: 85 total; 84 initially passed, and the one category-name
  failure was fixed. The entire 52-test Action suite then passed; the 29 Explore
  and four real-geometry tests had already passed with all169 context records.
- Backend suite: 117 passed. Following the explicit new-asset allowlist addition,
  all seven affected world-route tests passed again. The gallery, tests and
  recovered source remain inaccessible through the Flask public asset route.
- Take action's 19 supported categories/classifier remain unchanged. Unsupported
  Explore items retain their identity and use the existing official-recall route.
- Source/tests/previews are local on `iteration-3`. Nothing was pushed or deployed.

Screenshots and command receipts are in the ignored `tmp/explore-3d` folder.
The local contact sheet is `prototypes/i3-world-preview/models-gallery.html`.
Camera AR placement/tracking still requires a compatible physical device; desktop
3D and mocked AR tests do not establish that physical behaviour.
