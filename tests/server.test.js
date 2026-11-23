// The real server on a real port: static files, WebSocket flow and abuse limits.
const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const WebSocket = require('ws')
const {startServer} = require('../server/server')

/** GET a raw path (sent exactly as given, so nothing normalizes ../ for us). */
function request(port, rawPath, method = 'GET') {
    return new Promise((resolve, reject) => {
        const req = http.request({host: '127.0.0.1', port, path: rawPath, method}, res => {
            const chunks = []
            res.on('data', chunk => chunks.push(chunk))
            res.on('end', () => resolve({status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks)}))
        })
        req.on('error', reject)
        req.end()
    })
}

/** A WebSocket client that records every message and lets a test wait for one. */
function connect(port) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`)
        const client = {ws, inbox: [], closed: null}
        ws.on('message', data => client.inbox.push(JSON.parse(data.toString())))
        ws.on('close', code => { client.closed = code })
        ws.on('error', reject)
        client.send = message => ws.send(JSON.stringify(message))
        client.waitFor = async (predicate, ms = 3000) => {
            const start = Date.now()
            while (Date.now() - start < ms) {
                const found = client.inbox.find(predicate)
                if (found) return found
                await new Promise(r => setTimeout(r, 10))
            }
            throw new Error('timed out waiting for a message; got: ' + JSON.stringify(client.inbox.slice(-3)))
        }
        ws.on('open', () => resolve(client))
    })
}

test('serves the game files and refuses everything else', async t => {
    const {port, close} = await startServer()
    t.after(close)

    const page = await request(port, '/')
    assert.strictEqual(page.status, 200)
    assert.match(page.type, /text\/html/)
    assert.match(page.body.toString(), /<canvas>/)
    assert.strictEqual((await request(port, '/index.html')).status, 200)
    assert.match((await request(port, '/js/game.js')).type, /javascript/)
    assert.strictEqual((await request(port, '/assets/images/background.png')).type, 'image/png')
    assert.strictEqual((await request(port, '/assets/audio/hit.mp3')).type, 'audio/mpeg')
    assert.strictEqual((await request(port, '/index.css?v=3')).status, 200, 'query strings are ignored')

    const refused = ['/server/server.js', '/server/sim.js', '/package.json', '/package-lock.json', '/tests/sim.test.js', '/.git/config',
        '/node_modules/ws/package.json', '/README.md', '/../package.json', '/js/../package.json', '/js/../server/server.js',
        '/%2e%2e/package.json', '/js/%2e%2e/server/server.js', '/js/..%2fserver/server.js', '/%00', '/js/', '/assets/', '/nope', '/%E0%A4%A']
    for (const path of refused) {
        const res = await request(port, path)
        assert.strictEqual(res.status, 404, `${path} should be refused, got ${res.status}`)
    }
    assert.strictEqual((await request(port, '/', 'POST')).status, 405)
    assert.strictEqual((await request(port, '/', 'HEAD')).body.length, 0)
})

test('two players meet, play, and see each other move over WebSockets', async t => {
    const {port, close} = await startServer()
    t.after(close)
    const a = await connect(port), b = await connect(port)
    t.after(() => { a.ws.terminate(); b.ws.terminate() })

    a.send({t: 'join', mode: 'quick'})
    await a.waitFor(m => m.t === 'lobby')
    b.send({t: 'join', mode: 'quick'})
    const lobbyB = await b.waitFor(m => m.t === 'lobby' && m.count === 2)
    assert.strictEqual(lobbyB.host, false)
    assert.strictEqual((await a.waitFor(m => m.t === 'lobby' && m.count === 2)).host, true)

    a.send({t: 'start'})
    assert.strictEqual((await a.waitFor(m => m.t === 'start')).slot, 0)
    assert.strictEqual((await b.waitFor(m => m.t === 'start')).slot, 1)

    await new Promise(r => setTimeout(r, 1000))      // let the players settle onto the ground
    const startX = (await b.waitFor(m => m.t === 'snap' && m.n > 40)).s.p[1].x
    b.send({t: 'move', dir: 'left', pressed: true})
    await new Promise(r => setTimeout(r, 1000))
    b.send({t: 'move', dir: 'left', pressed: false})
    const latest = [...a.inbox].reverse().find(m => m.t === 'snap').s.p[1]
    assert.ok(startX - latest.x > 80, `player 2 should have walked left: ${startX} -> ${latest.x}`)
    assert.strictEqual(latest.anim === 'runLeft' || latest.anim === 'idleLeft', true)

    // B jumps: both clients see a jump event for slot 1
    b.send({t: 'jump'})
    const eventsSeenByA = await a.waitFor(m => m.t === 'snap' && m.ev.some(e => e.e === 'jump' && e.s === 1))
    assert.ok(eventsSeenByA)
    await b.waitFor(m => m.t === 'snap' && m.ev.some(e => e.e === 'jump' && e.s === 1))

    // B disconnects: A hears about it, and since nobody is left to race the game ends
    b.ws.close()
    assert.strictEqual((await a.waitFor(m => m.t === 'left')).slot, 1)
    assert.strictEqual((await a.waitFor(m => m.t === 'ended')).reason, 'all-left')
})

test('oversized messages close the connection; junk is ignored; a flood does not break the server', async t => {
    const {port, close, lobby} = await startServer()
    t.after(close)

    const big = await connect(port)
    big.ws.send('x'.repeat(5000))
    await new Promise(r => setTimeout(r, 200))
    assert.strictEqual(big.closed, 1009, 'message too big')

    const polite = await connect(port)
    t.after(() => polite.ws.terminate())
    polite.ws.send('not json at all')
    polite.ws.send(Buffer.from([1, 2, 3]))
    polite.ws.send('null')
    polite.send({t: 'join', mode: 'quick'})
    await polite.waitFor(m => m.t === 'lobby')            // still works after the junk

    // 1000 messages in a burst: the bucket drops the excess instead of the server falling over
    for (let i = 0; i < 1000; i++) polite.send({t: 'move', dir: 'left', pressed: i % 2 === 0})
    await new Promise(r => setTimeout(r, 300))
    const other = await connect(port)
    t.after(() => other.ws.terminate())
    other.send({t: 'join', mode: 'quick'})
    await other.waitFor(m => m.t === 'lobby')
    assert.strictEqual(lobby.rooms.size, 1, 'the server is fine and the second player joined the same public room')
})

test('closing a socket removes the player from their lobby', async t => {
    const {port, close, lobby} = await startServer()
    t.after(close)
    const a = await connect(port)
    a.send({t: 'join', mode: 'create'})
    await a.waitFor(m => m.t === 'lobby')
    assert.strictEqual(lobby.rooms.size, 1)
    a.ws.close()
    await new Promise(r => setTimeout(r, 200))
    assert.strictEqual(lobby.rooms.size, 0, 'empty rooms are cleaned up')
})
