// The computer opponent, run headless exactly as the rules run in the browser.
// It plays through the same keys and actions as a person, so these tests also check it obeys the rules.
const test = require('node:test')
const assert = require('node:assert')
const {createSim} = require('../server/sim')

const DT = 1 / 60

/**
 * Plays until the round ends (or the time runs out), checking each second.
 * @returns {{seconds: number|null, winner: number}} seconds is null if nobody reached the door in time
 */
function playUntilOver(sim, maxSeconds) {
    for (let tick = 0; tick < 60 * maxSeconds; tick++) {
        sim.step(DT)
        if (tick % 30 === 0 && sim.matchState().over) return {seconds: tick / 60, winner: sim.snapshot().win}
    }
    return {seconds: null, winner: -1}
}

test('an AI left alone climbs the whole tall level and reaches the door', () => {
    const sim = createSim(2)
    sim.addAi(1, 'normal', 1)
    const result = playUntilOver(sim, 90)
    assert.strictEqual(result.winner, 1, 'the AI should win the race by itself')
    assert.ok(result.seconds > 20, `${result.seconds}s: faster than that would mean it is cheating`)
    assert.ok(result.seconds < 60, `${result.seconds}s: took too long`)
})

test('the AI is deterministic: the same seed plays out identically', () => {
    const play = () => {
        const sim = createSim(2)
        sim.addAi(1, 'normal', 42)
        return JSON.stringify([playUntilOver(sim, 90), sim.snapshot()])
    }
    assert.strictEqual(play(), play())
})

test('the AI obeys the same speed limits as a person', () => {
    const sim = createSim(2)
    sim.addAi(1, 'normal', 1)
    let previous = sim.snapshot().p[1]
    let fastest = 0
    for (let tick = 0; tick < 60 * 20; tick++) {
        sim.step(DT)
        const now = sim.snapshot().p[1]
        fastest = Math.max(fastest, Math.abs(now.x - previous.x) / DT)
        previous = now
    }
    assert.ok(fastest <= 121, `moved ${fastest.toFixed(0)}px/s sideways; a person tops out at 120`)
})

test('the AI resets for a rematch and races again', () => {
    const sim = createSim(2)
    sim.addAi(1, 'normal', 1)
    assert.ok(playUntilOver(sim, 90).seconds)
    sim.rematch()
    assert.strictEqual(sim.snapshot().over, false)
    assert.ok(sim.snapshot().p[1].y >= 300, 'back at the spawn point (it was up at the door, around y = -1300)')
    assert.ok(playUntilOver(sim, 90).seconds, 'and races to the door again')
})

/** Counts the events of one kind (optionally by slot) over a number of seconds. */
function countEvents(sim, seconds, kind, slot) {
    let count = 0
    for (let tick = 0; tick < 60 * seconds; tick++) {
        sim.step(DT)
        if (tick % 6 === 0) count += sim.drainEvents().filter(e => e.e === kind && (slot === undefined || e.s === slot || e.a === slot)).length
    }
    return count
}

test('an AI beside a rival fights: it swings and wounds them', () => {
    const sim = createSim(2)
    sim.addAi(1, 'normal', 1)
    for (let i = 0; i < 90; i++) sim.step(DT) //Settle onto the ground
    sim.run('players[1].position.x = players[0].position.x + 60; players[1].facingLeft = true')
    const hits = countEvents(sim, 8, 'hit', 1)
    assert.ok(hits >= 3, `only ${hits} hits in 8s`)
    assert.ok(sim.snapshot().p[0].inj > 25, `rival injury ${sim.snapshot().p[0].inj}`)
    assert.strictEqual(sim.snapshot().p[1].inj, 0, 'a rival who never hits back leaves the AI unhurt')
})

test('an AI softens a rival up and then leaves them behind to race', () => {
    const sim = createSim(2)
    sim.addAi(1, 'normal', 1)
    for (let i = 0; i < 90; i++) sim.step(DT)
    sim.run('players[1].position.x = players[0].position.x + 60; players[1].facingLeft = true')
    let peak = 0 //The rival heals while resting, so look at the worst it got, not where it ended
    for (let tick = 0; tick < 60 * 20; tick++) {
        sim.step(DT)
        peak = Math.max(peak, sim.snapshot().p[0].inj)
    }
    assert.ok(peak >= 50 && peak < 80, `rival peaked at ${peak}: hurt, but not pounded to the cap`)
    assert.ok(JSON.parse(sim.run('JSON.stringify(raceProgress(players[1]))')) > 0.15, 'and the AI went on climbing')
})

test('an AI turns round to fight a rival standing behind it', () => {
    const sim = createSim(2)
    sim.addAi(1, 'normal', 1)
    for (let i = 0; i < 90; i++) sim.step(DT)
    sim.run('players[1].position.x = players[0].position.x - 60; players[1].facingLeft = false') //Rival is on its left, AI faces right
    assert.ok(countEvents(sim, 8, 'hit', 1) >= 1, 'it should turn and hit')
})

