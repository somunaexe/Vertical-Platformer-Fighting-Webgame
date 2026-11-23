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
