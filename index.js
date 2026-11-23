const gravity = 540; //Downward acceleration in pixels per second squared (was 0.15 per frame at 60 fps)

//Collision blocks for the whole tall level (see js/level.js)
const {collisionBlocks, platformBlocks} = buildLevel()

//Created in startGame() once Pixi and the textures are ready
let backgrounds = [] //The background image repeated to cover the tall level
let door
let player1
let player2
let players = [] //Everyone in the race; the camera keeps all of them on screen

//Add the background music
const bgMusic = new AudioSFX({src: 'assets/audio/bg-music.mp3', volume: 0.5, autoplay: true, loop: true});

/**
 * Builds the animation table for a warrior. Returns a fresh object each call because
 * the Player constructor attaches an Image to every entry, which players must not share.
 * Each entry is [name, spritesheet file, number of frames, frameBuffer (game frames per animation frame)].
 */
function createWarriorAnimations() {
    const sheets = [
        ['idle',           'Idle.png',           8, 3],
        ['run',            'Run.png',            8, 5],
        ['jump',           'Jump.png',           2, 5],
        ['fall',           'Fall.png',           2, 5],
        ['idleLeft',       'IdleLeft.png',       8, 3],
        ['runLeft',        'RunLeft.png',        8, 5],
        ['jumpLeft',       'JumpLeft.png',       2, 5],
        ['fallLeft',       'FallLeft.png',       2, 5],
        ['attackLow',      'AttackLow.png',      4, 6],
        ['attackMid',      'AttackMid.png',      4, 4],
        ['attackOverhead', 'AttackOverhead.png', 4, 5],
        ['hit',            'Take Hit.png',       2, 5],
        ['hitSilhouette',  'HitSilhouette.png',  2, 5],
        ['death',          'Death.png',          6, 5],
    ]
    const animations = {}
    for (const [name, file, frames, frameBuffer] of sheets) {
        animations[name] = {imageSrc: `assets/images/warrior/${file}`, frames, frameBuffer}
    }
    //Only right-facing sheets exist for these, so they are mirrored when drawn facing left
    for (const name of ['attackLow', 'attackMid', 'attackOverhead', 'hit', 'hitSilhouette', 'death']) {
        animations[name].mirrorWhenLeft = true
    }
    return animations
}

/**
 * Builds the sound set for a warrior. Each player needs their own Audio objects,
 * since playing a sound restarts it (shared objects would cut each other off).
 */
function createWarriorSounds() {
    const sound = (file, options) => new AudioSFX({src: `assets/audio/${file}`, ...options})
    return {
        death: sound('death.mp3'),
        fall: sound('fall.mp3'),
        grunt: sound('grunt.mp3'),
        hit: sound('hit.mp3'),
        jump: sound('jump.mp3'),
        lowAttack: sound('low-attack.mp3'),
        midAttack: sound('mid-attack.mp3'),
        overheadAttack: sound('overhead-attack.mp3'),
        run: sound('run.mp3', {loop: true}),
    }
}

/**
 * Creates a warrior at the given spawn point.
 * @param {Object} options
 * @param {String} options.name - Shown above the injury bar
 * @param {Number} options.x - Spawn x position
 * @param {Number} options.y - Spawn y position
 * @param {Boolean} options.facingLeft - Which way the warrior starts facing
 * @returns {Player}
 */
function createWarrior({name, x, y, facingLeft}) {
    return new Player({
        name,
        imageSrc: facingLeft ? "assets/images/warrior/IdleLeft.png" : "assets/images/warrior/Idle.png",
        position: {x, y},
        velocity: {x: 0, y: 0},
        collisionBlocks,
        platformBlocks,
        frames: 8,
        facingLeft,
        animations: createWarriorAnimations(),
        sounds: createWarriorSounds(),
    })
}

/** Starts a fresh round: no injuries, spawn positions. */
function resetMatch() {
    match.over = false
    match.winner = null
    player1.reset()
    player2.reset()
    updateCamera(players, app.screen, 0, true) //Don't glide across the level back to the start
}

//Timing state for the game loop. Lives outside animate() so it survives between frames
let lastTimestamp = null //Timestamp (ms) of the previous frame; null until the first frame
const MAX_DT = 0.05 //Longest time step allowed, in seconds (= 20 frames per second)
const MOVE_SPEED = 120 //Horizontal speed in pixels per second
const noKeys = {a: {pressed: false}, d: {pressed: false}} //Stand-in input when controls are locked

/**
 * Updates the player's animation and position based on the given keys
 * @param {Player} player - The player to update
 * @param {Object} keys - An object containing the pressed state of the left and right arrow keys
 * @param {Number} dt - Seconds elapsed since the previous frame
 */
function runPlayerAnimation(player, keys, dt) {
    player.checkForHorizontalCanvasCollisions(dt)
    player.update(dt);
    player.velocity.x = 0

    //Stunned: no control, just the hit animation while being pushed back
    if (player.hitTimer > 0) {
        player.velocity.x = player.knockbackSpeed
        player.switchSprite('hit')
        return
    }

    //Once the round is over nobody can steer
    const input = match.over ? noKeys : keys

    //Mid-attack the player is committed: no walking and no animation changes until the swing ends
    if (player.isAttacking) return

    if (input.d.pressed) {
        player.velocity.x = MOVE_SPEED * player.speedMultiplier //Move the player right (pixels per second)
        player.facingLeft = false //Set the player's facing direction
        player.switchSprite('run') //Switch to the run animation
    }
    else if (input.a.pressed) {
        player.velocity.x = -MOVE_SPEED * player.speedMultiplier //Move the player left (pixels per second)
        player.facingLeft = true //Set the player's facing direction
        player.switchSprite('runLeft') //Switch to the runLeft animation
    }
    else if (player.velocity.y === 0) {
        player.switchSprite(player.facingLeft ? 'idleLeft' : 'idle')
    }

    //Airborne animations, depending on the player's facing direction
    if (player.velocity.y < 0) player.switchSprite(player.facingLeft ? 'jumpLeft' : 'jump')
    else if (player.velocity.y > 0) player.switchSprite(player.facingLeft ? 'fallLeft' : 'fall')
}

/**
 * Runs one game frame: measures dt, updates players and combat, then has Pixi paint it.
 * the background and player animations, and applying camera transformations.
 * Utilizes requestAnimationFrame for smooth rendering.
 */
function animate(timestamp) {
    window.requestAnimationFrame(animate)

    // Seconds since the previous frame. On the very first frame there is no previous
    // timestamp, so dt is 0 (nothing moves yet) instead of NaN.
    // Capped so a hidden tab or a lag spike can't make characters teleport through walls.
    const dt = lastTimestamp === null ? 0 : Math.min((timestamp - lastTimestamp) / 1000, MAX_DT)
    lastTimestamp = timestamp

    //Frame everyone. Done before the players move so the sprites and the camera agree this frame
    updateCamera(players, app.screen, dt)

    runPlayerAnimation(player1, player1Keys, dt)
    runPlayerAnimation(player2, player2Keys, dt)
    resolveCombat(player1, player2)
    checkDoorWin([player1, player2], door)

    updateHud(player1, player2)
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
    door = new Door({position: doorPosition(36)}) //On the highest platform of the top copy
    player1 = createWarrior({name: 'PLAYER 1', x: 100, y: 300, facingLeft: false})
    player2 = createWarrior({name: 'PLAYER 2', x: 300, y: 300, facingLeft: true})
    players = [player1, player2]
    updateCamera(players, app.screen, 0, true) //Start already framed, no glide from nowhere

    window.requestAnimationFrame(animate)
}

startGame()
