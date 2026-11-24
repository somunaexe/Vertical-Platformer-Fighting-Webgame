# 🕹️ Vertical Platformer Fighting Webgame

A fast-paced **2D vertical platformer + fighting game** built for the web using HTML, CSS, and JavaScript.

Players race up a vertical level to a door at the top, fighting each other on the way.

---

## 🎮 Game Concept

A competitive **race to the top**. Every player climbs the same tall, vertical level and
**the first to reach the door wins**. You fight as you climb, but nobody dies:

- A sword hit adds **injury**. The more injured you are, the **slower you walk and the lower you jump**.
- Injury **heals slowly**, and faster while you stand still. Resting costs time; racing while hurt costs speed.
- Hits **knock you back and up**. Get knocked off a ledge and you fall to whatever is below.
- Nobody is left out: the **camera zooms in and out** to keep every player on screen, and a progress track shows who is ahead.
- The level is the original map **stacked five times**; change `LEVEL_COPIES` in `js/level.js` to make it taller.

---

## 🛠️ Built With

- HTML5
- CSS3
- JavaScript (Vanilla)
- [PixiJS](https://pixijs.com) v8 (WebGL rendering, vendored in `js/vendor/`, MIT licence)
- Node.js + [`ws`](https://github.com/websockets/ws) for online multiplayer (the only dependency)

---

## 🎯 Features

- Frame-rate independent movement, jumping (with double jump) and animation
- Sword combat: three attacks with wind-up, active frames, reach and knockback
- Injury system: weaker climbing, slow recovery, faster when resting
- Phone support: touch controls, responsive HUD, camera that keeps fighters clear of the buttons
- **Training mode**: race and fight a computer opponent (Dummy, Easy, Normal, Hard); no server or network needed
- **Online multiplayer**: up to **12 players per room**, quick match or private rooms with a 4-letter code, run by an authoritative Node server
- Tall level built from stacked copies of the collision data, with a zoom-to-fit camera
- PixiJS (WebGL) rendering
- Game feel: hit sparks, landing dust, screen shake, white hit flash and win confetti, all driven by game events (`js/bus.js`)

---

## 🧠 How to Play

### Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | A / D | Left / Right arrows |
| Jump (double jump) | W | Up arrow |
| Low / Mid / Overhead attack | X / C / V | I / O / P |

Press **Enter** after someone reaches the door for a rematch.

### On a phone or tablet

Touch screens get on-screen buttons automatically (add `?touch` to the URL to see them on a desktop):
a d-pad on the left, **JUMP** and **LOW / MID / HIGH** attacks on the right. They control **Player 1**; hold
a direction with one thumb and jump or attack with the other. Tap the game after a win to play again.
Portrait suits the tall level best.

- **Goal:** Reach the door at the top before anyone else

---

## ▶️ Running it

```bash
npm install     # installs ws, the only dependency
npm start       # http://localhost:3000   (set PORT to change it)
npm test        # 47 automated tests: game rules, the AI, rooms and lobby, the real server
```

Open the address in a browser. The menu offers **Quick match**, **Create private room**, joining by code, and
**Training** (against the computer) and **Play locally** (two players on one keyboard); neither needs the server. Address options skip the menu:

| Address | Does |
|---|---|
| `?local` | Local two-player game |
| `?training=LEVEL` | Training against the computer: `dummy`, `easy`, `normal` or `hard` |
| `?players=N` | Local round with N players (2-12); the extras stand still, handy for testing crowds |
| `?online` / `?online=create` | Quick match / new private room |
| `?room=CODE` | Join a room by code |
| `?touch` | Show the touch controls on a desktop |

## 🤖 Training mode

Pick **Training** in the menu (or open `?training=normal`) to race and fight a computer opponent. You are Player 1 and
can use either key set (WASD + X/C/V, or the arrow keys + I/O/P). It is a local game: no server, no network.

| Level | What it does | Races alone in | Swings in its first 5 s beside you |
|---|---|---|---|
| **Dummy** | Stands still and never acts: for practising attacks | never | 0 |
| **Easy** | Slow to react, dithers while climbing, swings rarely | 55 to 69 s | 2 |
| **Normal** | A fair race and a fair fight | 36 to 41 s | 5 |
| **Hard** | Quick, aggressive, dodges slow attacks, rests to heal when badly hurt | 31 s (the fastest the rules allow) | 7 |

**It plays by the same rules you do.** The AI holds the same left/right keys and calls the same `jump()` and `attack()`
a human does (`js/ai.js`), so it can't move faster, jump higher or skip injury. What it knows beyond a player is only the
layout of the level, which you can see too.

How it thinks, in the order it matters:
1. **A map of the level.** Platforms are found from the same collision blocks the physics uses and linked by which can reach
   which (a jump of up to 85 px, across gaps up to 60 px). A shortest-path search run backwards from the door tells every
   platform its best next hop. Hops cost more the higher they climb (the cost grows with the square of the rise), so it
   prefers a staircase of easy 32 and 48 px steps, the route that still works when injured (at full injury a double jump
   only rises 68 px, so the map's 64 and 80 px hops are out of reach).
2. **Choices happen at its reaction time; mechanics happen every step.** A few times a second it decides whether to fight,
   dither, rest or dodge. Walking onto the right spot and the moment of the jump are checked every step, like a beginner
   who is slow to decide but still knows where to put their feet.
3. **Fight, then move on.** On the same level and in range it turns to face you, closes in and swings, picking attacks
   at random (overhead against someone airborne). Once you are badly hurt it leaves you behind to race, unless you are
   attacking it.
4. **Repeatable.** Its random choices come from a seeded generator, so a run can be replayed exactly (the tests do).

## 🌐 How online play works

The **server runs the game** and the browsers only send input and draw what they are told, so nobody can cheat by
editing their own game. The server loads the *same* rules files the browser uses (`js/game.js`, `Player`, combat ...)
into a separate sandbox per room, with tiny stand-ins for the screen and sound (`server/stubs.js`), so the rules exist in
one place only.

- **Rooms**: up to 12 players. Quick match fills a public room, which starts 15 s after its second player joins, or at once
  when it reaches 12. A private room waits for its host to press Start (needs 2+ players).
- **Fixed ticks**: the server advances the game in exact 1/60 s steps (so it plays the same for everyone) and sends a snapshot
  plus the events since the last one (jump, attack, hit, land, win, reset) 30 times a second.
- **Smooth display**: browsers show the game 70 ms in the past and blend between snapshots, with the timeline taken from the
  server's tick numbers so network jitter does not turn into stutter. Events (sparks, shake, sounds) replay when their moment arrives.
- **Leaving**: a player who leaves is removed without renumbering anyone; the game ends if fewer than two remain.
- **Protection**: only `index.html`, `index.css`, `index.js`, `js/` and `assets/` are served (not the server code, tests or
  `.git`); WebSocket messages are capped at 1 KB, rate-limited per player and validated; connections and rooms are capped;
  dead connections are dropped by a heartbeat.

### Hosting it

Online play needs a host that runs Node and supports WebSockets (Render, Fly.io, Railway, a VPS ...): run `npm start`,
set `PORT` if the host asks, and serve it over HTTPS (the browser then uses `wss://` automatically). **GitHub Pages alone
cannot run online play** (static files only). The menu still works there and local play is fine; the online buttons
explain that the server could not be reached.

### Known limits

- No client-side prediction yet: what you see of your own character is delayed by your ping + 70 ms + up to 33 ms.
  Fine for a race, noticeable in a duel; prediction is the natural next step.
- Rooms live in one server process's memory: restarting the server ends the games, and there is no reconnecting to a game in progress.
- No accounts, chat, or per-IP limits, and all 12 fighters look alike (the HUD colours and labels tell them apart).

## 📁 Project Structure

```bash
Vertical-Platformer-Fighting-Webgame/
│
├── index.html        # Main game page
├── index.css         # Game, menu and touch-control styling
├── index.js          # Browser loop: boot, rounds, frame
├── package.json      # npm start / npm test; depends on ws only
├── js/               # Runs in the browser
│   ├── game.js       # THE RULES (shared with the server): players, jump, attack, step
│   ├── ai.js         # The computer opponent: level map, route to the door, fighting, difficulty (shared)
│   ├── net-state.js  # The game as plain data: snapshots, applying and blending them (shared)
│   ├── data/         # combat.js (attacks, injury, hits, HUD) and the Tiled collision data
│   ├── classes/      # Sprite, Player, Door, CollisionBlock, AudioSFX
│   ├── level.js      # Tall level: stacks the map data, door position
│   ├── utils.js      # Collision helpers
│   ├── bus.js        # GameEvents: the game announces jump/attack/hit/land/win/reset
│   ├── net.js        # Connects to the server, sends input, replays snapshots and events
│   ├── menu.js       # Main menu, lobby and Leave button
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
├── tests/            # node --test: rules, the AI, rooms/lobby, the real server
├── assets/           # Images, sprites, audio, Tiled map
└── README.md         # Documentation
```

## 💡 Inspiration

This project was inspired by classic:
- Vertical arcade platformers
- 2D browser fighting games
- Fast-paced movement-based combat games

## 🔧 Future Improvements

- Add combo / advanced combat system
- Improve enemy AI behavior
- Add multiple levels or procedurally generated maps
- Mobile touch controls 📱
- Sound effects and background music 🎵
- Power-ups and abilities

## 👨‍💻 Author
Somuna Nzenwa
somunanzenwa@gmail.com
Portfolio: https://somunaexe.github.io
