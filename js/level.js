// ---- Level geometry: the tall level is the original map stacked on top of itself ----
// World coordinates: x grows right, y grows DOWN, so higher up the level means a smaller (more negative) y.
// The bottom copy sits at its original position, so y = 0 is the top of the bottom copy and the ground is at y ~ 400.

const TILE = 16       //Size of one collision tile in pixels
const MAP_COLS = 36   //Width of the original map in tiles
const MAP_ROWS = 27   //Height of the original map in tiles
const MAP_WIDTH = MAP_COLS * TILE   //576
const MAP_HEIGHT = MAP_ROWS * TILE  //432

// How many copies of the map to stack. More copies = a taller climb. Change this one number to resize the level.
const LEVEL_COPIES = 5

// Each copy sits COPY_PERIOD pixels above the one below. That is LESS than the map's height (21 of
// its 27 tile rows), so the copies overlap: the empty top rows of the lower copy and the empty bottom rows
// of the upper copy occupy the same space. This puts the upper copy's lowest platforms just 48px above the
// lower copy's highest ones (the same spacing as inside the map), so the climb never has a gap at a seam.
const COPY_PERIOD_ROWS = 21
const COPY_PERIOD = COPY_PERIOD_ROWS * TILE //336

const LEVEL = {
    left: 0,
    top: -(LEVEL_COPIES - 1) * COPY_PERIOD, //y of the very top of the level
    width: MAP_WIDTH,
    height: (LEVEL_COPIES - 1) * COPY_PERIOD + MAP_HEIGHT,
}

/**
 * Where the door sits: the highest platform of the TOP copy (platform tiles x 12-14, row 4),
 * standing on it. Returns the door's top-left corner for a door of the given height.
 */
function doorPosition(doorHeight) {
    return {x: 12 * TILE + 12, y: LEVEL.top + 4 * TILE - doorHeight}
}

/**
 * Calls fn(column, row) for every filled tile in a flat tile array (36 tiles per row).
 * 202 is the tile id Tiled used for "collision here".
 */
function forEachCollisionTile(data, fn) {
    data.forEach((tile, index) => {
        if (tile === 202) fn(index % MAP_COLS, Math.floor(index / MAP_COLS))
    })
}

/**
 * Builds the collision blocks for the whole tall level out of the original map data.
 * - Solid blocks (floor and left ledge): only in the bottom copy, so the climb is never walled off from below.
 * - One-way platforms: in every copy, shifted up by k * COPY_PERIOD. You can jump up through them and stand on top.
 * @returns {{collisionBlocks: CollisionBlock[], platformBlocks: CollisionBlock[]}}
 */
function buildLevel() {
    const collisionBlocks = []
    const platformBlocks = []

    forEachCollisionTile(floorCollisions, (col, row) => {
        collisionBlocks.push(new CollisionBlock({position: {x: col * TILE, y: row * TILE}}))
    })

    for (let copy = 0; copy < LEVEL_COPIES; copy++) {
        const offsetY = -copy * COPY_PERIOD
        forEachCollisionTile(platformCollisions, (col, row) => {
            platformBlocks.push(new CollisionBlock({
                position: {x: col * TILE, y: row * TILE + offsetY},
                height: 4, //Platforms are thin: only their top surface counts
            }))
        })
    }

    return {collisionBlocks, platformBlocks}
}

/**
 * Where every piece of tile art goes in the tall level, as world pixels.
 * It uses the very same copy offsets as buildLevel(), which is the whole point: the platform you SEE and the
 * platform you can STAND ON come from the same arithmetic, so they cannot drift apart.
 * - Ground art (trees, the dark floor, the ledge, bushes): bottom copy only, because the solid floor and ledge only exist there.
 * - Platform art and the vines hanging under it: every copy, shifted up by k * COPY_PERIOD exactly like the platform collision.
 * Needs artLayers (js/data/art.js).
 * @returns {{layer: string, copy: number, gid: number, x: number, y: number}[]} gid is the tile's id in the tileset
 */
function levelArtPlacements() {
    const placements = []
    const place = (layer, copy) => {
        artLayers[layer].forEach((gid, index) => {
            if (!gid) return
            placements.push({
                layer, copy, gid,
                x: (index % MAP_COLS) * TILE,
                y: Math.floor(index / MAP_COLS) * TILE - copy * COPY_PERIOD,
            })
        })
    }
    place('trees', 0)
    place('foreground', 0)
    for (let copy = 0; copy < LEVEL_COPIES; copy++) {
        place('lights', copy)
        place('platforms', copy)
    }
    return placements
}
