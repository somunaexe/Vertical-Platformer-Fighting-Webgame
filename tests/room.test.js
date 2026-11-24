// Lobby and room behaviour, with fake clients and a fake clock (no sockets, no real waiting).
const test = require('node:test')
const assert = require('node:assert')
const {Lobby} = require('../server/lobby')
const {MAX_PLAYERS, LOBBY_COUNTDOWN_MS, TICK} = require('../server/room')

/** A stand-in for a connected player: it just records what the server sends it. */
function fakeClient() {
    return {
        room: null, slot: null, inbox: [],
        send(text) { this.inbox.push(JSON.parse(text)) },
        last(type) { return [...this.inbox].reverse().find(message => message.t === type) },
        all(type) { return this.inbox.filter(message => message.t === type) },
    }
}

/** A lobby whose rooms use a clock we control and no timers of their own. */
function setup() {
    const clock = {t: 1000}
    const lobby = new Lobby({timer: false, now: () => clock.t})
    const advance = (room, seconds) => {
        for (let i = 0; i < Math.round(seconds / TICK); i++) { clock.t += TICK * 1000; room.advance(clock.t) }
    }
    const join = (mode, code) => { const c = fakeClient(); lobby.handle(c, {t: 'join', mode, code}); return c }
    return {clock, lobby, advance, join}
}

test('quick match puts players in the same public room; the first is the host', () => {
    const {join} = setup()
    const a = join('quick'), b = join('quick')
    assert.strictEqual(a.room, b.room)
    const lobbyA = a.last('lobby'), lobbyB = b.last('lobby')
    assert.strictEqual(lobbyA.count, 2)
    assert.deepStrictEqual([lobbyA.you, lobbyA.host, lobbyB.you, lobbyB.host], [0, true, 1, false])
    assert.strictEqual(lobbyA.max, MAX_PLAYERS)
    assert.strictEqual(MAX_PLAYERS, 12)
})

test('only the host can start, and not alone', () => {
    const {lobby, join} = setup()
    const host = join('create')
    lobby.handle(host, {t: 'start'})
    assert.strictEqual(host.room.phase, 'lobby', 'host alone cannot start')
    const guest = join('code', host.last('lobby').code)
    lobby.handle(guest, {t: 'start'})
    assert.strictEqual(host.room.phase, 'lobby', 'a guest cannot start')
    lobby.handle(host, {t: 'start'})
    assert.strictEqual(host.room.phase, 'playing')
    assert.deepStrictEqual([host.last('start').slot, guest.last('start').slot, host.last('start').count], [0, 1, 2])
})

test('a public room starts by itself 15 seconds after its second player joins', () => {
    const {clock, join} = setup()
    const a = join('quick')
    assert.strictEqual(a.last('lobby').startsIn, null, 'no countdown for one player')
    join('quick')
    assert.strictEqual(a.last('lobby').startsIn, LOBBY_COUNTDOWN_MS)
    clock.t += LOBBY_COUNTDOWN_MS - 1000; a.room.advance(clock.t)
    assert.strictEqual(a.room.phase, 'lobby')
    clock.t += 1000; a.room.advance(clock.t)
    assert.strictEqual(a.room.phase, 'playing')
})

test('the countdown stops if players leave and the room is no longer viable', () => {
    const {lobby, join} = setup()
    const a = join('quick'), b = join('quick')
    lobby.leave(b)
    assert.strictEqual(a.last('lobby').startsIn, null)
    assert.strictEqual(a.last('lobby').count, 1)
})

