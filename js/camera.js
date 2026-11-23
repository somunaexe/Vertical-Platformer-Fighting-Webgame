// ---- Camera: one rule, "keep every player on screen" ----
// The camera zooms out when players are far apart and zooms in when they are close,
// so nobody is ever left behind or off screen.

const CAMERA_PADDING = 56 //Free space (world pixels) kept around the outermost players
const MAX_ZOOM = 6        //Closest the camera gets, e.g. when everyone stands together

// The camera's state: where it looks (world pixels) and how magnified the world is
const camera = {x: 0, y: 0, zoom: 4}

/**
 * Works out where the camera SHOULD be so every player fits on screen.
 * @param {Player[]} players - Everyone who must stay visible
 * @param {{width: number, height: number}} screen - The visible area in screen pixels
 * @returns {{x: number, y: number, zoom: number}}
 */
function cameraTarget(players, screen) {
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
    const wholeLevelZoom = Math.min(screen.width / LEVEL.width, screen.height / LEVEL.height)
    const zoom = Math.min(MAX_ZOOM, Math.max(wholeLevelZoom, Math.min(screen.width / boxWidth, screen.height / boxHeight)))

    return {
        x: clampToLevel((left + right) / 2, screen.width / zoom, LEVEL.left, LEVEL.width),
        y: clampToLevel((top + bottom) / 2, screen.height / zoom, LEVEL.top, LEVEL.height),
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
 * Moves the camera to frame everyone and applies it to the Pixi world container.
 * @param {Player[]} players
 * @param {{width: number, height: number}} screen
 */
function updateCamera(players, screen) {
    Object.assign(camera, cameraTarget(players, screen))
    applyCamera(screen)
}

/**
 * The camera is the world container's transform: scale it by the zoom,
 * then shift it so the camera's centre lands in the middle of the screen.
 */
function applyCamera(screen) {
    world.scale.set(camera.zoom)
    world.position.set(screen.width / 2 - camera.x * camera.zoom, screen.height / 2 - camera.y * camera.zoom)
}
