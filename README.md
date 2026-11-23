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
npm test        # 31 automated tests: game rules, rooms and lobby, the real server
```

Open the address in a browser. The menu offers **Quick match**, **Create private room**, joining by code, and
**Play locally** (two players on one keyboard, no server needed). Address options skip the menu:

| Address | Does |
|---|---|
| `?local` | Local two-player game |
| `?players=N` | Local round with N players (2-12); the extras stand still, handy for testing crowds |
| `?online` / `?online=create` | Quick match / new private room |
| `?room=CODE` | Join a room by code |
| `?touch` | Show the touch controls on a desktop |

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
├── tests/            # node --test: rules, rooms/lobby, the real server
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
