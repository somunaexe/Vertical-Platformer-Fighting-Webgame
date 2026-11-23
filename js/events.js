// Only left/right are held-key states; jumping and attacking are one-shot actions handled on keydown
const player1Keys = {
    a: { pressed: false },
    d: { pressed: false }
};

const player2Keys = {
    a: { pressed: false },
    d: { pressed: false }
};

const JUMP_SPEED = 240 //Initial upward speed of a jump, in pixels per second

// Maps each attack type to the sound and animation it triggers
const attackTypes = {
    low:      { sound: 'lowAttack',      animation: 'attackLow' },
    mid:      { sound: 'midAttack',      animation: 'attackMid' },
    overhead: { sound: 'overheadAttack', animation: 'attackOverhead' },
}

// One entry per player: which key does what.
// `player` is a function because player1/player2 are created later, in index.js
const controlSchemes = [
    {
        player: () => player1,
        keys: player1Keys,
        left: "KeyA",
        right: "KeyD",
        jump: "KeyW",
        attacks: { KeyX: 'low', KeyC: 'mid', KeyV: 'overhead' },
    },
    {
        player: () => player2,
        keys: player2Keys,
        left: "ArrowLeft",
        right: "ArrowRight",
        jump: "ArrowUp",
        attacks: { KeyI: 'low', KeyO: 'mid', KeyP: 'overhead' },
    },
]

/**
 * Makes a player jump if they have any jumps left (2 = double jump), and plays the jump sound once.
 * @param {Player} player - The player that should jump
 */
function jump(player) {
    if (player.jumps <= 0) return
    player.collidedVertically = false
    player.jumps--
    player.velocity.y = -JUMP_SPEED

    player.sounds.jump.currentTime = 0
    player.sounds.jump.playbackRate = 2.0
    player.sounds.jump.play()
}

/**
 * Starts an attack unless the player is already mid-attack.
 * Plays the matching sound and animation; Sprite.updateFrames resets isAttacking when the animation ends.
 * @param {Player} player - The attacking player
 * @param {String} type - A key of attackTypes: 'low', 'mid' or 'overhead'
 */
function attack(player, type) {
    if (player.isAttacking) return
    const {sound, animation} = attackTypes[type]
    player.isAttacking = true
    player.sounds[sound].currentTime = 0
    player.sounds[sound].play()
    player.switchSprite(animation)
}

window.addEventListener("keydown", event => {
    for (const scheme of controlSchemes) {
        if (event.code === scheme.left) scheme.keys.a.pressed = true
        else if (event.code === scheme.right) scheme.keys.d.pressed = true
        else if (event.code === scheme.jump) jump(scheme.player())
        else if (event.code in scheme.attacks) attack(scheme.player(), scheme.attacks[event.code])
    }
})

window.addEventListener("keyup", event => {
    for (const scheme of controlSchemes) {
        if (event.code === scheme.left) scheme.keys.a.pressed = false
        else if (event.code === scheme.right) scheme.keys.d.pressed = false
    }
})

//Resize the canvas to fit the window
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
})

//Start playing the music on first interaction (browsers block autoplay until the user interacts)
window.addEventListener("click", playMusic)
window.addEventListener("keydown", playMusic)
window.addEventListener("touchstart", playMusic)

function playMusic() {
    bgMusic.play().catch(error => {
        console.log("Error playing music", error) //Music couldn't be played
    })

    //Remove event listeners to prevent repeating
    window.removeEventListener("click", playMusic)
    window.removeEventListener("keydown", playMusic)
    window.removeEventListener("touchstart", playMusic)
}
