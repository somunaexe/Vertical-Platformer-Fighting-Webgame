// ---- Debug view: draws what the game actually collides with ----
// Open the game with ?debug (or press F2 to toggle). It overlays:
//   red     solid blocks (the floor and the ledge)
//   yellow  platform surfaces (you can land on these from above, and jump up through them)
//   green   each player's hitbox (the part that stands on things and gets hit)
//   magenta each sword's reach (bright while it can hurt, dim while winding up)
//   cyan    the door
// If the art and the collision ever disagree, you will see it here at a glance.

const debugView = {
    enabled: new URLSearchParams(location.search).has('debug'),
    statics: null, //Pixi Graphics for the level's fixed collision (drawn once per round)
    live: null,    //Pixi Graphics for things that move (redrawn every frame)
}

/** Creates the overlay for the current round. Called by beginRound(), after the players exist so it draws on top. */
function attachDebugView() {
    debugView.statics = new PIXI.Graphics()
    debugView.live = new PIXI.Graphics()
    for (const block of collisionBlocks) debugView.statics.rect(block.position.x, block.position.y, block.width, block.height).fill({color: 0xff0000, alpha: 0.5})
    for (const block of platformBlocks) debugView.statics.rect(block.position.x, block.position.y, block.width, 3).fill({color: 0xffee00, alpha: 0.95})
    world.addChild(debugView.statics, debugView.live)
    debugView.statics.visible = debugView.live.visible = debugView.enabled
}

/** Removes the overlay (the round is being torn down). */
function detachDebugView() {
    debugView.statics?.destroy()
    debugView.live?.destroy()
    debugView.statics = debugView.live = null
}

/** Redraws the moving parts. Call once per frame. */
function updateDebugView() {
    if (!debugView.live || !debugView.enabled) return
    const g = debugView.live
    g.clear()
    for (const player of activePlayers()) {
        const box = player.hitbox
        g.rect(box.position.x, box.position.y, box.width, box.height).stroke({width: 0.7, color: 0x00ff66})
        if (player.isAttacking) {
            const sword = player.attackHitbox()
            g.rect(sword.position.x, sword.position.y, sword.width, sword.height).stroke({width: 0.7, color: 0xff33ff, alpha: player.isAttackActive() ? 1 : 0.35})
        }
    }
    if (door) g.rect(door.position.x, door.position.y, door.width, door.height).stroke({width: 0.7, color: 0x33ffff})
}

window.addEventListener("keydown", event => {
    if (event.code !== "F2") return
    event.preventDefault()
    debugView.enabled = !debugView.enabled
    if (debugView.statics) debugView.statics.visible = debugView.live.visible = debugView.enabled
})
