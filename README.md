# 🕹️ Vertical Platformer Fighting Webgame

A **race-to-the-top platformer with sword fighting**, built for the browser with vanilla JavaScript and
[PixiJS](https://pixijs.com). Climb a tall level to the door at the top before anyone else, fighting on the way.
Play **online with up to 12 players**, against a **computer opponent** in training mode, or with a friend on one keyboard.

---

## 🎮 Game Concept

A competitive **race to the top**. Every player climbs the same tall level and **the first to reach the door wins**.
You fight as you climb, but nobody dies:

- A sword hit adds **injury**. The more injured you are, the **slower you walk and the lower you jump**.
- Injury **heals slowly**, and faster while you stand still. Resting costs time; racing while hurt costs speed.
- Hits **knock you back and up**. Get knocked off a ledge and you fall to whatever is below.
- Nobody is left out: the **camera zooms in and out** to keep every player on screen, and a progress track shows who is ahead.

### The rules in numbers

| | |
|---|---|
| **Movement** | Walk 120 px/s, double jump. A jump rises about 53 px, a double jump about 107 px |
| **Attacks** | **Low** (injury 10, active on frame 2), **Mid** (injury 8, fastest, frame 1), **Overhead** (injury 15, slowest, frame 3). A swing can only hurt on its *active* frame, and each swing lands once. You can't walk mid-swing |
| **Injury** | 0 to 100. At 100 you walk at half speed and your jump is 80% as fast (64% as high: a double jump rises only 68 px) |
| **Recovery** | 2 injury points per second; 2.5 times faster while standing still on the ground. No healing while stunned |
| **A hit** | Stuns for 0.3 s, pushes you away and up, then you are immune to further hits for 0.5 s |
| **Landing** | You land on a platform if your feet went from above its surface to at or below it during a step, however fast you fell (platforms are only 4 px thick). Jumping up through one from below is allowed |
| **The level** | The original 576 × 432 map stacked **5 times** (576 × 1776 px). Change `LEVEL_COPIES` in `js/level.js` to resize it |

The map's platforms are 32 to 80 px apart. The easiest route to the door has a hardest hop of 48 px, so even a badly
injured player can still climb it (the 64 and 80 px hops are out of reach until you heal).

---

## 🛠️ Built With

- HTML5, CSS3 and vanilla JavaScript (no build step)
- [PixiJS](https://pixijs.com) v8.5.2 for WebGL rendering, vendored in `js/vendor/` (MIT licence)
- Node.js and [`ws`](https://github.com/websockets/ws) for online multiplayer (`ws` is the only dependency)
- Node's built-in test runner (`node:test`) for the automated tests

---

## 🎯 Features

- **Online multiplayer**: up to **12 players per room**, quick match or private rooms with a 4-letter code, run by an authoritative Node server
- **Training mode**: race and fight a computer opponent (Dummy, Easy, Normal, Hard); no server or network needed
- **Local two-player** on one keyboard
- Sword combat with three attacks, wind-up, active frames, reach and knockback; the injury system
- A tall level built from stacked copies of the Tiled map, with a zoom-to-fit camera. The art is drawn from the map's own layers at the same offsets as the collision, so what you see is what you can stand on
- Game feel: hit sparks, landing dust, screen shake, white hit flash and win confetti, all driven by game events
- Phone support: touch controls, responsive HUD, camera that keeps fighters clear of the buttons
- Frame-rate independent movement, jumping and animation (plays the same on a 60 Hz or 144 Hz screen)
- Sound effects and background music

---

## ▶️ Running it

The game needs to be **served over HTTP**. Opening `index.html` by double-clicking it (a `file://` address) does not work,
because the image loader needs real HTTP.

```bash
npm install     # installs ws, the only dependency (the tests pass on Node 18, 20 and 22)
npm start       # http://localhost:3000   (set PORT to change it)
npm test        # 66 automated tests: game rules, collision, level art, the AI, rooms and lobby, the real server
npm run export-art   # only after editing the Tiled map: regenerates js/data/art.js
```

`npm start` runs the game server, which also serves the page and runs online play. For **local and training play only**
any static file server works, with nothing to install:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

(Online play needs `npm start`.) The menu offers **Quick match**, **Create private room**, joining by code, **Training**
(against the computer) and **Play locally** (two players on one keyboard). Address options skip the menu:

| Address | Does |
|---|---|
| `?local` | Local two-player game |
| `?training=LEVEL` | Training against the computer: `dummy`, `easy`, `normal` or `hard` |
| `?players=N` | Local round with N players (2-12); the extras stand still, handy for testing crowds |
| `?online` / `?online=create` | Quick match / new private room |
| `?room=CODE` | Join a room by code |
| `?touch` | Show the touch controls on a desktop |
| `?debug` | Draw what the game really collides with (F2 toggles it): solid blocks red, platform surfaces yellow, hitboxes green, sword reach magenta, the door cyan |

---

## 🧠 How to Play

### Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | A / D | Left / Right arrows |
| Jump (double jump) | W | Up arrow |
| Low / Mid / Overhead attack | X / C / V | I / O / P |

- **Goal:** reach the door at the top before anyone else.
- Press **Enter** (or click / tap the game) after someone reaches the door for a rematch.
- **Online** and in **training**, you are one player and *both* key sets control you, so use whichever you prefer.
- The small **Leave** button at the top returns you to the menu.

### On a phone or tablet

Touch screens get on-screen buttons automatically (add `?touch` to the URL to see them on a desktop): a d-pad on the left,
**JUMP** and **LOW / MID / HIGH** attacks on the right. Hold a direction with one thumb and jump or attack with the other.
Portrait suits the tall level best.

---

## 🤖 Training mode

Pick **Training** in the menu (or open `?training=normal`) to race and fight a computer opponent. You are Player 1. It is a
local game: no server, no network.

| Level | What it does | Races alone in | Swings in its first 5 s beside you |
|---|---|---|---|
| **Dummy** | Stands still and never acts: for practising attacks | never | 0 |
| **Easy** | Slow to react, dithers while climbing, swings rarely | 55 to 69 s | 2 |
| **Normal** | A fair race and a fair fight | 36 to 41 s | 5 |
| **Hard** | Quick, aggressive, dodges slow attacks, rests to heal when badly hurt | 31 s (the fastest the rules allow) | 7 |

**It plays by the same rules you do.** The AI holds the same left/right keys and calls the same `jump()` and `attack()` a
human does (`js/ai.js`), so it can't move faster, jump higher or skip injury. There is **no neural network or learning**:
it is hand-written rules plus a shortest-path search. What it knows beyond a player is only the layout of the level, which
you can see too.

How it thinks, in the order it matters:
1. **A map of the level.** Platforms are found from the same collision blocks the physics uses and linked by which can reach
   which (a jump of up to 85 px, across gaps up to 60 px). A shortest-path search (Dijkstra) run backwards from the door gives
   every platform its best next hop. Hops cost more the higher they climb (the cost grows with the square of the rise), so
   it prefers a staircase of easy 32 and 48 px steps, the route that still works when injured.
2. **Choices happen at its reaction time; mechanics happen every step.** A few times a second it decides whether to fight,
   dither, rest or dodge. Walking onto the right spot and the moment of the jump are checked every step, like a beginner
   who is slow to decide but still knows where to put their feet.
3. **Fight, then move on.** On the same level and in range it turns to face you, closes in and swings, picking attacks at
   random (overhead against someone airborne). Once you are badly hurt it leaves you behind to race, unless you are
   attacking it. Its rule order is: fight, rest, dither, un-stick, climb.
4. **Repeatable.** Its random choices come from a seeded generator, so a run can be replayed exactly (the tests do).

Every difficulty number lives in the `AI_LEVELS` table in `js/ai.js`; edit it and reload to tune a level.

---

## 🌐 How online play works

The **server runs the game** and the browsers only send input and draw what they are told, so nobody can cheat by editing
their own game. The server loads the *same* rules files the browser uses (`js/game.js`, `Player`, combat ...) into a separate
sandbox per room, with tiny stand-ins for the screen and sound (`server/stubs.js`), so the rules exist in one place only.

- **Rooms**: up to 12 players. Quick match fills a public room, which starts 15 s after its second player joins, or at once
  when it reaches 12. A private room waits for its host to press Start (needs 2+ players).
- **Fixed ticks**: the server advances the game in exact 1/60 s steps (so it plays the same for everyone) and sends a
  snapshot plus the events since the last one (jump, attack, hit, land, win, reset) 30 times a second.
- **Smooth display**: browsers show the game 70 ms in the past and blend between snapshots, with the timeline taken from the
  server's tick numbers so network jitter does not turn into stutter. Events (sparks, shake, sounds) replay when their
  moment arrives.
- **Leaving**: a player who leaves is removed without renumbering anyone; the game ends if fewer than two remain.
- **Protection**: only `index.html`, `index.css`, `index.js`, `js/` and `assets/` are served (not the server code, tests or
  `.git`); WebSocket messages are capped at 1 KB, rate-limited per player and validated; connections (1000) and rooms (200)
  are capped; dead connections are dropped by a heartbeat.

### Hosting it

Online play needs a host that runs Node and supports WebSockets (Railway, Render, Fly.io, a VPS ...). **GitHub Pages alone
cannot run online play** (static files only); the menu, local play and training still work there, and the online buttons
explain that the server could not be reached. See **Deploying** below.

## 🚀 Deploying

### What the game needs from any host
- Run `npm start` (no build step). It listens on the **`PORT`** environment variable (3000 if unset) on all network interfaces (it passes no host to Node, whose default is `::` where the machine has IPv6 and `0.0.0.0`
  otherwise; on a machine without IPv6 it binds `0.0.0.0`, which is what the tests ran on), and
  serves the page and the WebSocket on that one port. Over HTTPS the browser uses `wss://` automatically.
- **Exactly one instance.** Rooms live in that process's memory, so two copies would put players in separate worlds.
- `GET /healthz` returns `ok`, for a platform health check (or just `curl`).
- On `SIGTERM` (what hosts send on every redeploy) it tells every player "the server is restarting", closes the sockets
  properly and exits with code 0. A redeploy still ends games in progress.
- Optional limits, set as environment variables: **`MAX_CONNECTIONS`** (default 1000) and **`MAX_ROOMS`** (default 200).
  Anything that is not exactly a positive whole number is ignored.

### On Railway
These steps come from general knowledge of Railway, not from its current documentation (which I could not read when writing
this), so where its menus differ, follow Railway's docs. The game itself needs nothing Railway-specific.
1. Merge to `main` on GitHub (done if you are reading this there).
2. In Railway: **New Project**, **Deploy from GitHub repo**, pick this repo and the `main` branch.
3. It should detect Node from `package.json`, install the dependencies and run `npm start`. No environment variables are
   required: Railway supplies `PORT`.
4. Give the service a **public domain** in its networking settings. That URL is HTTPS, so the game uses `wss://` by itself.
5. Optionally set the health check path to `/healthz`, and keep the service at **one replica**.
6. Open the URL on two devices (say a laptop and a phone) and try **Quick match**.

### What it costs to run (measured, not guessed)
Measured on this code in one Node process, with simulated players moving, jumping and attacking about ten times a second each:

| Room | CPU | Memory | Bandwidth out |
|---|---|---|---|
| Busy **12-player** room | about 2.6% of one core | about 0.5 MB | about **430 KB/s (1.5 GB per hour)** |
| **2-player** room | about 0.7% of one core | about the same | about 15 KB/s (54 MB per hour) |

CPU and memory scale roughly linearly (a busy 12-player room cost 24.6 ms of CPU per second with 10 rooms and 27.4 ms with 200),
so one core holds roughly 27 busy 12-player rooms or about 100 two-player rooms at 70% load. **Bandwidth is the real limit and cost**, because every snapshot goes to every player in the room
(12 players receive 12 times what 2 do). Check your plan's price for network egress, and use `MAX_CONNECTIONS` and `MAX_ROOMS`
to cap spending. Not measured: real internet latency, the host's own CPU and memory limits, or the load balancer's overhead.

Before the URL goes public, settle the **licence for the art and audio** (see Credits and licences below).

---

## 🗺️ How the level is built

The map was made in [Tiled](https://www.mapeditor.org) (`assets/tiled/verticalPlatformer.tmx`) and both the **collision** and
the **art** are exported from it as tile data (`js/data/collision.js`, `js/data/art.js`). The tall level is that one map
repeated 5 times, **336 px apart** (less than the map's 432 px height, so the copies overlap and the platform spacing at each
seam stays 48 px). Only the first copy has the solid floor, the ledge, the trees and the bushes; every copy has platforms and
the vines hanging under them.

Collision and art are placed by the **same arithmetic** (`buildLevel()` and `levelArtPlacements()` in `js/level.js`), and a
test (`tests/art.test.js`) fails if a drawn platform isn't solid or a solid one isn't drawn. If you edit the map in Tiled,
run `npm run export-art` to regenerate `js/data/art.js` (a test fails if you forget). Use `?debug` to see the collision.

## 🧩 How the code fits together

The code is split into **the rules** and **the presentation**, joined by a small event bus:

```
  keyboard / touch / network / AI
              │  setMove · doJump · doAttack
              ▼
   THE RULES (js/game.js, Player, combat, level, ai)      ← runs in the browser AND headless on the server
              │  announces what happened: jump, attack, hit, land, win, reset
              ▼
   GameEvents (js/bus.js)  ──►  audio.js · effects.js · camera.js (shake)
              │
   Pixi sprites draw the result (render.js, Sprite, Player.draw)
```

The rules never draw or play a sound; they change plain state and announce events. That is what lets the server run them
with no screen, and lets every browser react to a server event exactly as it reacts to a local one.

## 📁 Project Structure

```bash
Vertical-Platformer-Fighting-Webgame/
│
├── index.html        # Main game page
├── index.css         # Game, menu and touch-control styling
├── index.js          # Browser loop: boot, rounds, frame
├── package.json      # npm start / npm test; depends on ws only
├── package-lock.json
├── js/               # Runs in the browser
│   ├── game.js       # THE RULES (shared with the server): players, jump, attack, step
│   ├── ai.js         # The computer opponent: level map, route to the door, fighting, difficulty (shared)
│   ├── net-state.js  # The game as plain data: snapshots, applying and blending them (shared)
│   ├── data/         # combat.js (attacks, injury, hits, HUD), collision.js (collision tiles) and art.js (art tiles, generated)
│   ├── classes/      # Sprite, Player, Door, CollisionBlock, AudioSFX
│   ├── level.js      # Tall level: stacks the map's collision AND art tiles with the same offsets, door position
│   ├── level-art.js  # Draws the sky, ground, platforms and vines from the Tiled layers
│   ├── debug.js      # ?debug / F2 collision overlay
│   ├── utils.js      # Collision helpers
│   ├── bus.js        # GameEvents: the game announces jump/attack/hit/land/win/reset
│   ├── net.js        # Connects to the server, sends input, replays snapshots and events
│   ├── menu.js       # Main menu, training and lobby screens, Leave button
│   ├── render.js     # PixiJS setup, texture loading, spritesheet slicing
│   ├── camera.js     # Zoom-to-fit camera that frames every player; screen shake
│   ├── effects.js    # Particles: sparks, dust, confetti
│   ├── audio.js      # Sound effects, reacting to game events
│   ├── events.js     # Keyboard controls and the three player actions
│   ├── touch.js      # On-screen touch buttons for phones
│   └── vendor/       # pixi.min.js (PixiJS 8.5.2) and its licence
├── server/           # Runs on Node
│   ├── server.js     # HTTP (static files) + WebSocket endpoint, limits
│   ├── lobby.js      # Quick match, private rooms, message routing
│   ├── room.js       # One room: lobby, fixed-tick game loop, snapshots
│   ├── sim.js        # Loads the shared rules into a sandbox per room
│   ├── sim-api.js    # The doorway into a room's sandbox (input, step, snapshot)
│   └── stubs.js      # Stand-ins for the browser-only pieces the rules touch
├── tools/
│   └── export-art.js # Tiled map -> js/data/art.js (npm run export-art)
├── tests/            # node --test
│   ├── sim.test.js   # The rules, headless (movement, jumps, hits, door, determinism, the AI's level map)
│   ├── collision.test.js # Landing on platforms at any speed and frame rate, one-way jumps, never falling out of the world
│   ├── art.test.js   # What you see is what you stand on: art matches collision in every copy; art.js matches the map
│   ├── ai.test.js    # The computer opponent (climbing, fighting, difficulty levels)
│   ├── room.test.js  # Lobby and rooms, with fake clients and a fake clock
│   └── server.test.js# The real server on a real port (files, sockets, limits)
└── assets/           # audio/ (10 sound files), images/ (warrior sprite sheets), tiled/ (the Tiled map, tileset and scenery images the level is drawn from)
```

`npm test` runs all 66 tests. Three of the sound files (`death`, `fall`, `run`) are loaded but not currently played, and `assets/images/background.png` (the original flattened picture of the map) is no longer used by the game: the level is drawn from the Tiled layers instead.

## ⚠️ Known limits

- **No client-side prediction yet**: online, what you see of your own character is delayed by your ping + 70 ms + up to 33 ms.
  Fine for a race, noticeable in a duel; prediction is the natural next step.
- Online rooms live in one server process's memory: restarting the server ends the games, and there is no reconnecting to a
  game in progress. No accounts, chat, or per-IP limits.
- All fighters look alike (the HUD colours and labels tell them apart), and the level is one map repeated (the tiles repeat, so the platform layout does too).
- The AI only fights rivals on its own platform level, doesn't chase one on another platform, and plans its route for a
  healthy player (it rests when badly hurt rather than re-planning).
- HUD for a full 12-player room shows your own bar plus a label and mini bar over each fighter.

## 📜 Credits and licences

- **PixiJS** (MIT): `js/vendor/pixi.min.js`, licence in `js/vendor/PIXI-LICENSE.txt`.
- **ws** (MIT): installed by `npm install`.
- **Game art and audio** (the warrior sprites, tileset, background and sound files in `assets/`): **the source and licence are
  not recorded in this repository yet.** Before publishing the game, confirm you are allowed to use and distribute each asset
  and add the credits here.
- This repository has no `LICENSE` file for the project's own code yet.

## 💡 Inspiration

This project was inspired by classic:
- Vertical arcade platformers
- 2D browser fighting games
- Fast-paced movement-based combat games

## 🔧 Future Improvements

- Client-side prediction for online play
- Bots that fill empty slots in an online room (the AI already runs headless on the server's rules)
- Hand-made levels and varied art instead of one repeated map
- Per-player character looks, and a proper HUD for large rooms
- A smarter AI: chase rivals on other platforms, and re-plan its route for its current injury
- Reconnecting to a game in progress, and rooms that survive a server restart
- Combos, power-ups and abilities

## 👨‍💻 Author
Somuna Nzenwa
somunanzenwa@gmail.com
Portfolio: https://somunaexe.github.io
