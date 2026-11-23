//Instantiate the canvas using the canvas html tag and context
const canvas = document.querySelector("canvas");
const c = canvas.getContext('2d');

//Set the canvas width and height
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gravity = 0.15; //The drag/acceleration due to gravity on the player

//Canvas is scaled to fill entire screen. Hence, it's actual width and height are stored in scaledCanvas for calculations
const scaledCanvas = {
    width: canvas.width / 4,
    height: canvas.height / 4
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

//Add the background sprite
const background = new Sprite({
    imageSrc: "assets/images/background.png",
    position: {x: 0, y: 0}
})

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
 * @param {Number} options.x - Spawn x position
 * @param {Number} options.y - Spawn y position
 * @param {Boolean} options.facingLeft - Which way the warrior starts facing
 * @returns {Player}
 */
function createWarrior({x, y, facingLeft}) {
    return new Player({
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

const player1 = createWarrior({x: 100, y: 300, facingLeft: false})
const player2 = createWarrior({x: 300, y: 300, facingLeft: true})

const backgroundHeight = 432
//Camera object for tracking the player
const camera = {
    position: {
        x: 0,
        y: -backgroundHeight + scaledCanvas.height,
    },
}

//Timing state for the game loop. Lives outside animate() so it survives between frames
let lastTimestamp = null //Timestamp (ms) of the previous frame; null until the first frame
const MAX_DT = 0.05 //Longest time step allowed, in seconds (= 20 frames per second)
const MOVE_SPEED = 120 //Horizontal speed in pixels per second

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

    if (keys.d.pressed) {
        player.velocity.x = MOVE_SPEED //Move the player right (pixels per second)
        player.facingLeft = false //Set the player's facing direction
        player.switchSprite('run') //Switch to the run animation

        player.panCameraToLeft(canvas, camera, dt) //Pan the camera to the left if the player is exceeding the right boundary
    }
    else if (keys.a.pressed) {
        player.velocity.x = -MOVE_SPEED //Move the player left (pixels per second)
        player.facingLeft = true //Set the player's facing direction
        player.switchSprite('runLeft') //Switch to the runLeft animation
        player.panCameraToRight(camera, dt) //Pan the camera to the right if the player is exceeding the left boundary
    }
    else if (player.velocity.y === 0 && !player.isAttacking) {
        if(player.facingLeft) player.switchSprite('idleLeft') //Switch to the idleLeft animation
        else player.switchSprite('idle') //Switch to the idle animation
    }

    //If player is jumping
    if (player.velocity.y < 0) {
        player.panCameraToDown(camera) //Pan the camera to the down if the player is exceeding the top boundary

        //Switch to the jump animation depending on the player's facing direction
        if(player.facingLeft) player.switchSprite('jumpLeft')
        else player.switchSprite('jump')
    }
    else if (player.velocity.y > 0) {
        player.panCameraToUp(camera, canvas) //Pan the camera to the up if the player is exceeding the bottom boundary

        //Switch to the fall animation depending on the player's facing direction
        if(player.facingLeft) player.switchSprite('fallLeft')
        else player.switchSprite('fall')
    }
}

/**
 * Continuously animates the game frame by clearing the canvas, updating
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

    c.fillStyle = 'white';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.save()
    c.scale(4, 4)
    c.translate(camera.position.x, camera.position.y)
    background.update()
    runPlayerAnimation(player1, player1Keys, dt)
    runPlayerAnimation(player2, player2Keys, dt)
    c.restore()
}
window.requestAnimationFrame(animate)