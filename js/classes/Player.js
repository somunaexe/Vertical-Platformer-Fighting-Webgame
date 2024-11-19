class Player extends Sprite {
    constructor({imageSrc, position, velocity}) {
        super({imageSrc, position})
        this.velocity = velocity;
        this.width = 100;
        this.height = 100;
    }

    update() {
        this.draw()
        this.position.y += this.velocity.y;
        this.position.x += this.velocity.x;
        if (this.position.y + this.height + this.velocity.y < canvas.height) 
            this.velocity.y += gravity
        else 
        this.velocity.y = 0
    }
}