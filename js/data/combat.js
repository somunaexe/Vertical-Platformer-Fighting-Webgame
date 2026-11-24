// ---- Combat tuning: every number that changes how fights feel lives here ----

const MAX_INJURY = 100          //Injury is capped here. Nobody dies: it only makes you weaker
// How much injury weakens a player. Each floor is the fraction of normal ability left at MAX_INJURY.
const INJURY_SPEED_FLOOR = 0.5  //Walking at max injury: half speed
// Jump HEIGHT grows with the square of take-off speed (h = v^2 / 2g), so 0.8 here means a jump
// reaches 0.8^2 = 64% as high. A lower floor would leave injured players unable to reach the next platform.
const INJURY_JUMP_FLOOR = 0.8
// Injury heals on its own, slowly. Standing still heals faster, so resting costs time but pays off.
const RECOVERY_RATE = 2             //Injury points healed per second while moving
const RESTING_RECOVERY_MULTIPLIER = 2.5 //Healing speed-up while standing still on the ground
const LAND_EVENT_MIN_SPEED = 110 //Slowest downward speed (px/s) that counts as a landing worth announcing (a ~11px fall)
const FLASH_TIME = 0.1         //Seconds a player is drawn solid white after being hit
const HIT_STUN = 0.3            //Seconds a player is stunned (can't act) after being hit
const INVULNERABLE_TIME = 0.5   //Seconds after a hit during which more hits are ignored
// Knockback is the main weapon in a race: with no death, sending someone off a ledge is how you win time.
const KNOCKBACK_SPEED = 170     //Initial horizontal push in pixels per second; fades out over the stun
const KNOCKBACK_POP = 120       //Upward kick in pixels per second, so a hit launches the victim off the platform

/**
 * One entry per attack type.
 * - sound / animation: keys into the player's sounds and animations
 * - injury: how much injury a hit adds to the victim
 * - activeFrames: indexes of the animation frames during which the sword can hurt.
 *   Frames before the first active one are "startup" (the wind-up the opponent can react to).
 * - reach: how far in front of the player the attack box extends (world pixels)
 * - offsetY / height: the attack box's vertical position relative to the top of the
 *   attacker's body hitbox, and its height. Negative offsetY means above the head.
 */
const ATTACKS = {
    low:      { sound: 'lowAttack',      animation: 'attackLow',      injury: 10, activeFrames: [2], reach: 24, offsetY: 14,  height: 13 },
    mid:      { sound: 'midAttack',      animation: 'attackMid',      injury: 8,  activeFrames: [1], reach: 24, offsetY: 6,   height: 14 },
    overhead: { sound: 'overheadAttack', animation: 'attackOverhead', injury: 15, activeFrames: [3], reach: 20, offsetY: -12, height: 24 },
}

// State of the current round
const match = {
    over: false,
    overAt: 0,    //When the round ended (performance.now() ms); used to delay tap-to-rematch
    winner: null, //The winning Player, or null for a draw (only meaningful when over is true)
}

/**
 * Ends the round when a player reaches the door. If several arrive on the same frame it's a draw.
 * @param {Player[]} players
 * @param {Door} door
 */
function checkDoorWin(players, door) {
    if (match.over) return
    const arrived = players.filter(player => door.isReachedBy(player))
    if (arrived.length === 0) return
    match.over = true
    match.overAt = performance.now()
    match.winner = arrived.length === 1 ? arrived[0] : null
    GameEvents.emit('win', {winner: match.winner, x: door.position.x + door.width / 2, y: door.position.y + door.height / 2})
}

/**
 * The middle of the area where two rectangles overlap: where a sword actually met a body.
 * @returns {{x: number, y: number}} World pixels
 */
function contactPoint(a, b) {
    const left = Math.max(a.position.x, b.position.x)
    const right = Math.min(a.position.x + a.width, b.position.x + b.width)
    const top = Math.max(a.position.y, b.position.y)
    const bottom = Math.min(a.position.y + a.height, b.position.y + b.height)
    return {x: (left + right) / 2, y: (top + bottom) / 2}
}

/**
 * Checks every player's attack against every other player and applies the hits that land.
 * All hits are worked out BEFORE any is applied, so simultaneous hits trade instead of whoever
 * is processed first winning automatically. That also means everything a hit needs (its injury and
 * contact point) is read up front: applying one hit clears the victim's own current attack.
 * A single swing can hit several players standing in front of it.
 * @param {Player[]} players
 */
