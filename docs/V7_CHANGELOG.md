# LoopLogic engineering and research record — v7

**Date:** November 17, 2026. **Based on:** validated v6 map build.

## Preserved from previous versions

- Our original GitHub Pages Community Navigator: resident service finder and organization insight concept.
- Satyam's CivicPath v6 contribution: Heating Assistance Rebate and Seniors Care Grant rules/testing, AI optional (independent team package).
- LoopLogic Studio: Resident Navigator + Partner Intelligence + Government Studio, sample service catalogue, synthetic metrics.
- Rent supplement screening v1: deterministic Python six-question conversation.
- Post-screening v2: 57.5% example affordability indicator, six-task action tracker, preliminary-rule caveat.
- Persistence v3: browser refresh restores saved screening and task state.
- Maps v4–v6: interactive synthetic fallback; correct map sizing and online Leaflet/OpenStreetMap basemap.

## Added v7

1. Local public-data synchronization and evidence cache (no resident profiles transmitted).
2. Real HRM 2021 DA polygons, population and density fields where available.
3. Official Halifax Transit static GTFS stop coordinates and service-date-based scheduled 17:00–21:00 departures.
4. Small source-cited provider directory; controlled OSM geocoding and required manual verification.
5. Four public-data map overlays: census population, stop proximity, scheduled departures, provider locations.
6. Data inspector, source ledger, deterministic evidence observations and optional model-generated, aggregate-only insights.
7. Local exploratory direct-bus GTFS check to provider under 45 modeled travel minutes; no walking network/transfers.
8. Pilot cost/capacity scenario linked to real stop coordinates and historical DA centroid population.
9. Government Studio source-backed evidence section, independent of synthetic policy allocation model.
10. Tests for GTFS calendar filtering, evening count, GIS feature shaping and scenario costs.

## Important design decisions

- Real census/GTFS inputs never overwrite synthetic demo KPIs.
- No false inference of observed unmet demand from population/stop distance.
- AI is optional and may explain precomputed evidence, but not silently calculate or invent official eligibility or service capacity.
- Any public deployment requires authentication, consent and stronger server-side controls; current web server binds only to 127.0.0.1.
- All sources are fetched on demand; a network failure leaves the existing demo operational and reports partial status.

## Limitations before future deployment

- Verify the ArcGIS query and GTFS ingestion against live endpoints from the user's network.
- Validate provider coordinates and operating hours directly with providers.
- Replace straight-line walking approximation with a pedestrian-network router and full GTFS time-dependent routing with transfers; sample route scan is not a complete accessibility model.
- Extend geographic bounding box/pagination to include all HRM if that scope is desired.
- Gain appropriate directory licenses/partnerships for comprehensive service datasets and live capacity.
- Model responsible synthetic-to-real transition with well-governed referral outcomes; do not infer demand from searches.
- Harden AI agent backend and introduce versioned deterministic eligibility rules, audit logs and protected resident accounts.
