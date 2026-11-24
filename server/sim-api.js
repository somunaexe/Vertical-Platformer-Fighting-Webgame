// ---- The doorway into one room's game (runs INSIDE its sandbox, alongside the shared game code) ----
// server/sim.js calls these functions from outside. Everything crossing the boundary is a JSON STRING:
// live objects made in here belong to this sandbox's own JavaScript world (their Array.prototype differs
// from the server's), and the server would have to turn them into JSON to send them anyway.

const simEvents = [] //Events announced since the last drain, already turned into plain data

const slotOf = player => players.indexOf(player)
const rounded = value => Math.round(value * 100) / 100

// Turn each game event into plain data. Players become slot numbers; browsers map them back to their own players.
const serializers = {
    jump:   d => ({e: 'jump', s: slotOf(d.player)}),
    attack: d => ({e: 'attack', s: slotOf(d.player), type: d.type}),
    hit:    d => ({e: 'hit', a: slotOf(d.attacker), v: slotOf(d.victim), injury: d.injury, x: rounded(d.x), y: rounded(d.y), dir: d.direction}),
    land:   d => ({e: 'land', s: slotOf(d.player), speed: rounded(d.speed), x: rounded(d.x), y: rounded(d.y)}),
    win:    d => ({e: 'win', w: d.winner ? slotOf(d.winner) : -1, x: rounded(d.x), y: rounded(d.y)}),
    reset:  () => ({e: 'reset'}),
}
for (const [name, serialize] of Object.entries(serializers)) {
    GameEvents.on(name, data => simEvents.push(serialize(data)))
}

/** Creates the door and `count` players. Call once per room, when its round starts. */
function simStart(count) {
    createRoundEntities(count)
}

/**
 * Applies one player's input. Returns false if the input was invalid (the caller has already checked
 * the slot is a real player; this checks the contents).
 * @param {Number} slot
 * @param {Object} message - {kind: 'move', dir, pressed} | {kind: 'jump'} | {kind: 'attack', type}
 */
function simInput(slot, message) {
    const player = players[slot]
    if (!player || player.departed) return false
    switch (message.kind) {
        case 'move':
            if (message.dir !== 'left' && message.dir !== 'right') return false
            playerKeys[slot][message.dir === 'left' ? 'a' : 'd'].pressed = !!message.pressed
            return true
        case 'jump':
            jump(player)
            return true
        case 'attack':
            if (typeof message.type !== 'string' || !Object.hasOwn(ATTACKS, message.type)) return false
            attack(player, message.type)
            return true
    }
    return false
}

/** Advances the room's game by dt seconds. */
function simStep(dt) {
    stepGame(dt)
}

/** @returns {String} The whole game as JSON (see js/net-state.js) */
function simSnapshot() {
    return JSON.stringify(snapshotGame())
}

/** @returns {String} JSON array of the events announced since the last call, oldest first; the queue is emptied */
function simDrainEvents() {
    return JSON.stringify(simEvents.splice(0))
}

/** Removes a player who left: hidden, ignored by the rules, and their held keys released. */
function simDepart(slot) {
    if (!players[slot]) return
    players[slot].depart()
    playerKeys[slot].a.pressed = playerKeys[slot].d.pressed = false
}

/** Starts a fresh round. */
function simRematch() {
    resetMatch()
}

/** @returns {String} JSON {over, overAt}: whether the round has finished, and when (performance.now() ms) */
function simMatchState() {
    return JSON.stringify({over: match.over, overAt: match.overAt})
}
