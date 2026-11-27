# BCCeC Data Integration and Dashboard Readiness — Assessment

**Status:** for approval. No code has been changed and no data imported.
**Prepared:** 19 November 2026.
**Readers:** NREP project lead, the M&E team and the Finance lead.

**Sources:**
- The seven CSV extracts of the BCCeC master tracker, listed in `dataset_catalog.csv`. They were shared in chat and are not yet in the repository: `data/bccec/source/` does not exist.
- The NREP-PROJECT-MGT codebase on branch `fix/api-auth`.
- The Google Drive folder `1H6iQ2N0sTLxcBWjGl9wq4TDgFn8wZQua`, which could **not** be read (see section 10).

**Method:**
- **Profiling:** every figure in this document was recomputed from the CSV values with a read-only script. The script and the transcribed data stay outside the repository.
- **Dates:** Excel serial dates were converted to calendar dates.
- **Phase 1:** 1 Aug 2024 – 31 Mar 2026, as the project lead stated.
- **Phase 2:** **assumed** to be 1 Apr 2026 – 31 Mar 2027, the BCCeC end date in the PMS. This needs confirming.

---

## 1. Summary

| | Rows | Period covered | Headline as reported | What can safely be said today |
|---|---|---|---|---|
| Direct reach | 128 | 26 Sep 2024 – 14 Dec 2025 | 99,656 participants | **41,642** people recorded at engagement events. Another 36,000 are template estimates and 22,014 are baseline respondents; both need an M&E decision. |
| Indirect reach | 72 | 2 Nov 2024 – 30 Nov 2025 | 90,730,651 "unique" reach | Only **estimated gross audience**. The "unique" column equals the per-row estimate, and the total is 1.88 times Uganda's population. |
| Private sector | 52 | 28 Jan 2025 – 26 Feb 2026 | 70,550 EPCs (+ 4,852 other products) | We do not know what the figures count (sold, ordered, displayed or enquired). They cannot be shown as sales yet. |
| Prospective buyers | 17 companies | No date | 253,778 | Pipeline only. **Never** a sale. Two values repeat exactly. |
| UNACC companies | 32 | No date | — | A reference list of companies, usable as-is. |
| EPC sales 2025/2026 | 21 companies (15 with a figure) | "2025/2026", undefined | 187,851 EPCs | Company self-reports. 83% comes from two companies (Kiboko 104,000; Digi Wave 52,500). They need source evidence. |
| Copy of Direct Reach | 0 rows (header only) | — | — | Discard. |

**All existing data falls in Phase 1.** Nothing in the extracts belongs to Phase 2 yet.

**The BCCeC data now gives three different EPC figures:**

| Source | EPCs |
|---|---|
| Company sales sheet already prepared for the PMS (19 companies, Jan–Nov) | 9,381 |
| Private Sector Data | 70,550 |
| EPC SALES DATA 2025/2026 | 187,851 |

They are probably different measures (period, scope, self-reported or observed). **None of them is verified adoption.** The dashboard must show them as separate, clearly labelled figures, or show none until M&E chooses one.

---

## 2. Data quality assessment

### 2.1 Direct reach (`01_direct_reach_data.csv`)

The 18 columns are:
- **When and where:** Date, Month, Year, Qrtr, Region, District.
- **What:** Activity Name, Total No. of Participants.
- **Who:** 18–24, 25–35, 36+, Male, Female.
- **Unlabelled pair:** Yes, No.
- **Nationality:** Ugandan, Refugees, Foreigner.

**What is consistent.** Every row passes the arithmetic checks:

| Check | Result |
|---|---|
| Age bands = total | 128 / 128 |
| Male + female = total | 128 / 128 |
| Yes + No = total | 128 / 128 |
| Ugandan + refugee + foreigner = total | 128 / 128 |
| Exact duplicate rows | none |

**Questionable figures, which need M&E confirmation:**

| # | Finding | Rows | Impact |
|---|---|---|---|
| D1 | **36 "Behavioral Change Awareness Outreach Exhibition" rows are identical templates.** Each has exactly 1,000 participants, split 49 / 651 / 300 by age and 320 / 680 by sex. Rows 91 and 98 differ only in nationality (37 / 960 / 3). | 16, 20, 23, 26, 28, 31, 38, 41, 44, 45, 52, 54, 55, 57, 60, 61, 66, 68, 77, 78, 81, 86, 87, 91, 94, 95, 96, 98, 101, 102, 107, 108, 113, 114, 118, 119 | 36,000 people (36% of the headline) are estimates, not head counts. |
| D2 | **Baseline Study**: six districts on one date (26 Sep 2024), 22,014 respondents. | 2–7 | A baseline survey usually measures a starting point. It is not programme reach, and 3,000–4,300 respondents per district is unusually large for a survey. |
| D3 | The **Yes / No** columns have no label. They sum to the total (627 Yes), so they are probably disability status (PWD). | all | They cannot be published until labelled. |
| D4 | **Quarter labels don't follow the sheet's own pattern.** Row 36 (4 Apr 2025) is labelled Y1Q2 instead of Y1Q3. Rows 65 and 66 (29 and 30 Jun 2025) are labelled Y1Q4 instead of Y1Q3. | 36, 65, 66 | Quarter totals shift. The quarter should be **calculated from the date**, never typed. |
| D5 | **Spelling:** "Feburary". | 23 | Cosmetic. The date is correct. |
| D6 | **Possible double entry:** two outreach rows in Mpigi on the same day (73 and 182 participants). | 83, 84 | Two separate sessions or one session typed twice? |
| D7 | **Two exhibitions in the same district a day apart:** Isingiro (91, 96) and Kamwenge (98, 102). | 91/96, 98/102 | If these are template rows, the same people may be counted twice. |
| D8 | **Very large single events:** World Refugee Day in Kiryandongo (6,000), Baise Igeme (5,368), the Nakasongola outreach (4,318). | 58, 9, 120 | Head count or estimate? This needs the method. |
| D9 | **Long free-text activity names** (e.g. row 49), with no activity type. | 49, 72, … | An **activity type** list is needed so the dashboard can filter (outreach, exhibition, conference, training, champions event…). |

