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


## Stage 2 implementation notes: docking and scoring
- **Docking:** stop inside the green berth beside the pier, slower than about 3 knots, within 25 degrees of the pier line, and hold for 2 seconds. A panel shows Position / Speed / Angle with check marks (not colour alone) and a hint for the one thing to fix. Reverse to brake.
- **Scoring:** Safety (hull condition), Navigation (respawns), Timing (seconds over the deadline), Docking (distance from berth centre and angle). Every deduction is explained on the results screen.
- **Failure:** hull breach, running past twice the deadline, or abort. No payment, no other penalty.
- **Rewards:** credits scale from 50% to 100% of the mission reward by score; reputation and XP are recorded for the Stage 3 license system.


## Stage 3 implementation notes: licenses and career
- **Small Craft Permit path:** two training tasks, a written test and a practical exam. Training is open to everyone; contracts need the permit; the exam needs training, the written test and a 100-credit fee.
- **Exam rules:** score 70+ and at most 2 damaging collisions. The exam pays nothing; passing awards the license plus a one-time bonus. A failed or aborted attempt keeps the fee and can be retaken.
- **Why a fee:** it makes the exam a decision (prepare first) and gives training runs a purpose. Training can be replayed for credits, so nobody is stuck.
- **Permissions:** each license lists the vessel classes it permits. Vessel access is checked per class so Stage 4's workboats and passenger craft can be gated behind the Coastal Skipper.
- **Next tier:** Coastal Skipper needs the Small Craft Permit and reputation 10. It became earnable in Stage 4 (see below).
- **Feedback:** results explain every deduction and add coaching tips for the weakest categories.
- Licenses are fictional game credentials, not real-world qualifications or safety training.


## Stage 4 implementation notes: vessels
- **Fleet:** Harbor Skiff (Small Craft Permit), Harbor Workboat and Coastal Cat (Coastal Skipper).
- **What differs:** top speed, pick-up, astern power (stopping distance), low-speed resistance (coasting), turn authority, sideways slip, wind leeway, hull size and toughness. Dimensions drive the placeholder model, the collision hull and the camera distance.
- **Wind:** steady 8 knots from the north-west. A light skiff and a tall passenger craft drift noticeably when slow; a heavy workboat hardly does. The HUD shows speed and the direction it pushes your bow.
- **Jobs:** most contracts accept any vessel you are licensed for; Heavy Gear Haul needs the workboat and the Passenger Shuttle needs the Coastal Cat. Deadlines are written for the skiff and scaled by vessel.
- **Sailing under instruction:** training trials and the exam may use a class you do not hold yet, once you meet the license prerequisites. Contracts never do.
- **Coastal Skipper:** needs the permit and reputation 10; two sea trials (score 50+), a written test (4 of 5) and a workboat exam (score 70+, at most 2 damaging collisions, fee 250).


## Stage 5 implementation notes: water, weather and performance
- **Weather per mission:** Calm, Fresh breeze, Moderate sea, Rough sea, Fog bank. Training and exams stay mostly calm so learning is not punished; heavier contracts and the Coastal Skipper exam use rougher seas; one contract runs in fog.
- **Readable effects:** the HUD shows wind speed and which way it pushes you, wave height and, in fog, visibility. The briefing says in plain words what the sea will do to the vessel you picked ("top speed -26%, steering -18%").
- **Fairness:** deadlines are longer in rough seas and for slower vessels, so bad weather changes how you drive, not whether you can win.
- **Why small boats suffer most:** the effect compares wave height with hull length. The same formula covers every vessel, so future ships behave sensibly without special-casing.
- **Visibility:** fog shortens how far you can see; the compass arrow and distance readout stay available, and the destination beam fades with distance like everything else.
- **Quality:** Auto, Low, Medium, High. The game aims to stay playable on old hardware first and look good second.


## Stage 6 implementation notes: the bay, ports and route planning
- **Bluewater Bay** is a 4 km x 4 km box (2 x 2 cells) with a soft edge: a warning near the edge and a return to the last safe point just beyond it. The earlier 8 km vision is still the long-term target; this is the first connected region.
- **Ports:** Bluewater Harbor (home, 20 m vessels), Pine Isle Landing (16 m), Cape Quay (commercial quay, 30 m, 12 kn slow zone) and Southgate Marina (12 m, 10 kn slow zone). Each has a pier, a berth, a slow zone and a coloured beacon.
- **The chart:** markers and the legs between them. A route is a path through markers; the harbor approach at each end is fixed. Suggested routes are the shortest plus alternatives within 35% of it. You can build your own.
- **Route choice is a trade-off:** a longer route has a longer deadline, so time alone never forces the short way. The short way to Cape Quay is a 30 m gap between rocks; the wide ways cost 4 to 5% more distance. Arriving early pays up to +15%.
- **Port approach limits:** slow zones around every berth and a vessel length limit per port. Breaking a limit costs Navigation points and the results say why.
- **Progression:** short jobs are open to permit holders; far jobs need reputation (5 to 10) and some need a specific vessel. Reputation comes from finished jobs.


## Stage 7 implementation notes: ships and terminals
- **Two commercial vessels**: the 90 m Coastal Freighter and the 140 m Feeder Carrier. They are not faster small boats: they take about a minute to get going, a long time to stop, and a wide arc to turn, and they slide sideways in turns. The container stack catches the wind; waves hardly matter.
- **Draft and channels**: deep-draft ships cannot cross shoal areas; they use the dredged channel between Cape Terminal and Driftwood Terminal. The player sees shoals as pale green water and on the chart, gets a warning near them, and damages the hull if they ground.
- **Berths**: terminal berths are 220 m long. The whole ship must fit inside, so you aim for the middle with room at both ends. Accuracy is judged against the berth, not against a marina slip.
- **Cargo**: heavy jobs score the cargo too. Hard turns at speed shift the load; the HUD shows the cargo condition. The answer is the same as for everything else big: plan early and use gentle rudder.
- **Progression**: Large Vessel Endorsement (tier 3) after the Coastal Skipper and reputation 30; container jobs need reputation 45. Large jobs pay 3,200 to 5,400 credits.
- **Port rules**: small craft use small berths; terminals take ships of 30 m and up only; harbors, Pine Isle and the marina refuse ships.
