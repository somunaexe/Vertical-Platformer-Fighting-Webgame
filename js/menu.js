// ---- The front door: main menu, lobby and in-game "Leave" button ----
// Plain HTML laid over the canvas. It drives js/net.js (online) or starts a local round.

const MENU_MESSAGES = {
    'no-such-room': 'No room with that code.',
    'bad-code': 'Room codes are 4 letters or numbers.',
    'started': 'That game has already started.',
    'full': 'That room is full (12 players).',
    'server-busy': 'The server is full right now. Try again in a moment.',
    'bad-request': 'Something went wrong. Try again.',
    'all-left': 'Everyone else left the race.',
    'unreachable': 'Could not reach the game server. Online play needs the Node server (npm start).',
    'disconnected': 'Lost the connection to the server.',
}

const menu = {
    root: null,     //The overlay element
    body: null,     //Where the current screen is drawn
    leave: null,    //The small in-game Leave button
    screen: 'main',
}

/** Creates an element with optional class and text. */
function element(tag, className = '', text = '') {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text) node.textContent = text
    return node
}

function button(label, onClick, className = '') {
    const node = element('button', 'menu-button ' + className, label)
    node.addEventListener('click', onClick)
    return node
}

/** Builds the overlay once and wires the network callbacks. */
function createMenu() {
    menu.root = element('div')
    menu.root.id = 'menu'
    menu.body = element('div', 'menu-card')
    menu.root.append(menu.body)

    menu.leave = button('Leave', () => showMainMenu(), 'leave-button')
    menu.leave.hidden = true

    document.body.append(menu.root, menu.leave)

    net.handlers.lobby = showLobby
    net.handlers.start = () => { menu.root.hidden = true; menu.leave.hidden = false }
    net.handlers.left = slot => toast(`PLAYER ${slot + 1} left`)
    net.handlers.ended = reason => showMainMenu(MENU_MESSAGES[reason] || 'The game ended.')
    net.handlers.error = reason => showMainMenu(MENU_MESSAGES[reason] || 'Could not join.')
    net.handlers.closed = () => { if (menu.screen !== 'main') showMainMenu(MENU_MESSAGES.disconnected) }
}

/** Shows a short message that fades away by itself. */
function toast(text) {
    const node = element('div', 'toast', text)
    document.body.append(node)
    setTimeout(() => node.remove(), 2500)
}

function show(screen, ...children) {
    menu.screen = screen
    menu.root.hidden = false
    menu.leave.hidden = true
    menu.body.replaceChildren(...children)
}

function showMainMenu(notice = '') {
    leaveOnline()
    const code = element('input', 'menu-input')
    code.placeholder = 'CODE'
    code.maxLength = 4
    code.autocapitalize = 'characters'
    code.autocomplete = 'off'
    code.spellcheck = false
    const join = () => joinOnline({mode: 'code', code: code.value})
    code.addEventListener('keydown', event => { if (event.key === 'Enter') join() })
    stopGameKeys(code)
    const joinRow = element('div', 'menu-row')
    joinRow.append(code, button('Join', join))

    show('main',
        element('h1', '', 'Swordfighter'),
        element('p', 'menu-tagline', 'Race to the door. Fight on the way up. Up to 12 players.'),
        notice ? element('p', 'menu-notice', notice) : '',
        button('Quick match', () => joinOnline({mode: 'quick'}), 'primary'),
        button('Create private room', () => joinOnline({mode: 'create'})),
        joinRow,
        button('Play locally (2 players, one keyboard)', () => startLocal()),
    )
}

/** Keys typed into the menu's text box must not be mistaken for game controls (W, A, S, D ...). */
function stopGameKeys(input) {
    for (const type of ['keydown', 'keyup']) input.addEventListener(type, event => event.stopPropagation())
}

function startLocal(count = 2) {
    menu.root.hidden = true
    menu.leave.hidden = false //Lets you get back to the menu
    beginRound(count)
}

/** Connects and joins; shows progress, and an explanation if the server can't be reached. */
function joinOnline(request) {
    show('connecting', element('h1', '', 'Connecting...'))
    connectOnline(request).catch(() => showMainMenu(MENU_MESSAGES.unreachable))
}

/** Draws the waiting room from the server's lobby message. */
function showLobby(info) {
    const link = `${location.origin}${location.pathname}?room=${info.code}`
    const status = info.count < 2
        ? 'Waiting for more players...'
        : info.startsIn !== null
            ? `Starting in ${Math.ceil(info.startsIn / 1000)}s, or when the host starts it`
            : info.host ? 'Ready when you are' : 'Waiting for the host to start...'

    const copy = button('Copy invite link', () => {
        navigator.clipboard?.writeText(link).then(() => { copy.textContent = 'Copied!' }, () => { copy.textContent = link })
    })
    const start = button('Start game', netStart, 'primary')
    start.disabled = info.count < 2
    show('lobby',
        element('h1', '', info.isPublic ? 'Quick match' : 'Private room'),
        element('p', 'menu-tagline', info.isPublic ? 'Players are matched automatically' : 'Share the code with your friends'),
        element('div', 'room-code', info.code),
        element('p', 'lobby-count', `${info.count} / ${info.max} players`),
        element('p', 'menu-notice', status),
        info.host ? start : '',
        copy,
        button('Leave', () => showMainMenu()),
    )
}