test('an AI ignores a rival on another level and keeps climbing', () => {
    const sim = createSim(2)
    sim.addAi(1, 'normal', 1)
    sim.run('players[0].position.y = -300; players[0].velocity.y = 0') //Far above
    const swings = countEvents(sim, 12, 'attack', 1) //A fair while: it may dither for a few seconds before setting off
    assert.strictEqual(swings, 0)
    assert.ok(JSON.parse(sim.run('JSON.stringify(raceProgress(players[1]))')) > 0.1, 'it climbed instead')
})

test('the AI does not swing once the round is over', () => {
    const sim = createSim(2)
    sim.addAi(1, 'normal', 1)
    for (let i = 0; i < 90; i++) sim.step(DT)
    sim.run('players[0].position.x = door.position.x - 31; players[0].position.y = door.position.y - 22; players[0].velocity.y = 0') //Player 1 wins
    for (let i = 0; i < 30; i++) sim.step(DT)
    assert.strictEqual(sim.snapshot().over, true)
    sim.drainEvents()
    sim.run('players[1].position.x = players[0].position.x + 30; players[1].position.y = players[0].position.y')
    assert.strictEqual(countEvents(sim, 3, 'attack', 1), 0)
})

test('four AIs racing and brawling in one room play to a finish without trouble', () => {
    const sim = createSim(4)
    for (let slot = 0; slot < 4; slot++) sim.addAi(slot, 'normal', slot + 1)
    const result = playUntilOver(sim, 120)
    assert.ok(result.seconds !== null, 'someone should reach the door')
    assert.ok(result.winner >= 0 && result.winner < 4)
})

// ---- Difficulty levels ----

/** A race with the other player removed, so only the AI's own speed matters. Returns seconds to the door. */
function raceAlone(level, seed) {
    const sim = createSim(2)
    sim.depart(0)
    sim.addAi(1, level, seed)
    return playUntilOver(sim, 150).seconds
}

/** How many times the AI swings in its first 5 seconds beside a player who just stands there. */
function swingsInFirstFiveSeconds(level) {
    const sim = createSim(2)
    sim.addAi(1, level, 1)
    for (let i = 0; i < 90; i++) sim.step(DT)
    sim.run('players[1].position.x = players[0].position.x + 60; players[1].facingLeft = true')
    return countEvents(sim, 5, 'attack', 1)
}

test('the levels are dummy, easy, normal and hard, and an unknown one is refused', () => {
    const sim = createSim(2)
    assert.deepStrictEqual(JSON.parse(sim.run('JSON.stringify(Object.keys(AI_LEVELS))')), ['dummy', 'easy', 'normal', 'hard'])
    assert.throws(() => sim.addAi(1, 'impossible', 1), /Unknown AI level/)
})

test('the dummy stands perfectly still and never swings, even with a rival beside it', () => {
    const sim = createSim(2)
    sim.addAi(1, 'dummy', 1)
    for (let i = 0; i < 90; i++) sim.step(DT)
    sim.run('players[0].position.x = players[1].position.x - 30; players[0].facingLeft = false')
    const start = sim.snapshot().p[1]
    assert.strictEqual(countEvents(sim, 10, 'attack', 1), 0)
    const end = sim.snapshot().p[1]
    assert.deepStrictEqual([end.x, end.y], [start.x, start.y], 'it never moved')
})

test('harder levels race faster: easy is clearly slower than normal, and normal than hard', () => {
    const easy = raceAlone('easy', 3), normal = raceAlone('normal', 3), hard = raceAlone('hard', 3)
    assert.ok(easy && normal && hard, `all should finish: ${easy}, ${normal}, ${hard}`)
    assert.ok(easy > normal * 1.3, `easy ${easy}s should be much slower than normal ${normal}s`)
    assert.ok(normal > hard * 1.1, `normal ${normal}s should be slower than hard ${hard}s`)
    assert.ok(hard >= 28, `hard ${hard}s: faster than the physics allow would mean cheating`)
})

test('harder levels fight more: easy swings least, hard most', () => {
    const easy = swingsInFirstFiveSeconds('easy'), normal = swingsInFirstFiveSeconds('normal'), hard = swingsInFirstFiveSeconds('hard')
    assert.ok(easy < normal && normal < hard, `swings in 5s: easy ${easy}, normal ${normal}, hard ${hard}`)
})

test('a badly hurt AI with nobody near stops to heal, then carries on', () => {
    const sim = createSim(2)
    sim.depart(0) //Nobody around
    sim.addAi(1, 'hard', 1)
    for (let i = 0; i < 90; i++) sim.step(DT)
    sim.run('players[1].injury = 90')
    const before = sim.snapshot().p[1]
    for (let i = 0; i < 60 * 3; i++) sim.step(DT)
    const resting = sim.snapshot().p[1]
    assert.ok(Math.abs(resting.x - before.x) < 5 && Math.abs(resting.y - before.y) < 1, `it stood (almost) still: moved ${resting.x - before.x}px sideways`)
    assert.ok(resting.inj < before.inj - 8, `injury ${before.inj} -> ${resting.inj}: it healed while resting`)
    for (let i = 0; i < 60 * 15; i++) sim.step(DT)
    assert.ok(sim.snapshot().p[1].y < before.y - 60, 'once healed it climbed on')
})
