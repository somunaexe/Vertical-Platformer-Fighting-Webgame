// ---- Combat tuning: every number that changes how fights feel lives here ----

const MAX_HEALTH = 100
const HIT_STUN = 0.3            //Seconds a player is stunned (can't act) after being hit
const INVULNERABLE_TIME = 0.5   //Seconds after a hit during which more hits are ignored
const KNOCKBACK_SPEED = 90      //Initial horizontal push in pixels per second; fades out over the stun

/**
 * One entry per attack type.
 * - sound / animation: keys into the player's sounds and animations
 * - damage: health removed on hit
 * - activeFrames: indexes of the animation frames during which the sword can hurt.
 *   Frames before the first active one are "startup" (the wind-up the opponent can react to).
 * - reach: how far in front of the player the attack box extends (world pixels)
 * - offsetY / height: the attack box's vertical position relative to the top of the
 *   attacker's body hitbox, and its height. Negative offsetY means above the head.
 */
const ATTACKS = {
    low:      { sound: 'lowAttack',      animation: 'attackLow',      damage: 10, activeFrames: [2], reach: 24, offsetY: 14,  height: 13 },
    mid:      { sound: 'midAttack',      animation: 'attackMid',      damage: 8,  activeFrames: [1], reach: 24, offsetY: 6,   height: 14 },
    overhead: { sound: 'overheadAttack', animation: 'attackOverhead', damage: 15, activeFrames: [3], reach: 20, offsetY: -12, height: 24 },
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
            && !defender.isDead
            && defender.invulnerableTimer <= 0
            && collision(attacker.attackHitbox(), defender.hitbox)) {
            //Read the damage now: applying the other hit of a trade clears this attacker's currentAttack
            landed.push([attacker, defender, ATTACKS[attacker.currentAttack].damage])
        }
    }

    for (const [attacker, defender, damage] of landed) {
        attacker.attackHasHit = true //One hit per swing
        defender.takeHit(damage, attacker)
    }

    if (p1.isDead || p2.isDead) {
        match.over = true
        match.winner = (p1.isDead && p2.isDead) ? null : (p1.isDead ? p2 : p1)
    }
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
    }
    hud.nameLeft.text = p1.name
    hud.nameRight.text = p2.name
    hud.nameLeft.anchor.set(0, 1)
    hud.nameRight.anchor.set(1, 1)
    hud.title.anchor.set(0.5)
    hud.subtitle.anchor.set(0.5)
    hud.subtitle.text = 'Press Enter for a rematch'
    hudLayer.addChild(hud.graphics, hud.nameLeft, hud.nameRight, hud.title, hud.subtitle)
}

/**
 * Syncs the health bars and the end-of-round banner with the game state.
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
        const ratio = player.health / MAX_HEALTH
        const filled = barWidth * ratio
        const colour = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xe0a020 : 0xd03030
        g.rect(x, barTop, barWidth, barHeight).fill({color: 0x000000, alpha: 0.6})
        g.rect(alignRight ? x + barWidth - filled : x, barTop, filled, barHeight).fill(colour)
        g.rect(x, barTop, barWidth, barHeight).stroke({width: 2, color: 0xffffff})
    }
    drawBar(p1, margin, false)
    drawBar(p2, width - margin - barWidth, true)
    hud.nameLeft.position.set(margin, barTop - 4)
    hud.nameRight.position.set(width - margin, barTop - 4)

    hud.title.visible = hud.subtitle.visible = match.over
    if (match.over) {
        g.rect(0, height / 2 - 70, width, 140).fill({color: 0x000000, alpha: 0.55})
        const message = match.winner ? `${match.winner.name} WINS!` : 'DRAW!'
        if (hud.title.text !== message) hud.title.text = message //Changing text rebuilds its texture, so only when needed
        hud.title.position.set(width / 2, height / 2 - 10)
        hud.subtitle.position.set(width / 2, height / 2 + 35)
    }
}
