// ---- The game rules: everything that decides what happens, and nothing that draws ----
// This file is shared. The browser runs it for local play, and the Node server runs the very same
// code headless (see server/). It must never touch the screen, the DOM or the sound system directly:
// it changes plain state and announces what happened through GameEvents.

// ---- Physics and movement tuning ----
const gravity = 540     //Downward acceleration in pixels per second squared (was 0.15 per frame at 60 fps)
const MOVE_SPEED = 120  //Horizontal speed in pixels per second
const JUMP_SPEED = 240  //Initial upward speed of a jump, in pixels per second
const noKeys = {a: {pressed: false}, d: {pressed: false}} //Stand-in input when controls are locked

//Collision blocks for the whole tall level (see js/level.js)
const {collisionBlocks, platformBlocks} = buildLevel()

// ---- The cast: set up by createRoundEntities() ----
let door
let player1
let player2
let players = [] //Everyone in the race; the camera keeps all of them on screen

// A room holds at most this many players. Everyone gets a "slot" (0 .. MAX_PLAYERS - 1) for the whole round.
const MAX_PLAYERS = 12

// Held-key state for each player slot: a = left, d = right. Jumping and attacking are one-shot actions.
const playerKeys = Array.from({length: MAX_PLAYERS}, () => ({a: {pressed: false}, d: {pressed: false}}))

// One colour per slot, spread around the colour wheel so neighbours are easy to tell apart.
// The first two keep their original blue and orange.
const PLAYER_COLORS = [0x4aa3ff, 0xff7a59, 0x55dd88, 0xffd34d, 0xc77dff, 0x4de3e3, 0xff6fa5, 0xa3e04a, 0xff9f1c, 0x8c9eff, 0xe6e6e6, 0xd6806b]

/**
 * Where a player starts, their name and their HUD colour.
 * Two players start apart facing each other (as in the original game); more are spread evenly
 * across the floor, each facing the middle.
 * @param {Number} slot - 0-based player slot
 * @param {Number} count - How many players are in the round
 */
function spawnFor(slot, count) {
    const x = count <= 2 ? [100, 300][slot] : 48 + slot * (480 / (count - 1))
    return {
        name: `PLAYER ${slot + 1}`,
        color: PLAYER_COLORS[slot],
        x,
        y: 300,
        facingLeft: count <= 2 ? slot === 1 : x > MAP_WIDTH / 2,
    }
}

/**
 * Builds the animation table for a warrior. Returns a fresh object each call because
 * the Player constructor attaches textures to every entry, which players must not share.
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
        ['hit',            'Take Hit.png',       4, 5],
        ['hitSilhouette',  'HitSilhouette.png',  4, 5],
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
 * @param {Number} options.color - Tint (0xRRGGBB) that identifies this player on the HUD
 * @param {Number} options.x - Spawn x position
 * @param {Number} options.y - Spawn y position
 * @param {Boolean} options.facingLeft - Which way the warrior starts facing
 * @returns {Player}
 */
function createWarrior({name, color, x, y, facingLeft}) {
    return new Player({
        name,
        color,
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

/**
 * Creates the door and the players. Call once, after anything they need (textures, in the browser) is ready.
 * The door is created first so it draws behind the players.
 * @param {Number} [count=2] - How many players are in the round (2 to MAX_PLAYERS)
 */
function createRoundEntities(count = 2) {
    door = new Door({position: doorPosition(36)}) //On the highest platform of the top copy
    players = Array.from({length: count}, (_, slot) => createWarrior(spawnFor(slot, count)))
    ;[player1, player2] = players //The two keyboard schemes of local play control these
}

/** @returns {Player[]} Everyone still in the round (players who disconnected are ignored by the rules and the camera) */
function activePlayers() {
    return players.filter(player => !player.departed)
}

/** Starts a fresh round: no injuries, spawn positions. Announces 'reset' so the presentation can clear itself. */
function resetMatch() {
    match.over = false
    match.winner = null
    activePlayers().forEach(player => player.reset())
    GameEvents.emit('reset', {})
}

/**
 * Makes a player jump if they have any jumps left (2 = double jump), and announces it.
 * @param {Player} player - The player that should jump
 */
function jump(player) {
    if (player.jumps <= 0 || !player.canAct()) return
    player.collidedVertically = false
    player.jumps--
    player.velocity.y = -JUMP_SPEED * player.jumpMultiplier //Injured players jump lower
    GameEvents.emit('jump', {player})
}

/**
 * Starts an attack unless the player is already mid-attack (or can't act).
 * Announces the attack and plays the matching animation; Sprite.updateFrames resets isAttacking when the animation ends.
 * Whether the sword actually hurts anyone is decided each frame by resolveCombat.
 * @param {Player} player - The attacking player
 * @param {String} type - A key of ATTACKS: 'low', 'mid' or 'overhead'
 */
function attack(player, type) {
    if (player.isAttacking || !player.canAct()) return
    const {animation} = ATTACKS[type]
    player.isAttacking = true
    player.currentAttack = type
    player.attackHasHit = false
    GameEvents.emit('attack', {player, type})
    player.switchSprite(animation)
    player.currentFrame = 0 //Start the swing from its first frame, even if the sheet was already showing
    player.elapsedTime = 0
}

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
 * Advances the whole game by dt seconds: every player moves, swords are checked, the door is checked.
 * @param {Number} dt - Seconds to simulate
 */
function stepGame(dt) {
    players.forEach((player, slot) => {
        if (!player.departed) runPlayerAnimation(player, playerKeys[slot], dt)
    })
    resolveCombat(activePlayers())
    checkDoorWin(activePlayers(), door)
}
