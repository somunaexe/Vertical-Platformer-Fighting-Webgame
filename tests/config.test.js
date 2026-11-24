// Which server address the page connects to: its own host by default, or the configured one (itch.io, GitHub Pages).
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

/** Loads js/config.js into a sandbox and returns gameServerAddress plus what it logged. */
function load(setting = '') {
    const logs = []
    const sandbox = {location: {protocol: 'https:', host: 'page.example'}, console: {warn: m => logs.push(['warn', m]), error: m => logs.push(['error', m])}}
    vm.createContext(sandbox)
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8').replace("const GAME_SERVER_URL = ''", `const GAME_SERVER_URL = ${JSON.stringify(setting)}`), sandbox)
    return {logs, address: (page, configured) => vm.runInContext(`gameServerAddress(${JSON.stringify(page)}, ${configured === undefined ? 'GAME_SERVER_URL' : JSON.stringify(configured)})`, sandbox)}
}
const https = {protocol: 'https:', host: 'html-classic.itch.zone'}
const http = {protocol: 'http:', host: 'localhost:3000'}

test('by default the page connects back to where it came from (the server serves the page itself)', () => {
    const {address, logs} = load()
    assert.strictEqual(address(http), 'ws://localhost:3000')
    assert.strictEqual(address({protocol: 'https:', host: 'game.up.railway.app'}), 'wss://game.up.railway.app', 'a secure page gets a secure socket')
    assert.deepStrictEqual(logs, [])
})

test('a configured address wins, so a page on itch.io can play on your own server', () => {
    const {address, logs} = load('wss://my-game.up.railway.app')
    assert.strictEqual(address(https), 'wss://my-game.up.railway.app')
    assert.strictEqual(address(http), 'wss://my-game.up.railway.app', 'the configured server is used wherever the page is')
    assert.deepStrictEqual(logs, [])
})

test('trailing slashes are tidied, and a port or path is kept', () => {
    const {address} = load()
    assert.strictEqual(address(https, 'wss://game.example/'), 'wss://game.example')
    assert.strictEqual(address(https, 'wss://game.example:8443'), 'wss://game.example:8443')
    assert.strictEqual(address(https, 'ws://localhost:3000'), 'ws://localhost:3000')
    assert.strictEqual(address(https, 'wss://game.example/play/'), 'wss://game.example/play')
})

test('anything that is not a plain ws:// or wss:// address is refused, with an explanation, and the page host is used', () => {
    for (const bad of ['https://game.example', 'game.example', 'wss://', 'wss://a b.example', 'wss://game.example?x=1', 'javascript:alert(1)', 'wss://game.example#frag']) {
        const {address, logs} = load()
        assert.strictEqual(address(http, bad), 'ws://localhost:3000', `"${bad}" should fall back`)
        assert.strictEqual(logs.length, 1, `"${bad}" should be explained`)
        assert.strictEqual(logs[0][0], 'error')
    }
})

test('an insecure ws:// setting on a secure page is used but warned about (browsers block it)', () => {
    const {address, logs} = load()
    assert.strictEqual(address(https, 'ws://game.example'), 'ws://game.example')
    assert.strictEqual(logs.length, 1)
    assert.match(logs[0][1], /wss:\/\//)
})

test('the setting ships empty, so a normal checkout connects to its own server', () => {
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8'), /^const GAME_SERVER_URL = ''$/m)
})
