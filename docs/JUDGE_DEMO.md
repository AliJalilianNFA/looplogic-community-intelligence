# LoopLogic — 3-Minute Judge Demo Guide

## The story

**Promise:** A resident should not have to become a social-services expert to get help. And community organizations should not have to guess which intervention might make help easier to access.

### 0:00–0:50 — Resident experience

1. Open **Resident Navigator**. Choose **Maria**, a fictional senior in Spryfield.
2. Show the support needs: heating, seniors, food, and a preference for evening access.
3. Click **Update my action plan**. Point out the ranked pathways and the *official government links*.
4. Ask the guided CivicPath assistant: **“How can I get food after work?”**
5. Show the checklist and progress tracking. Say: “This is not just a link—it is a repeatable, saved plan.”

### 0:50–1:50 — Partner Intelligence

1. Click **See the community view** or open **Partner Intelligence**.
2. Show the synthetic regional KPIs, the interactive neighbourhood map, and its three indicator layers.
3. Click **Spryfield** and use **After-work access** to show a modeled access gap.
4. Under **What if we changed one thing?**, choose **Mobile outreach near a transit stop**, then vary sessions, cost, and capacity.
5. Show the results and explicitly say **all demand, catchment and pilot numbers are synthetic**.

### 1:50–2:40 — Government Studio

1. Open **Government Studio** and show the colored regional need-index matrix.
2. Switch to **Transport** and adjust the fictional $100,000 funding allocation.
3. Explain the recommendation and the plan to validate hypotheses with providers and real service data.

### 2:40–3:00 — The real roadmap

1. Open **Service Library**: HARP, Seniors Care Grant, HRM Affordable Access, rent assistance, food resources, transportation.
2. Open **Data & Trust**. Say: “The official programs and source links are real. The dashboards are intentionally synthetic until we secure licensed, validated feeds.”
3. Explain optional AI: when configured with a **server-side** OpenAI key, it can generate profile briefs, grounded answers, and partner/government narratives. The demo remains useful without a live AI API.

## One-line differentiator

**“ChatGPT can explain a program. LoopLogic connects the resident's action plan to the community's capacity decisions—and lets partners test a possible fix.”**

## Answer to expected judge questions

- **Does this submit benefit applications?** No. It prepares a screening-based action plan and links to the official processes.
- **Are the map and demand numbers real?** No. The map may use a real OpenStreetMap basemap, but area scores and population/requests are modeled examples. Real GTFS, geographic boundaries and provider data are integration priorities.
- **Is AI really active?** Only when a private API key is configured on the Python server and the user consents. Otherwise it is transparent guided mode.
- **Can partner organizations see individual residents?** Not in the demo. We explicitly avoid exposing individual profiles in partner/government dashboards. A real platform would use aggregated, permissioned data.
- **How does the product scale?** Add service records in a structured registry; reserve verified eligibility rules for programs where deterministic screening is appropriate, and use provider connectors for real hours, capacity and referral status.

## Added demonstration: CivicPath completes the job (1 minute)

Use fictional resident Jordan and run the six-question rent-supplement intake: `yes`, `rent`, `permanent resident`, `3`, `2300`, `48000`. The new action tracker displays a 57.5% *actual-rent-to-gross-income indicator*, explains that **this is not official eligibility**, and presents source-linked next steps. Mark two tasks *In progress* or *Completed*; refresh to demonstrate saved progress; export the checklist. If the paid AI backend is available and consent is checked, click **Explain with AI** to show a human-friendly summary of the *unchanged deterministic plan*. Otherwise, demonstrate the fully functional rule-based workflow without spending API credits.

Judge caveat: The official program compares **average market rent** against household income for its eligibility test, and also checks other criteria. The demo makes no approval or payment estimate. No government application is submitted and no actual resident records are stored on a server.