**Totals, as reported, with no corrections:**

| Breakdown | Figures |
|---|---|
| By quarter label | Y1Q1 30,148 · Y1Q2 12,033 · Y1Q3 24,005 · Y1Q4 30,014 · Y2Q1 3,456 |
| By calendar year | 2024: 30,148 · 2025: 69,508 |
| By region | Central 34,641 · Eastern 25,468 · Western 26,796 · Northern 7,949 · West Nile 4,802 |
| By sex | Male 42,240 · Female 57,416 (57.6% female) |
| By age | 18–24: 11,322 · 25–35: 44,984 · 36+: 43,350 |
| By nationality | Ugandan 90,008 · Refugee 9,247 · Foreigner 401 |
| Districts covered | 43 |

The demographic shares above **include** the 36 template rows. Those rows pull the shares towards 65% aged 25–35 and 68% female, so the shares are not reliable either.

**How the quarter labels work.** Y1Q1 = September–December 2024 (September holds only the baseline). Q2 = Jan–Mar, Q3 = Apr–Jun, Q4 = Jul–Sep, and Y2Q1 = Oct–Dec 2025. That is a **project year running October to September**, with September 2024 included in Y1Q1. It is not the calendar year, and not the Phase 1 window (Aug 2024 – Mar 2026). M&E must say which one "aggregated by year" means (see section 9).

### 2.2 Indirect reach (`02_indirect_reach_data.csv`)

The 15 columns are:
- **When and where:** Date, Month, Year, Qrtr, Region, District.
- **The placement:** Medium, Station, Channel Type.
- **Assumptions:** Population Covered, % Listenership, % Campaign Reached.
- **Results:** Estimated Reach, Total Reach, Unique Individual Reach.

**The formula holds on every row:**
- **Radio and TV:** Estimated Reach = Population × Listenership × Campaign Reached.
- **Billboards:** Estimated Reach = Population × Campaign Reached. Their listenership cell is blank.
- **The campaign factor is 0.4 on every row.** No source is given for it.

| # | Finding | Rows | Impact |
|---|---|---|---|
| I1 | **"Unique Individual Reach" equals "Estimated Reach" on all 72 rows.** The column adds up to **90,730,651**, which is 1.88 times Uganda's population of 48,371,300. | all | **No deduplication was done.** The figure is a gross audience (impressions), not unique people. It must not be shown as "people reached". |
| I2 | **National population used for single programmes:** NTV People's Parliament ×5, NBS TV ×2, Spark TV, TV West, SMART24 ×2, and **CBS Radio ×4**. | 2, 3, 23, 37, 41, 44–47, 50, 51, 60, 62–64 | TV accounts for 57.4 million of the 90.7 million. Using the whole national population as coverage for a regional radio station (CBS) or one TV programme exaggerates reach. |
| I3 | **The 0.4 campaign-reach factor is applied to every row, billboards included.** | all | **Settled by the project lead (19 Nov 2026):** 40% is a **fixed business rule for all media channels**. See the rule box below. |
| I4 | **The same station has different coverage and listenership:** Capital FM (3 regions: 4.7M / 4.4M / 3.7M at 19% / 17% / 11%), Beat FM, and every billboard between May and August 2025 (e.g. Seeta 1.79M → 3.07M; Hoima 1.20M → 0.79M). | 17–21, 28–36 vs 52–59, 65–73 | Assumptions change with no record of why. A **dated, versioned assumption per outlet** is needed. |
| I5 | **Row 6 (Radio Buddu FM talk show):** Total Reach is twice the Estimated Reach (1,561,965 vs 780,982). | 6 | Probably two airings. Airings must become their own field (number of spots or shows). |
| I6 | **Row 61:** "Dembe FM", channel "Radio Adverts", but medium **TV**. | 61 | Wrong classification. |
| I7 | **No district** on 5 Capital FM / Beat FM rows (regional campaigns), all dated 1 Mar 2025. | 17–21 | These are regional placements. The district should be optional and the **coverage area** recorded instead. |
| I8 | **Name variants:** "SMART24" and "SMART 24". | 2, 3 | An outlet list with aliases is needed. |
| I9 | **Billboards repeated** in May 2025, Aug 2025 and Nov 2025, each counted in full. | 28–36, 52–59, 65–73 | Each repeat counts the same passers-by again. This should be reported as **exposure**, not new people. |
| I10 | **Spelling:** "Febraury". | 9 | Cosmetic. |

> **Business rule: media reach assumptions** (project lead, 19 Nov 2026)
> 1. **Campaign reach is fixed at 40% (0.4) for every media channel**: radio, TV, billboards and any future medium. No outlet may use a different campaign-reach value.
> 2. **CBS and Capital FM may have higher approved audience or listenership percentages.** Only their audience rate can differ; their campaign reach stays 40%.
> 3. **Every other station keeps its approved coverage population and audience percentage.**
> 4. **The system never increases these figures automatically** and **never changes historical records to raise reach.** Imported rows keep the values they were reported with. A newly approved assumption is a new, dated methodology version that applies from its effective date. It is never applied backwards to existing placements.

**Estimated gross audience by medium:**

