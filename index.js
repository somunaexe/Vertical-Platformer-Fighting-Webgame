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
    if (!players.length) { //Between rounds (menu, lobby): nothing to simulate; show the level behind the menu
        idleCamera(app.screen)
        app.render()
        return
    }

    // Seconds since the previous frame. On the very first frame there is no previous
    // timestamp, so dt is 0 (nothing moves yet) instead of NaN.
    // Capped so a hidden tab or a lag spike can't make characters teleport through walls.
    const dt = lastTimestamp === null ? 0 : Math.min((timestamp - lastTimestamp) / 1000, MAX_DT)
    lastTimestamp = timestamp

    //Online: show the server's game (a moment ago, blended) BEFORE framing, so the camera sees the puppets where they're drawn
    if (net.active) renderNetworkState(timestamp)

    //Frame everyone. Done before the players move so the sprites and the camera agree this frame
    //Normally frame everyone; once the race is won, glide in on the winner (nobody is racing any more)
    const cameraFocus = match.over && match.winner ? [match.winner] : activePlayers()
    updateCamera(cameraFocus, app.screen, dt)

    if (!net.active) stepGame(dt) //Local play: all the rules live in game.js. Online, the server runs them and snapshots arrive by network

    updateEffects(dt)
    updateHud(players)
    app.render() //One paint per game frame, after all state is updated
}

/**
 * Starts Pixi, loads every image and builds the level's background. Done once per page.
 * Everything that needs a texture waits for this, because textures load asynchronously.
 */
async function bootRenderer() {
    const sheets = Object.values(createWarriorAnimations()).map(animation => animation.imageSrc)
    await initRenderer([...levelArtTextureUrls(), ...sheets])
    buildLevelArt() //Sky, ground, platforms and vines, drawn from the Tiled map's layers (see js/level-art.js)
    window.requestAnimationFrame(animate)
}

/**
 * Starts a round: creates the door and the players and frames the camera on them.
 * @param {Number} count - How many players (2 to MAX_PLAYERS)
 */
function beginRound(count) {
    createRoundEntities(count) //The door and the players (see game.js); after the background so they draw on top
    initEffects() //After the players, so particles draw on top of them
    updateCamera(activePlayers(), app.screen, 0, true) //Start already framed, no glide from nowhere
}

/** Removes the current round's players, door and effects from the scene (before the next round, or when leaving). */
function teardownRound() {
    if (!players.length) return
    clearEffects()
    effects.layer.destroy()
    for (const player of players) player.view.destroy()
    door.view.destroy()
    players = []
    door = undefined
    aiControllers.length = 0 //Any computer players go with the round
    training.active = false
    training.level = null
    match.over = false
    match.winner = null
}

//Normally the menu appears. The address can skip it: ?online, ?online=create or ?room=CODE joins a game server;
//?local starts a local round, ?training=easy|normal|hard|dummy a round against the computer, ?players=N a local round with N players (2-12; the extras stand still, handy for testing crowds)
const params = new URLSearchParams(location.search)
bootRenderer().then(() => {
    createMenu()
    if (params.has('room')) return joinOnline({mode: 'code', code: params.get('room')})
    if (params.has('online')) return joinOnline({mode: params.get('online') === 'create' ? 'create' : 'quick'})
    if (params.has('training')) {
        const level = params.get('training')
        return startTraining(Object.hasOwn(AI_LEVELS, level) ? level : 'normal')
    }
    if (params.has('local') || params.has('players')) {
        const requested = parseInt(params.get('players'), 10)
        return startLocal(Number.isInteger(requested) ? Math.min(MAX_PLAYERS, Math.max(2, requested)) : 2)
    }
    showMainMenu() //Normal start: the menu
})
