# Step 4: ORA dataset exploration (peek before mapping)

**Source:** [Open Repair Alliance aggregate CSV](https://github.com/openrepair/data/tree/master/aggregated/202507)  
**File saved:** `data/raw/ora/OpenRepairData_v0.3_aggregate_202507.csv`  
**Retrieval date:** 2025-07 release (downloaded 2026-08-31)  
**Licence:** CC BY-SA 4.0

## Columns in the raw file

| Column | What it means |
|--------|----------------|
| `id` | Partner record ID |
| `data_provider` | Which repair organisation logged it |
| `country` | 3-letter ISO code (`AUS` = Australia) |
| `partner_product_category` | Partner’s own category label |
| `product_category` | **Standard ORA category** (we map from this) |
| `product_category_id` | Numeric ID for category |
| `brand` | Brand name (often missing or unknown) |
| `year_of_manufacture` | Year made |
| `product_age` | Age at repair |
| `repair_status` | `Fixed`, `Repairable`, `End of life`, or `Unknown` |
| `repair_barrier_if_end_of_life` | Why repair failed (when end of life) |
| `group_identifier` | Repair group |
| `event_date` | Date of repair event |
| `problem` | Free-text problem (we do not show to users) |

## Dataset size

- **Total rows:** 305,649 repair attempts (global)
- **Australian rows:** 3,108

## Australian rows by ORA `product_category`

Categories **in scope** for FixForward (mapped in `appliance_families.csv`):

| ORA category | AU count | n ≥ 30? |
|--------------|----------|---------|
| Kettle | 52 | Yes |
| Toaster | 118 | Yes |
| Small kitchen item | 169 | Yes |
| Food processor | 185 | Yes |
| Coffee maker | 89 | Yes |
| Vacuum | 229 | Yes |
| Hair & beauty item | 44 | Yes |
| Hair dryer | 26 | **No** — use global fallback or “insufficient evidence” |
| Fan | 50 | Yes |
| Aircon/dehumidifier | 8 | **No** — use global fallback or “insufficient evidence” |

Many other ORA categories (Lamp, Laptop, Power tool, etc.) are **out of scope** for FixForward’s six appliance families.

## Repair status values (global)

- Fixed
- End of life
- Repairable
- Unknown

## Top repair barriers (Australia, end-of-life records)

1. Item too worn out  
2. No way to open product  
3. Spare parts not available  
4. Repair information not available  
5. Lack of equipment  
6. Spare parts too expensive  

## Limitations to document (DATA-20)

- Repair Café / community repair data is **self-selected** (not a random sample of all appliances).
- ORA has **no model field** — we show **category benchmarks only**, never model predictions.
- Some in-scope categories have **few Australian records** (e.g. Hair dryer n=26, Aircon n=8).

## Say this to your mentor

> “We downloaded the official ORA aggregate CSV and inspected columns and Australian category counts before writing any mapping. We map ORA `product_category` to our six appliance families, and we only publish Australian statistics when n is at least 30; otherwise we label insufficient evidence or use a clearly marked global fallback.”
