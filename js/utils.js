
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

/**
 * Checks for collision between a player and platform collision blocks.
 * @param {Object} params - An object containing the collision objects.
 * @param {Object} params.object1 - The first object to check for collision.
 * @param {Object} params.object2 - The second object to check for collision.
 * @returns {Boolean} - True if the objects are colliding on the platform, false otherwise.
 */
function platformCollision({object1, object2}){
    return (
        object1.position.y + object1.height >= object2.position.y && 
        object1.position.y + object1.height <= object2.position.y + object2.height && 
        object1.position.x + object1.width >= object2.position.x &&
        object1.position.x <= object2.position.x + object2.width
    )
}