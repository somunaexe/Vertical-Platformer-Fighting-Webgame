class Sprite {
    constructor({imageSrc, position, frames = 1, frameBuffer = 3, scale = 1}) {
        this.position = position
        this.scale = scale
        this.isAttacking = false
        this.flipX = false //Draw mirrored (for sheets that only exist facing right)
        this.flipShift = 0 //Horizontal nudge so a mirrored character stays where its body is
        this.holdLastFrame = false //Stop on the final frame instead of looping (death animation)
        this.frames = frames
        this.textures = sheetFrames(imageSrc, frames) //One texture per animation frame
        this.width = this.textures[0].width * scale
        this.height = this.textures[0].height * scale
        this.view = new PIXI.Sprite(this.textures[0]) //The Pixi object that actually gets drawn
        world.addChild(this.view)
        this.currentFrame = 0
        this.frameBuffer = frameBuffer
        this.elapsedTime = 0 //Seconds spent on the current animation frame
    }

    /**
     * Copies this sprite's state (frame, position, mirroring) onto its Pixi display object.
     * Nothing is painted here; Pixi paints everything once per frame in app.render().
     */
    draw() {
        const view = this.view
        view.texture = this.textures[this.currentFrame]
        view.y = this.position.y
        view.scale.y = this.scale
        if (this.flipX) {
            //A negative x-scale mirrors the sprite to the LEFT of view.x, so start at its right edge
            view.scale.x = -this.scale
            view.x = this.position.x + this.width + this.flipShift
        } else {
            view.scale.x = this.scale
            view.x = this.position.x
        }
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
