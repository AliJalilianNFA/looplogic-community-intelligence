# Contributing to LoopLogic

## Before changing code

1. Pull latest `main` and create a feature branch, for example `feature/civicpath-rules` or `fix/geo-sync`.
2. Use fictional resident data; do not commit API keys or downloaded cache files.
3. Keep original simulated indicators visually distinct from retrieved public-data indicators.
4. When changing government-program logic or language, record the source URL and verification date in the PR.
5. Run tests locally before requesting review.

```powershell
python -m unittest test_geo_intelligence test_screening test_post_screening -v
npm test  # optional Node.js
```

## Suggested branches and owners

- `feature/resident-*` — Resident Navigator, UX, accessibility and checklists.
- `feature/civicpath-*` — AI-assisted guidance, rule versioning and screening.
- `feature/geo-*` — public data feeds, GIS, transit and evidence provenance.
- `feature/partner-*` — Partner dashboards, scenario controls and insights.
- `docs/*` — README, demo scripts, user guides and citations.

## PR checklist

- [ ] Screenshots or a brief UI explanation for visible changes
- [ ] Unit tests added/updated for changed behavior
- [ ] Synthetic/observed/estimated labels remain correct
- [ ] External URLs, sources and licenses documented
- [ ] No secrets, personal records or private data committed
- [ ] New model/API calls opt-in and their cost/privacy described

The Python server is **local-only**. Public deployment requires separate security design and code review.
