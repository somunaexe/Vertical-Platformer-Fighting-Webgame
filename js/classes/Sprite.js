class Sprite {
    constructor({imageSrc, position, frames = 1, frameBuffer = 3, scale = 1}) {
        this.position = position
        this.scale = scale
        this.loaded = false
        this.isAttacking = false
        this.flipX = false //Draw mirrored (for sheets that only exist facing right)
        this.flipShift = 0 //Horizontal nudge so a mirrored character stays where its body is
        this.holdLastFrame = false //Stop on the final frame instead of looping (death animation)
        this.image = new Image()
        this.image.onload = () => {    
            this.width = (this.image.width / this.frames) * scale
            this.height = (this.image.height) * scale
            this.loaded = true
        }
        this.image.src = imageSrc
        this.frames = frames
        this.currentFrame = 0
        this.frameBuffer = frameBuffer
        this.elapsedTime = 0 //Seconds spent on the current animation frame
    }

    draw() {
        if (!this.image) return

        const cropbox = {
            position: {
                x: this.currentFrame * (this.image.width / this.frames),
                y: 0,
            },
            width: this.image.width / this.frames,
            height: this.image.height,
        }

        c.save()
        if (this.flipX) {
            //Mirror around the sprite's own centre line
            c.translate(2 * this.position.x + this.width + this.flipShift, 0)
            c.scale(-1, 1)
        }
        c.drawImage(
            this.image,
            cropbox.position.x,
            cropbox.position.y,
            cropbox.width,
            cropbox.height,
            this.position.x, 
            this.position.y,
            this.width,
            this.height
        );
        c.restore()
    }

    update(dt){
        this.draw()
        this.updateFrames(dt)
    }

    /**
     * Advances the animation based on elapsed time, so it plays at the same speed on any monitor.
     * frameBuffer was authored as "game frames per animation frame" at 60 fps,
     * so one animation frame lasts frameBuffer / 60 seconds.
     * @param {Number} dt - Seconds elapsed since the previous game frame
     */
    updateFrames(dt){
        const frameDuration = this.frameBuffer / 60
        this.elapsedTime += dt
        while (this.elapsedTime >= frameDuration) {
            this.elapsedTime -= frameDuration
            if (this.currentFrame < this.frames - 1) {
                this.currentFrame++
            }
            else if (!this.holdLastFrame) {
                this.currentFrame = 0
                if(this.isAttacking) this.isAttacking = false
            }
        }
    }
}