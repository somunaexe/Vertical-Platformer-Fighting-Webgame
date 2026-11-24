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
        button('Training: play against the computer', () => showTrainingMenu()),
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

const TRAINING_LEVELS = [
    ['dummy', 'Dummy', 'Stands still: practise your attacks'],
    ['easy', 'Easy', 'Slow and hesitant'],
    ['normal', 'Normal', 'A fair race and a fair fight'],
    ['hard', 'Hard', 'Quick, aggressive, and it heals when hurt'],
]

/** Picks the computer opponent's difficulty. */
function showTrainingMenu() {
    show('training',
        element('h1', '', 'Training'),
        element('p', 'menu-tagline', 'You are Player 1. The computer follows exactly the same rules you do.'),
        element('p', 'menu-controls', 'Move A / D, jump W, attack X / C / V (the arrow keys and I / O / P work too). On a phone, use the buttons.'),
        ...TRAINING_LEVELS.map(([level, name, blurb]) => button(`${name}: ${blurb}`, () => startTraining(level), level === 'normal' ? 'primary' : '')),
        button('Back', () => showMainMenu()),
    )
}

/**
 * Starts a local round against the computer: you are player 1, it plays player 2.
 * No network is involved.
 * @param {String} level - A key of AI_LEVELS
 */
function startTraining(level) {
    menu.root.hidden = true
    menu.leave.hidden = false
    beginRound(2)
    training.active = true
    training.level = level
    players[1].name = level === 'dummy' ? 'DUMMY' : `AI (${level.toUpperCase()})`
    aiControllers.push(createAiController({slot: 1, level, seed: Date.now() % 1_000_000})) //A different game each time
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
