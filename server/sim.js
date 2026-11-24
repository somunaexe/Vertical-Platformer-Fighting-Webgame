// ---- Runs one room's game headless, using the SAME source files as the browser ----
// Each room gets its own vm context: a separate set of globals (its own players, match, door ...), so
// rooms cannot affect each other, and the shared game code needs no changes to run here.

const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

// Load order matters (same dependencies as the script tags in index.html), minus everything that draws or listens
const FILES = [
    'server/stubs.js',
    'js/bus.js',
    'js/utils.js',
    'js/data/collision.js',
    'js/data/combat.js',
    'js/level.js',
    'js/classes/CollisionBlock.js',
    'js/classes/Door.js',
    'js/classes/Sprite.js',
    'js/classes/Player.js',
    'js/game.js',
    'js/net-state.js',
    'server/sim-api.js',
]

// Read and compile once; running a compiled script in a fresh context is cheap
const scripts = FILES.map(file => new vm.Script(fs.readFileSync(path.join(ROOT, file), 'utf8'), {filename: file}))

/**
 * Creates one room's game.
 * @param {Number} playerCount - How many players are in the round
 * @returns {Object} Methods to feed it input, step it and read it back. The *Json variants return the
 *   string ready to send over the network; the others parse it into ordinary objects.
 */
function createSim(playerCount) {
    const context = vm.createContext({performance, console})
    for (const script of scripts) script.runInContext(context)

    const api = vm.runInContext(
        '({simStart, simInput, simStep, simSnapshot, simDrainEvents, simDepart, simRematch, simMatchState})',
        context,
    )
    api.simStart(playerCount)

    return {
        input: (slot, message) => api.simInput(slot, message),
        step: dt => api.simStep(dt),
        snapshotJson: () => api.simSnapshot(),          //Ready to send: no second serialization
        snapshot: () => JSON.parse(api.simSnapshot()),
        drainEventsJson: () => api.simDrainEvents(),
        drainEvents: () => JSON.parse(api.simDrainEvents()),
        depart: slot => api.simDepart(slot),
        rematch: () => api.simRematch(),
        matchState: () => JSON.parse(api.simMatchState()),
        /** Runs a snippet inside the room's sandbox. For tests only. */
        run: code => vm.runInContext(code, context),
    }
}

// The most players a room can hold: read from the game rules themselves so the two can never disagree
const MAX_PLAYERS = createSim(2).run('MAX_PLAYERS')

module.exports = {createSim, MAX_PLAYERS}
