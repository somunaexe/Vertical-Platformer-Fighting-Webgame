const canvas = document.querySelector("canvas");
const c = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
c.fillStyle = 'green';
c.fillRect(0, 0, canvas.width, canvas.height);
const gravity = 0.5;

class Sprite {
    constructor({imageSrc, position}) {
        this.position = position
        this.image = new Image()
        this.image.src = imageSrc
    }

    draw() {
        if (!this.image) return
        c.drawImage(this.image, this.position.x, this.position.y);
    }

    update(){
        draw()
    }
}
class Player extends Sprite {
    constructor({imageSrc, position, velocity, width, height}) {
        super(imageSrc, position)
        this.velocity = velocity;
        this.width = width;
        this.height = height;
    }

    update() {
        this.draw()
        this.position.y += this.velocity.y;
        if (this.position.y + this.height + this.velocity.y < canvas.height) 
            this.velocity.y += gravity
        else this.velocity.y = 0
    }
}

const a = {pressed: false}
const w = {pressed: false}
const s = {pressed: false}
const d = {pressed: false}
const keys = {a,w,s,d}

const player1 = new Player({
    imageSrc: "assets/images/player.jfif",
    position: {x: 0, y: 0},
    velocity:  {x: 0, y: 0},
    width: 100, 
    height: 100
});

window.addEventListener("keydown", (event) => {
    switch (event.code) {
        case "KeyA":
            keys.a.pressed = true;
            player1.velocity.x = -1;
            break
        case "KeyD":
            keys.d.pressed = true;
            player1.velocity.x = 1;
            break
        case "KeyW":
            keys.w.pressed = true;
            player1.velocity.y = -20;
            break
        case "KeyS":
            keys.s.pressed = true;
            player1.velocity.y = 1;
            break
    }
})

window.addEventListener("keyup", (event) => {
    switch (event.code) {
        case "KeyA":
            keys.a.pressed = false;
            player1.velocity.x = 0;
            break
        case "KeyD":
            keys.d.pressed = false;
            player1.velocity.x = 0;
            break
        case "KeyS":
            keys.s.pressed = false;
            break
        case "KeyW":
            keys.w.pressed = false;
            break
    }
})
function animate() {
    window.requestAnimationFrame(animate)
    c.fillStyle = 'white';
    c.fillRect(0, 0, canvas.width, canvas.height);
    // Player.update();
}
animate()