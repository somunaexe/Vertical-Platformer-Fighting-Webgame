// The itch.io build: the right files, the server address baked in safely, and a zip that other tools can open.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const {spawnSync} = require('node:child_process')
const {buildItch, makeZip, applyServerUrl, isValidServerUrl} = require('../tools/build-itch')

const ROOT = path.join(__dirname, '..')
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'itch-test-'))

/**
 * An independent zip READER (it shares no code with the writer): finds the end record, walks the directory,
 * and inflates each file. Returns {name: Buffer}.
 */
function readZip(zip) {
    let end = zip.length - 22
    while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--
    assert.ok(end >= 0, 'no end-of-archive record')
    const count = zip.readUInt16LE(end + 10)
    let cursor = zip.readUInt32LE(end + 16)
    const files = {}
    for (let i = 0; i < count; i++) {
        assert.strictEqual(zip.readUInt32LE(cursor), 0x02014b50, 'directory entry signature')
        const method = zip.readUInt16LE(cursor + 10)
        const compressed = zip.readUInt32LE(cursor + 20)
        const size = zip.readUInt32LE(cursor + 24)
        const nameLength = zip.readUInt16LE(cursor + 28)
        const extraLength = zip.readUInt16LE(cursor + 30)
        const commentLength = zip.readUInt16LE(cursor + 32)
        const localAt = zip.readUInt32LE(cursor + 42)
        const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength)
        assert.strictEqual(zip.readUInt32LE(localAt), 0x04034b50, 'local header signature')
        const dataAt = localAt + 30 + zip.readUInt16LE(localAt + 26) + zip.readUInt16LE(localAt + 28)
        const raw = zip.subarray(dataAt, dataAt + compressed)
        const data = method === 8 ? zlib.inflateRawSync(raw) : raw
        assert.strictEqual(data.length, size, `${name}: size`)
        files[name] = Buffer.from(data)
        cursor += 46 + nameLength + extraLength + commentLength
    }
    return files
}

test('the zip writer round-trips empty, binary and unicode-named files', () => {
    const random = Buffer.from(Array.from({length: 5000}, (_, i) => (i * 7919 + 13) % 256))
    const input = [
        {name: 'index.html', data: Buffer.from('<h1>hi</h1>'.repeat(100))},
        {name: 'empty.txt', data: Buffer.alloc(0)},
        {name: 'assets/binary.bin', data: random},
        {name: 'assets/ünïcode ✓.txt', data: Buffer.from('ok')},
    ]
    const back = readZip(makeZip(input))
    assert.deepStrictEqual(Object.keys(back), input.map(f => f.name))
    for (const f of input) assert.ok(back[f.name].equals(f.data), `${f.name} comes back identical`)
})

test('building makes a folder and a zip with the same files, index.html at the top, nothing else leaked in', () => {
    const out = tempDir()
    const result = buildItch({server: 'wss://my-game.up.railway.app', outDir: out})
    const zipped = readZip(fs.readFileSync(result.zip))
    const names = Object.keys(zipped)
    assert.strictEqual(names.length, result.files)
    for (const top of ['index.html', 'index.css', 'index.js']) assert.ok(names.includes(top), `${top} is at the top level`)
    assert.ok(names.every(n => !n.startsWith('/') && !n.includes('\\')), "names use '/' and are relative")
    assert.deepStrictEqual(names.filter(n => /\.(tmx|tsx)$|\.DS_Store$/.test(n)), [], 'editor files are not shipped')
    assert.deepStrictEqual(names.filter(n => /^(server|tests|tools|dist|node_modules|\.git)\b|^package/.test(n)), [], 'server code, tests and package files are not shipped')
    // everything the page references is there, and so are a few assets the game loads at runtime
    const html = zipped['index.html'].toString()
    for (const m of html.matchAll(/(?:src|href)="\.?\/?([^"]+)"/g)) assert.ok(names.includes(m[1]), `${m[1]} is referenced by index.html but missing from the zip`)
    for (const needed of ['assets/tiled/assets/tileset.png', 'assets/tiled/assets/background_0.png', 'assets/images/warrior/Idle.png', 'assets/audio/hit.mp3', 'js/vendor/pixi.min.js', 'js/data/art.js']) {
        assert.ok(names.includes(needed), `${needed} is missing`)
    }
    // the unzipped folder matches the zip
    for (const name of names) assert.ok(fs.readFileSync(path.join(result.folder, name)).equals(zipped[name]), `${name}: folder and zip agree`)
    // and every file except config.js is a byte-for-byte copy of the source
    for (const name of names.filter(n => n !== 'js/config.js')) assert.ok(fs.readFileSync(path.join(ROOT, name)).equals(zipped[name]), `${name} matches the source`)
})

test('the server address goes into the built config.js only, and the source file is left alone', () => {
    const out = tempDir()
    const before = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8')
    const result = buildItch({server: 'wss://my-game.up.railway.app/', outDir: out}) //Trailing slash is tidied
    const built = fs.readFileSync(path.join(result.folder, 'js', 'config.js'), 'utf8')
    assert.match(built, /^const GAME_SERVER_URL = "wss:\/\/my-game\.up\.railway\.app"$/m)
    assert.strictEqual(fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8'), before, 'the committed config is untouched')
    assert.match(before, /^const GAME_SERVER_URL = ''$/m)
    const without = buildItch({outDir: tempDir()})
    assert.match(fs.readFileSync(path.join(without.folder, 'js', 'config.js'), 'utf8'), /^const GAME_SERVER_URL = ''$/m, 'no server given: left empty')
})

test('addresses that are not plain ws:// or wss:// are rejected, including ones that could break out of the string', () => {
    for (const good of ['wss://game.up.railway.app', 'ws://localhost:3000', 'wss://game.example:8443/play']) assert.ok(isValidServerUrl(good), good)
    for (const bad of ['', 'https://x.example', 'game.example', 'wss://', "wss://x.example'+alert(1)+'", 'wss://x.example"; evil()//', 'wss://x\\y.example', 'wss://a b.example', 'wss://x.example?q=1', 'javascript:alert(1)', undefined, 42]) {
        assert.ok(!isValidServerUrl(bad), `${bad} must be rejected`)
    }
    assert.throws(() => buildItch({server: "wss://x.example'+alert(1)+'", outDir: tempDir()}), /not a ws:\/\/ or wss:\/\/ address/)
    assert.throws(() => applyServerUrl('const SOMETHING_ELSE = 1', 'wss://x.example'), /GAME_SERVER_URL/)
})

test('building twice gives byte-identical zips (so a rebuild is easy to compare)', () => {
    const one = fs.readFileSync(buildItch({server: 'wss://a.example', outDir: tempDir()}).zip)
    const two = fs.readFileSync(buildItch({server: 'wss://a.example', outDir: tempDir()}).zip)
    assert.ok(one.equals(two))
})

test('standard tools can open the zip (unzip -t, when it is installed)', t => {
    const probe = spawnSync('unzip', ['-v'])
    if (probe.error) return t.skip('unzip is not installed here')
    const result = buildItch({server: 'wss://a.example', outDir: tempDir()})
    const check = spawnSync('unzip', ['-t', result.zip], {encoding: 'utf8'})
    assert.strictEqual(check.status, 0, check.stdout + check.stderr)
    assert.match(check.stdout, /No errors detected/)
})
