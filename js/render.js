// ---- Rendering: everything that touches PixiJS lives here or in the classes' draw() methods ----
// Game logic never draws directly; it updates plain state (positions, frames, health)
// and Pixi display objects are synced from that state once per frame.

const SCALE = 4 //The pixel art is drawn at 4x

const app = new PIXI.Application()   //Created here, initialised asynchronously by initRenderer()
const world = new PIXI.Container()   //Everything in the level: moved by the camera and scaled by SCALE
const hudLayer = new PIXI.Container() //Screen-space overlay (health bars, banners): ignores the camera
world.scale.set(SCALE)

/**
 * Starts Pixi and loads every texture the game needs, so nothing pops in later.
 * @param {String[]} textureUrls - Image files to preload
 */
async function initRenderer(textureUrls) {
    await app.init({
        canvas: document.querySelector("canvas"),
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0xffffff,
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