| Medium | Placements | Gross audience |
|---|---|---|
| TV | 12 | 57,448,107 |
| Billboard | 26 | 17,715,344 |
| Radio | 34 | 15,567,200 |

**By quarter:** Y1Q1 1.4M · Y1Q2 9.5M · Y1Q3 27.8M · Y1Q4 38.9M · Y2Q1 13.1M.

### 2.3 Private sector (`03_private_sector_data.csv`)

The 13 columns are:
- **When and where:** Date, Month, Year, Qrtr, Region, District.
- **Seven product counts:** Briquettes, EPCs, Improved Cook Stove, LPG, Pressure cookers, Volcanic Rock Stove, Others (Kitchen e-Ware).

| # | Finding | Impact |
|---|---|---|
| P1 | **The unit is not stated** (sold, ordered, displayed or enquiries). 30 of the 52 rows fall on the same date and district as an outreach or exhibition in the direct-reach sheet, so these are probably **company figures reported at exhibitions**. | Cannot be called "sales" until M&E defines it. |
| P2 | **Single-event EPC counts look too high for on-the-spot sales:** Buruuli 3,571; Kampala 3,997 (30 Sep 2025); Iganga 3,034; Nebbi 2,661. | Probably cumulative company figures or orders. This needs the method. |
| P3 | **The dates look auto-filled.** Rows 42–46 run on consecutive days (26 Sep – 4 Oct 2025), and so do rows 48–51 (21–24 Nov 2025). | Day-level dates aren't reliable; at best only the month is. |
| P4 | **The month label disagrees with the date** in 4 rows: row 44 (date 1 Oct, labelled September) and rows 49–51 (22–24 Nov, labelled December). There are also spelling variants: "Feburary", "Novermber". | The rule must be decided: does the date or the label win? |
| P5 | **The Qrtr column is blank on all 52 rows.** | Quarters must be calculated from the date. |
| P6 | **Region names don't match the other sheets** (East / West / North instead of Eastern / Western / Northern). **Kikuube is labelled Central** but is in Western Uganda. Moroto is labelled East; it is in Karamoja, which other sheets file under Northern. | The region should be derived from the district via a master list, never typed. |
| P7 | **Places that are not districts:** Fortportal (a city; Kabarole), "Bushenyi (Ishaka)", Nakivale (a settlement in Isingiro), "Kamwenge (Rwamwanja)" (a settlement), Entebbe (a municipality in Wakiso), Buruuli (a county in Nakasongola), and "kampala" in lower case. | A district alias map is needed. The settlement or town should be kept as a **sub-location**. |
| P8 | **Two rows are entirely zero** (Nakivale, Rwamwanja). | Real "no sales" or a placeholder? |
| P9 | **Two blank cells** (row 16 Volcanic, row 42 Others). | Must be stored as "not reported", **not** zero. |

**Totals as reported:**
- **By product:** EPC 70,550 · Improved cookstove 1,390 · Briquettes 1,345 · Others 1,196 · LPG 420 · Pressure cookers 373 · Volcanic 128.
- **EPCs by calendar year:** 2025: 69,549 · 2026: 1,001.
- **EPCs by month:** the peaks are September 2025 (24,714) and August 2025 (13,086).

### 2.4 Prospective buyers (`04_…`)

- **17 companies, 253,778 "prospective buyers". There's no date, period or definition.**
- **Two exact repeats:** 809 (Swedo, Safe Plan Uganda) and 9,439 (Renewable Energy, Arem Energy). They may be copy errors.
- **This is a pipeline figure.** It must never be added to sales or shown as adoption.

### 2.5 UNACC companies (`05_…`)

- **32 company names.** "UNAAC" in the file name is a misspelling of UNACC, the Uganda National Alliance on Clean Cooking, which is spelled correctly in the direct-reach data.
- **Usable** as a membership flag on the companies list.

### 2.6 EPC SALES DATA 2025/2026 (`07_…`)

- **No header row.** The first row is data (Enersave, 1000).
- **Total:** 21 companies, 15 with a figure, adding to **187,851**.
- **Blank:** Ecopot, Safe Plan Uganda, Potential Energy, Ugas, African Clean Energy, ACE.
- **Likely duplicates:** "ACE" and "African Clean Energy"; "Green Flame company" and "blue Flame" (both 227).
- **Concentration:** Kiboko (104,000) and Digi Wave (52,500) make up **83.3%**. Any dashboard total is effectively these two figures, so they need documentary evidence (invoices, distributor reports) before publication.
- **"2025/2026" is not defined.** It could be a financial year (Jul 2025 – Jun 2026?) or a project year, and that decides the phase.

### 2.7 Copy of Copy of Direct Reach (`06_…`)

- **Header only, no data.** Discard it; it shouldn't be imported.

### 2.8 Personal data

- **None of the seven extracts has names, phone numbers or other personal details.** All figures are aggregates.
- **They are safe to keep** in the project data folder, but the folder should still be **excluded from git** until M&E approves publication. These are unverified programme figures.

---

## 3. Which data can feed the existing BCCeC dashboard

The current Clean Cooking tab shows:
- **Company EPC sales:** `cc_company_sales`.
- **Champions:** `cc_champions`.
- **Champion field work:** `cc_leads`, `cc_field_sales`, `cc_followups`.
- **Hubs:** `cc_hubs`.

