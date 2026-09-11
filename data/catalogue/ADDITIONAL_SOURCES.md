# Additional retail price observations

Reviewed on 11 September 2026 for FixForward.

This separate seed adds 10 factual AUD advertised-price observations covering the 9 appliance categories absent from the initial catalogue. It includes The Good Guys and Harvey Norman direct retailer listings. These are recorded examples from official retailer pages, not a complete price history, a live feed, proof of stock, or evidence of appliance reliability.

## Evidence and dates

`observedAt` records the date the source was reviewed. Some retrieved pages were cached snapshots; their reported age appears below. A recent review date does not mean the retailer changed or guaranteed the price on that date. All rows retain `availability: "not-verified"`.

Full product purchase prices are recorded before delivery and optional extras. Instalments, cashback, price-beat promises, conditional checkout discounts and assumed savings are excluded. Jaffle makers, hand mixers, steam mops and different heater formats are deliberately described as examples within broad categories; they are not necessarily equivalent replacements for the user's appliance.

| Model | Category | AUD | Official product source | Reported snapshot age | Verification |
| --- | --- | ---: | --- | --- | --- |
| KRC300BSS2JAN1 | rice-cooker | $55.00 | [The Good Guys product page](https://www.thegoodguys.com.au/kambrook-meal-master-mini-krc300bss2jan1) | 1 day | Indexed product result and Kambrook brand page showed $55; deal ends 30/09/26. The older /meal-master-mini-50061774 snapshot was rejected. |
| BTS200SIL | sandwich-press | $69.00 | [The Good Guys product page](https://www.thegoodguys.com.au/breville-the-original-sandwich-maker-bts200sil) | 2 days | Opened product page showed $69; sandwich-press category agreed. |
| 5KHMB732ABM | mixer | $147.00 | [Harvey Norman product page](https://www.harveynorman.com.au/kitchenaid-cordless-hand-mixer-black-matte.html) | 3 days | Opened product page showed $147 and Clearance. No matching row was exposed in the current general hand-mixer category, so this is a product-page observation only. |
| FDP22130GY | food-processor | $129.00 | [Harvey Norman product page](https://www.harveynorman.com.au/kenwood-multipro-go-food-processor-storm-blue.html) | 2 days | Opened product page and food-processor category showed $129; Clearance label retained. |
| S1000ANZ | steam-cleaner | $99.00 | [Harvey Norman product page](https://www.harveynorman.com.au/shark-steam-mop-s1000.html) | Today (indexed result) | Official indexed product content showed $99, product identifier S1000ANZ, and specification identifier 2102101S1000ANZ; current steam-cleaner category also showed $99. Direct open sometimes returned an empty response. No promo-code discount was calculated. |
| S5527AU | straightener | $59.00 | [Harvey Norman product page](https://www.harveynorman.com.au/remington-pro-ceramic-extra-wide-plate-hair-straightener.html) | Today | Opened product page showed S5527AU at $59; Remington category agreed. |
| HCM2030 | portable-heater | $57.00 | [Harvey Norman product page](https://www.harveynorman.com.au/de-longhi-convector-heater.html) | 1 day (indexed result) | Official indexed product content showed HCM2030 at $57 ending 13/09/26; DeLonghi heater category agreed. Direct open sometimes returned an empty response. |
| FH140N | portable-heater | $69.00 | [The Good Guys product page](https://www.thegoodguys.com.au/nordic-ceramic-fan-heater-with-timer-fh140n) | 1 day (indexed result) | Official indexed product content showed FH140N at $69; fan-heater category agreed. |
| LAD208WHT | dehumidifier | $369.00 | [The Good Guys product page](https://www.thegoodguys.com.au/breville-the-smart-dry-dehumidifier-lad208wht) | Today | Opened direct retailer product page and current dehumidifier category both showed $369. No conditional sign-up or price-beat discount was applied. |
| GCPAC200 | portable-air-conditioner | $449.00 | [Harvey Norman product page](https://www.harveynorman.com.au/goldair-7000btu-portable-air-conditioner-white.html) | 1 day | Opened product page showed GCPAC200 at $449; portable-air-conditioner category agreed. |

## Supporting retailer listings

- [Kambrook brand catalogue](https://www.thegoodguys.com.au/kambrook): KRC300BSS2JAN1 at $55.
- [Sandwich presses](https://www.thegoodguys.com.au/small-kitchen-appliances/grills-and-sandwich-presses/sandwich-presses?page=1): BTS200SIL at $69. This returned a snapshot labelled two weeks old; the product page supplied the primary observation.
- [Harvey Norman food processors](https://www.harveynorman.com.au/kitchen-appliances/food-preparation/food-processors): Kenwood MultiPro Go Storm Blue at $129.
- [Harvey Norman steam cleaners](https://www.harveynorman.com.au/vacuum-laundry-appliances/steam-cleaners-shampooers/steam-cleaners): Shark S1000 at $99.
- [Harvey Norman Remington straighteners](https://www.harveynorman.com.au/health-fitness-beauty/hair-styling/hair-straighteners/remington/993): Pro Ceramic Extra Wide at $59.
- [Harvey Norman DeLonghi electric heaters](https://www.harveynorman.com.au/heating-cooling-air-treatment/heating/electric-heaters/delonghi/993): HCM2030 named Convector Heater at $57, ending 13 September 2026.
- [The Good Guys fan heaters](https://www.thegoodguys.com.au/heating-and-cooling/heaters/fan-heaters): FH140N at $69.
- [The Good Guys dehumidifiers](https://www.thegoodguys.com.au/heating-and-cooling/air-treatment/dehumidifiers): LAD208WHT at $369.
- [Harvey Norman portable air conditioners](https://www.harveynorman.com.au/heating-cooling-air-treatment/air-conditioning/portable-airconditioners): Goldair 7000BTU at $449.

## Exclusions and limitations

- Kambrook KFH770GRY was excluded after its product snapshot showed $69 while the current brand/category listings showed $99. A trailing-slash product URL also returned an older expired $89 promotion.
- Goldair GFH220 was excluded after its product snapshot showed $27 while category listings showed $39.
- DeLonghi TRRS0510T was excluded after a product snapshot showed $110 while the category showed $104.
- These differences were not interpreted as historical price changes. They may reflect caching, changing offers or different retrieval states.
- The [JB Hi-Fi DC30DEHUM listing](https://www.jbhifi.com.au/products/dimplex-30l-portable-dehumidifier-4l-tank-2-speeds-white) was excluded because the retrieved content did not identify its seller. It was not treated as a verified direct-retailer offer. The included dehumidifier observation uses The Good Guys instead.
- Do not copy retailer-generated AI summaries, star ratings or promotional claims into safety, diagnosis, repairability or reliability recommendations.
- Keep the promotion expiry in notes, especially the DeLonghi offer ending 13 September 2026. Recheck sources before refreshing observation dates.
