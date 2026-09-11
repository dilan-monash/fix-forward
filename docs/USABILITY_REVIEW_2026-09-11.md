# FixForward usability review and fixes

Date: 11 September 2026. Scope: the local v1.6 prototype in this folder.

This was an expert walkthrough using simulated household/parent scenarios, code review, automated interaction tests, and Chrome checks. No real parents were recruited or observed. These findings do not constitute a completed participant study or accessibility certification.

## What the parent scenarios revealed

1. **A busy parent with a faulty kettle:** “I don't know whether that is a burning smell. Can I still find someone to ask?” The old Repair → Not sure screen ended with external safety links. It offered no repair or replacement exploration.
2. **A parent watching household costs:** “I don't have a quote yet. Why do I have to describe the fault to see generic fees?” The interface promised estimates but displayed the same published service fees. The form asked for effort without producing a personalised price.
3. **A cautious parent:** “I already said there was smoke, but I can't answer the rest.” The opt-out action discarded the serious answer and replaced it with uncertainty.
4. **A person using a small phone or keyboard:** selecting a group, submitting a form, or changing a filter could remove the focused control. The progress strip was wider than the phone.
5. **A parent interrupted mid-task:** changing the problem description erased unsubmitted prices. Browser history and delayed network/location responses could revive an inappropriate screen.

## Findings and implemented changes

