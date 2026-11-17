# orbit-sling

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Siezy/orbit-sling/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Siezy/orbit-sling/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Sky Race** — an airplane race arcade game for make.fun best-game-01: take off from the runway, race two AI rivals, collect every star, and land on the strip — across a 9-stage campaign through 4 realms, ending with a boss fight against the Thunderhead.

## The game

- **Campaign:** 9 stages across 4 named realms — Dawn Meadows, Storm Peaks, Twilight Coast, Night Summit — each with its own sky, ground and obstacle mix, plus a realm intro card. Final stage: the **Thunderhead**, a giant drifting storm that throws telegraphed, dodgeable lightning.
- **Two verbs:** the slingshot takeoff (drag-aim-release, or arrow keys + Space) and **fuel + boost rings** — fuel drains in the air, golden rings refill it and kick the plane faster, so routing matters.
- **Workshop:** after each realm, pick 1 of 3 relics (bigger tank, magnet coil, swift wings, storm hull, tailwind, shield plating, extra plane, star doubler). Relics persist through the campaign and show in the HUD.
- **Reactive rivals:** REX and MAYA rubber-band — faster when behind, easing off when ahead — with a live 1st/2nd/3rd HUD and race bonuses.
- **Scoring depth:** combo multiplier for chained star pickups and near-miss grazes, smooth-landing and realm-clear bonuses, campaign-end summary (time, stars, relics, best race position).
- **Hazards:** storm vortexes (gravity), orbiting storm cells, turbulence, birds, and the boss's lightning. Off-course and out-of-fuel flights cost no life — lives are the crash budget only.

## Run it

```sh
python3 -m http.server --directory game
# then open http://localhost:8000 in a desktop browser
# (or just open game/index.html directly — it needs no server and no network)
```

`?seed=N` fixes the sky. `?shot=start|play|action|end&seed=N` stages a screenshot scene and sets `window.__shotReady`.

## Tests

The auto-player (Node, no browser) proves the campaign with the game's own physics: **8/8 seeds clear** (seeds 1–8), 0 unreachable stars/rings/power-ups on any stage, boss stage clearable on every seed. A few seeds spend a shield or a life on a star that only a crash flight reaches — covered in the live game by the shield and extra-plane power-ups the planner models.

The headless-Chrome test (pure Node + CDP) drives the real game with pointer and keyboard input: **13/13 pass** — title → intro → aim, Space launch, pause/resume, restart, drag launch, workshop pick by key (1/2/3) and by card click — with 0 console errors and no external network requests.

Two `main.ts` runs are byte-identical (deterministic build).

---

<sub>Entered on [make.fun](https://make.fun/?ref=y1qp32ce&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
