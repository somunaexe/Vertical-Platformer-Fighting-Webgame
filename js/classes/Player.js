class Player extends Sprite {
    constructor({imageSrc, position, velocity, collisionBlocks, platformBlocks, frames, collidedVertically=false, scale = 0.5, animations, facingLeft, sounds}) {
        super({imageSrc, position, frames, scale})
        this.velocity = velocity;
        this.collisionBlocks = collisionBlocks
        this.platformBlocks = platformBlocks
        this.frames = frames
        this.facingLeft = facingLeft
        this.jumps = 2
        this.collidedVertically = collidedVertically
        this.hitbox = {
            position: {
                x: this.position.x + 35,
                y: this.position.y + 26,
            },
            width: 14,
            height: 27,
        }
        this.cameraBox = {
            position:{
                x: this.position.x - 50,
                y: this.position.y,
            },
            width: 200,
            height: 80,
        }
        this.animations = animations

        for (let key in this.animations) {
            const image = new Image()
            image.src = this.animations[key].imageSrc
            this.animations[key].image = image
        }
        this.sounds = sounds
    }

    updateCameraBox(){
        this.cameraBox = {
            position:{
                x: this.position.x - 50,
                y: this.position.y,
            },
            width: 200,
            height: 80
        }
    }

    panCameraToLeft(canvas, camera){
        const cameraboxRightSide = this.cameraBox.position.x + this.cameraBox.width
        if(cameraboxRightSide >= 576) return
        if(cameraboxRightSide >= (canvas.width / 4) + Math.abs(camera.position.x)){
            camera.position.x -= this.velocity.x
        }
    }
    panCameraToRight(camera){
        if(this.cameraBox.position.x <= 0) return
        if(this.cameraBox.position.x <= Math.abs(camera.position.x)){
            camera.position.x -= this.velocity.x
        }
    }

    panCameraToUp(camera, canvas){
        if(this.cameraBox.position.y +this.cameraBox.height + this.velocity.y >= 432) return
        if(this.cameraBox.position.y + this.cameraBox.height >= Math.abs(camera.position.y) + (canvas.height / 4)){
            camera.position.y -= this.velocity.y
        }
    }

    panCameraToDown(camera){
        if(this.cameraBox.position.y + this.velocity.y <= 0) return
        if(this.cameraBox.position.y <= Math.abs(camera.position.y))
            camera.position.y -= this.velocity.y
    }

    checkForHorizontalCanvasCollisions() {
        if(this.hitbox.position.x + this.hitbox.width + this.velocity.x >= 576 || this.hitbox.position.x + this.velocity.x <= 0)
            this.velocity.x = 0
    }
    switchSprite(key) {
        if(this.image === this.animations[key].image || !this.loaded) return
        this.currentFrame = 0
        this.image = this.animations[key].image
        this.frameBuffer = this.animations[key].frameBuffer
        this.frames = this.animations[key].frames
    }
    update() {
        this.updateFrames()
        this.updateHitbox()
        this.updateCameraBox()
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
        // Detects collision blocks
        for (let i =0; i < this.collisionBlocks.length; i++) {
            const block = this.collisionBlocks[i]

            if(collision(this.hitbox, block)){
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
        // Detects collision blocks
        for (let i =0; i < this.collisionBlocks.length; i++) {
            const block = this.collisionBlocks[i]

            if(collision(this.hitbox, block)){
                console.log("collided")
                if(this.velocity.y > 0) {
                    this.collidedVertically = true
                    this.velocity.y = 0
                    const offset = this.hitbox.position.y - this.position.y + this.hitbox.height
                    this.position.y = block.position.y - offset - 0.01
                    this.jumps = 2       
                    // if(!this.sounds.fall.isPlaying) this.sounds.fall.play()             
                    break
                }
                if(this.velocity.y < 0) {
                    this.velocity.y = 0
                    const offset = this.hitbox.position.y - this.position.y + this.hitbox.height
                    this.position.y = block.position.y + block.height - offset + 0.01
                    this.jumps = 2                    
                    break
                }
            }
        }

        //Detects platform blocks
        for (let i =0; i < this.platformBlocks.length; i++) {
            const platformBlock = this.platformBlocks[i]

            if(platformCollision({object1 : this.hitbox, object2 : platformBlock})){
                console.log("collided")
                this.collidedVertically = true
                if(this.velocity.y > 0) {
                    this.velocity.y = 0
                    const offset = this.hitbox.position.y - this.position.y + this.hitbox.height
                    this.position.y = platformBlock.position.y - offset - 0.01
                    this.jumps = 2         
                    // if(!this.sounds.fall.isPlaying) this.sounds.fall.play()           
                    break
                }
            }
        }
    }
}