| Data | Fits an existing screen? | Ready to show? |
|---|---|---|
| EPC SALES 2025/2026 | Yes, Company sales (`cc_company_sales`). It needs a period and "unspecified brand". | **After validation:** period definition, de-duplicated company names, evidence for the two largest figures. |
| Private sector product counts | No. It is multi-product and event-based, a new **Market activity** view. | After P1 (unit) and P3/P4 (dates) are settled. |
| Direct reach | No. New **Reach → In-person** view. | Partly. The 41,642 head-counted participants can be shown now as "reported, unverified". Template and baseline rows wait for M&E. |
| Indirect reach | No. New **Reach → Media** view with the assumption panel. | Only as "estimated gross audience", once the assumptions are documented. Never as unique people. |
| Prospective buyers | No. Company profile / pipeline. | Yes, as a pipeline figure, clearly labelled. |
| UNACC list | Yes, a flag on `cc_companies`. | Yes. |

---

## 4. The existing Appwrite schema and how historical data should link

**What exists (verified in the code):**
- **Projects:** each project is a document in `pms_projects`, which belongs to an organization and its team. BCCeC is one of them.
- **Activities:** the activity schedule lives in `pms_milestones` (`activityCode`, e.g. 1.1 Community Engagement, 1.2 Monitoring & Evaluation, plus `parentActivityId`).
- **Finance:** money is keyed by activity. `pms_budget_lines.activityId` points to `pms_milestones`; expenditures, commitments and reallocations point to budget lines.
- **Clean Cooking module:**
  - It is switched on per project in `pms_project_modules`.
  - All `cc_*` collections are **private**: no browser access, every read goes through `/api/clean-cooking/[projectId]/…`, and access is checked against the caller's project role (`ccHandler` / `resolveProjectAccess`).
  - **Districts are a per-project list** (`cc_districts`), currently the six champion districts.

**How to link without breaking anything:**
1. **Every historical record carries `projectId` = BCCeC**, the same key every `cc_*` collection already uses. No change to `pms_projects`.
2. **Optional `activityId` link to `pms_milestones`**, empty by default. It lets M&E later say "this outreach delivered activity 1.1", which in turn lets Finance show cost per person reached. **Nothing is written to `pms_milestones` or any Finance collection.** The link is read-only from the Clean Cooking side.
3. **Phases are dates, stored once per project** in a new `cc_project_phases` collection. Records are not stamped with a phase, so moving a phase boundary later needs no data change.
4. **Districts:** add the 43+ reach districts to the project list, with aliases (see 7.4). Champions keep working as they do now.
5. **Other projects (Power for Food, RETC):** unaffected. All new collections are project-scoped and only used where the Clean Cooking module is switched on.
6. **The schema change is additive only**, deployed with the existing `npm run schema:clean-cooking` tool, which refuses incompatible changes.

---

## 5. Proposed collections and source-to-target mapping

**The ground rules:**
- **Long, flat records.** One row per event, placement or company figure.
- **Every record keeps where it came from:** `sourceBatchId`, `sourceSheet`, `sourceRow`, `sourceRowHash`.
- **Status fields:**
  - `dataStatus` is one of `reported` · `estimated` · `template` · `excluded`.
  - `verificationStatus` is one of `unverified` · `verified` · `queried` · `rejected`.
- **Nothing is published until verified.**

### 5.1 `cc_project_phases`

| Field | Value |
|---|---|
| `projectId` | BCCeC |
| `key`, `name` | `phase_1` "Phase 1"; `phase_2` "Phase 2" |
| `startDate`, `endDate` | 2024-08-01 → 2026-03-31; 2026-04-01 → 2027-03-31 (**assumed**) |
| `reportingYearStartMonth` | e.g. 10 (October) if M&E keeps the Y1 = Oct–Sep project year |

### 5.2 `cc_import_batches` (where each import came from)

The fields:
- **Which file:** `projectId`, `sourceSystem` (`master_tracker` | `drive` | `manual`), `sourceSheet`, `sourceFileName`, `sourceFileId` (Drive ID when available), `sourceFileModifiedAt`, `sourceChecksum`.
- **Who and when:** `importedBy`, `importedAt`.
- **Counts:** `rowCount`, `acceptedCount`, `flaggedCount`.
- **State:** `status` (`dry_run` → `staged` → `published` | `rolled_back`), `methodologyVersion`, `notes`.

Every imported row points back to its batch, so a whole batch can be withdrawn without touching other data.

### 5.3 `cc_reach_events` (direct reach)

| Target field | Source column | Rule |
|---|---|---|
| `eventDate` | Date (Excel serial) | Convert to a date. The **Month, Year and Qrtr columns are not imported**; they are recalculated. A mismatch is flagged, not silently fixed. |
| `region` | Region | Derived from the district via the master list. A conflicting source value is flagged. |
| `district`, `subLocation` | District | Normalised through the alias map. The original text is kept in `districtRaw`. |
| `activityName` | Activity Name | Trimmed; maximum 500 characters. |
| `activityType` | (new) | Derived: `outreach`, `exhibition`, `baseline_study`, `conference`, `training`, `champions_event`, `community_event`, `media_engagement`, `other`. M&E confirms. |
| `participantsTotal` | Total No. of Participants | Integer, 0 or more. |
| `age18to24`, `age25to35`, `age36plus` | 18–24, 25–35, 36+ | Must add up to the total. |
| `male`, `female` | Male, Female | Must add up to the total. |
| `pwdYes`, `pwdNo` | Yes, No | **Label pending M&E** (assumed disability). |
| `ugandan`, `refugee`, `foreigner` | Ugandan, Refugees, Foreigner | Must add up to the total. |
| `dataStatus` | (derived) | `template` for the 36 identical exhibition rows; `excluded` for the baseline rows (pending M&E); otherwise `reported`. |
| `countsTowardReach` | (derived) | false for `template` and `excluded` until M&E decides. |
| `activityId` | (new, optional) | Link to `pms_milestones`. |
| `verificationStatus`, `verifiedBy`, `verifiedAt`, `verificationNote` | (new) | Same workflow as champion sales. |
| provenance | — | `sourceBatchId`, `sourceSheet`, `sourceRow`, `sourceRowHash` (unique). |

