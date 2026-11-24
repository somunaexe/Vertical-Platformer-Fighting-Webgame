// ---- Draws the level from the Tiled art layers (js/data/art.js) ----
// Tile positions come from levelArtPlacements() in level.js, the same arithmetic as the collision, so the
// platforms you see are the platforms you can stand on. Everything is "baked" into a few big textures once
// at startup (instead of drawing ~1500 little tiles every frame), which also means the tile edges can never
// show hairline gaps when the camera zooms by a fractional amount.

const ART_TILESET = 'assets/tiled/assets/tileset.png'
const artSceneryUrl = name => `assets/tiled/assets/${name}.png`
const ART_STRIP_HEIGHT = 1024 //Tile art is baked in strips this tall (px), so a very tall level never exceeds a GPU's texture size limit

/** @returns {String[]} Every image the level art needs, for the loader */
function levelArtTextureUrls() {
    return [ART_TILESET, ...new Set(artScenery.map(piece => artSceneryUrl(piece.image)))]
}

/** Renders a container into a texture of the given size at 1:1 and throws the container away. */
function bakeToTexture(container, width, height) {
    const texture = app.renderer.generateTexture({target: container, frame: new PIXI.Rectangle(0, 0, width, height), resolution: 1})
    texture.source.scaleMode = "nearest"
    container.destroy({children: true})
    return texture
}

/** One block of sky and clouds, the size of one copy of the map, built from the map's scenery images. */
function bakeScenery() {
    const container = new PIXI.Container()
    for (const piece of artScenery) {
        const sprite = new PIXI.Sprite(PIXI.Assets.get(artSceneryUrl(piece.image)))
        sprite.position.set(piece.x, piece.y)
        sprite.width = piece.width
        sprite.height = piece.height
        container.addChild(sprite)
    }
    //The images overshoot the map's edges slightly; baking to exactly one map's size crops them
    return bakeToTexture(container, MAP_WIDTH, MAP_HEIGHT)
}

/**
 * Draws the sky, ground, platforms and vines into the world. Call once, after the textures have loaded
 * and before the door and players are created (so they draw on top).
 */
function buildLevelArt() {
    // ---- Sky and clouds: repeated upwards, every other block mirrored so the seams match (sky meets sky, clouds meet clouds)
    const scenery = bakeScenery()
    const blockCount = Math.ceil(LEVEL.height / MAP_HEIGHT)
    for (let i = 0; i < blockCount; i++) {
        const block = new PIXI.Sprite(scenery)
        const top = MAP_HEIGHT - (i + 1) * MAP_HEIGHT
        if (i % 2 === 1) {
            block.scale.y = -1
            block.y = top + MAP_HEIGHT //A flipped sprite grows upwards from its y
        } else {
            block.y = top
        }
        world.addChild(block)
    }

    // ---- Tiles: ground, bushes, vines and platforms, baked in strips
    const tileset = PIXI.Assets.get(ART_TILESET)
    const tileTextures = {}
    const tileTexture = gid => tileTextures[gid] ||= new PIXI.Texture({
        source: tileset.source,
        frame: new PIXI.Rectangle(((gid - 1) % ART_TILE_COLUMNS) * TILE, Math.floor((gid - 1) / ART_TILE_COLUMNS) * TILE, TILE, TILE),
    })
    const placements = levelArtPlacements()
    const drawOrder = ['trees', 'foreground', 'lights', 'platforms'] //Same order as the layers in Tiled: later ones draw on top
    const stripCount = Math.ceil(LEVEL.height / ART_STRIP_HEIGHT)
    for (let strip = 0; strip < stripCount; strip++) {
        const stripTop = LEVEL.top + strip * ART_STRIP_HEIGHT
        const stripHeight = Math.min(ART_STRIP_HEIGHT, LEVEL.height - strip * ART_STRIP_HEIGHT)
        const container = new PIXI.Container()
        const bushes = new PIXI.Container() //The map draws the Foreground Objects layer at 39% opacity
        bushes.alpha = 0.39
        container.addChild(bushes)
        for (const layer of drawOrder) {
            for (const tile of placements) {
                if (tile.layer !== layer || tile.y < stripTop || tile.y >= stripTop + stripHeight) continue
                const sprite = new PIXI.Sprite(tileTexture(tile.gid))
                sprite.position.set(tile.x, tile.y - stripTop)
                ;(layer === 'foreground' ? bushes : container).addChild(sprite)
            }
        }
        const art = new PIXI.Sprite(bakeToTexture(container, MAP_WIDTH, stripHeight))
        art.y = stripTop
        world.addChild(art)
    }
}
