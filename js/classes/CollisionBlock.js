class CollisionBlock {

    /**
     * Creates a new CollisionBlock object. Blocks are invisible: the level art is the background image.
     * @param {Object} options - Object containing properties for the CollisionBlock
     * @param {Object} options.position - The position of the CollisionBlock
     * @param {Number} [options.width=16] - The width of the CollisionBlock
     * @param {Number} [options.height=16] - The height of the CollisionBlock
     */
    constructor({position, width = 16, height = 16}) {
        this.position = position
        this.width = width
        this.height = height
    }
}
