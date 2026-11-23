// ---- One room: a lobby where players gather, then a running game ----
// A room knows nothing about sockets. It talks to "clients": any object with a send(text) method
// and the fields room, slot (set here). That keeps it testable with fake clients and a fake clock.

const {createSim, MAX_PLAYERS} = require('./sim')

const TICK = 1 / 60                 //The game always advances in steps of exactly 1/60 s, whatever the server's timer does
const MAX_CATCH_UP_TICKS = 5        //After a stall, simulate at most this many steps at once (then just carry on)
const SNAPSHOT_EVERY = 2            //Send the state every 2nd tick: 30 times a second
const LOBBY_COUNTDOWN_MS = 15000    //A public room starts this long after its second player joins
const REMATCH_DELAY_MS = 800        //A rematch can't be requested sooner than this after the round ends (lets the win sink in)

class Room {
    /**
     * @param {String} code - The room's short code, shown to players
     * @param {Object} options
     * @param {Boolean} options.isPublic - Public rooms fill from quick match and auto-start; private ones wait for the host
     * @param {Function} [options.now] - Clock in milliseconds (replaceable in tests)
     * @param {Boolean} [options.timer=true] - Run its own timer; tests turn this off and call advance() themselves
     * @param {Function} [options.onEmpty] - Called when the last player has left
     */
    constructor(code, {isPublic, now = () => performance.now(), timer = true, onEmpty = () => {}}) {
        this.code = code
        this.isPublic = isPublic
        this.now = now
        this.onEmpty = onEmpty
        this.phase = 'lobby'        //'lobby' until it starts, then 'playing'
        this.clients = []           //In join order; the first is the host. During play, a client's index is their slot
        this.autoStartAt = null     //Clock time at which a public lobby starts by itself
        this.lastLobbyBroadcast = 0
        this.sim = null
        this.tick = 0
        this.accumulator = 0
        this.lastAdvance = 0
        this.timer = timer ? setInterval(() => this.advance(this.now()), 1000 / 60) : null
    }

    get isFull() { return this.clients.length >= MAX_PLAYERS }
    get joinable() { return this.phase === 'lobby' && !this.isFull }

    /** Adds a client to the lobby. Returns false if the room can't take them. */
    join(client) {
        if (!this.joinable) return false
        client.room = this
        client.slot = null
        this.clients.push(client)
        // A public room with two or more players counts down to starting; a full room starts straight away
        if (this.isPublic && this.clients.length >= 2 && this.autoStartAt === null) this.autoStartAt = this.now() + LOBBY_COUNTDOWN_MS
        if (this.isFull) {
            this.start()
            return true
        }
        this.broadcastLobby()
        return true
    }

    /** Removes a client (they left or disconnected). */
    leave(client) {
        const index = this.clients.indexOf(client)
        if (index === -1) return
        if (this.phase === 'lobby') {
            this.clients.splice(index, 1)
            client.room = null
            if (this.clients.length === 0) return this.destroy()
            if (this.clients.length < 2) this.autoStartAt = null //Not enough players for a countdown any more
            this.broadcastLobby()
        } else {
            //Mid-game: keep everyone's slot numbers stable by marking this player as gone instead of removing them
            const slot = client.slot
            client.room = null
            client.slot = null
            this.clients[index] = null
            if (slot !== null) this.sim.depart(slot)
            this.broadcast(JSON.stringify({t: 'left', slot}))
            if (this.activeClients().length < 2) this.end('all-left')
        }
    }

    activeClients() {
        return this.clients.filter(client => client !== null)
    }

    /** Handles a message from one of this room's clients. Unknown or invalid messages are ignored. */
    handle(client, message) {
        switch (message.t) {
            case 'start':
                //Only the host can start, and only with someone to play against
                if (this.phase === 'lobby' && client === this.clients[0] && this.clients.length >= 2) this.start()
                break
            case 'move':
                this.input(client, {kind: 'move', dir: message.dir, pressed: message.pressed})
                break
            case 'jump':
                this.input(client, {kind: 'jump'})
                break
            case 'attack':
                this.input(client, {kind: 'attack', type: message.type})
                break
            case 'rematch':
                if (this.phase === 'playing') {
                    const state = this.sim.matchState()
                    //state.overAt was stamped inside the game with the real clock, so compare with the real clock (not this.now)
                    if (state.over && performance.now() - state.overAt >= REMATCH_DELAY_MS) this.sim.rematch()
                }
                break
        }
    }

    input(client, message) {
        if (this.phase === 'playing' && client.slot !== null) this.sim.input(client.slot, message)
    }

    /** Starts the game with everyone currently in the lobby. Returns false if it can't start. */
    start() {
        if (this.phase !== 'lobby' || this.clients.length < 2) return false
        this.phase = 'playing'
        this.autoStartAt = null
        this.sim = createSim(this.clients.length)
        this.tick = 0
        this.accumulator = 0
        this.lastAdvance = this.now()
        this.clients.forEach((client, slot) => {
            client.slot = slot
            client.send(JSON.stringify({t: 'start', slot, count: this.clients.length}))
        })
        return true
    }

    /**
     * Moves time forward. Called by the room's timer (or by tests with a fake clock).
     * In the lobby it handles the auto-start countdown; in play it steps the game in fixed ticks
     * and sends snapshots.
     * @param {Number} nowMs - The current time in milliseconds
     */
    advance(nowMs) {
        if (this.phase === 'lobby') {
            if (this.autoStartAt !== null && nowMs >= this.autoStartAt) this.start()
            else if (this.autoStartAt !== null && nowMs - this.lastLobbyBroadcast >= 1000) this.broadcastLobby() //Tick the countdown on screens
            return
        }
        this.accumulator = Math.min(this.accumulator + (nowMs - this.lastAdvance) / 1000, MAX_CATCH_UP_TICKS * TICK)
        this.lastAdvance = nowMs
        while (this.accumulator >= TICK) {
            this.sim.step(TICK)
            this.tick++
            this.accumulator -= TICK
            if (this.tick % SNAPSHOT_EVERY === 0) this.broadcastSnapshot()
        }
    }

    /** Sends the whole game's state, plus every event since the last snapshot, to everyone. */
    broadcastSnapshot() {
        // Both parts are already JSON text, so the message is stitched together without re-serializing
        this.broadcast(`{"t":"snap","n":${this.tick},"s":${this.sim.snapshotJson()},"ev":${this.sim.drainEventsJson()}}`)
    }

    /** Tells every lobby member who is here (each message says which one is them). */
    broadcastLobby() {
        this.lastLobbyBroadcast = this.now()
        const startsIn = this.autoStartAt === null ? null : Math.max(0, Math.round(this.autoStartAt - this.now()))
        this.clients.forEach((client, index) => {
            client.send(JSON.stringify({
                t: 'lobby', code: this.code, isPublic: this.isPublic,
                you: index, host: index === 0, count: this.clients.length, max: MAX_PLAYERS, startsIn,
            }))
        })
    }

    broadcast(text) {
        for (const client of this.clients) if (client) client.send(text)
    }

    /** Ends the game for everyone who is left and closes the room. */
    end(reason) {
        this.broadcast(JSON.stringify({t: 'ended', reason}))
        this.destroy()
    }

    destroy() {
        clearInterval(this.timer)
        for (const client of this.clients) if (client) { client.room = null; client.slot = null }
        this.clients = []
        this.phase = 'closed'
        this.onEmpty(this)
    }
}

module.exports = {Room, MAX_PLAYERS, TICK, SNAPSHOT_EVERY, LOBBY_COUNTDOWN_MS, REMATCH_DELAY_MS}
