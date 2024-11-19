class Sprite {
    constructor({imageSrc, position, frames = 1}) {
        this.position = position
        this.image = new Image()
        this.image.onload = () => {    
            this.width = this.image.width / this.frames
            this.height = this.image.height
        }
        this.image.src = imageSrc
        this.frames = frames
        this.currentFrame = 0
        this.frameBuffer = 3
        this.elapsedFrames = 0
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
    }

    update(){
        this.draw()
        this.updateFrames()
    }

    updateFrames(){
        this.elapsedFrames++
        if (this.elapsedFrames % this.frameBuffer === 0) {
            if (this.currentFrame < this.frames - 1) this.currentFrame++
            else this.currentFrame = 0
        }
    }
}