// ---- Game events: the game announces what happened, and anyone interested reacts ----
// Game logic never plays a sound or spawns a particle itself. It calls GameEvents.emit('hit', {...}),
// and audio.js, effects.js and so on each subscribe with GameEvents.on('hit', ...).
// That keeps the rules separate from the presentation, and later lets a server send the same
// events over the network so every player's browser can react to them.
//
// Events used so far (each carries an object):
//   jump    {player}
//   attack  {player, type}
//   hit     {attacker, victim, injury, x, y, direction}   x, y = contact point in world pixels
//   land    {player, speed, x, y}                         speed = downward speed on impact
//   win     {winner, x, y}                                winner is null for a draw
//   reset   {}                                            a new round has started
const GameEvents = {
    listeners: {},

    /**
     * Calls fn whenever an event of this type is emitted.
     * @param {String} type - Event name
     * @param {Function} fn - Receives the event's data object
     */
    on(type, fn) {
        (this.listeners[type] ||= []).push(fn)
    },

    /**
     * Announces that something happened.
     * @param {String} type - Event name
     * @param {Object} data - Details about it
     */
    emit(type, data) {
        for (const fn of this.listeners[type] || []) fn(data)
    },
}