| ID | Priority | Problem / point of hesitation | Change |
|---|---|---|---|
| U01 | High | Not sure ended Repair and Compare journeys without useful choices. | All four starting goals now offer repair contacts, repair-versus-replacement cost exploration, and recycling when safety is uncertain and there is no possible recall. |
| U02 | Critical | “I'm not able to check this safely” erased an existing serious warning. | Previously recorded critical answers remain critical. Incomplete checking adds uncertainty without clearing the warning. |
| U03 | High | Following costs into repair could clear the safety context. | Safety status follows the user. Unresolved safety shows contact-first business listings and excludes community Repair Cafés, including filters and wider-search links. Listings do not certify qualifications. |
| U04 | High | Browser Forward could bypass a newly changed safety answer. | Rendering rechecks current answers and recall status before showing ordinary pathways. Serious warnings and possible recalls interrupt ordinary cost/repair flows. |
| U05 | High | A recall arriving after a fast user reached costs was not reflected on that screen. | Late valid recall data updates the current decision and shows official recall instructions when required. |
| U06 | Medium | Starting again left old history entries that could reopen an empty/stale journey. | Each new journey invalidates history entries from the cleared one. |
| U07 | Medium | Late geolocation/retry results could reopen a screen after Back or Start again. | Callbacks check the active journey/request. Data retry no longer forces the user back into service search. |
| U08 | Medium | Typed repair/replacement prices disappeared when another form rerendered. | Draft prices update in memory while typing and survive relevant rerenders. |
| U09 | Medium | Editing a price left the previous comparison visible. | A changed input clears the previous result until the user compares again. |
| U10 | Medium | A genuine free repair or pasted currency amount was rejected. | Confirmed $0 repairs and common AUD/dollar/comma formats are accepted. Negative, malformed and implausibly large values still receive field errors. Arithmetic is rounded to cents. |
| U11 | High | “Estimate”, “smart cost context”, and “model-level price evidence” implied capabilities or used developer language. | Plain labels explain inspection fees and real-price comparison. Generic fees explicitly do not change with the problem description. No model-specific estimate is claimed. |
| U12 | Medium | Users without a quote had no clear next step. | Expandable guidance explains what prices to collect, extra fees to include, and how to contact a repairer/retailer/manufacturer. |
| U13 | Medium | Generic price examples made the comparison page long and buried actions. | The manual comparison comes first; fee examples are optional expandable content. A fault description is optional. |
| U14 | Medium | “Has water got inside?” was ambiguous for a kettle. | The question identifies electrical parts/power base. Help distinguishes normal water in the jug/tank from water at electrical parts. |
| U15 | Medium | The uncertainty panel dominated the page before useful actions. | Reduced its heading and padding; retained the warning and gave exploration options a clear heading. Serious-warning styling remains distinct. |
| U16 | Medium | Mobile progress steps overflowed and sticky bars overlapped. | All three steps fit in columns; header/progress share a consistent container; small/short screens avoid a large sticky obstruction. |
| U17 | Medium | Small controls, weak blue text contrast, invisible/replaced keyboard focus. | Larger targets, 16px form text, stronger focus rings, darker blue text, selected-state semantics, and focus restoration after relevant actions. |
| U18 | Medium | Smooth scripted scrolling ignored reduced-motion preference. | Scripted scrolling respects the system preference. |
| U19 | High | Malformed API records could crash the UI or become misleading no-match results. | Affected datasets fail explicitly; invalid recall rows are not silently discarded. Other datasets remain usable. |
| U20 | Medium | Bundled source links made total API failure appear partially connected. | API availability is tracked separately from bundled reference links. Total endpoint failure is accurately classified. |
| U21 | Medium | Hung fetch/JSON operations could leave loading unbounded. | Bounded timeouts handle stalled requests and response parsing. |
| U22 | Medium | Missing coordinates could become false map points; failed map scripts could not retry cleanly. | Coordinate validation rejects missing/out-of-range values, failed scripts are removed before retry, and list-based results remain usable. |
| U23 | Medium | 404/500 pages offered little recovery help. | Error pages explain the problem and give visible recovery actions. |
| U24 | Medium | “Use the official recall search” appeared as plain text in some fallback screens. | Added a direct official-search link in the compact unavailable-recall message. |
| U25 | Medium | “Motorised kitchen”, “Complex kitchen” and “Air treatment” were technical categories a parent had to interpret. | Labels now use appliance examples or familiar activities: Blending & mixing; Coffee, air fryers & microwaves; Heating & cooling. |
| U26 | High | Browser Forward after changing appliance could open old guided results before completing the new check. | Results and downstream pages all require the current appliance's answers or an explicit cannot-check choice. |
| U27 | Medium | A pending GPS result could overwrite a newer manual suburb choice. | Manual entry/selection invalidates the older location request. |
| U28 | High | A previous no-match recall message survived a failed refresh. | A failed refresh replaces the old no-match claim with unavailable guidance; an already known possible recall remains restrictive. |
| U29 | Medium | A loaded map retained its loading text and markers had generic names. | Remove the loading placeholder once ready and give each marker its listing name. |
| U30 | Medium | The documented local `.env` setup was not loaded by the app. | Flask and the diagnostic now load `.env`; existing environment values take precedence. |
| U31 | Medium | API outage responses could be cached; queries could hang after connecting. | Failed responses use `no-store`; database statements have a ten-second timeout. |
| U32 | High | A healthy web process was confused with a usable database. | Corrected health/readiness documentation and added a diagnostic that reads all four actual dataset routes, reports counts, distinguishes empty imports, and hides credentials. |

## The uncertainty wording

The result now says:

> You can still explore your options.
>
> We cannot recommend repair or replacement while safety is unclear. These paths help you gather information. Get advice before using the appliance again.

The three actions are **Explore repair options**, **Explore repair vs replacement**, and **Find recycling places to contact**. These options do not indicate that the appliance is safe. A possible recall still takes priority, and serious warnings retain stop-use guidance.

## Validation evidence

Final local results: **104 JavaScript tests passed**, including **24 DOM interaction tests**. **10 dependency-independent Python tests passed** (four data transformations and six diagnostic cases), and changed Python files compiled. Full Flask integration tests could not run because Flask dependencies were unavailable. Network installation failed and its escalation request was aborted; no Flask server was started. These limits do not affect the separate Node fixture server used for browser testing.

