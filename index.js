//Created in startGame() once Pixi and the textures are ready
let backgrounds = [] //The background image repeated to cover the tall level

//Add the background music
const bgMusic = new AudioSFX({src: 'assets/audio/bg-music.mp3', volume: 0.5, autoplay: true, loop: true});

// When a round restarts, the presentation clears its leftovers and the camera jumps back (no glide across the level)
GameEvents.on('reset', () => {
    clearEffects()
    updateCamera(activePlayers(), app.screen, 0, true)
})

//Timing state for the game loop. Lives outside animate() so it survives between frames
let lastTimestamp = null //Timestamp (ms) of the previous frame; null until the first frame
const MAX_DT = 0.05 //Longest time step allowed, in seconds (= 20 frames per second)

/**
 * Runs one browser frame: measures dt, steps the game rules, then has Pixi paint the result.
 * Re-schedules itself with requestAnimationFrame, so it runs once per monitor refresh.
 * @param {Number} timestamp - Milliseconds since page load, supplied by requestAnimationFrame
 */
function animate(timestamp) {
    window.requestAnimationFrame(animate)

    // Seconds since the previous frame. On the very first frame there is no previous
    // timestamp, so dt is 0 (nothing moves yet) instead of NaN.
    // Capped so a hidden tab or a lag spike can't make characters teleport through walls.
    const dt = lastTimestamp === null ? 0 : Math.min((timestamp - lastTimestamp) / 1000, MAX_DT)
    lastTimestamp = timestamp

    //Frame everyone. Done before the players move so the sprites and the camera agree this frame
    //Normally frame everyone; once the race is won, glide in on the winner (nobody is racing any more)
    const cameraFocus = match.over && match.winner ? [match.winner] : activePlayers()
    updateCamera(cameraFocus, app.screen, dt)

    stepGame(dt) //All the rules live in game.js

    updateEffects(dt)
    updateHud(players[0], players[1])
    app.render() //One paint per game frame, after all state is updated
}

/**
 * Boots the game: starts Pixi, loads every image, builds the scene, then starts the loop.
 * Everything that needs a texture waits for this, because textures load asynchronously.
 */
async function startGame() {
    const backgroundSrc = "assets/images/background.png"
    const sheets = Object.values(createWarriorAnimations()).map(animation => animation.imageSrc)
    await initRenderer([backgroundSrc, ...sheets])

    //Stack copies of the background upwards from the bottom of the level until the top is covered
    const backgroundCount = Math.ceil(LEVEL.height / BACKGROUND_HEIGHT)
    for (let i = 0; i < backgroundCount; i++) {
        const background = new Sprite({imageSrc: backgroundSrc, position: {x: 0, y: -i * BACKGROUND_HEIGHT}})
        background.draw() //Static: positioned once, never animated
        backgrounds.push(background)
    }
    //?players=N starts a local round with N players (2-12): the extras stand still, which is handy for testing crowds
    const requested = parseInt(new URLSearchParams(location.search).get('players'), 10)
    createRoundEntities(Number.isInteger(requested) ? Math.min(MAX_PLAYERS, Math.max(2, requested)) : 2) //The door and the players (see game.js); after the background so they draw on top
    initEffects() //After the players, so particles draw on top of them
    updateCamera(activePlayers(), app.screen, 0, true) //Start already framed, no glide from nowhere

    window.requestAnimationFrame(animate)
}

startGame()
