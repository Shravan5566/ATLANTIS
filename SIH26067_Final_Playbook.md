# SIH26067 — Complete Playbook (Final)
### Interactive 3D Ocean Visualization Platform (INCOIS / Ministry of Earth Sciences)
### Team profile: 2nd-year engineering, near-beginner (Python up to arrays, basic JS websites), building with Claude + Antigravity IDE

---

## 1. Problem Statement Snapshot

**PS ID:** SIH26067 · **Org:** Ministry of Earth Sciences (MoES) / INCOIS · **Category:** Software · **Verdict:** Yellow — Workable, Read the Fine Print

**Core ask:** Build a web-based interactive 3D visualization platform that renders INCOIS's ocean model outputs (temperature, salinity, current vectors, chlorophyll — 3D fields across depth) **together with** real in-situ observations (Argo floats, gliders) in a single interactive environment, across the full water column, so that non-specialists — students, the public, policymakers — can explore ocean data intuitively.

**Explicitly stated core requirement:** 3D volumetric rendering of ocean model fields across the full water column, integrated with real observational data, in a browser (no desktop install).

**Explicitly stated audience:** school/college students, general public (awareness campaigns), policymakers, INCOIS itself (outreach, exhibitions, e-learning).

---

## 2. The 3-Step Analysis

**Step 1 — Domain:** Ocean/marine science + geospatial data visualization + public science communication. Sits at the intersection of oceanography, GIS, and frontend/data-viz engineering — not primarily an "AI" problem.

**Step 2 — Keywords underlined:** *3D volumetric rendering, full water column, model outputs + in-situ observations simultaneously, interactive, web-based, non-specialists, education/outreach, NetCDF, ASCII/text.*

**Step 3 — Actual deliverable:** This is **not** a policy document, not a research paper, and not primarily an ML model. It is a **working, deployed web application** — a rendering/data-engineering product. The deliverable is a tool someone can open in a browser, pick a date/region/variable, and see both the model's ocean field and the real float/glider readings overlaid in 3D. That's the bar.

---

## 3. Government vs Industry Read

This is a **Government (Ministry) problem statement**, which changes what "winning" looks like:
- Judges weight **real-world deployability and communication** heavily — not just technical cleverness. INCOIS explicitly wants this for *outreach and education*, so a version a 12th-grader or a policymaker can actually use and understand matters as much as the rendering engine underneath.
- Government PS reward teams that can **explain the domain correctly** (ocean model vs. observation, what a "profile" is, why depth matters) — not just teams that can code. Budget real time to learn the domain vocabulary, not just the tech stack.

---

## 4. Five Whys — Finding the Real Problem

> Surface read: "INCOIS needs a 3D viewer for ocean data."

1. **Why** does INCOIS need this? → Because ocean model output and real observations exist separately and nobody outside specialists can see them together.
2. **Why** can't people see them together today? → Because the tools that *can* do 3D ocean visualization (ParaView/pyParaOcean, VAPOR) are expert-only desktop software requiring installation, and the tools that *are* web-based (Argovis, Copernicus MyOcean viewer) are 2D map/point viewers, not true 3D volumetric renderers.
3. **Why** does that gap matter? → Because INCOIS's stated goal isn't just "visualize data" — it's *outreach*: getting ocean science in front of students and the public who will never install ParaView or read a NetCDF file.
4. **Why** hasn't this been built already? → Because 3D volumetric rendering of large multi-dimensional NetCDF data *in a browser*, performantly, is a genuinely hard engineering problem — most attempts either strip it down to 2D or push it to desktop tools.
5. **Why** does that make this winnable for a lean team? → Because the real, root problem isn't "we lack a fancy dashboard" — it's **"there is no accessible bridge between raw scientific ocean data and a non-specialist's understanding of it."** That reframes your build target: don't just render pretty 3D — design specifically for a first-time, non-expert user's comprehension (legends, plain-language tooltips, guided "tours" of a phenomenon), which most technically-driven teams will skip in favor of chasing rendering fidelity.

