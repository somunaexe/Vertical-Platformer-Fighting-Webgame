// ---- Rendering: everything that touches PixiJS lives here or in the classes' draw() methods ----
// Game logic never draws directly; it updates plain state (positions, frames, injury)
// and Pixi display objects are synced from that state once per frame.

const app = new PIXI.Application()   //Created here, initialised asynchronously by initRenderer()
const world = new PIXI.Container()   //Everything in the level: the camera moves and scales it
const hudLayer = new PIXI.Container() //Screen-space overlay (injury bars, banners): ignores the camera

/**
 * Starts Pixi and loads every texture the game needs, so nothing pops in later.
 * @param {String[]} textureUrls - Image files to preload
 */
async function initRenderer(textureUrls) {
    await app.init({
        canvas: document.querySelector("canvas"),
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x10202e, //Shows around the level when the camera zooms out past its edges
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,  //Canvas keeps its CSS size on high-DPI screens
        roundPixels: true,  //Snap sprites to whole screen pixels: no shimmering pixel art
        autoStart: false,   //We render from our own loop (it measures dt), not Pixi's ticker
    })
    app.stage.addChild(world, hudLayer)

    const textures = await PIXI.Assets.load(textureUrls)
    for (const url of textureUrls) {
        textures[url].source.scaleMode = "nearest" //Crisp pixels instead of blurry smoothing
    }
}

// A filter that turns a sprite solid white (keeps its shape/alpha, replaces its colours).
// The 4x5 matrix maps (R, G, B, A, 1) -> new (R, G, B, A): the last column adds 1 to R, G and B
// while the first three columns are zeroed, so every pixel becomes white. Shared by every flash.
const whiteFlashFilter = new PIXI.ColorMatrixFilter()
whiteFlashFilter.matrix = [
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 1, 0,
]

const frameCache = {}

/**
 * Cuts a horizontal spritesheet into one texture per animation frame.
 * Results are cached, so players sharing a sheet share its textures, and the same
 * (sheet, frames) pair always returns the very same array (switchSprite relies on that).
 * @param {String} src - Spritesheet path (must already be loaded by initRenderer)
 * @param {Number} frames - How many equal-width frames the sheet holds
 * @returns {PIXI.Texture[]}
 */
function sheetFrames(src, frames) {
    const key = `${src}#${frames}`
    if (!frameCache[key]) {
        const sheet = PIXI.Assets.get(src)
        const frameWidth = sheet.width / frames
        frameCache[key] = Array.from({length: frames}, (_, i) => new PIXI.Texture({
            source: sheet.source,
            frame: new PIXI.Rectangle(i * frameWidth, 0, frameWidth, sheet.height),
        }))
    }
    return frameCache[key]
}
