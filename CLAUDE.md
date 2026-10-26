# Project Instructions for Claude Code

## Product vision
Create a 3D maritime career and ship-command game tentatively titled **Bluewater Captain**. The player begins with a small boat and earns increasingly advanced maritime licenses, unlocks larger vessels, and completes missions between ports. The long-term vision includes a box-shaped world divided into connected sea regions, realistic-looking waves and ocean conditions, detailed vessels from small craft to container carriers, and special legendary/heritage ship unlocks.

## Non-negotiable development rules
1. **Build in stages.** Work only on the current approved stage. Never scaffold every future system at once.
2. At the start of a stage, inspect the repository and existing implementation before changing anything.
3. Keep the game runnable at the end of each stage. Run available tests/builds and report results honestly.
4. Use clear architecture, small components, typed interfaces where supported, and documented decisions.
5. Do not add paid services, online accounts, analytics, or network dependencies without approval.
6. Do not use placeholder art as if it were final production art. Clearly label temporary assets.
7. Prioritize frame rate, loading time, input feel, accessibility, and readable UI.
8. Do not claim a build, test, feature, or file works unless verified.
9. Maintain `docs/STATUS.md`, `docs/DECISIONS.md`, and `docs/KNOWN_ISSUES.md`.
10. Ask before making major engine, platform, monetization, multiplayer, or scope changes.

## Initial technical decision
At Stage 0, compare **Unreal Engine 5** and **Unity** against the project's needs and recommend one. Do not silently assume the engine. Default recommendation: Unreal Engine 5 for high-fidelity ocean visuals and large vessels, unless the target hardware or team skill makes Unity more practical. If the workspace is already initialized with an engine, evaluate that first and avoid unnecessary migration.

## Core gameplay pillars
- **License career:** training, written/practical exams, graduated permissions, and progression gates.
- **Port-to-port missions:** route planning, departure clearance, navigation, weather/sea state, docking, delivery/passenger/cargo objectives, and arrival assessment.
- **Ship progression:** start with a small vessel, earn money/reputation, rent or purchase ships, and qualify for larger classes.
- **Maritime simulation:** throttle, steering, inertia, turning radius, waves, wind, visibility, collision risk, and docking.
- **World exploration:** a stylized box-world / bounded world composed of connected sea regions and ports. Define what “box world” means in `docs/GAME_DESIGN.md`; do not assume an infinite globe.
- **Vessel collection:** small boats, workboats, ferries, tugs, cargo vessels, and container carriers. Special unlocks can include fictional legendary ships and, only when legally cleared, real-world or licensed vessels.
- **Presentation:** professional, clean UI; detailed ships; high-quality water and weather that scale to hardware.

## License progression (initial proposal)
1. Small Craft Permit — basic handling, safety, short coastal route.
2. Coastal Skipper — navigation markers, tides/currents, docking under pressure.
3. Commercial Operator — passengers/light cargo, inspections, schedules.
4. Offshore Master — longer routes, night navigation, weather planning.
5. Large Vessel / Cargo Endorsement — heavy-vessel inertia, channel limits, tug assistance.
6. Deep-Sea / Container Carrier Qualification — ocean passage, cargo constraints, complex port approach.

Treat these as fictional game credentials, not legal advice or a representation of any real country's licensing requirements. The player should understand that licenses are game progression systems.

## Port-to-port mission loop
1. Choose a mission at a port board.
2. Read destination, cargo/passengers, deadline, risk, reward, and required license/vessel.
3. Inspect the ship and fuel/supplies.
4. Plan a route and review forecast.
5. Depart and navigate.
6. Respond to optional events (weather, traffic, equipment warning, route closure) appropriate to the current stage.
7. Enter the destination harbor and dock.
8. Receive a score for safety, navigation, timing, cargo condition, and docking.
9. Earn currency, reputation, experience, and license progress.
10. Repair, upgrade, or unlock the next mission.

## Stage gates
- Each stage must have explicit scope, acceptance criteria, test plan, and a short completion report.
- Do not begin the next stage until the current stage is playable/buildable and its acceptance criteria are met or the user explicitly accepts remaining issues.
- Keep a backlog for out-of-stage requests rather than expanding scope mid-stage.
- Prefer one representative port, one vessel, and one mission in early stages over broad but shallow content.

## Required outputs
- A runnable project, not just mockups or design documents.
- `docs/GAME_DESIGN.md`, `docs/TECHNICAL_DESIGN.md`, `docs/ROADMAP.md`
- `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`
- Tests or repeatable manual verification steps for core mechanics.
- Asset inventory with source/license notes.
- A README with setup, controls, build, and run instructions.