**Root problem to solve:** Ocean data is scientifically rich but experientially inaccessible to everyone except oceanographers. Your product's job is to be the translation layer — not just a renderer.

---

## 5. Existing Solutions — What's Out There, and the Gap

| Tool | What it does | Where it falls short (your opening) |
|---|---|---|
| **ParaView / pyParaOcean** (IISc research tool) | Genuinely powerful 3D volumetric ocean rendering — isosurfaces, streamlines, eddy tracking | Desktop-only plugin, requires installation and domain expertise to operate. Not public-facing, not for a browser, not for students. |
| **VAPOR** | Efficient 3D visualization for oceanography/atmospheric science on GPUs | Also a desktop scientific tool — same accessibility gap. |
| **Argovis** (Univ. of Colorado) | Fast, clean web app for Argo float profile data, good API | 2D map + point-based, not volumetric 3D, and doesn't integrate numerical model output — observation data only. |
| **Copernicus MyOcean Pro Viewer** | Web-based 4D (lat/lon/depth/time) exploration of Copernicus model products | Global/generic, not India/INCOIS-specific, and again primarily a slice/map viewer rather than true interactive 3D volume rendering combined with live in-situ overlays. |
| **Ocean Data View (ODV)** | Widely used by oceanographers for profile/section analysis | Desktop software, built for researchers producing figures for papers — not an outreach/education tool. |

**The pattern:** every tool is either (a) desktop/expert-only and powerful, or (b) web-based but flattened to 2D/point data. **Nobody has shipped a genuinely 3D, browser-based, model+observation-fused viewer aimed at non-specialists.** That's your differentiator — lean into it directly in your pitch instead of a generic "AI-powered ocean dashboard" line.

---

## 6. Evaluation Scoring (Self-Assessment)

| Pillar | Score (1–5) | Notes |
|---|---|---|
| Innovation Potential | 4 | Nobody has combined web-native 3D volumetric rendering + live in-situ overlay + non-specialist UX. Genuine white space. |
| Team Feasibility | 3 (revised down from earlier — see §7 skill reality) | Achievable, but only with disciplined use of AI tools + a real fundamentals pass, not pure prompting. |
| Technical Impact | 3.5 | Real engineering challenge (large multi-dim data, performant browser rendering) — credible, not trivial. |
| Presentation Strength | 3 | Visual output is naturally demo-friendly *if* you don't over-scope. |
| Real-World Impact | 4 | Direct stated use case: INCOIS outreach, e-learning, policymaker briefings — easy to articulate concretely. |

**Read:** strong on substance; your actual risk is team fluency with the tools and code, not the idea itself.

---

## 7. Skill Reality Check — What You Actually Need, Given Your Starting Point

Your stated baseline: Python up to arrays, "frontend" meaning basic JS websites. You'll build primarily by prompting Claude and Antigravity IDE. That's a completely viable path to a working national-level demo — **but only if you close one specific gap**: judges at national finals routinely ask "walk me through this code" or "why this approach, not that one." A team that vibe-coded everything and can't answer gets exposed fast, regardless of how good the demo looks. So your real skill target isn't "learn to code from scratch" — it's **functional literacy**: enough to read, verify, modify, and defend what the AI builds.

