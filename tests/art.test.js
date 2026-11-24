// The level's art and its collision must agree: what you see as a platform is what you can stand on.
// (In the tall level the collision once repeated every 336px while the picture repeated every 432px, so in every
// copy above the first the drawn platforms and the solid ones were in different places.)
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const {createSim} = require('../server/sim')
const {buildArtSource, parseLayers, TMX_PATH, OUT_PATH} = require('../tools/export-art')

const tmx = fs.readFileSync(TMX_PATH, 'utf8')

/** A game sandbox with the art data loaded, so level.js's art functions can run. */
function simWithArt() {
    const sim = createSim(2)
    sim.run(fs.readFileSync(OUT_PATH, 'utf8'))
    return sim
}
const keyOf = (x, y) => `${x},${y}`

test('js/data/art.js is up to date with the Tiled map (run `npm run export-art` after editing the map)', () => {
    assert.strictEqual(fs.readFileSync(OUT_PATH, 'utf8'), buildArtSource(tmx))
})

test('js/data/collision.js matches the Tiled map\'s collision layers', () => {
    const layers = parseLayers(tmx)
    const data = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'collision.js'), 'utf8') + '; ({floorCollisions, platformCollisions})')
    assert.deepStrictEqual([...data.floorCollisions], layers['FloorCollisions'].ids)
    assert.deepStrictEqual([...data.platformCollisions], layers['PlatformCollisions'].ids)
})

test('in one copy of the map, platform art sits on exactly the platform collision cells', () => {
    const layers = parseLayers(tmx)
    const cells = ids => ids.map((id, i) => id ? i : -1).filter(i => i >= 0)
    assert.deepStrictEqual(cells(layers['Platforms'].ids), cells(layers['PlatformCollisions'].ids))
})

test('in the tall level every platform has art and every piece of platform art is solid, in EVERY copy', () => {
    const sim = simWithArt()
    const art = JSON.parse(sim.run('JSON.stringify(levelArtPlacements().filter(p => p.layer === "platforms"))'))
    const blocks = JSON.parse(sim.run('JSON.stringify(platformBlocks.map(b => ({x: b.position.x, y: b.position.y})))'))
    assert.strictEqual(blocks.length, 56 * 5, '56 platform tiles in each of the 5 copies')
    assert.deepStrictEqual(new Set(art.map(p => keyOf(p.x, p.y))), new Set(blocks.map(b => keyOf(b.x, b.y))))
    assert.strictEqual(art.length, blocks.length)
    // ...and specifically in the copies above the first, where it used to go wrong
    for (let copy = 1; copy < 5; copy++) {
        const inCopy = art.filter(p => p.copy === copy)
        assert.strictEqual(inCopy.length, 56)
        assert.ok(inCopy.every(p => blocks.some(b => b.x === p.x && b.y === p.y)), `copy ${copy}: art and collision agree`)
    }
})

test('ground art exists only where the solid floor does (the bottom copy)', () => {
    const sim = simWithArt()
    const ground = JSON.parse(sim.run('JSON.stringify(levelArtPlacements().filter(p => p.layer === "trees" || p.layer === "foreground"))'))
    assert.ok(ground.length > 100)
    assert.ok(ground.every(p => p.copy === 0 && p.y >= 0 && p.y < 432), 'no floor, tree or bush art floating in the upper copies')
    const solid = JSON.parse(sim.run('JSON.stringify(collisionBlocks.map(b => ({x: b.position.x, y: b.position.y})))'))
    const drawn = new Set(ground.filter(p => p.layer === 'trees').map(p => keyOf(p.x, p.y)))
    assert.ok(solid.every(b => drawn.has(keyOf(b.x, b.y))), 'every solid floor/ledge block has ground art drawn on it')
})

test('the hanging vines go with their platforms: one set per copy, at the same offsets', () => {
    const sim = simWithArt()
    const lights = JSON.parse(sim.run('JSON.stringify(levelArtPlacements().filter(p => p.layer === "lights"))'))
    const perCopy = [0, 1, 2, 3, 4].map(copy => lights.filter(p => p.copy === copy).length)
    assert.ok(perCopy.every(n => n === perCopy[0] && n > 0), `lights per copy: ${perCopy}`)
    const dy = new Set(lights.map(p => (p.y - (-p.copy * 336)) % 16))
    assert.deepStrictEqual([...dy], [0], 'tiles sit on the 16px grid')
})

test('the scenery has the sky and the three cloud layers', () => {
    const sim = simWithArt()
    const scenery = JSON.parse(sim.run('JSON.stringify(artScenery)'))
    assert.deepStrictEqual(scenery.map(s => s.image), ['background_0', 'background_1', 'background_1', 'background_2'])
    assert.ok(scenery.every(s => s.width > 0 && s.height > 0))
})
