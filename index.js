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

const bgMusic = new Audio('/assets/audio/bg-music.mp3');
bgMusic.volume = 0.5
bgMusic.loop = true
bgMusic.autoplay = true

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
        attackLow: {
            imageSrc: "assets/images/warrior/AttackLow.png",
            frames: 6,
            frameBuffer: 5
        },
        attackMid: {
            imageSrc: "assets/images/warrior/AttackMid.png",
            frames: 6,
            frameBuffer: 5
        },
        attackOverhead: {
            imageSrc: "assets/images/warrior/AttackOverhead.png",
            frames: 6,
            frameBuffer: 5
        },
        // attackLowLeft: {
        //     imageSrc: "assets/images/warrior/AttackLowLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // },
        // attackMidLeft: {
        //     imageSrc: "assets/images/warrior/AttackMidLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // },
        // attackOverheadLeft: {
        //     imageSrc: "assets/images/warrior/AttackOverheadLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // },
        hit: {
            imageSrc: "assets/images/warrior/Hit.png",
            frames: 2,
            frameBuffer: 5
        },
        hitSilhouette: {
            imageSrc: "assets/images/warrior/HitSilhouette.png",
            frames: 2,
            frameBuffer: 5
        } ,
        // hitSilhouetteLeft: {
        //     imageSrc: "assets/images/warrior/HitSilhouetteLeft.png",
        //     frames: 2,
        //     frameBuffer: 5
        // },
        // hitLeft: {
        //     imageSrc: "assets/images/warrior/HitLeft.png",
        //     frames: 2,
        //     frameBuffer: 5
        // },
        death: {
            imageSrc: "assets/images/warrior/Death.png",
            frames: 6,
            frameBuffer: 5
        },
        // deathLeft: {
        //     imageSrc: "assets/images/warrior/DeathLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // }
    },
    facingLeft: false
});

const backgroundHeight = 432

const camera = {
    position: {
        x: 0,
        y: -backgroundHeight + scaledCanvas.height,
    },
}
function animate() {
    window.requestAnimationFrame(animate)
    c.fillStyle = 'white';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.save()
    c.scale(4, 4)
    c.translate(camera.position.x, camera.position.y)
    background.update()
    player1.checkForHorizontalCanvasCollisions()
    player1.update();
    player1.velocity.x = 0
    
    if (keys.d.pressed) {
        player1.velocity.x = 2
        player1.facingLeft = false
        player1.switchSprite('run')
        player1.panCameraToLeft(canvas, camera)
    }
    else if (keys.a.pressed) {
        player1.velocity.x = -2
        player1.facingLeft = true
        player1.switchSprite('runLeft')
        player1.panCameraToRight(camera)
    }
    else if (player1.velocity.y === 0) {
        if(player1.facingLeft) player1.switchSprite('idleLeft')
        else player1.switchSprite('idle')
    }

    if (player1.velocity.y < 0) {
        player1.panCameraToDown(camera)
        if(player1.facingLeft) player1.switchSprite('jumpLeft')
        else player1.switchSprite('jump')
    } 
    else if (player1.velocity.y > 0) {
        player1.panCameraToUp(camera, canvas)
        if(player1.facingLeft) player1.switchSprite('fallLeft')
        else player1.switchSprite('fall')
    }
    c.restore()
}
animate()