| Skill | Why it matters even though AI writes the code |
|---|---|
| **Python: past arrays → functions, dictionaries, file I/O, `requests`** | Claude will generate this constantly (JSON is just nested dicts). If you can't read it, you can't verify it's doing what you asked. |
| **HTML/CSS/JS fundamentals (DOM, events, `fetch`)** | You'll need small live tweaks during dev and — critically — during a live demo if something breaks. Can't wait on a prompt mid-demo. |
| **Client-server / API concept** | Your Python backend and JS frontend talk over HTTP as JSON. If this is fuzzy, every bug looks like magic. |
| **Basic debugging** (console errors, network tab) | AI-generated code breaks too. You need to describe the error back to Claude accurately, not just say "it doesn't work." |
| **What NetCDF/geospatial data is, conceptually** | You don't need to be an oceanographer, but you must explain "this is a 4D grid: lat, lon, depth, time" in your own words to a judge. |
| **Git/GitHub basics** | Clean commit history and a working repo is something judges do check, and it prevents your team overwriting each other's AI-generated changes. |
| **Good prompting + reviewing diffs** | Ask Claude for one scoped change at a time, and actually read what changed before accepting it — this is what prevents silent bugs piling up. |

None of this requires becoming an expert. It's the difference between "we vibe-coded this and have no idea how it works" and "we used AI to move fast, and every one of us can explain any part of it." The second version is what wins.

---

## 8. MoSCoW Scope Definition

**Must Have**
- Load one real NetCDF ocean model dataset (e.g., one INCOIS/ROMS temperature field, one region, one time range)
- Render it as an interactive 3D layer in CesiumJS (temperature or salinity, one depth range)
- Overlay real Argo float positions/profiles from the same region/time on the same 3D view
- A working, clickable UI to select region/variable/time — not just a static render

**Should Have**
- Time-scrubbing slider to animate the field over time
- A second variable (e.g., currents as vectors) toggle
- Plain-language tooltips/legend aimed at a non-specialist viewer (directly serves the "education/outreach" ask)

**Could Have**
- A simple "model vs. observation" comparison mode (does the model agree with what the float measured?)
- Guided "tour" mode highlighting a real phenomenon (e.g., a monsoon-season temperature anomaly)
- Basic anomaly flagging (rule-based, not ML — keep it simple and explainable)

**Won't Have (this cycle)**
- Full water-column, all-variable, all-region coverage — pick one region (e.g., Bay of Bengal) and be explicit that this is a scoped MVP, expandable
- Real-time live data ingestion — use recent archived datasets, say so plainly
- Any deep ML/forecasting layer — it adds risk without matching this PS's actual ask (visualization, not prediction)

---

## 9. 7-Day Plan — Internal Hackathon (near-zero baseline, AI-tool-driven)

| Day | Focus |
|---|---|
| **1** | Set up Antigravity IDE + Claude access. 30-min crash course as a team: what is JSON, what is an API call, what does "frontend talks to backend" mean. Get a basic webpage running locally. |
| **2** | Prompt Claude to scaffold a minimal CesiumJS globe. Don't just accept it — walk through the generated HTML/JS file as a team and make sure everyone can say what each part does in plain English. |
| **3** | Prompt Claude/Antigravity to build a small Python FastAPI service reading one sample NetCDF file. Learn just enough Python (dicts, functions) to tweak params yourselves — file path, variable name — without re-prompting for every tiny change. |
| **4** | Connect frontend to backend via `fetch`. First real data renders. When it breaks (it will), practice reading the browser console error and feeding *that exact error* back to Claude instead of just "fix it." |
| **5** | Add the Argo float overlay the same way: prompt → review the diff → confirm you understand it → test. |
| **6** | UI polish (time slider, legend). Build your 90-second demo script and 3-slide pitch with an architecture diagram. |
| **7** | Rehearsal. For every major code block, have one team member ready to explain it in one sentence if asked — this is your actual bottleneck, not the code itself. Log remaining bugs in a shared tracker. |

---

## 10. 3-Month Plan — National-Level Readiness

**Month 1 — Parallel tracks: build + fundamentals**
- Keep shipping features via Claude/Antigravity (multi-variable, multi-depth pipeline; add gliders alongside Argo floats)
- Run a lightweight, deliberate fundamentals pass in the background: a short Python basics pass (functions, dicts, files), a short HTML/CSS/JS pass, and one manual (non-AI) walkthrough of loading a NetCDF file with `xarray` yourselves, just once, so it's not a total black box
- Start reading actual INCOIS/MoES documentation and basic oceanography concepts (water masses, thermoclines, monsoon-driven variability) so you can speak to the domain, not just the code