function resolveCombat(players) {
    if (match.over) return

    const landed = []
    for (const attacker of players) {
        if (!attacker.isAttackActive()) continue
        const swordBox = attacker.attackHitbox()
        const injury = ATTACKS[attacker.currentAttack].injury
        for (const defender of players) {
            if (defender === attacker || defender.invulnerableTimer > 0) continue
            if (collision(swordBox, defender.hitbox)) {
                landed.push({attacker, defender, injury, contact: contactPoint(swordBox, defender.hitbox)})
            }
        }
    }

    for (const {attacker, defender, injury, contact} of landed) {
        attacker.attackHasHit = true //One swing; it cannot land again
        defender.takeHit(injury, attacker)
        GameEvents.emit('hit', {attacker, victim: defender, injury, direction: defender.knockbackDirection, ...contact})
    }
}

/**
 * How far up the level a player has climbed: 0 at the ground, 1 at the door's platform.
 * @param {Player} player
 */
function raceProgress(player) {
    const groundY = MAP_HEIGHT - 2 * TILE //Top of the solid floor (row 25 of the map)
    const doorFeetY = door.position.y + door.height
    const bodyBottom = player.hitbox.position.y + player.hitbox.height
    return Math.min(1, Math.max(0, (groundY - bodyBottom) / (groundY - doorFeetY)))
}

// Which slot is "me" when playing online (set by the networking code); null in local play
let localSlot = null

// Pixi objects for the HUD, created on the first updateHud() call
let hud = null

function createHud() {
    const text = (size, weight, fill = 0xffffff) => new PIXI.Text({
        text: '',
        style: {fontFamily: 'sans-serif', fontSize: size, fontWeight: weight, fill},
    })
    hud = {
        graphics: new PIXI.Graphics(), //Bars, track and banner background, redrawn every frame
        nameLeft: text(16, 'bold'),
        nameRight: text(16, 'bold'),
        title: text(48, 'bold'),
        subtitle: text(20, 'normal'),
        captionLeft: text(12, 'normal'),
        captionRight: text(12, 'normal'),
        plates: [], //One small label per player slot, created as needed
    }
    hud.nameLeft.anchor.set(0, 1)
    hud.nameRight.anchor.set(1, 1)
    hud.captionLeft.text = hud.captionRight.text = 'INJURY'
    hud.captionLeft.anchor.set(0, 0)
    hud.captionRight.anchor.set(1, 0)
    hud.title.anchor.set(0.5)
    hud.subtitle.anchor.set(0.5)
    hud.subtitle.text = (typeof TOUCH_MODE !== 'undefined' && TOUCH_MODE) ? 'Tap to play again' : 'Press Enter for a rematch'
    hudLayer.addChild(hud.graphics, hud.nameLeft, hud.nameRight, hud.captionLeft, hud.captionRight, hud.title, hud.subtitle)
}