### 5.4 `cc_media_outlets` (the radio station coverage assumptions)

The fields:
- **The outlet:** `name`, `aliases[]` (e.g. "SMART24", "SMART 24"), `medium` (`radio` | `tv` | `billboard` | `print` | `digital`), `coverageArea` (districts or regions), `notes`.
- **The default assumption:** `defaultPopulationCovered`, `defaultAudienceRate` (listenership or viewership), `assumptionSource` (e.g. "UBOS 2024 census; station audience survey 2024"), `assumptionDate`, `approvedBy`.

### 5.5 `cc_media_placements` (indirect reach)

| Target field | Source column | Rule |
|---|---|---|
| `placementDate` | Date | As for direct reach. |
| `outletId` | Station | Matched through `cc_media_outlets` names and aliases. |
| `medium` | Medium | Checked against the outlet. Row 61 (Dembe FM marked TV) is flagged. |
| `placementType` | Channel Type | `talk_show`, `advert`, `tv_show`, `billboard`. |
| `airings` | (new) | Defaults to 1. Row 6 (Total = 2 × Estimated) suggests 2. |
| `region`, `district` (optional), `coverageArea` | Region, District | District may be empty for regional placements. |
| `populationCovered`, `audienceRate`, `campaignRecallRate` | Population Covered, % Listenership, % Campaign Reached | **Copied onto each placement**, so a later change to an outlet's assumption doesn't rewrite history. |
| `estimatedAudience` | — | **Recalculated** = population × audience rate (1 for billboards) × recall rate × airings. |
| `sourceEstimatedReach`, `sourceTotalReach`, `sourceUniqueReach` | Estimated / Total / Unique Individual Reach | Kept for reconciliation only. **Not shown as unique reach.** |
| `assumptionSetId` | — | Link to `cc_reach_methodology` (5.6). |
| status and provenance | — | As in 5.3. |

### 5.6 `cc_reach_methodology` (versioned assumptions)

The fields:
- `version`.
- `nationalPopulation` (48,371,300) and its `source`.
- `campaignReachRate`: **fixed at 0.4 by business rule**. The server enforces it and the forms can't edit it.
- `dedupMethod` (text and code key), `effectiveFrom`.
- `approvedBy`, `approvedAt`, `notes`.

The dashboard shows the version and assumptions next to every media figure.

### 5.7 `cc_market_reports` (private-sector product counts)

The data is in long format: one row per date, district and product.

| Field | Rule |
|---|---|
| `reportDate`, `reportMonth` | `reportMonth` is the trusted level (see P3). |
| `district`, `subLocation`, `region` | Alias map; region derived from the district. |
| `product` | `epc`, `briquettes`, `improved_cookstove`, `lpg`, `pressure_cooker`, `volcanic_rock_stove`, `kitchen_eware_other`. |
| `quantity` | Integer. **A blank stays null (not reported), never 0.** |
| `metricType` | **Pending M&E:** `sold`, `ordered`, `displayed` or `enquiries`. |
| `companyId` | Unknown in the source (empty). Set it when known. |
| `reachEventId` | Optional link to the exhibition in `cc_reach_events` (same date and district). |
| status and provenance | As above. |

### 5.8 Companies, sales and prospects (extending what exists)

- **`cc_companies`** gains `aliases[]` and `unaccMember`, a boolean set from file 05.
- **`cc_company_sales`** gains provenance fields and `evidenceStatus` (`self_reported` | `evidence_on_file` | `verified`). File 07 maps to it as follows:
  - `periodLabel` "2025/2026" with dates M&E defines;
  - `brand` "Unspecified";
  - `product` "EPC";
  - `quantity`, with blanks skipped and listed in the batch report.
- **`cc_company_prospects`:** `companyId`, `prospectiveBuyers`, `asOfDate` (unknown, required at import), `definition`, provenance. It is never joined into sales totals.

### 5.9 `cc_indicator_targets`

The fields:
- **What:** `indicatorKey` (e.g. `direct_reach_people`, `media_gross_audience`, `epc_sales_reported`, `epc_sales_verified`, `epc_in_use_rate`).
- **When:** `phaseKey` or `year`.
- **The target:** `targetValue`, `source` (logframe or MECS agreement), `approvedBy`.

The dashboard draws its target lines from here.

---

## 6. Dashboard specification

### 6.1 Filters, on every view

- **Time:** **Phase** (Phase 1 / Phase 2 / All), **year** (calendar or project year, per the M&E decision), **quarter** (always calculated from the date).
- **Place:** **region** and **district**.
- **Breakdowns:** **activity type** (in-person) and **medium or outlet** (media).
- **Data status:** a toggle to include estimated or template rows. **Off by default.**

### 6.2 Headline cards

The cards are kept separate on purpose; they are never added together.

| Card | Definition | Note shown on the card |
|---|---|---|
| People reached in person | Sum of `participantsTotal` where `countsTowardReach` | "Reported, not yet verified" until M&E signs off. |
| Estimated media audience | Sum of `estimatedAudience` | "Gross audience, not unique people", with a link to the assumptions panel. |
| EPCs reported by companies | `cc_company_sales` (self-reported) | Shows the evidence status. |
| EPCs at market events | `cc_market_reports` product = EPC | The unit (sold / ordered / …) as M&E defines it. |
| EPCs sold by champions (verified) | Verified `cc_field_sales` | Only verified sales count. |
| Still using their EPC | Latest follow-up per customer | **The only adoption measure.** |
| Prospective buyers | `cc_company_prospects` | "Pipeline, not sales". |

