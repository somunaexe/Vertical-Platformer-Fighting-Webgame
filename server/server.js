// ---- The game server: serves the game's files and runs the online rooms over WebSockets ----
// Start it with `npm start`, then open http://localhost:3000 (set PORT to change the port).

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const {WebSocketServer} = require('ws')
const {Lobby} = require('./lobby')

const ROOT = path.join(__dirname, '..')
/**
 * Reads a positive whole number from an environment variable, or returns the fallback if it is missing or not
 * exactly that. Strict on purpose: parseInt would turn a typo like "100MB" into 100 without a word.
 */
function envInt(name, fallback) {
    const text = process.env[name]
    return typeof text === 'string' && /^[1-9]\d*$/.test(text.trim()) ? Number(text) : fallback
}

// Server-wide caps. Set MAX_CONNECTIONS / MAX_ROOMS in the environment to change them without touching the code.
// Bandwidth is the real cost: a busy 12-player room sends about 430 KB/s (1.5 GB an hour), a 2-player room about 15 KB/s.
const DEFAULT_MAX_CONNECTIONS = envInt('MAX_CONNECTIONS', 1000)
const DEFAULT_MAX_ROOMS = envInt('MAX_ROOMS', 200)
const MAX_MESSAGE_BYTES = 1024      //Real messages are tiny; anything bigger is dropped by the socket itself
const BURST_MESSAGES = 60           //Each client may send this many messages at once...
const MESSAGES_PER_SECOND = 120     //...and then this many per second (a rapid key-masher is ~20/s)
const HEARTBEAT_MS = 20000          //Dead connections (closed laptops, lost wifi) are dropped after about two beats
const MAX_BUFFERED_BYTES = 1_000_000 //A client that can't keep up with the snapshots is disconnected

const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
    '.tmx': 'application/xml', '.tsx': 'application/xml',
}

// Only these parts of the project are public. Everything else (server code, tests, package.json, .git ...) is refused.
const PUBLIC_FILES = new Set(['index.html', 'index.css', 'index.js'])
const PUBLIC_FOLDERS = ['js/', 'assets/']

/**
 * Maps a request path to a file under the project root, or null if it must not be served.
 * @param {String} urlPath - The path part of the request URL
 */
function resolvePublicFile(urlPath) {
    let requested
    try {
        requested = decodeURIComponent(urlPath)
    } catch {
        return null //Malformed % escapes
    }
    if (requested.includes('\0')) return null
    if (requested === '/') requested = '/index.html'
    const relative = path.posix.normalize(requested).replace(/^\/+/, '')
    if (relative.startsWith('..') || relative.includes('..')) return null
    if (!PUBLIC_FILES.has(relative) && !PUBLIC_FOLDERS.some(folder => relative.startsWith(folder))) return null
    const full = path.join(ROOT, relative)
    return full.startsWith(ROOT + path.sep) ? full : null
}

/** Answers an HTTP request: the health check, or the file if it is a public one. */
function serveStatic(request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, {Allow: 'GET, HEAD'}).end()
        return
    }
    // A hosting platform (or you) can poll this to see that the server is up. It says nothing about the game.
    if (new URL(request.url, 'http://localhost').pathname === '/healthz') {
        response.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'})
        response.end(request.method === 'HEAD' ? undefined : 'ok')
        return
    }
    const file = resolvePublicFile(new URL(request.url, 'http://localhost').pathname)
    if (!file) {
        response.writeHead(404).end('Not found')
        return
    }
    fs.stat(file, (error, stats) => {
        if (error || !stats.isFile()) {
            response.writeHead(404).end('Not found')
            return
        }
        response.writeHead(200, {
            'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
        })
        if (request.method === 'HEAD') return response.end()
        fs.createReadStream(file).pipe(response)
    })
}

/**
 * Starts a server.
 * @param {Object} [options]
 * @param {Number} [options.port=0] - 0 picks a free port (used by tests)
 * @param {Object} [options.lobbyOptions] - Passed to the Lobby/Rooms (tests)
 * @param {Number} [options.maxConnections] - Open sockets allowed at once (default 1000, or the MAX_CONNECTIONS variable)
 * @param {Number} [options.maxRooms] - Rooms allowed at once (default 200, or the MAX_ROOMS variable)
 * @returns {Promise<{server, lobby, port, close}>}
 */
function startServer({port = 0, lobbyOptions = {}, maxConnections = DEFAULT_MAX_CONNECTIONS, maxRooms = DEFAULT_MAX_ROOMS} = {}) {
    const lobby = new Lobby({maxRooms, ...lobbyOptions})
    const server = http.createServer(serveStatic)
    const sockets = new WebSocketServer({server, maxPayload: MAX_MESSAGE_BYTES})
    let nextClientId = 1

    sockets.on('connection', socket => {
        if (sockets.clients.size > maxConnections) return socket.close(1013, 'busy')

        // The "client" the lobby and rooms talk to: a way to send text, plus the room they are in
        const client = {
            id: nextClientId++,
            room: null,
            slot: null,
            tokens: BURST_MESSAGES,
            lastRefill: Date.now(),
            send(text) {
                if (socket.readyState !== socket.OPEN) return
                if (socket.bufferedAmount > MAX_BUFFERED_BYTES) return socket.terminate()
                socket.send(text)
            },
        }

        // Token bucket: refills continuously, each message costs one token
        const allowMessage = () => {
            const now = Date.now()
            client.tokens = Math.min(BURST_MESSAGES, client.tokens + ((now - client.lastRefill) / 1000) * MESSAGES_PER_SECOND)
            client.lastRefill = now
            if (client.tokens < 1) return false
            client.tokens -= 1
            return true
        }

        socket.isAlive = true
        socket.on('pong', () => { socket.isAlive = true })
        socket.on('message', (data, isBinary) => {
            if (isBinary || !allowMessage()) return
            let message
            try {
                message = JSON.parse(data.toString())
            } catch {
                return //Not JSON: ignore
            }
            lobby.handle(client, message)
        })
        socket.on('close', () => lobby.leave(client))
        socket.on('error', () => {}) //The 'close' event follows; nothing else to do
    })

    const heartbeat = setInterval(() => {
        for (const socket of sockets.clients) {
            if (!socket.isAlive) { socket.terminate(); continue }
            socket.isAlive = false
            socket.ping()
        }
    }, HEARTBEAT_MS)

    return new Promise(resolve => {
        server.listen(port, () => resolve({
            server, lobby, port: server.address().port,
            // A polite shutdown: tell everyone why, close the sockets properly, and only force the stragglers after a second
            close: async () => {
                clearInterval(heartbeat)
                lobby.announceShutdown()
                const closing = [...sockets.clients].map(socket => new Promise(finished => {
                    socket.once('close', finished)
                    socket.close(1001, 'restarting') //1001 = "going away"
                }))
                await Promise.race([Promise.all(closing), new Promise(finished => setTimeout(finished, 1000))])
                for (const room of lobby.rooms.values()) clearInterval(room.timer)
                for (const socket of sockets.clients) socket.terminate()
                await new Promise(done => sockets.close(() => server.close(done)))
            },
        }))
    })
}

module.exports = {startServer, resolvePublicFile, envInt}

if (require.main === module) {
    const port = Number(process.env.PORT) || 3000
    startServer({port}).then(({close}) => {
        console.log(`Game server running: http://localhost:${port}`)
        process.on('SIGTERM', () => close().then(() => process.exit(0)))
        process.on('SIGINT', () => close().then(() => process.exit(0)))
    })
}
