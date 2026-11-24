// ---- Settings you may need to change when you host the game ----

// Where the online game server lives, as a WebSocket address such as 'wss://your-app.up.railway.app'.
//
// Leave it EMPTY (the default) when the page is served by the game server itself (`npm start`, or the server's own
// address on a host like Railway): the page then connects back to wherever it came from.
//
// Set it when the page is hosted somewhere that can only serve static files, like itch.io or GitHub Pages: the page
// loads from there, but the online game is played on your server. `npm run build:itch` fills this in for you.
// Use wss:// (a page loaded over HTTPS is not allowed to open an insecure ws:// connection).
const GAME_SERVER_URL = ''

/**
 * The WebSocket address the game should connect to.
 * @param {Location} [page=location] - Where this page was loaded from (a parameter so it can be tested)
 * @param {String} [configured=GAME_SERVER_URL] - The setting above
 * @returns {String} e.g. 'wss://your-app.up.railway.app'
 */
function gameServerAddress(page = location, configured = GAME_SERVER_URL) {
    if (configured) {
        // Only a plain ws:// or wss:// address: no spaces, no query string
        if (/^wss?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(configured)) {
            if (page.protocol === 'https:' && configured.startsWith('ws://')) {
                console.warn('This page is secure (https) but GAME_SERVER_URL starts with ws://. Browsers block that; use wss://')
            }
            return configured.replace(/\/$/, '')
        }
        console.error(`GAME_SERVER_URL "${configured}" is not a ws:// or wss:// address, so the page's own host is used instead`)
    }
    return (page.protocol === 'https:' ? 'wss://' : 'ws://') + page.host
}