test('private rooms: codes work in any case, bad and unknown codes are refused, started rooms are closed', () => {
    const {lobby, join} = setup()
    const host = join('create')
    const code = host.last('lobby').code
    assert.match(code, /^[A-Z2-9]{4}$/)
    assert.strictEqual(host.room.isPublic, false)
    assert.ok(join('code', code.toLowerCase()).room, 'lowercase code accepted')
    assert.strictEqual(join('code', 'zz').last('error').reason, 'bad-code')
    assert.strictEqual(join('code', 'ABCD').last('error').reason, 'no-such-room')
    assert.strictEqual(join('code', {}).last('error').reason, 'bad-code')
    // A private room is never offered to quick match
    const stranger = join('quick')
    assert.notStrictEqual(stranger.room, host.room)
    lobby.handle(host, {t: 'start'})
    assert.strictEqual(join('code', code).last('error').reason, 'started')
})

test('a room holds twelve players: it starts when full and the next player gets a new room', () => {
    const {join} = setup()
    const players = Array.from({length: MAX_PLAYERS}, () => join('quick'))
    const room = players[0].room
    assert.ok(players.every(p => p.room === room))
    assert.strictEqual(room.phase, 'playing', 'a full room starts immediately')
    assert.deepStrictEqual(players.map(p => p.last('start').slot), [...Array(MAX_PLAYERS).keys()])
    const late = join('quick')
    assert.notStrictEqual(late.room, room)
    assert.strictEqual(late.room.phase, 'lobby')
})

test('a full private room refuses a thirteenth player', () => {
    const {lobby, join} = setup()
    const host = join('create')
    const code = host.last('lobby').code
    for (let i = 1; i < MAX_PLAYERS - 1; i++) join('code', code)   // 11 in the lobby, room not started
    assert.strictEqual(host.room.clients.length, MAX_PLAYERS - 1)
    join('code', code)                                              // the 12th fills it, so it starts
    assert.strictEqual(host.room.phase, 'playing')
    assert.strictEqual(join('code', code).last('error').reason, 'started')
})

test('snapshots arrive 30 times a second with one entry per player and an events list', () => {
    const {lobby, advance, join} = setup()
    const a = join('quick'), b = join('quick')
    lobby.handle(a, {t: 'start'})
    advance(a.room, 1)
    const snaps = a.all('snap')
    assert.ok(snaps.length >= 29 && snaps.length <= 31, `${snaps.length} snapshots in a second`)
    assert.strictEqual(snaps[0].s.p.length, 2)
    assert.ok(Array.isArray(snaps[0].ev))
    assert.ok(snaps.every((snap, i) => i === 0 || snap.n > snaps[i - 1].n), 'tick numbers increase')
    assert.strictEqual(b.all('snap').length, snaps.length, 'everyone gets the same snapshots')
})

test('input goes to the sender\'s own player only', () => {
    const {lobby, advance, join} = setup()
    const a = join('quick'), b = join('quick')
    lobby.handle(a, {t: 'start'})
    advance(a.room, 1)
    const before = a.last('snap').s.p.map(p => p.x)
    lobby.handle(b, {t: 'move', dir: 'left', pressed: true})
    advance(a.room, 1)
    const after = a.last('snap').s.p.map(p => p.x)
    assert.strictEqual(after[0], before[0], 'player 1 did not move')
    assert.ok(before[1] - after[1] > 100, `player 2 walked left ${before[1] - after[1]}px`)
})

test('a stall does not make the game race to catch up', () => {
    const {clock, lobby, join} = setup()
    const a = join('quick'); join('quick')
    lobby.handle(a, {t: 'start'})
    const before = a.room.tick
    clock.t += 10_000                    // the server froze for 10 seconds
    a.room.advance(clock.t)
    assert.ok(a.room.tick - before <= 5, `simulated ${a.room.tick - before} ticks`)
})

test('someone leaving mid-game is marked gone; when too few remain the game ends', () => {
    const {lobby, advance, join} = setup()
    const clients = [join('quick'), join('quick'), join('quick')]
    lobby.handle(clients[0], {t: 'start'})
    advance(clients[0].room, 0.5)
    const room = clients[0].room
    lobby.leave(clients[1])
    assert.strictEqual(clients[0].last('left').slot, 1)
    advance(room, 0.2)
    assert.strictEqual(clients[0].last('snap').s.p[1].gone, 1)
    assert.strictEqual(clients[2].slot, 2, 'other slots keep their numbers')
    lobby.leave(clients[2])
    assert.strictEqual(clients[0].last('ended').reason, 'all-left')
    assert.strictEqual(lobby.rooms.size, 0, 'the room is cleaned up')
    assert.strictEqual(clients[0].room, null)
})

