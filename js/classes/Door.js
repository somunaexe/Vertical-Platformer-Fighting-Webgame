/**
 * The goal of the race: the first player to touch the door wins the round.
 * Its position and size are in world pixels, just like players and collision blocks,
 * so it can be tested with the same collision() helper.
 * The art is a placeholder drawn with Pixi Graphics until a real door sprite exists.
 */
class Door {
    /**
     * @param {Object} options
     * @param {Object} options.position - Top-left corner in world pixels
     * @param {Number} [options.width=24]
     * @param {Number} [options.height=36]
     */
    constructor({position, width = 24, height = 36}) {
        this.position = position
        this.width = width
        this.height = height

        // Frame, dark doorway, and a gold knob
        const art = new PIXI.Graphics()
        art.roundRect(0, 0, width, height, 4).fill(0x6b4423)
        art.roundRect(3, 3, width - 6, height - 3, 3).fill(0x1b1008)
        art.circle(width - 8, height / 2 + 2, 1.6).fill(0xf2c14e)
        art.position.set(position.x, position.y)
        world.addChild(art)
        this.view = art
    }

    /**
     * @param {Player} player
     * @returns {Boolean} True while the player's body overlaps the door
     */
    isReachedBy(player) {
        return collision(player.hitbox, this)
    }
}