The JavaScript suite includes logic, API contract/error tests, existing UI contracts, and DOM integration tests running the actual application event handlers. Synthetic API and location fixtures are isolated to tests; they are not inserted into the database.

Tested scenarios include:

- All four starting goals with clear answers and with Not sure.
- Partial check / cannot-check, mixed critical and uncertain answers, possible recalls and late recalls.
- Professional-contact filtering versus community events when safety is unresolved.
- Price drafts, $0 repair, common pasted amounts, invalid input focus, cent rounding, stale-result removal.
- Browser Back/Forward, changing answers, Start again, and late geolocation responses.
- Keyboard postcode suggestions, selected area search, location denial and manual fallback.
- API outage, malformed records, request/parsing timeout, and map-load failure with a usable service list.

Chrome walkthroughs verified the original unsure dead end, updated uncertainty options, help disclosure, optional identity fields, the $0 cost comparison, retained caution on repair contacts, unavailable-service recovery, and narrow-screen progress/options layout.

A separate local test server at port 5501 supplied clearly labelled synthetic listings. Chrome verified `312` → Arrow Down twice → Enter selecting Richmond, displaying two business listings while excluding the café, retaining keyboard focus, loading the map, and opening the matching marker popup. This is evidence of the UI with test data, not a Neon connection or endorsement of any provider. No test listing was contacted or visited.

With requested 320px and 390px viewport settings, the browser's existing 90% zoom produced effective CSS widths of approximately 355px and 433px. DOM measurements found no horizontal overflow on the inspected landing, identification, check and uncertainty-result layouts. All three progress steps fit; uncertainty buttons measured at least 48px high. Device-emulation screenshots were affected by capture/scaling problems, so they are not evidence of physical-phone visual acceptance.

## Database and deployment boundary

The existing user tab was served at `http://127.0.0.1:5500/index.html`. The frontend requests `/api/...` on the same origin. A static preview alone cannot establish a Neon connection. No `DATABASE_URL` environment variable or local `.env` was present at the initial inspection.

The current backend is PostgreSQL-based. Historical project notes about SQLite do not describe a configured fallback in this checkout. Use the Flask app and its database-readiness check to verify the real connection. A healthy web process alone is not proof that application tables can be read.

Follow [DATABASE_CONNECTION_CHECK.md](DATABASE_CONNECTION_CHECK.md). Once dependencies and the ignored `.env` are ready, run `python -m backend.check_database` using the project's Python environment. It prints statuses and counts, not the connection string. Then run Flask and check the exact website origin at port 5000 or its deployed domain.

Live Neon connectivity, live service-list contents, live role privileges, and production deployment are not verified without the actual configured environment. Keep credentials in the ignored `.env` or hosting environment, not in browser JavaScript or this report.

## Source checks

Published fees were checked on 11 September 2026 against the providers' own pages. They remain examples, with parts/labour/delivery limitations and a prompt to confirm applicability before booking:

- [National Appliance Repairs pricing](https://www.nationalappliancerepairs.com.au/pricing/): workshop inspection examples.
- [One Touch Appliance Repairs services](https://1touchappliancerepairs.com.au/services/): call-out/labour examples.
- [Energy Safe Victoria: using electricity safely](https://www.energysafe.vic.gov.au/community-safety/energy-safety-guides/home-safety/using-electricity-safely): electrical-appliance safety context.

## Remaining validation with real users

The implemented fixes are ready for a participant round. Observe actual parents completing tasks without coaching: find repair help with an unsure answer, compare a free repair with replacement, identify what a generic fee does and does not mean, locate a service on a phone, and recover after changing their mind. Record task success, hesitation, wrong turns and the participant's own words. Do not count this expert simulation as participant evidence.

Still required for full acceptance: a real configured database/deployed URL, populated live-map/provider checks, physical-phone visual testing, and manual screen-reader testing. No test suite proves the absence of every usability defect.
