const gravity = 540; //Downward acceleration in pixels per second squared (was 0.15 per frame at 60 fps)

//The world is drawn at SCALE x, so the screen shows window / SCALE world pixels. Used to place the camera
const scaledCanvas = {
    width: window.innerWidth / SCALE,
    height: window.innerHeight / SCALE
}

//Set up a 2D array to store the collision tileset data
const floorCollisions2D = []
for (let i = 0; i < floorCollisions.length; i+= 36) {
    floorCollisions2D.push(floorCollisions.slice(i, i + 36))//Each pushed/sliced array represents a row
}

//Set up collision blocks in the canvas using the collision tileset data
const collisionBlocks = []
floorCollisions2D.forEach((row, y) => {
    row.forEach((symbol, x) => {
        if (symbol === 202) {
            collisionBlocks.push(new CollisionBlock({
                position: {
                    x: x * 16,
                    y: y * 16
                }
            }))
        }
    })
})

//Set up a 2D array to store the platform collision tileset data
const platformCollisions2D = []
for (let i = 0; i < platformCollisions.length; i+= 36) {
    platformCollisions2D.push(platformCollisions.slice(i, i + 36))
}

//Set up platform collision blocks in the canvas using the collision tileset data
const platformBlocks = []
platformCollisions2D.forEach((row, y) => {
    row.forEach((symbol, x) => {
        if (symbol === 202) {
            platformBlocks.push(new CollisionBlock({
                position: {
                    x: x * 16,
                    y: y * 16
                },
                height: 4,
            }))
        }
    })
})

//Created in startGame() once Pixi and the textures are ready
let background
let door
let player1
let player2

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

const backgroundHeight = 432
//Camera object for tracking the player
const cameraStart = {x: 0, y: -backgroundHeight + scaledCanvas.height}
const camera = {
    position: {...cameraStart},
}

/** Starts a fresh round: no injuries, spawn positions, camera back at the start. */
function resetMatch() {
    match.over = false
    match.winner = null
    player1.reset()
    player2.reset()
    camera.position.x = cameraStart.x
    camera.position.y = cameraStart.y
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

    //The camera follows vertical movement in every state (jumping, falling, even while stunned)
    if (player.velocity.y < 0) player.panCameraToDown(camera, dt) //Pan the camera down if the player is exceeding the top boundary
    else if (player.velocity.y > 0) player.panCameraToUp(camera, app.screen, dt) //Pan the camera up if the player is exceeding the bottom boundary

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
        player.velocity.x = MOVE_SPEED //Move the player right (pixels per second)
        player.facingLeft = false //Set the player's facing direction
        player.switchSprite('run') //Switch to the run animation
        player.panCameraToLeft(app.screen, camera, dt) //Pan the camera to the left if the player is exceeding the right boundary
    }
    else if (input.a.pressed) {
        player.velocity.x = -MOVE_SPEED //Move the player left (pixels per second)
        player.facingLeft = true //Set the player's facing direction
        player.switchSprite('runLeft') //Switch to the runLeft animation
        player.panCameraToRight(camera, dt) //Pan the camera to the right if the player is exceeding the left boundary
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

    //Camera -> screen: the world is scaled by SCALE, then shifted by the camera
    world.position.set(camera.position.x * SCALE, camera.position.y * SCALE)

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

    background = new Sprite({imageSrc: backgroundSrc, position: {x: 0, y: 0}})
    background.draw() //Static: positioned once, never animated
    //The door sits on the highest platform of the map (platform tiles x 12-14, y = 4 tiles = 64px)
    door = new Door({position: {x: 12 * 16 + 12, y: 4 * 16 - 36}})
    player1 = createWarrior({name: 'PLAYER 1', x: 100, y: 300, facingLeft: false})
    player2 = createWarrior({name: 'PLAYER 2', x: 300, y: 300, facingLeft: true})

    window.requestAnimationFrame(animate)
}

startGame()
