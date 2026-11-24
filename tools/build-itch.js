// ---- Builds the files to upload to itch.io (or any static host) ----
//   npm run build:itch -- --server=wss://your-app.up.railway.app
//
// itch.io can only serve static files, so the online game runs on YOUR server (for example on Railway) and the page
// has to know its address. This copies exactly the files the game needs at runtime, writes your server's address into
// the copy of js/config.js, and zips the result with index.html at the top level (itch.io needs that).
//
// Output (the dist/ folder is not committed):
//   dist/itch/                  the files, if you want to try them locally first
//   dist/swordfighter-itch.zip  the file to upload
// The zip is written by plain Node code, so this works the same on Windows, macOS and Linux and needs no zip command.

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const ROOT = path.join(__dirname, '..')
// The same public files the game server serves (see server/server.js). The Tiled editor files (.tmx, .tsx) are
// skipped: the game never loads them, only the images next to them.
const ROOT_FILES = ['index.html', 'index.css', 'index.js']
const FOLDERS = ['js', 'assets']
const skip = name => name === '.DS_Store' || /\.(tmx|tsx)$/.test(name)

/** @returns {String[]} Every file under a folder, as '/'-separated paths relative to the project root, sorted */
function listFiles(folder) {
    const found = []
    for (const entry of fs.readdirSync(path.join(ROOT, folder), {withFileTypes: true})) {
        const relative = `${folder}/${entry.name}`
        if (entry.isDirectory()) found.push(...listFiles(relative))
        else if (!skip(entry.name)) found.push(relative)
    }
    return found.sort()
}

/** Writes the game server's address into js/config.js's source. Throws if the setting line can't be found (so the two can't drift apart silently). */
function applyServerUrl(configSource, serverUrl) {
    const setting = /^const GAME_SERVER_URL = .*$/m
    if (!setting.test(configSource)) throw new Error("Couldn't find the GAME_SERVER_URL line in js/config.js")
    return configSource.replace(setting, `const GAME_SERVER_URL = ${JSON.stringify(serverUrl)}`)
}

/** Only a plain wss:// (or ws://) address is accepted. */
function isValidServerUrl(url) {
    return typeof url === 'string' && /^wss?:\/\/[^\s/?#'"\\]+(\/[^\s?#'"\\]*)?$/.test(url)
}

// ---- A small ZIP writer (the format is simple: each file, then a directory of the files, then an end marker) ----
const CRC_TABLE = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
function crc32(buffer) {
    let crc = 0xFFFFFFFF
    for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
    return (crc ^ 0xFFFFFFFF) >>> 0
}
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1 //Every file is stamped 2024-01-01 00:00, so building twice gives byte-identical zips

/**
 * @param {{name: string, data: Buffer}[]} files - names use '/' and no leading slash
 * @returns {Buffer} A zip archive
 */
function makeZip(files) {
    const parts = [], directory = []
    let offset = 0
    for (const {name, data} of files) {
        const nameBytes = Buffer.from(name, 'utf8')
        const deflated = zlib.deflateRawSync(data, {level: 9})
        const useDeflate = deflated.length < data.length //Already-compressed files (png, mp3) are stored as they are
        const body = useDeflate ? deflated : data
        const method = useDeflate ? 8 : 0
        const crc = crc32(data)
        const local = Buffer.alloc(30)
        local.writeUInt32LE(0x04034b50, 0)    //Local file header signature
        local.writeUInt16LE(20, 4)            //Version needed to extract
        local.writeUInt16LE(0x0800, 6)        //Flags: the name is UTF-8
        local.writeUInt16LE(method, 8)
        local.writeUInt16LE(0, 10)            //Time
        local.writeUInt16LE(DOS_DATE, 12)
        local.writeUInt32LE(crc, 14)
        local.writeUInt32LE(body.length, 18)
        local.writeUInt32LE(data.length, 22)
        local.writeUInt16LE(nameBytes.length, 26)
        local.writeUInt16LE(0, 28)            //No extra field
        parts.push(local, nameBytes, body)
        const entry = Buffer.alloc(46)
        entry.writeUInt32LE(0x02014b50, 0)    //Central directory header signature
        entry.writeUInt16LE(20, 4)            //Made by
        entry.writeUInt16LE(20, 6)            //Needed to extract
        entry.writeUInt16LE(0x0800, 8)
        entry.writeUInt16LE(method, 10)
        entry.writeUInt16LE(0, 12)
        entry.writeUInt16LE(DOS_DATE, 14)
        entry.writeUInt32LE(crc, 16)
        entry.writeUInt32LE(body.length, 20)
        entry.writeUInt32LE(data.length, 24)
        entry.writeUInt16LE(nameBytes.length, 28)
        entry.writeUInt32LE(offset, 42)       //Where this file's local header starts
        directory.push(entry, nameBytes)
        offset += local.length + nameBytes.length + body.length
    }
    const directoryBytes = Buffer.concat(directory)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)          //End of central directory signature
    end.writeUInt16LE(files.length, 8)
    end.writeUInt16LE(files.length, 10)
    end.writeUInt32LE(directoryBytes.length, 12)
    end.writeUInt32LE(offset, 16)
    return Buffer.concat([...parts, directoryBytes, end])
}

