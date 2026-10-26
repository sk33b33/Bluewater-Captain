# Game Design Document — Bluewater Captain

## High concept
A single-player 3D maritime career game where the player earns fictional in-game licenses, takes on port-to-port contracts, and progresses from small boats to large commercial vessels. The game emphasizes satisfying vessel handling, navigational decisions, docking, and a sense of scale at sea.

## Target experience
The player should feel they are learning a craft: small early missions are forgiving and teach control; later missions require route planning, ship-specific handling, weather awareness, and careful port approaches.

## World model
The requested “box world” is a bounded 3D play space rather than an unbounded globe. Design it as connected maritime zones with defined edges, streaming boundaries, and port hubs. Ocean horizon and sky should hide boundaries naturally where possible. Record the chosen scale and streaming approach in the technical design before implementation.

### Box world definition (Stage 0 proposal, pending approval)
- **Bounds:** a rectangular sea volume of 8 km x 8 km, with the water plane as the floor of play and a fixed ceiling (sky) above. Final scale is tunable; large-ship stages may extend it.
- **Cells:** a 4 x 4 grid of 2 km sea regions. Each region has its own water/weather parameters and may contain zero or more ports, markers, and hazards.
- **Streaming:** only the player's cell and its neighbors are loaded. Stage 1 uses a single cell.
- **Edges:** the outer boundary is a soft limit (warning, then forced turnaround/"return to chart" prompt) hidden by haze and horizon. No hard invisible walls inside the world.
- **Not** a globe, not infinite, no procedural generation in early stages.

## Main game loop
Accept contract → prepare vessel → plan route → depart port → navigate → manage conditions → arrive and dock → get scored → earn rewards → train/license/unlock → repeat at greater scale.

## Mission types
- Basic coastal delivery
- Passenger transfer
- Timed mail or supply run
- Buoy and navigation-marker exercise
- Harbor approach and docking test
- Towing or workboat assignment
- Weather-diversion mission
- Cargo transport with stability/handling constraints
- Long offshore passage
- Container terminal arrival and departure

Only implement mission types required by the current stage.

## Licensing and assessment
Licenses are in-game progression credentials. Each license has prerequisites, training tasks, an exam mission, and a list of permitted vessel classes. Assessment can score:
- Collision/grounding avoidance
- Compliance with route markers and harbor limits
- Safe speed
- Arrival time
- Docking accuracy
- Cargo/passenger condition
- Fuel efficiency (optional)

Avoid opaque penalties. Explain score deductions in the post-mission report.

## Vessel progression
Vessels should have distinct handling profiles rather than only different meshes:
- Length, beam, draft, displacement/mass
- Acceleration, top speed, stopping distance
- Turning response and turning radius
- Wind sensitivity
- Wave response/stability
- Fuel capacity and consumption
- Cargo/passenger capacity
- License requirement

Initial vessel classes: small motorboat, fishing/workboat, coastal passenger craft, tug, ferry, general cargo ship, container carrier.

## World and ports
Ports are mission hubs and progression locations. Each port should include berths, navigation aids, approach channels, a mission board, and clear visual landmarks. The first playable slice needs only one port and one destination/route endpoint; later stages add connected ports and region variety.

## Water and weather
Build from a performant baseline: animated water surface, directional waves, reflection/lighting, foam near shore or vessel as budget allows, wind and sea-state parameters, fog/visibility, and optional rain. Water must support gameplay readability and not obscure navigation cues. Avoid expensive simulation everywhere; use scalable levels of detail.

## Unlockable famous/legendary vessels
The desired fantasy includes ships such as Titanic and the Black Pearl. Treat these as future, rights-dependent content. For early prototypes, use original fictional vessels inspired by broad historical or fantasy archetypes, without copying protected names, exact silhouettes, distinctive branding, or artwork. Real-world ship names/designs and franchise ships require legal review and appropriate permissions before public/commercial release.

## UI/UX
Corporate-quality, readable, consistent interface:
- Main menu and save/profile
- License and career screen
- Mission board
- Ship selection and inspection
- Route/nautical chart screen
- In-game HUD: speed, heading, objective, sea state, warnings
- Docking guidance
- Mission result and rewards
- Settings: graphics, audio, controls, accessibility

## Accessibility and comfort
Support adjustable camera sensitivity, remappable controls where practical, subtitles for voiced content, UI scaling, color-safe warnings, and motion/visual effect settings. Consider a reduced camera bob option.

## Scope discipline
No multiplayer, procedural planet, economy simulation, fully simulated ship interiors, or exhaustive fleet in the first playable version unless specifically approved later.
