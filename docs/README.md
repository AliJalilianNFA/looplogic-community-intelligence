# LoopLogic Studio — Interactive Community Intelligence Prototype

**Built around our Community Navigator + CivicPath work.** This is a new, offline-friendly standalone prototype for exploring a resident-to-organization-to-government workflow. No code was changed in the original repositories.

## Run on Windows / VS Code

1. Extract the website ZIP to a folder, such as `F:\SMU\Cognizant\LoopLogic_NextGen_Prototype`.
2. Open the folder in VS Code, then open its terminal.
3. Run `python ai_server.py` (no dependencies required for guided mode).
4. Visit <http://127.0.0.1:8000>.

An alternative static server: `python -m http.server 8000`. Static mode supports all local charts, saved demo profiles, service matching, checklists, reports, and map overlays; it has **no live generative AI**.

### Optional real generative AI

In a **new local PowerShell terminal**, set a server-only secret:

```powershell
$env:OPENAI_API_KEY = "YOUR_PRIVATE_API_KEY"
$env:OPENAI_MODEL = "gpt-4.1-mini" # optional; update to a supported model if needed
python ai_server.py
```

Users then tick the relevant AI-sharing consent checkbox in the interface. Text is sent from the **local Python server**, never directly from the browser to OpenAI. The model is used to write grounded profile briefs, conversational navigation, partner insights, and policy briefings. The *actual program matching and metrics* remain code-driven. An API key is not bundled. API calls may incur charges. If the API is unavailable, guided demo mode remains functional.

**Security limitation:** This is a local prototype, not a production-ready service. It binds only to `127.0.0.1`. Before public deployment, introduce authentication, per-organization access controls, privacy impact assessment, encryption/storage retention policies, abuse prevention, and legal review of terms and official data licensing. Do not use real resident personal details in this demo.

## Diagnostics update

- The Resident AI panel now has a **Check AI connection** button and specific messages for a file-only page, missing backend, missing API key, or failed API response.
- The Partner map keeps the interactive schematic visible until OpenStreetMap tiles load successfully. A **Retry map** button is available. The schematic is still not a real census-geometry choropleth.
- Real AI still needs an API key, billing availability, consent, and the Python server. No real API call was made in creating this package.

## What works in the browser

- **Resident Navigator:** three synthetic personas, custom profile form, optional browser-only save/delete, need selection, ranked program matches with official links, step-by-step task checklists, action plan download, guided conversational help, optional generative profile brief/assistant.
- **Partner Intelligence:** area/category filters, KPI cards, map overlays (`gap`, `reachable hours`, `after-work hours`), community drill-down, ranked gap table, analytics bar graph, adjustable pilot scenario costs/slots, saved demo organization profile, insight studio, report export.
- **Government Studio:** synthetic community gaps by category, intervention matrix, interactive $100k budget-allocation experiment, evidence-labeled recommendation narrative and optional generative policy brief.
- **Service Library:** 12 curated, link-backed Halifax/Nova Scotia public programs and referral entry points covering food, housing, transit, heating, seniors, and families.
- **Data & Trust:** direct links to official sources and explicit distinctions between actual program information and simulated operational data.

## Data provenance and important limitations

| Item | Status |
|---|---|
| Program names / links / broad requirements | Curated from publicly accessible official websites (checked November 2026) |
| Synthetic residents and partners | Fictional, invented for demo |
| Regional population, gap index, demand, matching rates, provider availability / capacity | Fictional estimates, **NOT** observed census or operational data |
| Map | OpenStreetMap base tiles if online; offline schematic if not. The colored points are approximate area centers with synthetic scores, **not** census dissemination-area boundaries |
| Transit routes / trips / food bank hours | Not connected to live services. The app does **not** compute real trip times, opening hours, or service capacity |
| New programs | Guided recommendations only; do not promise full legal eligibility assessment. HARP and Seniors Care Grant are preliminary checks, not official confirmation |
| AI chatbot | In static mode, deterministic guidance. Real AI only when configured server-side and explicitly opted in |
| Reports | Entirely synthetic insights; do not represent actual regional inequity, outcomes, or program uptake |

