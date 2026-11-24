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
 * Makes a player jump if they have any jumps left (2 = double jump), and plays the jump sound once.
 * @param {Player} player - The player that should jump
 */
function jump(player) {
    if (player.jumps <= 0 || !player.canAct()) return
    player.collidedVertically = false
    player.jumps--
    player.velocity.y = -JUMP_SPEED * player.jumpMultiplier //Injured players jump lower

    player.sounds.jump.currentTime = 0
    player.sounds.jump.playbackRate = 2.0
    player.sounds.jump.play()
}

/**
 * Starts an attack unless the player is already mid-attack (or can't act).
 * Plays the matching sound and animation; Sprite.updateFrames resets isAttacking when the animation ends.
 * Whether the sword actually hurts anyone is decided each frame by resolveCombat.
 * @param {Player} player - The attacking player
 * @param {String} type - A key of ATTACKS: 'low', 'mid' or 'overhead'
 */
function attack(player, type) {
    if (player.isAttacking || !player.canAct()) return
    const {sound, animation} = ATTACKS[type]
    player.isAttacking = true
    player.currentAttack = type
    player.attackHasHit = false
    player.sounds[sound].currentTime = 0
    player.sounds[sound].play()
    player.switchSprite(animation)
    player.currentFrame = 0 //Start the swing from its first frame, even if the sheet was already showing
    player.elapsedTime = 0
}

window.addEventListener("keydown", event => {
    if (event.code === "Enter" && match.over) resetMatch()

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