test('a client can rejoin another room after its room ended', () => {
    const {lobby, join} = setup()
    const a = join('quick'), b = join('quick')
    lobby.handle(a, {t: 'start'})
    lobby.leave(b)
    assert.strictEqual(a.room, null)
    lobby.handle(a, {t: 'join', mode: 'quick'})
    assert.ok(a.room)
})

test('rematch is refused straight after a win and allowed a moment later', async () => {
    const {lobby, advance, join} = setup()
    const a = join('quick'), b = join('quick')
    lobby.handle(a, {t: 'start'})
    advance(a.room, 1)
    a.room.sim.run('players[1].position.x = door.position.x - 31; players[1].position.y = door.position.y - 22; players[1].velocity.y = 0')
    advance(a.room, 0.3)
    assert.strictEqual(a.room.sim.snapshot().over, true)
    lobby.handle(b, {t: 'rematch'})
    assert.strictEqual(a.room.sim.snapshot().over, true, 'too soon')
    await new Promise(resolve => setTimeout(resolve, 850))
    lobby.handle(b, {t: 'rematch'})
    assert.strictEqual(a.room.sim.snapshot().over, false)
})

test('garbage from clients never throws and never changes anything', () => {
    const {lobby, advance, join} = setup()
    const host = join('quick'), guest = join('quick')
    const junk = [null, undefined, 5, 'x', [], {}, {t: 5}, {t: 'nope'}, {t: 'join', mode: 'x'}, {t: 'move'}, {t: 'move', dir: {}, pressed: 'yes'},
        {t: 'attack', type: '__proto__'}, {t: 'attack', type: 'constructor'}, {t: 'join'}]
    // From a guest (who cannot start the game) and from the host, in the lobby
    for (const message of junk) assert.doesNotThrow(() => lobby.handle(guest, message))
    for (const message of junk) assert.doesNotThrow(() => lobby.handle(host, message))
    assert.strictEqual(host.room.phase, 'lobby', 'junk never starts the room')
    assert.strictEqual(host.room.clients.length, 2)
    // A start message from a guest is ignored; the same message from the host works
    lobby.handle(guest, {t: 'start', extra: 1})
    assert.strictEqual(host.room.phase, 'lobby')
    lobby.handle(host, {t: 'start', extra: 1})
    assert.strictEqual(host.room.phase, 'playing')
    // ...and during play
    for (const message of junk) assert.doesNotThrow(() => lobby.handle(guest, message))
    for (const message of junk) assert.doesNotThrow(() => lobby.handle(host, message))
    advance(host.room, 0.5)
    const snap = host.last('snap').s
    assert.ok(snap.p.every(p => p.inj === 0 && p.anim === 'idle' || p.anim === 'idleLeft'), 'nobody did anything')
})

test('a lobby with a room cap refuses to create more rooms, and tells the player', () => {
    const clock = {t: 1000}
    const lobby = new Lobby({maxRooms: 1, timer: false, now: () => clock.t})
    const first = fakeClient(), second = fakeClient()
    lobby.handle(first, {t: 'join', mode: 'create'})
    lobby.handle(second, {t: 'join', mode: 'create'})
    assert.ok(first.room)
    assert.strictEqual(second.room, null)
    assert.strictEqual(second.last('error').reason, 'server-busy')
    // Joining the EXISTING room by code still works: the cap is on creating rooms
    const code = first.last('lobby').code
    const third = fakeClient()
    lobby.handle(third, {t: 'join', mode: 'code', code})
    assert.strictEqual(third.room, first.room)
})
