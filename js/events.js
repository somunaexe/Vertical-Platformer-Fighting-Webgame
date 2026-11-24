// Training mode (see menu.js): the computer plays player 2, so BOTH key sets drive player 1 and the
// player can use whichever they find comfortable (WASD + X/C/V, or the arrow keys + I/O/P)
const training = {active: false, level: null}

// One entry per player: which key does what.
// `player` is a function because player1/player2 are created later, in index.js
const controlSchemes = [
    {
        player: () => player1,
        keys: playerKeys[0],
        left: "KeyA",
        right: "KeyD",
        jump: "KeyW",
        attacks: { KeyX: 'low', KeyC: 'mid', KeyV: 'overhead' },
    },
    {
        player: () => player2,
        keys: playerKeys[1],
        left: "ArrowLeft",
        right: "ArrowRight",
        jump: "ArrowUp",
        attacks: { KeyI: 'low', KeyO: 'mid', KeyP: 'overhead' },
    },
]

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
    if (net.active) return netSend({t: 'move', dir: direction, pressed}) //Online: the server moves me
    scheme.keys[direction === 'left' ? 'a' : 'd'].pressed = pressed
}

/** Jumps (a one-shot action; see jump() for the rules). */
function doJump(scheme) {
    if (net.active) return netSend({t: 'jump'})
    jump(scheme.player())
}

/**
 * Swings the sword (a one-shot action; see attack() for the rules).
 * @param {String} type - 'low', 'mid' or 'overhead'
 */
function doAttack(scheme, type) {
    if (net.active) return netSend({t: 'attack', type})
    attack(scheme.player(), type)
}

// ---- Keyboard: translates key presses into the actions above ----
window.addEventListener("keydown", event => {
    if (event.code === "Enter" && match.over) requestRematch()

    for (const scheme of controlSchemes) {
        const actor = training.active ? controlSchemes[0] : scheme //Whose player the key controls
        if (event.code === scheme.left) setMove(actor, 'left', true)
        else if (event.code === scheme.right) setMove(actor, 'right', true)
        else if (event.code === scheme.jump) doJump(actor)
        else if (event.code in scheme.attacks) doAttack(actor, scheme.attacks[event.code])
    }
})

// Clicking or tapping the game (not a button) starts a rematch once the round is over.
// The short delay stops frantic button-mashing from skipping the winner's celebration.
const REMATCH_TAP_DELAY = 800 //ms
window.addEventListener("pointerdown", event => {
    if (match.over && event.target instanceof HTMLCanvasElement && performance.now() - match.overAt > REMATCH_TAP_DELAY) requestRematch()
})

// If the window loses focus while a key is held, the keyup never arrives and the character would keep walking
window.addEventListener("blur", () => {
    for (const scheme of controlSchemes) {
        setMove(scheme, 'left', false)
        setMove(scheme, 'right', false)
    }
})

window.addEventListener("keyup", event => {
    for (const scheme of controlSchemes) {
        const actor = training.active ? controlSchemes[0] : scheme
        if (event.code === scheme.left) setMove(actor, 'left', false)
        else if (event.code === scheme.right) setMove(actor, 'right', false)
    }
})

//Resize the canvas to fit the window (the renderer doesn't exist until startGame has run).
//Rotating a phone fires "resize"; so does the mobile address bar showing/hiding (visualViewport).
function fitCanvasToWindow() {
    if (app.renderer) app.renderer.resize(window.innerWidth, window.innerHeight)
}
window.addEventListener("resize", fitCanvasToWindow)
window.visualViewport?.addEventListener("resize", fitCanvasToWindow)
//Block the long-press context menu on touch devices
window.addEventListener("contextmenu", event => event.preventDefault())

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
