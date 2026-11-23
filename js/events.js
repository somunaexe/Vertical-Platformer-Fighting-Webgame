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

// ---- The three things a player can do ----
// Keyboard, touch buttons (and later the network) all go through these, so every input method
// behaves identically. `scheme` is an entry of controlSchemes: it identifies which player is acting.

/**
 * Starts or stops walking in a direction (held state; released when the key/button is let go).
 * @param {Object} scheme - Which player (an entry of controlSchemes)
 * @param {String} direction - 'left' or 'right'
 * @param {Boolean} pressed - true when the input goes down, false when it is released
 */
function setMove(scheme, direction, pressed) {
    scheme.keys[direction === 'left' ? 'a' : 'd'].pressed = pressed
}

/** Jumps (a one-shot action; see jump() for the rules). */
function doJump(scheme) {
    jump(scheme.player())
}

/**
 * Swings the sword (a one-shot action; see attack() for the rules).
 * @param {String} type - 'low', 'mid' or 'overhead'
 */
function doAttack(scheme, type) {
    attack(scheme.player(), type)
}

// ---- Keyboard: translates key presses into the actions above ----
window.addEventListener("keydown", event => {
    if (event.code === "Enter" && match.over) resetMatch()

    for (const scheme of controlSchemes) {
        if (event.code === scheme.left) setMove(scheme, 'left', true)
        else if (event.code === scheme.right) setMove(scheme, 'right', true)
        else if (event.code === scheme.jump) doJump(scheme)
        else if (event.code in scheme.attacks) doAttack(scheme, scheme.attacks[event.code])
    }
})

window.addEventListener("keyup", event => {
    for (const scheme of controlSchemes) {
        if (event.code === scheme.left) setMove(scheme, 'left', false)
        else if (event.code === scheme.right) setMove(scheme, 'right', false)
    }
})

//Resize the canvas to fit the window (the renderer doesn't exist until startGame has run)
window.addEventListener("resize", () => {
    if (app.renderer) app.renderer.resize(window.innerWidth, window.innerHeight)
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
