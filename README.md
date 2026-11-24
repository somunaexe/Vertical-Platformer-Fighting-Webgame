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
- GitHub Pages (for deployment, if applicable)

---

## 🎯 Features

- Frame-rate independent movement, jumping (with double jump) and animation
- Sword combat: three attacks with wind-up, active frames, reach and knockback
- Injury system: weaker climbing, slow recovery, faster when resting
- Tall level built from stacked copies of the collision data, with a zoom-to-fit camera
- PixiJS (WebGL) rendering

---

## 🧠 How to Play

### Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | A / D | Left / Right arrows |
| Jump (double jump) | W | Up arrow |
| Low / Mid / Overhead attack | X / C / V | I / O / P |

Press **Enter** after someone reaches the door for a rematch.

- **Goal:** Reach the door at the top before anyone else

---

## 📁 Project Structure

```bash
Vertical-Platformer-Fighting-Webgame/
│
├── index.html        # Main game page
├── index.css         # Game styling
├── index.js          # Level setup, player creation, game loop
├── js/
│   ├── render.js     # PixiJS setup, texture loading, spritesheet slicing
│   ├── level.js      # Tall level: stacks the map data, door position
│   ├── camera.js     # Zoom-to-fit camera that frames every player
│   ├── vendor/       # pixi.min.js (PixiJS 8.5.2) and its licence
│   ├── events.js     # Keyboard controls, jump/attack actions, music
│   ├── utils.js      # Collision helpers
│   ├── classes/      # Sprite, Player, CollisionBlock, AudioSFX
│   └── data/         # Tiled collision data
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