**Selected authoritative references:**
- [NS Heating Assistance Rebate](https://www.novascotia.ca/apply-heating-assistance-rebate-heating-assistance-rebate-program)
- [NS Seniors Care Grant](https://www.novascotia.ca/apply-help-household-healthcare-and-home-heating-costs-seniors-care-grant)
- [HRM Affordable Access guide](https://www.halifax.ca/sites/default/files/documents/about-halifax/information-guide_affordable-access-program_2025.pdf)
- [NS Rent supplement](https://www.novascotia.ca/apply-rent-supplement-canada-nova-scotia-targeted-housing-benefit)
- [NS Community Bus Pass](https://novascotia.ca/bus-pass/)
- [Feed Nova Scotia Find Food](https://feednovascotia.ca/find-food/)
- [211 Nova Scotia](https://ns.211.ca/)
- [HRM Open Data Hub](https://data-hrm.hub.arcgis.com/)
- [Halifax Transit GTFS](https://gtfs.halifax.ca/static/google_transit.zip) (future integration, not yet ingested)

## Next production-development path

1. Replace synthetic directory data with a licensed provider API/export or verified source feed, including service locations, opening hours, accessibility and contact details.
2. Integrate Halifax Transit GTFS static + realtime to calculate *actual* feasible trips, not straight-line distances or illustrative hours.
3. Ingest geospatial boundaries and appropriate anonymized statistical aggregates with provenance and suppression rules.
4. Move to FastAPI + PostgreSQL/PostGIS; create opt-in resident case management, partner authentication and strict tenant isolation.
5. Implement controlled LLM tool calling against read-only query tools and verified program rules, review every action, and log policy/source versions.
6. Add confirmed referral outcomes, human review, partner capacity sync, impact evaluation and measurement of uncertainty.

See `JUDGE_DEMO.md` for a suggested 3-minute demonstration and anticipated judge questions.

## Files

- `index.html` — all three views and service catalogue
- `styles.css` — responsive design
- `data.js` — source-linked service registry plus **labeled synthetic** test data
- `app.js` — UI, matching, planning, dashboards, map, scenarios, exports
- `ai_server.py` — optional local server-side generative AI via OpenAI Responses API

*This is a concept demonstration and not affiliated with a government agency, Feed Nova Scotia, or 211.*

## New: persistent rent supplement intake workflow (demo)

The Resident Navigator's CivicPath chat now routes rent-supplement screening messages to
`POST /api/screening` *before* free-form AI. The server applies a small deterministic
question sequence and returns the next required question plus a structured session.
The browser keeps the fictional session in `localStorage` so answers survive refreshes;
no screening record is written to the Python server. Selecting another demo resident
or clearing the resident profile resets the screening. Say `restart screening` or
`cancel screening` in the chat for control.

**Try:** `Please screen me for the rent supplement` → `yes` → `rent` →
`I am a permanent resident` → `3` → `1500` → `42000`.
The script asks six intake questions and produces a *review checklist*, not a
verified eligibility determination. Current government program requirements and
exceptions must still be checked on the official source. The new route does not
make an OpenAI API call, so it costs no model tokens.

Run `python -m unittest -v test_screening.py` to verify the intake workflow.

## November 2026 upgrade — post-screening intelligence and task tracking

The rent supplement intake now ends with a dedicated **Rent support · action tracker** in the Resident Navigator. The previous six-question intake remains intact. After the final answer, the local Python `/api/screening` endpoint returns a deterministic, structured plan that includes:

- Reported rent, reported household income, and an **actual-rent-to-gross-income ratio** (e.g., $2,300/month rent and $48,000/year income = 57.5%). This is **not** the program's average-market-rent test or a benefit calculation.
- Review flags for unknown answers and circumstances requiring confirmation. Even when none are unknown, the renter program's official average market rent, income limits, and exclusion conditions still require checking.
- A six-step individualized checklist with official provincial links and statuses: **Not started / In progress / Completed**. A homeowner alternative appears if the resident reported owning.
- Progress bar and separate downloadable text checklist.
- An optional **Explain with AI** button that uses the existing `/api/assist` only after the fictional-profile consent checkbox is checked. The language model explains the plan; it does not update screening rules, task statuses, or the computed indicator.

**Storage:** the screening answers, plan, and task statuses are stored **only in this browser's `localStorage`** and tied to the demo persona. Selecting another demo persona, restarting screening, or clicking **Clear screening data** resets the workflow. Do not enter actual income records, SINs, sensitive documents or other resident data into the prototype. This is *not* a secure multi-device account or production case-management application.

**Source:** [Nova Scotia — Apply for a rent supplement](https://www.novascotia.ca/apply-rent-supplement-canada-nova-scotia-targeted-housing-benefit) and the linked [Renter Guide](https://www.novascotia.ca/documents/canada-nova-scotia-targeted-housing-benefit-renter-guide), reviewed November 16, 2026. Official guidance bases its **40% test on average market rent in the resident's area, not the actual rent they pay**; other income and rental conditions apply. The checklist reflects general application preparation and requires independent confirmation before real use. Official application processes may request SINs; LoopLogic must never collect them.

### Run the upgraded build

1. Extract this ZIP into a **new** folder. Open the folder containing `ai_server.py` in VS Code.
2. Activate your existing virtual environment if applicable; no extra packages are required for deterministic screening.
3. Run `python ai_server.py` in PowerShell, then open `http://127.0.0.1:8000` and hard-refresh with Ctrl+Shift+R.
4. Select fictional resident Jordan and enter: `Please screen me for the Canada–Nova Scotia Rent Supplement` → `yes` → `rent` → `permanent resident` → `3` → `2300` → `48000`.
5. The action tracker will appear **below the CivicPath chat**, above the regular recommendations. Change a task to `Completed`, refresh the browser, and confirm the saved progress remains. Use the new **Download checklist** button.
6. To test the optional AI narrative, start the server with your own valid server-only OpenAI API key and billing enabled, then tick the consent checkbox. **This is not required for the tracker to work.** Never share your key or place it in the repository.

If you had a finished intake saved from an older LoopLogic build, restart the demo screening after upgrading to create the new action-plan data.

### Run checks

```powershell
python -m unittest -v test_screening.py test_post_screening.py
node --check app.js
node tests.mjs
```

The test scripts do not require an OpenAI API key or spend credits. The new `post_screening.py` module contains all post-intake calculations and task definitions, while `screening.py` remains responsible for asking the six questions.


## November 2026 — Persistence and Leaflet fix

The application now remembers the **selected demo persona ID** independently of the optional Save Demo Profile action. The rent screening and task tracker are bound to the resident profile ID, not to the dropdown's transient `custom` value. The tracker is restored after a real full-page reload; a saved intake displays a brief resume message and retains task statuses. Automatic initialization no longer deletes screening data just because a different default persona was selected. Selecting a different resident *explicitly* still clears the prior intake.

The Leaflet CSS subresource-integrity value has been corrected to the published Leaflet 1.9.4 hash. The frontend also sets a small inline SVG favicon. Both changes are unrelated to the synthetic geographic datasets or the AI endpoint.

Run the test from the extracted folder with `python -m unittest -v test_screening.py test_post_screening.py`, and confirm the interactive browser flow: Jordan → six questions → first task Completed → Ctrl+R → first task remains Completed. Test the same flow once without pressing Save demo profile and once after pressing Save demo profile.

**Privacy:** Only fictional scenarios should be used. The record is saved in this browser's `localStorage` until explicitly cleared. This is not secure multi-user persistence.


## v4: map loading and fallback improvements

- The Leaflet container remains measurable (`visibility:hidden`, not `display:none`) until complete tiles load.
- A complete `TileLayer.load` event (instead of the first `tileload` event) is required before showing the online map.
- A CSS presence check prevents broken / misplaced fragments if Leaflet CSS is blocked.
- Failed/slow tiles never hide the local schematic; it has dynamic gap/reachable/after-work layers, clickable community centres and Zoom/Reset buttons.
- The Retry button now resets the viewport and reloads the basemap without dropping the fallback.
- Existing resident profiles, screening sessions and task progress are unchanged. Do not use real resident data in the demo.

**Test:** open Partner Intelligence, try all three map layers, click Fairview/Spryfield, change category and try Zoom/Reset. If an online map cannot load, the schematic should remain visible and interactive. The conceptual overlays still use fictional data and approximate points, not real census polygons.

For the local demonstration, the pinned Leaflet stylesheet is loaded without a Subresource Integrity attribute to avoid an observed false/mismatched CSS integrity failure. The Leaflet JavaScript retains its integrity attribute. **For production, vendor and verify both Leaflet assets locally** rather than depending on third-party CDN availability.


## v5: Local map stylesheet reliability fix

The live Leaflet map no longer requests its CSS from `unpkg.com`. A local
`leaflet-core-local.css` file provides the tile placement, overlays, marker
interaction, tooltip, attribution and zoom-control styles needed by this
prototype. The script `leaflet.js` still loads from unpkg and the background
tiles still load from OpenStreetMap, so an internet connection is required
for a true street map. If either resource fails, the fully interactive
**synthetic schematic map** remains available. The synthetic map and its
indicators are not a validated geographic-accessibility analysis.

**Test**: Run the Python server, open Partner Intelligence, click Retry map,
and confirm whether online tiles load without fragmentation. In either map
mode switch Gap score / Reachable hours / After-work access and click two
communities; the selected-community metrics should update. This build does
not modify resident profile, screening, or local task persistence logic.

For a production deployment, locally vendor a verified full Leaflet
distribution and use a managed, properly attributed tile provider; this
minimal stylesheet is a prototype compatibility layer only.


## v6 map initialization correction (November 2026)

The Partner Intelligence online basemap was previously *always* rejected by a
pre-initialization stylesheet check: the script tested the plain `#real-map`
element's `overflow` before `L.map()` could add the `leaflet-container` class.
Version 6 initializes Leaflet first, then checks its computed layout styles.
The CSS also gives the map container a safe `overflow:hidden` default.

To test: run `python ai_server.py`, open `http://127.0.0.1:8000`, press
Ctrl+Shift+R, go to Partner Intelligence, and click Retry map. If internet
access to unpkg.com or the OpenStreetMap tile service is unavailable, the
interactive **schematic** will appear. This does **not** use measured travel
times or official census polygons; its category metrics are synthetic.

The test suite and mocked-Leaflet browser regression pass, but live OSM tiles
need to be verified on the target Windows computer. No API key is needed.
