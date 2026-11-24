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
