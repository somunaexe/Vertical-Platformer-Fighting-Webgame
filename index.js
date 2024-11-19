const canvas = document.querySelector("canvas");
const c = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
c.fillStyle = 'green';
c.fillRect(0, 0, canvas.width, canvas.height);
const gravity = 0.15;

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
                },
                height: 4,
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
    position: {x: 100, y: 300},
    velocity:  {x: 0, y: 0},
    collisionBlocks,
    platformBlocks,
    frames: 8,
    animations: {
        idle: {
            imageSrc: "assets/images/warrior/Idle.png",
            frames: 8,
            frameBuffer: 3,
        },
        run: {
            imageSrc: "assets/images/warrior/Run.png",
            frames: 8,
            frameBuffer: 5
        },
        jump: {
            imageSrc: "assets/images/warrior/Jump.png",
            frames: 2,
            frameBuffer: 5
        },
        fall: {
            imageSrc: "assets/images/warrior/Fall.png",
            frames: 2,
            frameBuffer: 5
        },
        idleLeft: {
            imageSrc: "assets/images/warrior/IdleLeft.png",
            frames: 8,
            frameBuffer: 3
        },
        runLeft: {
            imageSrc: "assets/images/warrior/RunLeft.png",
            frames: 8,
            frameBuffer: 5
        },
        jumpLeft: {
            imageSrc: "assets/images/warrior/JumpLeft.png",
            frames: 2,
            frameBuffer: 5
        },
        fallLeft: {
            imageSrc: "assets/images/warrior/FallLeft.png",
            frames: 2,
            frameBuffer: 5
        },
    },
    facingLeft: false
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
    
    if (keys.d.pressed) {
        player1.velocity.x = 2
        player1.facingLeft = false
        player1.switchSprite('run')
        player1.panCameraToLeft()
    }
    else if (keys.a.pressed) {
        player1.velocity.x = -2
        player1.facingLeft = true
        player1.switchSprite('runLeft')
    }
    else if (player1.velocity.y === 0) {
        if(player1.facingLeft) player1.switchSprite('idleLeft')
        else player1.switchSprite('idle')
    }

    if (player1.velocity.y < 0) 
        if(player1.facingLeft) player1.switchSprite('jumpLeft')
        else player1.switchSprite('jump')
    else if (player1.velocity.y > 0) 
        if(player1.facingLeft) player1.switchSprite('fallLeft')
        else player1.switchSprite('fall')
    c.restore()
}
animate()