/**
 * Builds the upload.
 * @param {Object} options
 * @param {String} [options.server] - The game server's address (wss://...). Without it, only Training and local play work on itch.io.
 * @param {String} [options.outDir] - Where to write (default dist/ in the project)
 * @returns {{folder: string, zip: string, files: number, zipBytes: number}}
 */
function buildItch({server = '', outDir = path.join(ROOT, 'dist')} = {}) {
    if (server && !isValidServerUrl(server)) throw new Error(`"${server}" is not a ws:// or wss:// address (for example wss://your-app.up.railway.app)`)
    const names = [...ROOT_FILES, ...FOLDERS.flatMap(listFiles)]
    const files = names.map(name => {
        let data = fs.readFileSync(path.join(ROOT, name))
        if (name === 'js/config.js' && server) data = Buffer.from(applyServerUrl(data.toString('utf8'), server.replace(/\/$/, '')))
        return {name, data}
    })
    const folder = path.join(outDir, 'itch')
    fs.rmSync(folder, {recursive: true, force: true})
    for (const {name, data} of files) {
        fs.mkdirSync(path.dirname(path.join(folder, name)), {recursive: true})
        fs.writeFileSync(path.join(folder, name), data)
    }
    const zip = path.join(outDir, 'swordfighter-itch.zip')
    const zipData = makeZip(files)
    fs.writeFileSync(zip, zipData)
    return {folder, zip, files: files.length, zipBytes: zipData.length}
}

module.exports = {buildItch, makeZip, crc32, applyServerUrl, isValidServerUrl, listFiles}

if (require.main === module) {
    const argument = process.argv.find(a => a.startsWith('--server='))
    const server = argument ? argument.slice('--server='.length) : (process.env.GAME_SERVER_URL || '')
    try {
        const result = buildItch({server})
        const relative = p => path.relative(process.cwd(), p)
        console.log(`Built ${result.files} files (${(result.zipBytes / 1048576).toFixed(1)} MB zipped).`)
        console.log(`  Upload this to itch.io: ${relative(result.zip)}`)
        console.log(`  Or try it first:        ${relative(result.folder)}  (serve that folder, e.g. python3 -m http.server)`)
        console.log(server
            ? `  Online play will connect to: ${server}`
            : '  No server address given: Quick match and private rooms will NOT work on itch.io (Training and Play locally will).\n  Add one with: npm run build:itch -- --server=wss://your-app.up.railway.app')
    } catch (error) {
        console.error(`Build failed: ${error.message}`)
        process.exit(1)
    }
}
