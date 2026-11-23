// ---- Stand-ins for the browser-only things the shared game code touches ----
// The server runs the same game rules as the browser (js/game.js and friends), but there is no
// screen or sound here. The rules only ever *write* to these objects (position a sprite, add it to
// the world), never read anything back from the screen, so empty stand-ins are enough.

const PIXI = {
    // A sprite is just a bag of properties the game sets every frame
    Sprite: class {
        constructor(texture) {
            this.texture = texture
            this.x = 0
            this.y = 0
            this.alpha = 1
            this.visible = true
            this.filters = null
            this.scale = {x: 1, y: 1}
        }
    },
    // Door drawing: every call is accepted and chained, nothing is drawn
    Graphics: class {
        constructor() { this.position = {set() {}} }
        roundRect() { return this }
        circle() { return this }
        rect() { return this }
        fill() { return this }
        stroke() { return this }
        clear() { return this }
    },
}

const world = {addChild() {}}

// Texture cuts are only used for their size. Cached so the same (sheet, frames) pair returns the very
// same array, which is how a Player tells whether it is already showing an animation.
const textureCache = {}
function sheetFrames(src, frames) {
    const key = `${src}#${frames}`
    return textureCache[key] ||= Array.from({length: frames}, () => ({width: 160, height: 111}))
}

const whiteFlashFilter = {}

// Sounds are played by the browser in response to events; the server never makes noise
class AudioSFX {
    constructor() {}
}