**Month 2 — Shift from prompting to editing + the differentiator**
- Start making small code edits directly instead of always re-prompting for everything — this is where real fluency comes from, editing AI output teaches faster than generating it
- Build your "model vs. observation" comparison feature properly — your strongest unique-value story per the Five Whys analysis
- Optimize the data pipeline for performance (pre-tile/cache NetCDF conversions so the browser demo never lags during live judging)
- Deploy to a real cloud URL (Render/Railway/Vercel) — understand conceptually what deployment does, not just click-deploy
- Add the "guided tour" / education mode explicitly aimed at the school/public audience the PS names — cheap, high-impact, and most competing teams will skip it

**Month 3 — Polish, validation, and the pre-nationals gate**
- User-test the "non-specialist" UX claim on actual non-specialists (a classmate outside CS, a family member) — fix what confuses them
- Build the documentation: architecture diagram, a short written note on how this compares to ParaView/Argovis/MyOcean and why yours is different (this is your pitch's spine)
- Run an internal rule as your gate before nationals: **nobody presents a feature they can't explain without looking at the code.** Mock-evaluate with someone playing a tough judge who asks "why this approach" repeatedly — fix whatever nobody can answer
- Maintain the shared bug tracker throughout; cross off systematically, don't let known issues linger silently into the final demo

---

## 11. Datasets & Resources

**Primary data sources**
- INCOIS Data Holdings (official listing of all in-situ + model datasets, formats, access): incois.gov.in/site/dataholdings.jsp
- INCOIS Argo Data Viewing Application (Indian Ocean Argo data): services.incois.gov.in/argo/ADV.jsp
- Global Argo GDAC (NetCDF, all floats worldwide, FTP + ERDDAP access): via ifremer.fr / usgodae.org mirrors
- Copernicus Marine Service (global ocean model NetCDF output, free API key, good fallback/supplement to INCOIS data): marine.copernicus.eu
- argopy (Python library purpose-built for fetching/handling Argo data cleanly): pypi.org/project/argopy

**Reference tools to study (for your gap analysis and pitch)**
- Argovis (web Argo viewer, Univ. of Colorado): argovis.colorado.edu
- Copernicus MyOcean Pro Viewer (4D web ocean viewer): marine.copernicus.eu/explore-ocean-myocean-viewer
- pyParaOcean paper (IISc — the closest existing 3D ocean viz research, useful to cite/contrast in your pitch): arxiv.org/abs/2309.14328 and arxiv.org/abs/2501.05009

**Core tech stack**
- Data handling: `xarray`, `netCDF4`, `argopy`
- Backend: FastAPI (Python) to serve processed CZML/GeoJSON tiles
- 3D rendering: CesiumJS (open-source, purpose-built for time-dynamic geospatial 3D)
- Optional lightweight alternative for a leaner build: deck.gl

---

## 12. Demo & Pitch Notes

- **90-second live demo hard limit:** open app → select region/variable → show model layer render → toggle Argo overlay on → done. Practice until this is boring-fast and can't break.
- **Hook line (first two sentences of your pitch):** lead with the gap, not the tech — *"Every existing ocean visualization tool is either desktop software built for scientists, or a flat 2D map — nobody has put real 3D ocean data in a browser for a student or policymaker to actually explore. We did."* This directly counters the "90% of teams lead with buzzwords" trap.
- **Keep the user-facing interaction dead simple** even though the backend (NetCDF processing, CZML generation) is genuinely complex — the complexity should be invisible in the demo, visible only when a judge asks "how does this work under the hood."
- **Track bugs in one shared doc** (Notion/shared notepad) from Day 1 of the 7-day sprint onward, not just during crunch — this habit compounds.
