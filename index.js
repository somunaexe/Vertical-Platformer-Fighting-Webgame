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
const collisionBlocks = []
floorCollisions2D.forEach((row, y) => {
    row.forEach((symbol, x) => {
        if (symbol === 202) {
            collisionBlocks.push(new CollisionBlock({
                position: {
                    x: x * 16, 
                    y: y * 16
                }
            }))
        }
    })
})

const platformCollisions2D = []
for (let i = 0; i < platformCollisions.length; i+= 36) {
    platformCollisions2D.push(platformCollisions.slice(i, i + 36))
}
const platformBlocks = []
platformCollisions2D.forEach((row, y) => {
    row.forEach((symbol, x) => {
        if (symbol === 202) {
            platformBlocks.push(new CollisionBlock({
                position: {
                    x: x * 16, 
                    y: y * 16
                }
            }))
        }
    })
})

const background = new Sprite({
    imageSrc: "assets/images/background.png",
    position: {x: 0, y: 0}
})

const player1 = new Player({
    imageSrc: "assets/images/warrior/Idle.png",
    position: {x: 100, y: 0},
    velocity:  {x: 0, y: 0},
    collisionBlocks,
    frames: 8
});

// const a = {pressed: false}
// const w = {pressed: false}
// const s = {pressed: false}
// const d = {pressed: false}
// const keys = {a,w,s,d}
// window.addEventListener("keydown", event => {
//     switch (event.code) {
//         case "KeyA":
//             keys.a.pressed = true;
//             break
//         case "KeyD":
//             keys.d.pressed = true;
//             break
//         case "KeyW":
//             keys.w.pressed = true;
//             player1.velocity.y = -10;
//             break
//     }
// })

// window.addEventListener("keyup", event => {
//     switch (event.code) {
//         case "KeyA":
//             keys.a.pressed = false;
//             break
//         case "KeyD":
//             keys.d.pressed = false;
//             break
//     }
// })
// window.addEventListener("resize", () => {
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;
// })
function animate() {
    window.requestAnimationFrame(animate)
    c.fillStyle = 'white';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.save()
    c.scale(4, 4)
    c.translate(0, -background.image.height + scaledCanvas.height)
    background.update()
    collisionBlocks.forEach(block => block.update())
    platformBlocks.forEach(block => block.update())

    player1.update();
    player1.velocity.x = 0
    if (keys.d.pressed) player1.velocity.x = 5
    else if (keys.a.pressed) player1.velocity.x = -5
    c.restore()
}
animate()