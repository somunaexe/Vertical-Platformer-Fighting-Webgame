// The game rules, run headless in Node exactly as a room on the server runs them.
// Run with: npm test
const test = require('node:test')
const assert = require('node:assert')
const {createSim} = require('../server/sim')

const DT = 1 / 60 //The server's fixed time step

/** Steps a sim forward by a number of seconds at the fixed time step. */
function run(sim, seconds) {
    for (let i = 0; i < Math.round(seconds / DT); i++) sim.step(DT)
}

test('players start apart and settle onto the ground', () => {
    const sim = createSim(2)
    run(sim, 2)
    const [a, b] = sim.snapshot().p
    assert.strictEqual(a.x, 100)
    assert.strictEqual(b.x, 300)
    assert.ok(a.y > 340 && a.y < 350, `expected standing on the ground, y = ${a.y}`)
    assert.strictEqual(a.anim, 'idle')
    assert.strictEqual(b.anim, 'idleLeft')
})

test('holding right walks about 120 pixels per second', () => {
    const sim = createSim(2)
    run(sim, 1)
    const before = sim.snapshot().p[0].x
    sim.input(0, {kind: 'move', dir: 'right', pressed: true})
    run(sim, 1)
    const walked = sim.snapshot().p[0].x - before
    assert.ok(Math.abs(walked - 120) < 4, `walked ${walked}px in a second`)
    sim.input(0, {kind: 'move', dir: 'right', pressed: false})
    run(sim, 0.2)
    const stopped = sim.snapshot().p[0].x
    run(sim, 0.5)
    assert.strictEqual(sim.snapshot().p[0].x, stopped, 'released key should stop the player')
})

test('a jump rises about 50 pixels, announces itself, and lands with a land event', () => {
    const sim = createSim(2)
    run(sim, 1)
    sim.drainEvents()
    const groundY = sim.snapshot().p[0].y
    assert.ok(sim.input(0, {kind: 'jump'}))
    let highest = groundY
    for (let i = 0; i < 90; i++) { sim.step(DT); highest = Math.min(highest, sim.snapshot().p[0].y) }
    assert.ok(groundY - highest > 45 && groundY - highest < 56, `rose ${groundY - highest}px`)
    const kinds = sim.drainEvents().map(event => event.e)
    assert.deepStrictEqual(kinds.filter(k => k === 'jump'), ['jump'])
    assert.ok(kinds.includes('land'))
})

test('an attack that connects injures the victim and reports a hit event', () => {
    const sim = createSim(2)
    run(sim, 1)
    sim.run('players[1].position.x = players[0].position.x + 25; players[1].facingLeft = true')
    sim.drainEvents()
    sim.input(0, {kind: 'attack', type: 'mid'})
    run(sim, 0.5)
    const events = sim.drainEvents()
    const hit = events.find(event => event.e === 'hit')
    assert.ok(hit, 'expected a hit event')
    assert.strictEqual(hit.a, 0)
    assert.strictEqual(hit.v, 1)
    assert.strictEqual(hit.injury, 8)
    assert.ok(sim.snapshot().p[1].inj > 5, 'victim should be injured')
    assert.strictEqual(sim.snapshot().p[0].inj, 0, 'attacker should be unhurt')
    assert.strictEqual(events.filter(event => event.e === 'hit').length, 1, 'one swing lands once')
})

test('a same-frame trade hurts both players and does not crash', () => {
    const sim = createSim(2)
    run(sim, 1)
    sim.run('players[1].position.x = players[0].position.x + 25; players[1].facingLeft = true')
    sim.input(0, {kind: 'attack', type: 'mid'})
    sim.input(1, {kind: 'attack', type: 'mid'})
    run(sim, 0.5)
    const [a, b] = sim.snapshot().p
    assert.ok(a.inj > 0 && b.inj > 0, `injuries: ${a.inj}, ${b.inj}`)
})

test('reaching the door wins the round, once, and a rematch resets it', () => {
    const sim = createSim(2)
    run(sim, 1)
    sim.drainEvents()
    sim.run('players[1].position.x = door.position.x - 31; players[1].position.y = door.position.y - 22; players[1].velocity.y = 0')
    run(sim, 0.3)
    const events = sim.drainEvents()
    assert.deepStrictEqual(events.filter(e => e.e === 'win').map(e => e.w), [1])
    assert.strictEqual(sim.snapshot().over, true)
    assert.strictEqual(sim.snapshot().win, 1)
    run(sim, 1)
    assert.strictEqual(sim.drainEvents().filter(e => e.e === 'win').length, 0, 'win is announced once')

    sim.rematch()
    const snap = sim.snapshot()
    assert.strictEqual(snap.over, false)
    assert.strictEqual(snap.p[1].x, 300)
    assert.ok(sim.drainEvents().some(e => e.e === 'reset'))
})

test('invalid input is rejected without effect', () => {
    const sim = createSim(2)
    assert.strictEqual(sim.input(0, {kind: 'attack', type: 'constructor'}), false)
    assert.strictEqual(sim.input(0, {kind: 'attack', type: 'nope'}), false)
    assert.strictEqual(sim.input(0, {kind: 'move', dir: 'up', pressed: true}), false)
    assert.strictEqual(sim.input(0, {kind: 'bogus'}), false)
    assert.strictEqual(sim.input(7, {kind: 'jump'}), false, 'no such slot')
})

