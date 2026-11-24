// Standing on things: the platforms you see must hold you up, however fast you fall and however laggy the frame.
// (Platforms are only 4px thick. The old check asked "are the feet INSIDE the platform right now?", which a
// falling player (5 to 20+ px per step) usually isn't: about 40% of falls at 60 fps, up to 70% at 20 fps, went
// straight through the platform they should have landed on.)
const test = require('node:test')
const assert = require('node:assert')
const {createSim} = require('../server/sim')

// Helpers that run inside the game's sandbox, so thousands of steps cost almost nothing
const HELPERS = `
function dropFrom(cx, startFeet, dt) {
    const p = players[0]
    p.position.x = cx - 42; p.position.y = startFeet - 53
    p.velocity.x = 0; p.velocity.y = 0; p.jumps = 2
    p.updateHitbox(); p.previousBottom = startFeet
    let calm = 0
    for (let t = 0; t < 60 * 12 && calm < 30; t++) { stepGame(dt); calm = Math.abs(p.velocity.y) < 12 ? calm + 1 : 0 }
    return p.hitbox.position.y + p.hitbox.height
}
function firstSurfaceBelow(cx, startFeet) {
    const {runs} = getPlatformGraph()
    const under = runs.filter(r => r.y >= startFeet - 0.5 && r.x1 > cx - 7 && r.x0 < cx + 7)
    return Math.min(...under.map(r => r.y))
}
`
function setup() {
    const sim = createSim(2)
    sim.depart(1)
    sim.run(HELPERS)
    return sim
}
const platformRuns = sim => JSON.parse(sim.run('JSON.stringify(getPlatformGraph().runs.filter(r => !r.solid).map(r => ({cx: (r.x0 + r.x1) / 2, y: r.y, x0: r.x0, x1: r.x1})))'))

test('a falling player always lands on the first platform beneath them, at any height and any frame rate', () => {
    const sim = setup()
    const spots = platformRuns(sim)
    assert.ok(spots.length >= 90)
    const failures = []
    for (const dt of [1 / 60, 1 / 30, 1 / 20]) {
        for (const height of [100, 250, 500, 1000]) {
            for (const spot of spots) {
                const start = spot.y - height
                const expected = sim.run(`firstSurfaceBelow(${spot.cx}, ${start})`)
                const landed = sim.run(`dropFrom(${spot.cx}, ${start}, ${dt})`)
                if (Math.abs(landed - expected) > 2) failures.push(`${height}px drop at ${Math.round(1 / dt)} fps onto y=${spot.y}: expected ${expected}, landed ${landed.toFixed(0)}`)
            }
        }
    }
    assert.deepStrictEqual(failures.slice(0, 5), [], `${failures.length} of ${spots.length * 12} falls went through a platform`)
})

test('a player who jumps up through a platform from below lands on top of it (platforms are one-way)', () => {
    const sim = setup()
    // The jump starts 25px below the platform and peaks about 28px above it. Only another platform in that band
    // could get in the way; ones further above or below the start are irrelevant.
    const all = platformRuns(sim)
    const clear = all.filter(r => all.every(o => o === r || o.x1 <= r.x0 || o.x0 >= r.x1 || o.y <= r.y - 40 || o.y > r.y + 25))
    assert.ok(clear.length >= 5, `only ${clear.length} suitable platforms`)
    for (const spot of clear.slice(0, 8)) {
        const result = JSON.parse(sim.run(`(() => {
            const p = players[0]
            p.position.x = ${spot.cx - 42}; p.position.y = ${spot.y + 25 - 53}; p.velocity.x = 0; p.velocity.y = 0; p.jumps = 2; p.updateHitbox(); p.previousBottom = ${spot.y + 25}
            jump(p)
            let calm = 0, sawAbove = false
            for (let t = 0; t < 60 * 6 && calm < 30; t++) { stepGame(1/60); const bottom = p.hitbox.position.y + p.hitbox.height; if (bottom < ${spot.y} - 2) sawAbove = true; calm = Math.abs(p.velocity.y) < 12 ? calm + 1 : 0 }
            return JSON.stringify({feet: p.hitbox.position.y + p.hitbox.height, sawAbove})
        })()`))
        assert.ok(result.sawAbove, `jump from below y=${spot.y} should rise above it (one-way)`)
        assert.ok(Math.abs(result.feet - spot.y) <= 2, `should end up standing on y=${spot.y}, ended at ${result.feet}`)
    }
})

test('a player standing on a platform stays put: no sinking, no jitter', () => {
    const sim = setup()
    for (const spot of platformRuns(sim).slice(0, 12)) {
        sim.run(`dropFrom(${spot.cx}, ${spot.y - 20}, 1/60)`)
        const before = sim.run('players[0].position.y')
        for (let i = 0; i < 60 * 3; i++) sim.step(1 / 60)
        const after = sim.run('players[0].position.y')
        assert.ok(Math.abs(after - before) < 0.05, `drifted ${after - before}px in 3s on the platform at y=${spot.y}`)
    }
})

test('falling from the very top of the level never ends below the floor, even at 20 fps', () => {
    const sim = setup()
    for (const dt of [1 / 60, 1 / 30, 1 / 20]) {
        for (let cx = 20; cx <= 556; cx += 12) {
            const landed = sim.run(`dropFrom(${cx}, -1300, ${dt})`)
            assert.ok(landed <= 400.5, `x=${cx} at ${Math.round(1 / dt)} fps ended with feet at y=${landed}, below the floor`)
            assert.ok(landed >= -1300, 'and did not end up above where it started')
        }
    }
})

test('a long laggy frame is split into small steps, a normal one is a single step', () => {
    const sim = setup()
    const steps = dt => sim.run(`(() => { let n = 0; const original = runPlayerAnimation; runPlayerAnimation = (...a) => { n++; return original(...a) }; stepGame(${dt}); runPlayerAnimation = original; return n })()`)
    assert.strictEqual(steps(1 / 60), 1, 'the server\'s fixed tick is one step')
    assert.strictEqual(steps(1 / 40), 1, 'a 40 fps frame is one step')
    assert.strictEqual(steps(0.05), 2, 'the longest frame the game allows is two steps')
    assert.strictEqual(steps(0), 1, 'a zero-length first frame still runs once')
})
