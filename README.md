# Space Invaders 3D

A browser-based 3D adventure-defense prototype. The player protects a solar
system from invader waves, completes ship and planet tasks for XP, upgrades
their spacecraft, and pilots different ship types from a cockpit-style view.

## Project Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/darkness22s/space-invaders-3d.git
   cd space-invaders-3d
   ```

2. Switch to the development branch:

   ```bash
   git checkout dev
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

   If you do not have Node.js installed, install it from https://nodejs.org first.

4. Start the game:

   ```bash
   npm run dev
   ```

5. Open the local URL printed by Vite.

## Controls

- `WASD`: fly the ship
- `Shift`: climb
- `Ctrl`: descend
- `Space`: fire laser
- `E`: land near a planet or complete a landing task
- `F`: complete a nearby surface mission while landed
- `P`: toggle autopilot toward the most threatened planet
- `L`: engage landing assist for the nearest planet
- `Q`: switch ship type
- `U`: open or close the upgrade bay
- `R`: enter or exit the ship interior
- `Arrow Left / Arrow Right`: jump between interior stations
- `WASD` while inside: walk around the ship deck
- Use the cockpit buttons and engine slider for the same actions.

## Current Prototype Features

- 3D solar system with procedural planet surfaces and orbital motion
- Invader waves that attack planets and drain the solar shield
- Wave alerts, threat count, formation movement, hit flashes, damaged enemy
  colors, laser muzzle pulses, and explosion effects
- Player ship with cockpit dashboard, radar, laser firing, and engine power
- Functional cockpit buttons for autopilot, landing assist, shield boost, and
  repair pulse
- Mission log that tracks active wave defense, wave delay, planet-side work,
  and upgrades
- Invaders require three laser hits to destroy
- Onboard tasks and planet-surface tasks that award XP and delay waves
- Walkable 3D ship interior deck with pilot, engine, shield, navigation,
  cargo, and comms stations
- Station tasks that refill fuel, repair shields, prepare landing, and disrupt
  invader waves
- Landing sequence that consumes fuel before surface tasks unlock
- Planet-side EVA mode with terrain, mission beacons, oxygen, and launch back
  to orbit
- Surface missions that award XP, restore shield strength, and add extra wave
  delay so invaders stay away longer
- XP upgrade action for hull/shield improvements
- Multiple ship profiles with different speed and hull tradeoffs
- Upgrade bay with hull, laser, engine, shield, fuel, and scanner tracks
- Distinct procedural ship models that visually change with ship type and
  upgrades

## Branch Workflow

- `main` is the stable branch.
- `dev` is the integration branch for active development.
- Create feature branches from `dev`.
- Open pull requests into `dev`.

## Current Status

The first playable prototype is in progress. The final target is a much richer
adventure game with realistic ship interiors, landable planets, deeper missions,
and more polished models.
