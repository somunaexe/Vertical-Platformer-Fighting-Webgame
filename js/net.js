// ---- Online play, browser side: talk to the server, show what it says ----
// The server runs the game. This file sends the player's inputs up, and turns what comes back
// (snapshots of the game and a list of events) into the same GameEvents that the sparks, sounds and
// screen shake already listen to, so online play looks and sounds like local play.

const net = {
    socket: null,
    active: false,  //True while an online round is on screen: input goes to the server instead of the local game
    slot: null,     //Which player I am in the current round
    lobby: null,    //The last lobby message while waiting for a round
    // The menu fills these in to react to what happens (see js/menu.js). Each is optional.
    handlers: {},
}

/** @returns {String} The WebSocket address of the server that served this page */
function netAddress() {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
}

/**
 * Connects and asks to join a room.
 * @param {Object} request - {mode: 'quick'} | {mode: 'create'} | {mode: 'code', code: 'ABCD'}
 * @returns {Promise} Resolves once connected and the join request has been sent; rejects if the server can't be reached
 */
function connectOnline(request) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(netAddress())
        net.socket = socket
        socket.addEventListener('open', () => {
            netSend({t: 'join', ...request})
            resolve()
        })
        socket.addEventListener('message', event => {
            try {
                handleServerMessage(JSON.parse(event.data))
            } catch (error) {
                console.error('Bad message from the server', error)
            }
        })
        socket.addEventListener('close', () => {
            if (net.socket === socket) leaveOnline()
            net.handlers.closed?.()
        })
        socket.addEventListener('error', () => reject(new Error('Could not reach the game server')))
    })
}

/** Sends a message to the server, if connected. */
function netSend(message) {
    if (net.socket && net.socket.readyState === WebSocket.OPEN) net.socket.send(JSON.stringify(message))
}

/** Asks the server to start the round (only the host's request is accepted). */
function netStart() {
    netSend({t: 'start'})
}

/** Leaves the room and goes back to offline mode. */
function leaveOnline() {
    const socket = net.socket
    net.socket = null
    net.active = false
    net.slot = null
    net.lobby = null
    localSlot = null
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close()
    teardownRound()
}

/** Reacts to one message from the server. */
function handleServerMessage(message) {
    switch (message.t) {
        case 'lobby':
            net.lobby = message
            net.handlers.lobby?.(message)
            break
        case 'start':
            net.slot = message.slot
            localSlot = message.slot //The HUD shows my bar and labels me "YOU"
            teardownRound()          //Clears any round left over from before
            beginRound(message.count)
            net.active = true
            net.handlers.start?.(message)
            break
        case 'snap':
            if (!net.active) break
            applyGameSnapshot(message.s)
            replayServerEvents(message.ev)
            break
        case 'left':
            players[message.slot]?.depart()
            net.handlers.left?.(message.slot)
            break
        case 'ended':
            net.active = false
            net.handlers.ended?.(message.reason)
            break
        case 'error':
            net.handlers.error?.(message.reason)
            break
    }
}

/**
 * Turns the server's events (which name players by slot number) back into local GameEvents
 * (which carry the player objects), so audio, effects and shake react exactly as in local play.
 * @param {Object[]} events - What the server's sim-api serialized
 */
function replayServerEvents(events) {
    const at = slot => players[slot]
    for (const event of events) {
        switch (event.e) {
            case 'jump':   GameEvents.emit('jump', {player: at(event.s)}); break
            case 'attack': GameEvents.emit('attack', {player: at(event.s), type: event.type}); break
            case 'hit':    GameEvents.emit('hit', {attacker: at(event.a), victim: at(event.v), injury: event.injury, x: event.x, y: event.y, direction: event.dir}); break
            case 'land':   GameEvents.emit('land', {player: at(event.s), speed: event.speed, x: event.x, y: event.y}); break
            case 'win':    GameEvents.emit('win', {winner: event.w >= 0 ? at(event.w) : null, x: event.x, y: event.y}); break
            case 'reset':  GameEvents.emit('reset', {}); break
        }
    }
}

/** Asks for a rematch: the server decides (online), or the local game restarts (offline). */
function requestRematch() {
    if (net.active) netSend({t: 'rematch'})
    else resetMatch()
}