### 6.3 Charts

- **By year and phase:**
  - In-person reach as bars by year or quarter, coloured by phase, with the target line from `cc_indicator_targets`.
  - Media audience by quarter, stacked by medium.
- **People reached:**
  - In-person reach by region, with a district table (map later).
  - Sex and age split; refugees and host community (relevant for Kiryandongo, Yumbe, Isingiro and Kamwenge).
- **Market:**
  - Product mix at market events.
  - Company EPC figures as horizontal bars, with a **concentration warning** when one company is over 40% of the total.
- **Adoption funnel:** Prospects → Reported sales → Verified sales → In use. Each stage is labelled with its source; there is no implied conversion between different sources.

### 6.4 Drill-down

From any card or bar, open the matching records in a table, then a single record. The record view shows:
- the original source row (sheet name, row number);
- the assumptions used;
- the verification history.

### 6.5 The assumptions panel (for media)

- **Per placement:** the population, audience rate, recall rate and airings that produced the figure, each with its source and date.
- **At the top:** the methodology version. Changes to assumptions are versioned, not overwritten.

---

## 7. Validation and deduplication rules

Rules run in this order at import. Each failed row is **flagged**, never silently "fixed":

1. **Required fields:** date and district (district optional for regional media); total for reach; quantity for market and sales.
2. **The date is the truth.** Month, year and quarter are recalculated from it. A mismatch with the typed labels is flagged (D4, D5, P4, I10).
3. **Breakdowns must add up:** age, sex and nationality to the total. All pass today.
4. **District master list and aliases** (with the region derived):
   - Fortportal / Fort Portal → Fort Portal City (Kabarole)
   - Bushenyi (Ishaka) → Bushenyi, sub-location Ishaka
   - Nakivale → Isingiro, sub-location Nakivale
   - Kamwenge (Rwamwanja) → Kamwenge, sub-location Rwamwanja
   - Entebbe → Wakiso, sub-location Entebbe
   - Buruuli → Nakasongola, sub-location Buruuli
   - kampala → Kampala
   - Region values: East / West / North → Eastern / Western / Northern

   The final list is for M&E to confirm.
5. **Template detection:** total 1,000 with the 49/651/300 and 320/680 split → `dataStatus = template`.
6. **Duplicates:**
   - **Exact copies:** the same source row hash is never imported twice (unique index), which makes re-imports safe.
   - **Possible duplicates:** the same date, district, activity type and total, or the same district with exhibitions on consecutive days. These are flagged for review (D6, D7).
7. **Media consistency:**
   - **campaign reach must equal 0.4** (the business rule); any other value is rejected, not corrected;
   - imported population and audience values are **stored exactly as reported**. The importer never raises, rounds up or replaces them, and a later assumption change never rewrites them;
   - an outlet's medium must match;
   - rates must be between 0 and 1;
   - the audience can't exceed the population covered;
   - an outlet's population changing without a new assumption date is flagged (I4).
8. **Blank versus zero:** a blank becomes null ("not reported"); a 0 stays 0.
9. **Outliers:** any figure more than 3 times the median for its activity type or product is flagged (D8, P2, Kiboko and Digi Wave).
10. **Never combine across types:**
    - in-person + media is never added into one "people reached" figure;
    - prospects are never added to sales;
    - sales are never shown as adoption.

    These rules are enforced in the calculation code itself, not left to how a screen happens to be laid out.

**Deduplicating media into unique people.** This is not possible from this data: it records placements, not individuals. M&E has three options, to be chosen and documented in `cc_reach_methodology`:

| Option | What it does |
|---|---|
| A (recommended) | Report **gross audience only**, plus "number of outlets" and "districts covered". |
| B | Estimate unique reach per outlet per period (the largest single airing per outlet per quarter, not the sum) and cap the total at the population of the area covered. |
| C | Use a listener survey or broadcaster data. |

---

## 8. How the historical tracker and new field reporting coexist

| | Historical (master tracker, Phase 1) | New (PMS and champions portal, from cut-over) |
|---|---|---|
| Unit | Aggregated per event, outlet or company | Individual records (lead, sale, follow-up, event) |
| Entry | Import script, in batches, with provenance | Forms (staff and champions), with drafts and idempotent submission |
| Status | `unverified` until M&E reviews the batch | `submitted` → verified by staff |
| Collections | `cc_reach_events`, `cc_media_placements`, `cc_market_reports`, `cc_company_sales`, `cc_company_prospects` | `cc_leads`, `cc_field_sales`, `cc_followups`, plus new staff forms writing to the same reach and media collections |

**Rules:**
1. **A cut-over date per data type.** For example: from 1 April 2026 (Phase 2), in-person events and media placements are entered in the PMS, not the spreadsheet. Before that date, the import is the only source, so the same event is never entered twice.
2. **Staff forms write into the same collections** as the import (`cc_reach_events`, `cc_media_placements`), with `sourceSystem = pms_form`. The dashboard then shows one continuous series across both phases.
3. **Champion sales and company sales stay separate figures.** A champion's verified sale may also appear in a company's self-report. Deduplicating those two needs a shared reference (company and receipt number) and is a later step.
4. **The Google Drive sync** (section 10), once authorised, creates `cc_import_batches` from Drive files. It only **stages** data; a person publishes it.
5. **Offline-first:** Phase 2 field forms keep working offline (the step 3 PWA). Imports and sync remain server-side.

---

## 9. Decisions needed from M&E before publication

