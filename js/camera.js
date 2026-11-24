// ---- Camera: one rule, "keep every player on screen" ----
// The camera zooms out when players are far apart and zooms in when they are close,
// so nobody is ever left behind or off screen.

const CAMERA_PADDING = 56 //Free space (world pixels) kept around the outermost players
const MAX_ZOOM = 6        //Closest the camera gets, e.g. when everyone stands together
const CAMERA_SMOOTHING = 5 //How quickly the camera catches up with its target (per second); higher = snappier

// Screen shake uses the "trauma" model: events ADD trauma (0..1), the shake size is trauma SQUARED
// (so small hits barely register but big ones kick hard), and trauma drains away over time.
const SHAKE_MAX_OFFSET = 14 //Biggest shake in SCREEN pixels, at full trauma
const SHAKE_DECAY = 2.2     //Trauma lost per second
let shakeTrauma = 0

/**
 * Adds screen shake. Several hits in a row stack up (capped at 1).
 * @param {Number} amount - 0..1; about 0.3 is a solid hit, 1 is the biggest possible
 */
function addShake(amount) {
    shakeTrauma = Math.min(1, shakeTrauma + amount)
}

// Parts of the screen that something else covers (e.g. the touch buttons along the bottom).
// The camera frames everyone in the REST of the screen, so nobody ends up hidden behind a button.
const cameraInsets = {bottom: 0}

// The camera's state: where it looks (world pixels) and how magnified the world is
const camera = {x: 0, y: 0, zoom: 4}

/**
 * Works out where the camera SHOULD be so every player fits on screen.
 * @param {Player[]} players - Everyone who must stay visible
 * @param {{width: number, height: number}} screen - The visible area in screen pixels
 * @returns {{x: number, y: number, zoom: number}}
 */
function cameraTarget(players, screen) {
    const viewHeight = screen.height - cameraInsets.bottom //The part of the screen the player can actually see

    // Bounding box around every player's body
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
    for (const {hitbox} of players) {
        left = Math.min(left, hitbox.position.x)
        right = Math.max(right, hitbox.position.x + hitbox.width)
        top = Math.min(top, hitbox.position.y)
        bottom = Math.max(bottom, hitbox.position.y + hitbox.height)
    }
    const boxWidth = right - left + 2 * CAMERA_PADDING
    const boxHeight = bottom - top + 2 * CAMERA_PADDING

    // The zoom at which the box exactly fills the screen on its tighter axis.
    // Never zoom out further than showing the whole level, never in further than MAX_ZOOM.
    const wholeLevelZoom = Math.min(screen.width / LEVEL.width, viewHeight / LEVEL.height)
    const zoom = Math.min(MAX_ZOOM, Math.max(wholeLevelZoom, Math.min(screen.width / boxWidth, viewHeight / boxHeight)))

    return {
        x: clampToLevel((left + right) / 2, screen.width / zoom, LEVEL.left, LEVEL.width),
        y: clampToLevel((top + bottom) / 2, viewHeight / zoom, LEVEL.top, LEVEL.height),
        zoom,
    }
}

/**
 * Keeps the view inside the level where it can: if the view is smaller than the level,
 * its centre is limited so no empty space shows; otherwise it is centred on the level.
 * @param {Number} centre - Wanted view centre on this axis
 * @param {Number} viewSize - How much of the world the view shows on this axis
 * @param {Number} start - Level start on this axis
 * @param {Number} size - Level size on this axis
 */
function clampToLevel(centre, viewSize, start, size) {
    if (viewSize >= size) return start + size / 2
    return Math.min(Math.max(centre, start + viewSize / 2), start + size - viewSize / 2)
}

/**
 * Moves the camera TOWARDS the spot that frames everyone, and applies it to the Pixi world container.
 * Each frame it closes a fixed fraction of the remaining distance (exponential smoothing), so it
 * glides: fast when far from the target, gentle as it arrives. The fraction depends on dt,
 * so the glide takes the same time on any monitor.
 * @param {Player[]} players
 * @param {{width: number, height: number}} screen
 * @param {Number} dt - Seconds since the previous frame
 * @param {Boolean} [snap=false] - Jump straight to the target (used at the start and on a rematch)
 */
function updateCamera(players, screen, dt, snap = false) {
    const target = cameraTarget(players, screen)
    const catchUp = snap ? 1 : 1 - Math.exp(-CAMERA_SMOOTHING * dt)

    camera.x += (target.x - camera.x) * catchUp
    camera.y += (target.y - camera.y) * catchUp
    // Zoom is multiplicative (2x -> 4x feels like 4x -> 8x), so ease it in log space
    camera.zoom = Math.exp(Math.log(camera.zoom) + (Math.log(target.zoom) - Math.log(camera.zoom)) * catchUp)
    shakeTrauma = snap ? 0 : Math.max(0, shakeTrauma - SHAKE_DECAY * dt)
    applyCamera(screen)
}

/**
 * The camera is the world container's transform: scale it by the zoom,
 * then shift it so the camera's centre lands in the middle of the screen.
 */
function applyCamera(screen) {
    //Shake nudges the whole picture by a random amount, which grows with the square of the trauma
    const shake = shakeTrauma * shakeTrauma * SHAKE_MAX_OFFSET
    const centreY = (screen.height - cameraInsets.bottom) / 2 //Middle of the uncovered part of the screen
    world.scale.set(camera.zoom)
    world.position.set(
        screen.width / 2 - camera.x * camera.zoom + (Math.random() * 2 - 1) * shake,
        centreY - camera.y * camera.zoom + (Math.random() * 2 - 1) * shake,
    )
}

// Hits shake the screen in proportion to how hard they were; big landings give a small thud
GameEvents.on('hit', ({injury}) => addShake(0.2 + injury * 0.02))
GameEvents.on('land', ({speed}) => { if (speed > 250) addShake(speed / 1800) })
