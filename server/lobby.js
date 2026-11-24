// ---- The lobby: finds or creates rooms and routes each client's messages ----
// Like Room, it works with abstract clients (send(text), room, slot), so it is testable without sockets.

const {Room} = require('./room')

const MAX_ROOMS = 200 //Default server-wide cap so nobody can exhaust the server by opening rooms (server.js can override it)
// Room codes avoid look-alike characters (no 0/O, 1/I) so they are easy to read aloud
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 4
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)

class Lobby {
    /**
     * @param {Object} [options]
     * @param {Number} [options.maxRooms=200] - Rooms that may exist at once
     * @param {*} [options.*] - Everything else (timer, now) is passed on to every Room, for tests
     */
    constructor({maxRooms = MAX_ROOMS, ...roomOptions} = {}) {
        this.maxRooms = maxRooms
        this.options = roomOptions
        this.rooms = new Map() //code -> Room
    }

    /** @returns {String} An unused room code */
    newCode() {
        let code
        do {
            code = Array.from({length: CODE_LENGTH}, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('')
        } while (this.rooms.has(code))
        return code
    }

    createRoom(isPublic) {
        if (this.rooms.size >= this.maxRooms) return null
        const room = new Room(this.newCode(), {...this.options, isPublic, onEmpty: closed => this.rooms.delete(closed.code)})
        this.rooms.set(room.code, room)
        return room
    }

    /**
     * Handles any message from a client. Never throws on bad input: it is untrusted.
     * @param {Object} client
     * @param {Object} message - Already-parsed JSON from the client
     */
    handle(client, message) {
        if (!message || typeof message !== 'object' || typeof message.t !== 'string') return
        if (message.t === 'join') return this.join(client, message)
        if (message.t === 'leave') return this.leave(client)
        if (client.room) client.room.handle(client, message)
    }

    /**
     * Puts a client in a room.
     * message.mode: 'quick' (any open public room), 'create' (a new private room) or 'code' (a specific room; needs message.code)
     */
    join(client, message) {
        if (client.room) return //Already in a room
        let room = null
        if (message.mode === 'quick') {
            room = [...this.rooms.values()].find(candidate => candidate.isPublic && candidate.joinable) || this.createRoom(true)
        } else if (message.mode === 'create') {
            room = this.createRoom(false)
        } else if (message.mode === 'code') {
            const code = typeof message.code === 'string' ? message.code.toUpperCase().trim() : ''
            if (!CODE_PATTERN.test(code)) return client.send(JSON.stringify({t: 'error', reason: 'bad-code'}))
            room = this.rooms.get(code)
            if (!room) return client.send(JSON.stringify({t: 'error', reason: 'no-such-room'}))
            if (room.phase !== 'lobby') return client.send(JSON.stringify({t: 'error', reason: 'started'}))
            if (room.isFull) return client.send(JSON.stringify({t: 'error', reason: 'full'}))
        } else {
            return client.send(JSON.stringify({t: 'error', reason: 'bad-request'}))
        }
        if (!room) return client.send(JSON.stringify({t: 'error', reason: 'server-busy'}))
        if (!room.join(client)) client.send(JSON.stringify({t: 'error', reason: 'full'}))
    }

    /** Tells everyone in every room the server is about to restart, so they see why instead of just losing the connection. */
    announceShutdown() {
        for (const room of this.rooms.values()) room.broadcast(JSON.stringify({t: 'ended', reason: 'restarting'}))
    }

    /** Takes a client out of whatever room they are in (they left or disconnected). */
    leave(client) {
        if (client.room) client.room.leave(client)
    }
}

module.exports = {Lobby, MAX_ROOMS}
