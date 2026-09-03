# Step 4: Appliance family mapping (GOV-11 draft)

**Status:** DRAFT — needs team approval before coding against it.

**File:** `data/mapping/appliance_families.csv`

## The six FixForward families

1. **Heating and simple cooking** — kettles, toasters, rice cookers  
2. **Motorised kitchen** — blenders, mixers, food processors  
3. **Complex kitchen** — coffee machines, air fryers, deep fryers  
(microwaves are out of Iteration 1 scope: ORA has no microwave category)  
4. **Cleaning** — vacuum cleaners, steam cleaners  
5. **Personal care** — hair dryers, straighteners, shavers  
6. **Air treatment** — fans, portable heaters, dehumidifiers, portable air conditioners  

## How this file works

Each row maps one **ORA `product_category`** to a FixForward **family** and **category** (what the user sees in US1.1).

| Column | Meaning |
|--------|---------|
| `family` | One of the six approved families |
| `category` | User-facing category within that family |
| `ora_product_category` | Exact string from ORA CSV `product_category` column |
| `in_scope` | `yes` = fully in scope; `partial` = shared ORA bucket, document limitation |
| `aus_sample_size_202507` | AU row count when we downloaded (for mentor evidence) |
| `notes` | Limitations, n<30 warnings, mapping caveats |

## Known limitations (tell your team)

- **Small kitchen item** is shared between rice cookers and air fryers in ORA — we cannot split them in the data.
- **Hair dryer** (n=26) and **Aircon/dehumidifier** (n=8) are below the n≥30 rule for Australian-only stats.
- **Steam cleaners** do not have a dedicated ORA category.
- **Microwaves** are out of Iteration 1 scope. ORA v0.3 has no microwave
  category, so a microwave UI category would have no honest repair evidence.
- ORA categories like Lamp, Laptop, Power tool are **not mapped** — out of FixForward appliance scope.

## Action for team (GOV-11)

Share this CSV in your team chat. Ask everyone to confirm family names and categories before we run cleaning scripts.

## Say this to your mentor

> "Before cleaning, we inspected ORA’s real column names and Australian category counts. appliance_families.csv is our controlled mapping from ORA product_category to the six appliance families in the proposal. The team must freeze this file so recall matching, repair stats, and the UI all use the same categories."
