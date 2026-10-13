# World Cup 2026 — contributor instructions

## Scope and commands

Desktop browser football, entirely client-side. Display name World Cup 2026;
internal coordinator PitchKickGame. Do not restore Modelence, Expo, authentication,
backend examples or mobile build hooks without a new requirement.

Node >=22.12.0. `npm ci`, `npm run dev`, `npm test`, `npm run typecheck`,
`npm run build`, `npm start` (static preview). Build output is root `dist/`.

## Architecture

- `game/simulation/` is pure TypeScript: no React, Three.js, DOM, clocks or browser
  APIs. Inject the seeded random generator and input. Domain functions receive
  MatchState explicitly. All player links and marking/offside tables use stable IDs.
- InputFrame contains normalized analog movement and held/pressed/released actions.
  Physical keycodes belong only in the input adapters and binding configuration.
- MatchSimulation.step advances the simulation; snapshot copies presentation data.
  MatchEvent IDs increase monotonically, with tick/time and optional player/team.
- Keep gameplay units and tuning in constants.ts. FIELD_W/PX_PER_M corresponds to
  105 metres. Convert at the renderer boundary; do not retune physics by rescaling it.
- engine.ts owns browser lifecycle, FixedStepClock, input, renderer and HUD delivery.
  Fixed simulation is 60 Hz with at most five catch-up steps. Pause clears held input,
  charge, edges and accumulated time. Resume after focus loss/disconnection is explicit.
- ThreeRenderer owns presentation and resource disposal. Animation never changes
  simulation coordinates or emits another kick. Keep shared geometry/materials and
  instanced crowd. Models load before play; errors have visible retry UI.
- render.ts/projection.ts and ReferenceRenderer are temporary 2D migration references,
  excluded from the runtime bundle. Remove only after actual 3D visual validation.
- useGame owns creation/destruction. HomePage coordinates intro/select/playing;
  components/game owns selection, HUD, pause and settings. Engine loads dynamically.

## Game invariants

- Exactly ten selectable teams: ARG BRA FRA ESP ENG POR GER NED URU COL, each eleven
  players. Argentina–Brazil initially, different home/away teams. No June schedule.
- Preserve existing roster names, numbers, diacritics and rating tuples. Do not
  update real-world squads from memory or describe estimates as exact EA ratings.
- Roles derive from explicit formation slots. Practice chooses GK + four outfielders
  by role, versus one away GK. No match clock/offside/restarts in practice.
- Home attacks right. Choose home/change kits by contrast with teams/kits.ts; use
  the same decision in selection and renderer. Goalkeepers use gkKit.
- Match clock is 180 seconds of active play mapped to 90 minutes. Preserve both modes.
- Shots/passes fire on release; switchPlayer doubles as loft modifier. Buffer first
  touches, preserve kick provenance until another touch, cap reception assistance.
- High balls cannot be trapped above CONTROL_HEIGHT. Swept contacts reuse possession,
  keeper and offside rules. Test changes to update order and trajectories.

## Validation and assets

Run `npm test` and `npm run build` after simulation/runtime changes. Add meaningful
regressions before changing rules. Test determinism by simulation step inputs, not
by wall-clock timing or screenshots. Never call CPU tests a GPU benchmark.

Only free Standard Quaternius assets used by the game are checked in. See
scripts/prepare-assets.py, public/assets/players/manifest.json and source license
notices. Keep downloaded archives and unused models outside the repository.

See docs/validacion-3d.md for actual evidence and pending browser acceptance.
Preserve unrelated existing work; the original .cursor/mcp.json and screenshot
removals predate this implementation. Do not include those in an implementation commit.

## Birthday customization

The user authorized editable player identities, faces, appearance and ratings as
an overlay; keep the original ten roster files unchanged. See customization/profile.ts
and docs/cumpleanos.md. Store per-player overrides by country and ORIGINAL shirt
number, using sourceId so editable numbers never change simulation IDs. Validate
imports and keep embedded audio bounded; never load arbitrary remote audio URLs.

Facial geometry must be cloned before deformation and disposed per avatar. Do not
mutate shared GLB geometry. Cosmetic dimensions never affect physics. Goal audio
and confetti are presentation effects, consumed once per event, and stopped/paused
with the game. Updating camera/volume must not recreate an ongoing match.
