# FixForward v1.5 — Human usability test script

Use this with real participants. Do not explain where buttons are or what a product recall means before the participant tries the interface.

## Opening statement

> We are testing the website, not you. Please say what you are thinking as you use it. Some information is prototype/limited. Do not enter real private information you do not want recorded in our research notes.

## Scenario A — direct repair

> Your vacuum cleaner stopped working. You want to find somewhere that may help repair it. You do not want to read a long guide.

Observe:
- Can the participant find Repair from the first screen without scrolling?
- Do they understand why a short safety check appears?
- Is the question count acceptable?
- Can they understand the info/help button?
- Can they get to map/list/contact actions?
- Which information do they look for first: address, phone, distance, opening time, source?

## Scenario B — unfamiliar safety wording

> You see a question you do not fully understand. Use the website as you normally would.

Observe:
- Do they notice “What does this mean?”?
- Does the visual help?
- Do they understand they must not test the appliance?
- Can they change Yes/No after reading help?

## Scenario C — user is still not sure

> Even after the explanation, you are not sure whether the warning applies.

Observe:
- Do they find “I’m still not sure — show a safer next step”?
- Do they expect more questions?
- Does the result tell them what to do next?

## Scenario D — serious warning

> Your kettle has a new burning-plastic smell.

Expected:
- User can stop after that answer.
- Stop-use guidance appears.
- No community Repair Café/cost route is offered as the ordinary next step.

## Scenario E — recycling without location permission

> You want to recycle an old appliance but do not want to share your exact location.

Expected:
- Manual suburb/postcode is obvious.
- User is not blocked by denying geolocation.

## Scenario F — recycling with uncertainty

> You want to recycle the appliance, but you are not sure about one of the safety warnings.

Expected:
- User is not forced through remaining questions.
- If not high-risk/recall, they can view recycling places to contact.
- Transport/contact warning is clear.

## Scenario G — cost comparison

> You have a repair quote of $180 and saw a similar replacement for $320.

Observe:
- Is the automatic-estimate limitation understandable without sounding broken?
- Can they immediately find the manual inputs?
- Does the visual comparison help?
- Do they understand that lower upfront cost is not an instruction to choose that option?

## Scenario H — recall knowledge

> You have never heard the term “product recall”. Your appliance is a Mistral BVC 160 vacuum cleaner.

Observe:
- Does the interface explain the term?
- Does “may be affected” avoid sounding like a confirmed recall?
- Can they identify the official notice action?

## Scenario I — near model

Use BVC 161.

Expected:
- It is not upgraded to the BVC 160 exact match.
- User is encouraged to re-check the label/official search.

## Scenario J — slow startup

Throttle/slow the public API or use a cold deployment.

Expected:
- Landing page appears immediately.
- User can begin identifying appliance.
- Service screen updates when service data becomes available.
- Recall unavailable state can be replaced once recall data arrives.

## Questions after each scenario

Ask without leading:

1. What do you think FixForward is telling you?
2. What would you do next?
3. Was anything confusing or unnecessary?
4. Was anything missing that you expected to see?
5. Which part felt like the most work?
6. What would you call the website's main purpose in your own words?

## Record

- task completion: yes/no/partial;
- time to first correct action;
- wrong turns;
- words participant did not understand;
- help panels used;
- questions skipped/uncertain;
- participant's expected next action;
- accessibility/device/browser notes;
- exact build version and commit hash;
- screenshot/recording only where consent allows.

## Scenario K — browser Back and editing the appliance

> Start a cost journey for one appliance, reach the result, then use Back and change to a different appliance.

Expected:
- Back labels make sense.
- Old safety/result state is not silently attached to the new appliance.
- An old displayed cost comparison is invalidated when identity changes.

## Scenario L — service/map failure

> Reach Repair options, then block the Leaflet/CDN or map tiles in DevTools.

Expected:
- Text service cards remain usable.
- The page says the map could not load rather than implying service search failed.
- Call/Directions/address remain visible where source data provides them.

## Scenario M — geolocation allow / deny / timeout

Run three times: Allow, Deny, and simulated timeout/unavailable.

Expected:
- Allow sorts nearby results.
- Deny/timeout never blocks manual suburb/postcode.
- No exact coordinate is sent to a FixForward API or saved in browser storage.
- Map resources are not requested before there is a useful search/result set.

## Scenario N — narrow mobile / 200% zoom / keyboard

Complete one direct Repair journey using:

- a narrow mobile viewport;
- desktop at 200% zoom;
- keyboard only.

Observe:
- no clipped goal buttons, question controls, sticky action or service actions;
- focus order follows the visual task;
- “What does this mean?” is reachable and its explanation receives focus;
- map is not required to finish the task.

## Scenario O — unavailable public datasets

Test recall unavailable and location unavailable separately.

Expected:
- recall failure does not block static safety questions;
- location failure does not make recall/safety appear broken;
- Retry is available for a genuine location failure;
- no failure message claims an unrelated dataset failed.

## Scenario P — plain-language comprehension

Without explaining the site first, ask the participant after the landing page and after a safety result:

> “Tell me what this page means in your own words.”

Record every word they ask about. Pay special attention to: product recall, model number, electrical appliance, Repair Café, qualified repairer, e-waste, replacement price and safety notice.