test('a departed player is ignored by the rules and flagged in snapshots', () => {
    const sim = createSim(3)
    run(sim, 1)
    sim.depart(1)
    sim.run('players[0].position.x = 100; players[2].position.x = 105; players[1].position.x = 112')
    sim.input(0, {kind: 'attack', type: 'overhead'})
    run(sim, 0.6)
    const snap = sim.snapshot()
    assert.strictEqual(snap.p[1].gone, 1)
    assert.strictEqual(snap.p[1].inj, 0, 'departed player cannot be hurt')
    assert.strictEqual(sim.input(1, {kind: 'jump'}), false, 'departed player cannot act')
})

test('twelve players fit in a room and the snapshot stays small', () => {
    const sim = createSim(12)
    run(sim, 1)
    const snap = sim.snapshot()
    assert.strictEqual(snap.p.length, 12)
    const bytes = JSON.stringify(snap).length
    assert.ok(bytes < 1500, `snapshot is ${bytes} bytes`)
})

test('the same inputs always produce the same game (fixed time step is deterministic)', () => {
    const play = () => {
        const sim = createSim(2)
        run(sim, 1)
        sim.input(0, {kind: 'move', dir: 'right', pressed: true})
        for (let i = 0; i < 300; i++) {
            if (i === 20) sim.input(0, {kind: 'jump'})
            if (i === 60) sim.input(1, {kind: 'attack', type: 'low'})
            if (i === 100) sim.input(0, {kind: 'attack', type: 'overhead'})
            sim.step(DT)
        }
        return JSON.stringify(sim.snapshot())
    }
    assert.strictEqual(play(), play())
})

test('rooms are isolated from each other', () => {
    const a = createSim(2)
    const b = createSim(2)
    run(a, 1)
    a.input(0, {kind: 'move', dir: 'right', pressed: true})
    run(a, 1)
    run(b, 2)
    assert.ok(a.snapshot().p[0].x > 200)
    assert.strictEqual(b.snapshot().p[0].x, 100, 'the other room must not have moved')
})

test('interpolateSnapshots slides positions, keeps the rest, and never slides across a teleport', () => {
    const sim = createSim(2)
    const player = (x, y, extra = {}) => ({x, y, anim: 'run', frame: 1, left: 0, inj: 0, inv: 0, flash: 0, gone: 0, ...extra})
    const a = {p: [player(100, 300), player(200, 300, {anim: 'idle'})], over: false, win: -1}
    const b = {p: [player(104, 296, {anim: 'jump', frame: 0}), player(500, 300)], over: true, win: 0}
    const mix = t => JSON.parse(sim.run(`JSON.stringify(interpolateSnapshots(${JSON.stringify(a)}, ${JSON.stringify(b)}, ${t}))`))

    assert.deepStrictEqual([mix(0).p[0].x, mix(0).p[0].y], [100, 300])
    assert.deepStrictEqual([mix(0.5).p[0].x, mix(0.5).p[0].y], [102, 298])
    assert.deepStrictEqual([mix(1).p[0].x, mix(1).p[0].y], [104, 296])
    assert.strictEqual(mix(0.5).p[0].anim, 'run', 'animation stays as in the earlier snapshot')
    assert.strictEqual(mix(0.5).p[0].frame, 1)
    assert.strictEqual(mix(0.5).over, false, 'the result flag changes when its moment arrives, not before')
    assert.strictEqual(mix(0.5).p[1].x, 200, 'a 300px jump is a teleport: no sliding')
})

// ---- The AI's map of the level ----
test('the AI\'s platform map covers the level and has a route from the ground to the door', () => {
    const sim = createSim(2)
    const info = JSON.parse(sim.run(`(() => {
        const {runs, doorRun} = getPlatformGraph()
        const ground = runs.find(r => r.solid && r.y === 400)
        const route = []
        for (let r = ground; r; r = r.next) route.push([r.x0, r.x1, r.y])
        const rises = route.slice(1).map((r, i) => route[i][2] - r[2])
        return JSON.stringify({runs: runs.length, solid: runs.filter(r => r.solid).length, doorRun: [doorRun.x0, doorRun.x1, doorRun.y],
            groundDistance: ground.distance, route, unreachable: runs.filter(r => r.distance === Infinity && !r.solid).length, rises})
    })()`))
    assert.strictEqual(info.solid, 2, 'the ground and the left ledge are the two solid surfaces')
    assert.ok(info.runs > 60, `${info.runs} platforms`)
    assert.deepStrictEqual(info.doorRun.slice(2), [-1280], 'the door stands on the top copy\'s highest platform')
    assert.ok(Number.isFinite(info.groundDistance), 'a route exists')
    const last = info.route[info.route.length - 1]
    assert.deepStrictEqual(last, info.doorRun, 'the route ends on the door platform')
    assert.ok(info.route.length > 25, `${info.route.length} runs from ground to door`)
    assert.ok(Math.max(...info.rises) <= 48, `hardest hop is ${Math.max(...info.rises)}px: the easiest staircase (48px) exists and is used, so even a badly injured player can follow it`)
    assert.strictEqual(info.unreachable, 0, 'every platform can reach the door')
})
