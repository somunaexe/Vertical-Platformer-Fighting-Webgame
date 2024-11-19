class Player extends Sprite {
    constructor({imageSrc, position, velocity, collisionBlocks, frames}) {
        super({imageSrc, position, frames})
        this.velocity = velocity;
        this.collisionBlocks = collisionBlocks
        this.frames = frames
    }

    update() {
        this.updateFrames()
        c.fillStyle = 'rgba(255, 0, 255, 0.5)'
        c.fillRect(this.position.x, this.position.y, this.width, this.height);
        this.draw()
        this.position.x += this.velocity.x;
        this.checkForHorizontalCollisions()
        this.applyGravity()
        this.checkForVerticalCollisions()
    }

    checkForHorizontalCollisions() {
        for (let i =0; i < this.collisionBlocks.length; i++) {
            const block = this.collisionBlocks[i]

            if(collision(this, block)){
                console.log("collided")
                if(this.velocity.x < 0) {
                    this.velocity.x = 0
                    this.position.x = block.position.x + block.width + 0.01
                    break
                }
                if(this.velocity.x > 0) {
                    this.velocity.x = 0
                    this.position.x = block.position.x - this.width - 0.01
                    break
                }
            }
        }
    }

    applyGravity() {
        this.position.y += this.velocity.y;
        this.velocity.y += gravity
    }

    checkForVerticalCollisions() {
        for (let i =0; i < this.collisionBlocks.length; i++) {
            const block = this.collisionBlocks[i]

            if(collision(this, block)){
                console.log("collided")
                if(this.velocity.y > 0) {
                    this.velocity.y = 0
                    this.position.y = block.position.y - this.height - 0.01
                    break
                }
                if(this.velocity.y < 0) {
                    this.velocity.y = 0
                    this.position.y = block.position.y + block.height + 0.01
                    break
                }
            }
        }
    }
}