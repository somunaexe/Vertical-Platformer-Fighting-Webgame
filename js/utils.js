
/**
 * Checks for collision between player and collision blocks.
 * @param {Object} object1 - The first object to check for collision.
 * @param {Object} object2 - The second object to check for collision.
 * @returns {Boolean} - True if the objects are colliding, false otherwise.
 */
function collision(object1, object2){
    return (
        object1.position.y + object1.height >= object2.position.y && 
        object1.position.y <= object2.position.y + object2.height && 
        object1.position.x + object1.width >= object2.position.x &&
        object1.position.x <= object2.position.x + object2.width
    )
}

// How far (px) below a platform's surface the feet may already be and still count as having been "on top" before a step.
// Absorbs tiny float errors after a landing and a slightly embedded start.
const PLATFORM_FORGIVENESS = 1

/**
 * Does the player land on this one-way platform during the step that just happened?
 *
 * A platform is only 4px thick but a falling player moves 5 to 20+ px per step, so asking "are the feet
 * inside the platform right now?" misses most fast landings (they step from above it to below it without ever
 * being inside). Instead this asks "were the feet above the surface BEFORE the step and at or below it AFTER?".
 * Moving up through it from below never counts (it is one-way).
 * @param {Player} player - Needs hitbox, velocity.y and previousBottom (where the feet were before this step)
 * @param {CollisionBlock} platform
 * @returns {Boolean}
 */
function landsOnPlatform(player, platform) {
    const box = player.hitbox
    return player.velocity.y > 0
        && player.previousBottom <= platform.position.y + PLATFORM_FORGIVENESS
        && box.position.y + box.height >= platform.position.y
        && box.position.x + box.width >= platform.position.x
        && box.position.x <= platform.position.x + platform.width
}