| # | Decision | Affects |
|---|---|---|
| M1 | Do the 36 identical "Exhibition" rows (36,000) count as reach? If so, by what method? | Direct reach headline |
| M2 | Do the baseline study respondents (22,014) count as reach? | Direct reach headline |
| M3 | ~~What do the Yes / No columns mean?~~ **Settled:** the new tracker labels them "Disability Yes / No" | — |
| M4 | ~~The source for the 0.4 campaign factor~~ **Settled:** 40% is a fixed business rule for all channels (see the rule box in 2.2) | — |
| M5 | The **approved** coverage population and audience percentage per outlet, including the higher approved audience rates for CBS and Capital FM, with the date each approval applies from. Existing records keep their reported values. | Media figures from the approval date |
| M6 | Deduplication method for media: option A, B or C (section 7) | "Unique reach" |
| M7 | The unit of the Private Sector figures (sold / ordered / displayed / enquiries) and how they were collected | Market view |
| M8 | Which EPC figure is official for which period: 9,381 vs 70,550 vs 187,851; the meaning of "2025/2026"; evidence for Kiboko and Digi Wave | Sales headline |
| M9 | The definition and date of "prospective buyers"; check the repeated values (809, 9,439) | Pipeline |
| M10 | **Year definition:** calendar year, project year (Oct–Sep, as Y1/Y2 suggests) or financial year | All "by year" charts |
| M11 | **Phase 2 dates** (assumed 1 Apr 2026 – 31 Mar 2027) | Phase filter |
| M12 | Targets per indicator, per phase or year (from the logframe or the MECS agreement) | Target lines |
| M13 | The district master list and aliases (rule 4) | Maps and filters |
| M14 | The activity type list (D9) | Filters |

**Indicators that need approval before publication:**
- **Can go up now,** marked "reported, unverified": in-person reach based only on the 41,642 head-counted participants.
- **Need approval first:** template and baseline reach, every media audience figure, all market and private-sector figures, company EPC totals, and prospects.

---

## 10. Google Drive integration

**Access check (19 Nov 2026, updated the same day):**
- **The Google Drive connector is still not signed in,** and the project has no Drive API setup.
- **The folder turned out to be shared publicly ("anyone with the link"),** so it was inventoried and read **read-only** through that public link, at the project lead's request. Nothing in Drive was changed. Downloaded copies are kept only in a temporary folder outside the repository.
- ⚠️ **Privacy risk:** because of that public sharing, **anyone with the link** can open champions' phone numbers and email addresses (in the reports), a named beneficiary, and a scanned attendance list. **Recommendation: restrict the folder to NREP accounts** and use a folder-scoped connector or service account instead.

**Inventory (29 items):**

| Folder | Files | What they hold |
|---|---|---|
| (root) | `BCCeC Master Tracker (2) (1).xlsx` (modified 19 Nov 2026) | The **new tracker template**, holding **Phase 2 data**; see below |
| Gulu | Champions refresher training BTOR (11 Aug 2026) | 78 champions (41 women, 37 men; 35 under 35) |
| Hoima | Refresher training BTOR (13 Aug 2026); champions live demonstration report (3 Oct 2026) | 73 participants; 44 at the demo (30 F / 14 M); a UGX 100,000 community fundraiser for one buyer |
| Kabale | Bishop Barham (UCU) outreach PDF (26 Sep 2026); Kigezi women's conference report (3–5 Sep 2026) | 73 reached, 72 new champions, UGX 500,000 spent; "more than 1,000 women", broadcast live on Voice of Victory 96.2 FM, 18 champions trained |
| Mbale | City work plan and budget; Munkaga and Namabasa outreach reports | Plan: 13 sessions × about 40 people, UGX 4,499,500 (a plan, not results); 25 and 30 participants, all new champions, UGX 185,000 each |
| Mbarara | Katete demonstration report; scanned attendance list (image only) | 43 participants (17 M / 26 F), **28 expressed interest in buying an EPC**, 6 champions involved |
| Mukono – Seeta | Arch Diocese, Mpunge, Nalulagala and Wanyama outreach reports; Seeta e-cooking BTOR (22 Aug 2026); Document1.pdf (25 Aug 2026); 2 photos | 30 / 15 / 16 / 20 participants (Flourish Hub champions), UGX 117,000–225,000 per session |
| Jinja, Masaka, Ntungamo, Soroti | empty | — |

**The new master tracker's sheets:**

| Sheet | Rows | What it holds |
|---|---|---|
| Direct Reach NREP | 17 | **Phase 2** events, May–Sep 2026. New columns: Disability Yes/No (this **settles M3**), Private sector engaged, EPCs sold, EPC leads, other technologies. |
| Champions Direct Reach | 15 | **New.** Champion-led trainings, Aug–Nov 2026: location 1 and 2, EPC sales, customer leads, champion in charge, new champions recruited. |
| Indirect Reach Data | 1 + 2 placeholders | Only an old Phase 1 row and "Kabale radio" / "Add radio" placeholders. **No Phase 2 media data yet.** |
| EPC SALES | 113 | The **same company sales sheet** the PMS importer already reads (20 companies, 9,381 EPCs, Jan–Nov 2025). |
| REC26 SALES LEADS | 46 | **New.** Renewable Energy Conference 2026 exhibitors: EPC sales, other technologies and leads, all **as free text** (e.g. "12 EPCs sold", "20 leads for LPG 3 leads on e-mobility"). |
| Private Sector Data | 1 | New columns (Solar Aided Stove, Induction Cookers), but the one row still holds the **old** values. Its 16 and 22 were "Volcanic" and "Others" in the old sheet and now sit under the new headings. **This is a column-shift error.** |

