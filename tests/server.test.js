// The real server on a real port: static files, WebSocket flow and abuse limits.
const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const WebSocket = require('ws')
const {spawn} = require('node:child_process')
const net = require('node:net')
const path = require('node:path')
const {startServer, envInt} = require('../server/server')

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

test('every file the page references is actually served', async t => {
    const {port, close} = await startServer()
    t.after(close)
    const html = (await request(port, '/')).body.toString()
    // Every <script src> and <link href> in index.html
    const referenced = [...html.matchAll(/(?:src|href)="\.?\/?([^"]+)"/g)].map(match => '/' + match[1])
    assert.ok(referenced.length >= 20, `expected many references, found ${referenced.length}`)
    assert.ok(referenced.includes('/index.js'))
    for (const path of referenced) {
        assert.strictEqual((await request(port, path)).status, 200, `${path} is referenced by index.html but not served`)
    }
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

test('/healthz answers "ok" and is not a file', async t => {
    const {port, close} = await startServer()
    t.after(close)
    const res = await request(port, '/healthz')
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.toString(), 'ok')
    assert.match(res.type, /text\/plain/)
    assert.strictEqual((await request(port, '/healthz', 'HEAD')).status, 200)
    assert.strictEqual((await request(port, '/healthz', 'POST')).status, 405)
    assert.strictEqual((await request(port, '/healthz/x')).status, 404, 'only the exact path')
})

test('the connection cap refuses sockets beyond the limit and recovers when one leaves', async t => {
    const {port, close} = await startServer({maxConnections: 2})
    t.after(close)
    const a = await connect(port), b = await connect(port), c = await connect(port)
    t.after(() => { a.ws.terminate(); b.ws.terminate(); c.ws.terminate() })
    await new Promise(r => setTimeout(r, 200))
    assert.strictEqual(c.closed, 1013, 'the third socket is turned away ("try again later")')
    assert.strictEqual(a.closed, null)
    assert.strictEqual(b.closed, null)
    a.ws.close()
    await new Promise(r => setTimeout(r, 200))
    const d = await connect(port)
    t.after(() => d.ws.terminate())
    await new Promise(r => setTimeout(r, 200))
    assert.strictEqual(d.closed, null, 'a free slot can be used again')
})

test('the room cap turns away players who would need a new room', async t => {
    const {port, close} = await startServer({maxRooms: 1})
    t.after(close)
    const a = await connect(port), b = await connect(port)
    t.after(() => { a.ws.terminate(); b.ws.terminate() })
    a.send({t: 'join', mode: 'create'})
    await a.waitFor(m => m.t === 'lobby')
    b.send({t: 'join', mode: 'create'})
    assert.strictEqual((await b.waitFor(m => m.t === 'error')).reason, 'server-busy')
})

test('envInt reads positive whole numbers and ignores anything else', () => {
    process.env.TEST_LIMIT = '25'
    assert.strictEqual(envInt('TEST_LIMIT', 7), 25)
    process.env.TEST_LIMIT = ' 40 '
    assert.strictEqual(envInt('TEST_LIMIT', 7), 40, 'surrounding spaces are fine')
    for (const bad of ['', 'abc', '0', '-3', '2.5', '100MB', '1e3', 'NaN', '07x']) {
        process.env.TEST_LIMIT = bad
        assert.strictEqual(envInt('TEST_LIMIT', 7), 7, `"${bad}" must be ignored, not partly read`)
    }
    delete process.env.TEST_LIMIT
    assert.strictEqual(envInt('TEST_LIMIT', 7), 7, 'missing -> fallback')
})

test('shutting down tells players the server is restarting, then closes politely', async t => {
    const {port, close} = await startServer()
    const a = await connect(port)
    t.after(() => a.ws.terminate())
    a.send({t: 'join', mode: 'create'})
    await a.waitFor(m => m.t === 'lobby')
    await close()
    assert.strictEqual(a.inbox.at(-1).t, 'ended')
    assert.strictEqual(a.inbox.at(-1).reason, 'restarting')
    assert.strictEqual(a.closed, 1001, 'closed with "going away", not dropped')
})

test('the real entrypoint: reads PORT, serves the page and /healthz, and shuts down cleanly on SIGTERM', async t => {
    // Find a free port, then start `node server/server.js` exactly as `npm start` does
    const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)) }) })
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {env: {...process.env, PORT: String(port), MAX_ROOMS: '3'}})
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    t.after(() => child.kill('SIGKILL'))
    const exited = new Promise(resolve => child.on('exit', (code, signal) => resolve({code, signal})))
    for (let i = 0; i < 100 && !output.includes('Game server running'); i++) await new Promise(r => setTimeout(r, 50))
    assert.match(output, new RegExp(`http://localhost:${port}`), 'it announces the port it was given')
    assert.strictEqual((await request(port, '/healthz')).body.toString(), 'ok')
    assert.match((await request(port, '/')).body.toString(), /<canvas>/)

    const a = await connect(port)
    t.after(() => a.ws.terminate())
    a.send({t: 'join', mode: 'quick'})
    await a.waitFor(m => m.t === 'lobby')
    child.kill('SIGTERM') //What a host sends when it redeploys
    assert.deepStrictEqual(await exited, {code: 0, signal: null}, 'a clean exit, not a crash or a kill')
    assert.strictEqual(a.inbox.at(-1).reason, 'restarting')
})
