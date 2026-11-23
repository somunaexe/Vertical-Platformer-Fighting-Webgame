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
    match.winner = arrived.length === 1 ? arrived[0] : null
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
 * Checks both players' attacks for hits this frame and applies damage.
 * Both hits are worked out BEFORE either is applied, so two simultaneous hits trade
 * instead of the player processed first winning automatically.
 * @param {Player} p1
 * @param {Player} p2
 */
function resolveCombat(p1, p2) {
    if (match.over) return

    const landed = []
    for (const [attacker, defender] of [[p1, p2], [p2, p1]]) {
        if (attacker.isAttackActive()
            && defender.invulnerableTimer <= 0
            && collision(attacker.attackHitbox(), defender.hitbox)) {
            //Read the injury now: applying the other hit of a trade clears this attacker's currentAttack
            landed.push([attacker, defender, ATTACKS[attacker.currentAttack].injury])
        }
    }

    for (const [attacker, defender, injury] of landed) {
        attacker.attackHasHit = true //One hit per swing
        const contact = contactPoint(attacker.attackHitbox(), defender.hitbox) //Measured before the hit changes anything
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

// Pixi objects for the HUD, created on the first updateHud() call
let hud = null

function createHud(p1, p2) {
    const text = (size, weight) => new PIXI.Text({
        text: '',
        style: {fontFamily: 'sans-serif', fontSize: size, fontWeight: weight, fill: 0xffffff},
    })
    hud = {
        graphics: new PIXI.Graphics(), //Bars and the banner background, redrawn every frame
        nameLeft: text(16, 'bold'),
        nameRight: text(16, 'bold'),
        title: text(48, 'bold'),
        subtitle: text(20, 'normal'),
        captionLeft: text(12, 'normal'),
        captionRight: text(12, 'normal'),
    }
    hud.nameLeft.text = p1.name
    hud.nameRight.text = p2.name
    hud.nameLeft.style.fill = p1.color
    hud.nameRight.style.fill = p2.color
    hud.nameLeft.anchor.set(0, 1)
    hud.nameRight.anchor.set(1, 1)
    hud.captionLeft.text = hud.captionRight.text = 'INJURY'
    hud.captionLeft.anchor.set(0, 0)
    hud.captionRight.anchor.set(1, 0)
    hud.title.anchor.set(0.5)
    hud.subtitle.anchor.set(0.5)
    hud.subtitle.text = 'Press Enter for a rematch'
    hudLayer.addChild(hud.graphics, hud.nameLeft, hud.nameRight, hud.captionLeft, hud.captionRight, hud.title, hud.subtitle)
}

/**
 * Syncs the injury bars and the end-of-round banner with the game state.
 * Lives in screen space (hudLayer), so it ignores the camera. Call once per frame.
 */
function updateHud(p1, p2) {
    if (!hud) createHud(p1, p2)

    const width = app.screen.width
    const height = app.screen.height
    const margin = 20
    const barWidth = Math.min(width * 0.35, 420)
    const barHeight = 22
    const barTop = margin + 18

    const g = hud.graphics
    g.clear()
    const drawBar = (player, x, alignRight) => {
        const ratio = player.injury / MAX_INJURY //0 = fresh, 1 = badly injured
        const filled = barWidth * ratio
        const colour = ratio < 0.5 ? 0x4caf50 : ratio < 0.75 ? 0xe0a020 : 0xd03030
        g.rect(x, barTop, barWidth, barHeight).fill({color: 0x000000, alpha: 0.6})
        g.rect(alignRight ? x + barWidth - filled : x, barTop, filled, barHeight).fill(colour)
        g.rect(x, barTop, barWidth, barHeight).stroke({width: 2, color: 0xffffff})
    }
    drawBar(p1, margin, false)
    drawBar(p2, width - margin - barWidth, true)
    hud.nameLeft.position.set(margin, barTop - 4)
    hud.nameRight.position.set(width - margin, barTop - 4)
    hud.captionLeft.position.set(margin, barTop + barHeight + 3)
    hud.captionRight.position.set(width - margin, barTop + barHeight + 3)

    // Race progress: a vertical track with the door at the top and a coloured dot per player
    const trackX = width - 24
    const trackTop = barTop + barHeight + 40
    const trackBottom = height - 30
    g.roundRect(trackX - 2, trackTop, 4, trackBottom - trackTop, 2).fill({color: 0xffffff, alpha: 0.35})
    g.roundRect(trackX - 7, trackTop - 14, 14, 14, 3).fill(0xf2c14e) //The door
    ;[p1, p2].forEach((player, i) => {
        const y = trackBottom - raceProgress(player) * (trackBottom - trackTop)
        const x = trackX + (i === 0 ? -11 : 11) //Side by side so two players at the same height don't hide each other
        g.circle(x, y, 7).fill(player.color).stroke({width: 2, color: 0xffffff})
    })

    hud.title.visible = hud.subtitle.visible = match.over
    if (match.over) {
        g.rect(0, height / 2 - 70, width, 140).fill({color: 0x000000, alpha: 0.55})
        const message = match.winner ? `${match.winner.name} WINS!` : 'DRAW!'
        if (hud.title.text !== message) hud.title.text = message //Changing text rebuilds its texture, so only when needed
        hud.title.position.set(width / 2, height / 2 - 10)
        hud.subtitle.position.set(width / 2, height / 2 + 35)
    }
}