**Problems found in the Phase 2 data:**
- **Double counting:** the Masaka refresher training (51 people, 18 Aug 2026) is in **both** Direct Reach and Champions Direct Reach.
- **Tracker and reports disagree:**
  - Gulu: 77 in the tracker, 78 in the report.
  - Hoima demo: 31 F / 13 M in the tracker, 30 F / 14 M in the report.
  - Several Mukono reports contradict themselves (Mpunge says 15, 20 and 13 in different sections; Nalulagala says 16 and 30). The reports look copied from one template.
- **Kigezi women's conference:** exactly 1,000 with no age breakdown; the report says "more than 1,000". This is an estimate (same issue as D1).
- **The year scheme changed between phases.** Phase 1 uses Y1Q1–Y2Q1; Phase 2 uses Q2–Q4 2026. This confirms that quarters must be **calculated from the date**.
- **Gaps and typos:** many champion rows have no age or sex breakdown; "Sororti" should be Soroti.
- **Costs per activity** (UGX 117,000–500,000) are in the reports. They could later be linked to Finance as expenses against the activity, but that's not part of this import.

**To let Claude read the folder (read-only, for the inventory):**
1. In claude.ai, go to **Settings → Connectors → Google Drive → Connect**. Sign in with the NREP Google account that already has access to the folder.
2. Prefer an account that sees **only** this folder: share the folder with a dedicated NREP account rather than connecting a personal Drive with everything in it.
3. Start a new session. Claude can then list the folder and its subfolders, record each file's name, ID, type, modified date and parent, and read Sheets, CSVs, PDFs and Word files. No changes are made to Drive.

**For the PMS itself to sync from Drive later (server-side):**
1. **Create the account.** In Google Cloud, create a project, enable the **Google Drive API**, and create a **service account**. Don't create domain-wide delegation.
2. **Share only the folder.** Share **only the BCCeC folder** with the service account's email address, as **Viewer**. That keeps access limited to that folder.
3. **Use read-only access.** The scope is `https://www.googleapis.com/auth/drive.readonly`. The PMS never writes to Drive.
4. **Keep the key on the server.** Store it on the server only (`/home/admin/apps/nrep-project-mgt`, in `.env`, `chmod 600`, never in git). Better still, put the file in a secret store and load its path from an environment variable. Rotate the key every year.
5. **Sync only what changed:**
   - **Find the files:** list the folder with `files.list`, where `'<folderId>' in parents`, recursing into subfolders. Keep `fileId`, `modifiedTime`, `md5Checksum` (for uploaded files) and `version` (for Google Docs and Sheets).
   - **Fetch only what changed:** skip any file whose ID and version or checksum match the last `cc_import_batches` record. Export Google Sheets to CSV with `files.export`.
   - **Stage, don't publish:** create a `staged` import batch and run the validation rules from section 7. A person reviews and publishes.
6. **Keep a source register:** `cc_source_files`, with `fileId`, name, type, parent path, purpose (targets / results / champions / sales / budget / M&E), last synced version and the linked import batches.

---

## 11. Recommended order of work

1. **Approvals.** M&E answers M1–M14. The project lead confirms the Phase 2 dates.
2. **Put the source files in place.** Add them to `data/bccec/source/`, excluded from git.
3. **Additive schema:** `cc_project_phases`, `cc_import_batches`, `cc_reach_events`, `cc_media_outlets`, `cc_media_placements`, `cc_reach_methodology`, `cc_market_reports`, `cc_company_prospects`, `cc_indicator_targets`, plus new fields on `cc_companies` and `cc_company_sales`. A dry run is shown first, as before.
4. **Import script, dry run by default.** It produces a validation report per file: accepted, flagged and why. No data is written until approved.
5. **Stage the import.** Data loads as `unverified` into the production Appwrite project, which is the only one `.env.local` points at; it is reversible per batch.
6. **Dashboard views** (Reach in person, Media and assumptions, Market, Sales and adoption funnel). Phase, year and quarter filters and the graphs are built against the staged data, behind an "Unverified data" banner.
7. **M&E review** in the PMS: verify or query by batch or row. Publish.
8. **Phase 2 entry forms** for staff (reach events, media placements), using the same collections.
9. **Google Drive sync**, after the connector or service account is set up.
10. **Targets and the funder report export.**

---

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unverified figures reach the funder (FCDO / MECS) as results | High if published without labels | High | Status fields, an "unverified" banner, and publication only after M&E sign-off |
| Media "unique reach" is reported as 90.7 million people | High (the column is named that way) | High | Show only "estimated gross audience"; a methodology panel |
| Reach is inflated by changing assumptions or editing history | Medium | High | 40% campaign reach is fixed; reported values are stored as-is; new assumptions are dated versions, never applied backwards; every change is logged |
| Three conflicting EPC totals | Certain | High | Separate labelled cards; M8 decision |
| Two companies make up 83% of reported sales | Certain | High | Concentration warning; evidence status |
| Template and baseline rows inflate in-person reach by 58,014 | Certain | Medium | Excluded by default; M1 and M2 |
| Typed month and quarter labels disagree with dates | Certain | Low–Medium | Recalculate from the date; flag differences |
| Double counting between the historical tracker and new forms | Medium | Medium | Cut-over dates; import provenance; unique source hashes |
| Imports write to the **production** Appwrite (the only database) | Certain | Medium | Dry run by default; staged batches; rollback per batch |
| Appwrite row-size limit on new collections | Low | Medium | Modest text field sizes; the dry-run plan checks before applying |
| Drive credentials leak | Low | High | Folder-scoped viewer, read-only scope, key kept only on the server |
| District naming differences break maps and filters | Certain | Low | Alias map and master list (rule 4) |
