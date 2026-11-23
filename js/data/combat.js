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

/**
 * Draws the health bars and the end-of-round message in screen space
 * (call it after the camera transform has been restored).
 */
function drawHud(p1, p2) {
    const margin = 20
    const barWidth = Math.min(canvas.width * 0.35, 420)
    const barHeight = 22

    const drawBar = (player, x, alignRight) => {
        const ratio = player.health / MAX_HEALTH
        const filled = barWidth * ratio
        c.fillStyle = 'rgba(0, 0, 0, 0.6)'
        c.fillRect(x, margin + 18, barWidth, barHeight)
        c.fillStyle = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#e0a020' : '#d03030'
        c.fillRect(alignRight ? x + barWidth - filled : x, margin + 18, filled, barHeight)
        c.strokeStyle = 'white'
        c.lineWidth = 2
        c.strokeRect(x, margin + 18, barWidth, barHeight)
        c.fillStyle = 'white'
        c.font = 'bold 16px sans-serif'
        c.textAlign = alignRight ? 'right' : 'left'
        c.fillText(player.name, alignRight ? x + barWidth : x, margin + 12)
    }
    drawBar(p1, margin, false)
    drawBar(p2, canvas.width - margin - barWidth, true)

    if (match.over) {
        c.fillStyle = 'rgba(0, 0, 0, 0.55)'
        c.fillRect(0, canvas.height / 2 - 70, canvas.width, 140)
        c.fillStyle = 'white'
        c.textAlign = 'center'
        c.font = 'bold 48px sans-serif'
        c.fillText(match.winner ? `${match.winner.name} WINS!` : 'DRAW!', canvas.width / 2, canvas.height / 2 + 5)
        c.font = '20px sans-serif'
        c.fillText('Press Enter for a rematch', canvas.width / 2, canvas.height / 2 + 45)
    }
}
