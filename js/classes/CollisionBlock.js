class CollisionBlock {
    
    /**
     * Creates a new CollisionBlock object.
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

    /**
     * Draws the CollisionBlock on the canvas with a semi-transparent red color.
     * The block is rendered at its position with its specified width and height.
     * Strictly for debugging purposes. Used only in development.
     */
    draw() {
        c.fillStyle = 'rgba(225, 0, 0, 0.5)'
        c.fillRect(this.position.x, this.position.y, this.width, this.height);
    }

    /**
     * Calls the draw method, which is only used in development for debugging.
     */
    update(){
        this.draw()
    }
}