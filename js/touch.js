// ---- On-screen touch controls ----
// Buttons are plain HTML elements over the canvas. Each button handles its OWN pointer, so several
// fingers work at once (e.g. hold "right" with one thumb while tapping "jump" with the other).
// They call the same setMove / doJump / doAttack actions as the keyboard.

// Show the controls on touch screens (a "coarse" pointer), or on any device with ?touch in the URL (handy for testing)
const TOUCH_MODE = window.matchMedia("(pointer: coarse)").matches || new URLSearchParams(location.search).has("touch")

/**
 * Creates one on-screen button.
 * @param {String} label - Text shown on the button
 * @param {String} className - CSS classes (size/position styling)
 * @param {Function} onDown - Called when a finger goes down on it
 * @param {Function} [onUp] - Called when that finger lifts or is cancelled (for held buttons)
 */
function createTouchButton(label, className, onDown, onUp) {
    const button = document.createElement("button")
    button.className = "touch-button " + className
    button.textContent = label
    button.addEventListener("pointerdown", event => {
        event.preventDefault()
        //Capture: this button keeps getting this finger's events even if it slides off the button
        button.setPointerCapture(event.pointerId)
        button.classList.add("pressed")
        onDown()
    })
    const release = () => {
        if (!button.classList.contains("pressed")) return
        button.classList.remove("pressed")
        if (onUp) onUp()
    }
    button.addEventListener("pointerup", release)
    button.addEventListener("pointercancel", release)
    button.addEventListener("lostpointercapture", release)
    return button
}

/**
 * Builds the control pad for one player: a d-pad on the left, jump and three attacks on the right.
 * @param {Object} scheme - The player these buttons control (an entry of controlSchemes)
 */
function createTouchControls(scheme) {
    const root = document.createElement("div")
    root.id = "touch-controls"

    const dpad = document.createElement("div")
    dpad.className = "touch-group touch-left"
    dpad.append(
        createTouchButton("◀", "touch-move", () => setMove(scheme, 'left', true), () => setMove(scheme, 'left', false)),
        createTouchButton("▶", "touch-move", () => setMove(scheme, 'right', true), () => setMove(scheme, 'right', false)),
    )

    const actions = document.createElement("div")
    actions.className = "touch-group touch-right"
    const attacks = document.createElement("div")
    attacks.className = "touch-attacks"
    attacks.append(
        createTouchButton("LOW", "touch-attack", () => doAttack(scheme, 'low')),
        createTouchButton("MID", "touch-attack", () => doAttack(scheme, 'mid')),
        createTouchButton("HIGH", "touch-attack", () => doAttack(scheme, 'overhead')),
    )
    actions.append(attacks, createTouchButton("JUMP", "touch-jump", () => doJump(scheme)))

    root.append(dpad, actions)
    document.body.append(root)
}

const TOUCH_CONTROLS_HEIGHT = 120 //Screen pixels along the bottom that the buttons cover

//On touch devices the touch pad controls the first player (the other player keeps the keyboard)
if (TOUCH_MODE) {
    cameraInsets.bottom = TOUCH_CONTROLS_HEIGHT //Keep the fighters clear of the buttons
    createTouchControls(controlSchemes[0])
}
