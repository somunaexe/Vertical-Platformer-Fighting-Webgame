const canvas = document.querySelector("canvas");
const c = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
c.fillStyle = 'green';
c.fillRect(0, 0, canvas.width, canvas.height);
const gravity = 0.5;

const scaledCanvas = {
    width: canvas.width / 4,
    height: canvas.height / 4
}

const floorCollisions2D = []
for (let i = 0; i < floorCollisions.length; i+= 36) {
    floorCollisions2D.push(floorCollisions.slice(i, i + 36))
}

floorCollisions2D.forEach((row) => {
    row.forEach((symbol) => {
        if (symbol === 202) {

        }
    })
})

const background = new Sprite({
    imageSrc: "assets/images/background.png",
    position: {x: 0, y: 0}
})

const a = {pressed: false}
const w = {pressed: false}
const s = {pressed: false}
const d = {pressed: false}
const keys = {a,w,s,d}

const player1 = new Player({
    imageSrc: "assets/images/player.jfif",
    position: {x: 0, y: background.image.height},
    velocity:  {x: 0, y: 0}
});

window.addEventListener("keydown", (event) => {
    switch (event.code) {
        case "KeyA":
            keys.a.pressed = true;
            break
        case "KeyD":
            keys.d.pressed = true;
            break
        case "KeyW":
            keys.w.pressed = true;
            player1.velocity.y = -10;
            break
    }
})

window.addEventListener("keyup", (event) => {
    switch (event.code) {
        case "KeyA":
            keys.a.pressed = false;
            break
        case "KeyD":
            keys.d.pressed = false;
            break
    }
})
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
})
function animate() {
    window.requestAnimationFrame(animate)
    c.fillStyle = 'white';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.save()
    c.scale(4, 4)
    c.translate(0, -background.image.height + scaledCanvas.height)
    background.update()
    c.restore()
    player1.update();
}
animate()