/** The small label that floats above a player; created the first time it is needed. */
function plateFor(slot, player) {
    if (!hud.plates[slot]) {
        const label = new PIXI.Text({text: '', style: {fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold', fill: player.color, stroke: {color: 0x000000, width: 3}}})
        label.anchor.set(0.5, 1)
        hudLayer.addChild(label)
        hud.plates[slot] = label
    }
    return hud.plates[slot]
}

/** Sets a Pixi Text's string only when it changed (changing it rebuilds the texture). */
function setText(label, value) {
    if (label.text !== value) label.text = value
}

/**
 * Syncs the HUD with the game state. Lives in screen space (hudLayer), so it ignores the camera.
 * - Big injury bars: you (online), or both players in a two-player local game.
 * - A small label and injury bar floating above every fighter whenever there are more than two,
 *   or when playing online, so you can always tell who is who and how hurt they are.
 * - A progress track with a coloured dot per player, and the end-of-round banner.
 * @param {Player[]} all - Every player, in slot order
 */
function updateHud(all) {
    if (!hud) createHud()

    const width = app.screen.width
    const height = app.screen.height
    // Everything scales with the screen's SHORT side so the HUD fits phones (ui = 1 on a desktop, 0.6 at smallest)
    const ui = Math.min(1, Math.max(0.6, Math.min(width, height) / 640))
    const touch = typeof TOUCH_MODE !== 'undefined' && TOUCH_MODE
    const margin = 20 * ui
    const barWidth = Math.min(width * 0.35, 420)
    const barHeight = 22 * ui
    const barTop = margin + 18 * ui
    for (const label of [hud.nameLeft, hud.nameRight, hud.captionLeft, hud.captionRight, hud.title, hud.subtitle]) label.scale.set(ui)
    const active = all.filter(player => !player.departed)

    const g = hud.graphics
    g.clear()

    // Big bars: the local player alone online, otherwise both players of a two-player game (or just the first in a crowd)
    const barPlayers = localSlot !== null ? [all[localSlot]] : (all.length <= 2 ? all : [all[0]])
    const drawBar = (player, x, alignRight) => {
        const ratio = player.injury / MAX_INJURY //0 = fresh, 1 = badly injured
        const filled = barWidth * ratio
        const colour = ratio < 0.5 ? 0x4caf50 : ratio < 0.75 ? 0xe0a020 : 0xd03030
        g.rect(x, barTop, barWidth, barHeight).fill({color: 0x000000, alpha: 0.6})
        g.rect(alignRight ? x + barWidth - filled : x, barTop, filled, barHeight).fill(colour)
        g.rect(x, barTop, barWidth, barHeight).stroke({width: 2 * ui, color: 0xffffff})
    }
    const label = player => player.name + (localSlot !== null && player === all[localSlot] ? ' (YOU)' : '')
    hud.nameLeft.visible = hud.captionLeft.visible = barPlayers.length > 0
    hud.nameRight.visible = hud.captionRight.visible = barPlayers.length > 1
    if (barPlayers[0]) {
        drawBar(barPlayers[0], margin, false)
        setText(hud.nameLeft, label(barPlayers[0]))
        hud.nameLeft.style.fill = barPlayers[0].color
    }
    if (barPlayers[1]) {
        drawBar(barPlayers[1], width - margin - barWidth, true)
        setText(hud.nameRight, label(barPlayers[1]))
        hud.nameRight.style.fill = barPlayers[1].color
    }
    hud.nameLeft.position.set(margin, barTop - 4 * ui)
    hud.nameRight.position.set(width - margin, barTop - 4 * ui)
    hud.captionLeft.position.set(margin, barTop + barHeight + 3 * ui)
    hud.captionRight.position.set(width - margin, barTop + barHeight + 3 * ui)

    // Floating labels with a mini injury bar above each fighter's head (projected from the world to the screen)
    const showPlates = all.length > 2 || localSlot !== null
    all.forEach((player, slot) => {
        const plate = plateFor(slot, player)
        plate.visible = showPlates && !player.departed
        if (!plate.visible) return
        setText(plate, slot === localSlot ? 'YOU' : `P${slot + 1}`)
        plate.scale.set(ui)
        const x = world.position.x + (player.hitbox.position.x + player.hitbox.width / 2) * camera.zoom
        const headY = world.position.y + player.hitbox.position.y * camera.zoom - 10 * ui
        plate.position.set(x, headY - 6 * ui)
        const w = 34 * ui, h = 4 * ui
        const ratio = player.injury / MAX_INJURY
        g.rect(x - w / 2, headY - h / 2, w, h).fill({color: 0x000000, alpha: 0.65})
        g.rect(x - w / 2, headY - h / 2, w * ratio, h).fill(ratio < 0.5 ? 0x4caf50 : ratio < 0.75 ? 0xe0a020 : 0xd03030)
    })

    // Race progress: a vertical track with the door at the top and a coloured dot per player
    const trackX = width - 24 * ui
    const trackTop = barTop + barHeight + 40 * ui
    //On touch screens the buttons fill the bottom corner, so the track ends above them
    const trackBottom = height - (touch ? 125 : 30 * ui)
    g.roundRect(trackX - 2 * ui, trackTop, 4 * ui, trackBottom - trackTop, 2 * ui).fill({color: 0xffffff, alpha: 0.35})
    g.roundRect(trackX - 7 * ui, trackTop - 14 * ui, 14 * ui, 14 * ui, 3 * ui).fill(0xf2c14e) //The door
    active.forEach(player => {
        const slot = all.indexOf(player)
        const y = trackBottom - raceProgress(player) * (trackBottom - trackTop)
        //Three columns, so players at the same height don't hide each other
        const x = trackX + ((slot % 3) - 1) * 11 * ui
        g.circle(x, y, (slot === localSlot ? 8 : 6) * ui).fill(player.color).stroke({width: 2 * ui, color: 0xffffff})
    })

    hud.title.visible = hud.subtitle.visible = match.over
    if (match.over) {
        g.rect(0, height / 2 - 70 * ui, width, 140 * ui).fill({color: 0x000000, alpha: 0.55})
        const message = match.winner ? `${match.winner.name} WINS!` : 'DRAW!'
        setText(hud.title, message)
        hud.title.position.set(width / 2, height / 2 - 10 * ui)
        hud.subtitle.position.set(width / 2, height / 2 + 35 * ui)
    }
}
