class Player extends Sprite {
    constructor({imageSrc, position, velocity, collisionBlocks, frames, scale = 0.5, animations}) {
        super({imageSrc, position, frames, scale})
        this.velocity = velocity;
        this.collisionBlocks = collisionBlocks
        this.frames = frames
        this.facingLeft = false
        this.hitbox = {
            position: {
                x: this.position.x + 35,
                y: this.position.y + 26,
            },
            width: 14,
            height: 27,
        }
        this.animations = animations

        for (let key in this.animations) {
            const image = new Image()
            image.src = this.animations[key].imageSrc
            this.animations[key].image = image
        }
    }

    switchSprite(key) {
        if(this.image === this.animations[key]) return
        this.image = this.animations[key].image
        this.frameBuffer = this.animations[key].frameBuffer
        this.frames = this.animations[key].frames
    }
    update() {
        this.updateFrames()
        this.updateHitbox()
        c.fillStyle = 'rgba(255, 0, 255, 0.5)'
        c.fillRect(this.position.x, this.position.y, this.width, this.height);
        c.fillStyle = 'rgba(0, 0, 255, 0.5)'
        c.fillRect(this.hitbox.position.x, this.hitbox.position.y, this.hitbox.width, this.hitbox.height);

        this.draw()
        this.position.x += this.velocity.x;
        this.updateHitbox()
        this.checkForHorizontalCollisions()
        this.applyGravity()
        this.updateHitbox()
        this.checkForVerticalCollisions()
    }

    updateHitbox(){
        this.hitbox = {
            position: {
                x: this.position.x + 35,
                y: this.position.y + 26,
            },
            width: 14,
            height: 27,
        }
    }
    checkForHorizontalCollisions() {
        for (let i =0; i < this.collisionBlocks.length; i++) {
            const block = this.collisionBlocks[i]

            if(collision(this.hitbox, block)){
                console.log("collided")
                if(this.velocity.x < 0) {
                    this.velocity.x = 0
                    const offset = this.hitbox.position.x - this.position.x
                    this.position.x = block.position.x + block.width - offset + 0.01
                    break
                }
                if(this.velocity.x > 0) {
                    this.velocity.x = 0
                    const offset = this.hitbox.position.x - this.position.x + this.hitbox.width
                    this.position.x = block.position.x - offset - 0.01
                    break
                }
            }
        }
    }

    applyGravity() {
        this.velocity.y += gravity
        this.position.y += this.velocity.y;
    }

    checkForVerticalCollisions() {
        for (let i =0; i < this.collisionBlocks.length; i++) {
            const block = this.collisionBlocks[i]

            if(collision(this.hitbox, block)){
                console.log("collided")
                if(this.velocity.y > 0) {
                    this.velocity.y = 0
                    const offset = this.hitbox.position.y - this.position.y + this.hitbox.height
                    this.position.y = block.position.y - offset - 0.01
                    break
                }
                if(this.velocity.y < 0) {
                    this.velocity.y = 0
                    const offset = this.hitbox.position.y - this.position.y + this.hitbox.height
                    this.position.y = block.position.y + block.height - offset + 0.01
                    break
                }
            }
        }
    }
}