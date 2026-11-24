// ---- The game as plain data: what the server sends and the browser applies ----
// A snapshot holds only what is needed to DRAW the game and its HUD, as small JSON-friendly values.
// Both directions live in this one file so the format is defined in a single place:
//   server:  snapshotGame()  ->  JSON  ->  network
//   browser: network  ->  JSON  ->  applyGameSnapshot()
//
// Snapshot shape:
//   { p: [ {x, y, anim, frame, left, inj, inv, flash, gone}, ... ],   one entry per player, in slot order
//     over: Boolean,      the round is finished
//     win: Number }       slot of the winner, or -1 for none / a draw

const roundTo = (value, places) => Math.round(value * 10 ** places) / 10 ** places

/**
 * @param {Player} player
 * @returns {Object} Everything needed to draw this player
 */
function snapshotPlayer(player) {
    return {
        x: roundTo(player.position.x, 2),
        y: roundTo(player.position.y, 2),
        anim: player.animationKey,          //Which animation is playing, by name
        frame: player.currentFrame,         //Which frame of it
        left: player.facingLeft ? 1 : 0,
        inj: roundTo(player.injury, 1),
        inv: player.invulnerableTimer > 0 ? 1 : 0, //Drawn see-through
        flash: player.flashTimer > 0 ? 1 : 0,      //Drawn solid white
        gone: player.departed ? 1 : 0,             //Left the room
    }
}

/** @returns {Object} The whole game's state as plain data */
function snapshotGame() {
    return {
        p: players.map(snapshotPlayer),
        over: match.over,
        win: match.winner ? players.indexOf(match.winner) : -1,
    }
}

/**
 * Makes a player look exactly like a snapshot says. The player is only a puppet here:
 * its own rules are not run, so its position, animation and frame are simply overwritten.
 * @param {Player} player
 * @param {Object} s - One entry of a snapshot's p array
 */
function applyPlayerSnapshot(player, s) {
    player.position.x = s.x
    player.position.y = s.y
    player.facingLeft = s.left === 1
    player.switchSprite(s.anim)  //Does nothing if that animation is already showing
    player.currentFrame = s.frame
    player.injury = s.inj
    player.invulnerableTimer = s.inv ? 1 : 0 //Only "is it > 0" matters when drawing
    player.flashTimer = s.flash ? 1 : 0
    player.updateHitbox()        //The camera and HUD read the hitbox
    player.departed = s.gone === 1
    player.view.visible = !player.departed
    player.draw()                //Puppets never run update(), which is what normally copies their state onto the sprite
}

// Between two snapshots a player never moves more than a few pixels. A bigger jump (a rematch sending
// everyone back to their spawn) is a teleport, and sliding across the level would look wrong.
const NET_LERP_MAX_JUMP = 60

/**
 * Blends two snapshots: positions slide from a to b, everything else (animation, frame, flags, who won)
 * stays as it was in a until b's moment arrives.
 * @param {Object} a - The earlier snapshot
 * @param {Object} b - The later snapshot
 * @param {Number} t - 0 = exactly a, 1 = exactly b
 * @returns {Object} A snapshot in between
 */
function interpolateSnapshots(a, b, t) {
    return {
        p: a.p.map((from, slot) => {
            const to = b.p[slot]
            const sameSpot = to && Math.abs(to.x - from.x) < NET_LERP_MAX_JUMP && Math.abs(to.y - from.y) < NET_LERP_MAX_JUMP
            return sameSpot
                ? {...from, x: roundTo(from.x + (to.x - from.x) * t, 2), y: roundTo(from.y + (to.y - from.y) * t, 2)}
                : from
        }),
        over: a.over,
        win: a.win,
    }
}

/**
 * Applies a whole snapshot to the current players and match.
 * @param {Object} snapshot - What snapshotGame() produced
 */
function applyGameSnapshot(snapshot) {
    snapshot.p.forEach((s, slot) => applyPlayerSnapshot(players[slot], s))
    if (snapshot.over && !match.over) match.overAt = performance.now() //For the tap-to-rematch delay
    match.over = snapshot.over
    match.winner = snapshot.win >= 0 ? players[snapshot.win] : null
}
