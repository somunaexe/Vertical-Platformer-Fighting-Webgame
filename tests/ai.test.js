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
    const swings = countEvents(sim, 6, 'attack', 1)
    assert.strictEqual(swings, 0)
    assert.ok(JSON.parse(sim.run('JSON.stringify(raceProgress(players[1]))')) > 0.05, 'it climbed instead')
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
