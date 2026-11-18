# LoopLogic v7 — Public Geographic Intelligence (Nov 17, 2026)

This release **extends the working v6 release**; it does not replace the resident profile, CivicPath Action Agent, six-question Rent Supplement intake, rent-to-income indicator, saved Action Tracker, original synthetic dashboards, or the now-working OpenStreetMap basemap.

## 1. Run in Windows PowerShell (no pip install required)

Unzip the complete package into a new folder, open the folder containing `ai_server.py` in VS Code, and run:

```powershell
python --version
python ai_server.py
```

Open `http://127.0.0.1:8000`. The built-in Python standard-library server requires Python 3.10+; you already have Python 3.13.1. If port 8000 is occupied, stop the older server with Ctrl+C or set `$env:LOOPLOGIC_PORT='8001'` before starting.

No OpenAI key is needed for the public data map, the existing guided resident assistant, screening, checklist, or deterministic evidence summaries. The optional AI narratives require a configured API key; never paste your key into a chat or store it in the public site or repository. This server is for **localhost-only** demos; do not deploy it directly to the public Internet.

## 2. Synchronize public data

1. Select **Partner Intelligence**.
2. Scroll down to **From demo gaps to observed geography**.
3. Click **Sync public data**. This deliberately downloads external data to a local `cache/` folder. The first sync may take time and can partially fail; the panel shows the individual source status/errors.
4. Switch to **2021 population**, **Transit stop proximity**, **Evening departures**, or **Verified-source services**.
5. On the live Halifax basemap, click a census DA polygon to view its source indicators. To check a direct scheduled transit candidate, also choose a geocoded provider and click **Check 45-minute direct GTFS option**.
6. Use **Grounded Decision Lab** to choose a real GTFS stop and adjust pilot weeks, cost and household visits/session. Its estimates are **capacity scenarios**, not outcome predictions.
7. Select **Government Studio** to view the same public evidence alongside the existing *synthetic* regional funding simulator.
8. Use **Export data evidence** to save the source-attributed aggregates, provider references and limitations.

The backend endpoints for developers are:
`GET /api/geo/status`, `POST /api/geo/sync`, `GET /api/geo/data`, `GET /api/geo/insights`, `POST /api/geo/scenario`, `POST /api/geo/journey`.

## 3. Exactly what is real

- HRM's ArcGIS hosted **2021 Census Dissemination Areas**: official DA geometry and 2021 population (not current population).
- Halifax Transit's **static GTFS**: officially published stop coordinates and scheduled departures for a documented sample Tuesday.
- Provider names, addresses and reference hours: small hand-curated sample from Feed Nova Scotia, specific provider sites and Halifax Public Libraries; subject to change and each address needs geocoding/verification.
- Calculations: counts of stops within **800 m straight-line** from DA representative coordinates; scheduled 17:00–21:00 departures at those stops; optional **direct-trip** schedule scan with radial first/last-mile walking assumptions, published hours and a 45-minute modeled threshold.

## 4. Exactly what is not real / not yet covered

- Original demo "Gap Score", "Unmet requests", "Matched pathways", "Reachable hours", "After-work access" and financial allocations remain explicitly **synthetic**.
- The 800 m radius is not a safe walking route; a GTFS departure is not proof a food bank is reachable during operating hours.
- The on-demand direct-trip check does not model transfers, true sidewalk routing, wait-until-departure, live alerts, service disruptions, holiday closures or physical accessibility. A zero result **does not prove inaccessibility**.
- DA population is not an exact measure of residents living within 800 m of a stop: each area is counted by its representative point.
- Provider sample is neither complete nor a licensed full copy of the 211 or Feed Nova Scotia directory. Reference hours may change; verify with the organization.
- The geographic study rectangle is the **Halifax core / Dartmouth / Bedford / Sackville vicinity**, not all rural HRM. No county-wide coverage claim.
- Scenario estimates are assumptions and capacity; they are not forecasts or verified outcomes. No private resident records are shared during public-data sync.

## 5. Data source ledger

- DA: https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/ArcGIS/rest/services/Census_2021_Dissemination_Areas/FeatureServer/0
- GTFS: https://gtfs.halifax.ca/static/google_transit.zip
- Feed NS directory: https://feednovascotia.ca/find-food/
- Halifax West Ecumenical Food Bank: https://www.halifaxwestfoodbank.ca/find-help
- Halifax Public Libraries: https://halifax.bibliocommons.com/v2/locations
- Public OSM basemap: https://www.openstreetmap.org/copyright
- Provider geocoding: OpenStreetMap Nominatim (small numbers of manual requests, 1+/second).

Where applicable, include attribution: "Contains information licensed under the Open Government Licence — Halifax." Census-derived data © Statistics Canada (2021) according to source notices. Review all use and re-use terms before public deployment.

## 6. Test commands

```powershell
python -m unittest test_geo_intelligence test_screening test_post_screening -v
# Optional: if Node.js is installed
npm test
```

Results in our build environment: 15 Python tests passed, 17 JavaScript scenario/structure assertions plus 60 area/category checks passed, a mocked browser test passed for map-layer switching, provider sample, scenario results and the public-data panel. Local HTTP smoke tests passed for `/api/geo/status`, `/api/geo/data`, `/api/geo/scenario`.

**The live official feed downloads could not be run in the build environment due to its restricted internet access.** The real-sync and direct-trip calculations must be tested on your Windows machine. Tests using mocked official responses should not be presented as successful production-data ingestion.

## 7. Reliability and ethics

This is a hackathon prototype. Do not collect real residents' income, identification numbers or housing details unless an appropriate privacy, security, consent, retention and access-control design has been implemented. A resident search is not a referral or verified benefit receipt. AI-generated briefs use public aggregates and must not invent causation or claim policy impact without validation.
