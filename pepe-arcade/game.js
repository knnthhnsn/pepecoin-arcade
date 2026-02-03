// --- Constants & Config ---
const GRAVITY = 0.5;
const TERMINAL_VELOCITY = 12;
const GROUND_Y = 500; // Floor level

// Animation Config (Assuming sprite sheet layout)
const ANIMATIONS = {
    idle: { row: 0, frames: 1, speed: 10 },
    run: { row: 1, frames: 4, speed: 8 },
    jump: { row: 2, frames: 1, speed: 1 },
    shoot: { row: 3, frames: 2, speed: 5 }
};

// --- Core Systems ---

// --- Audio System ---
class SoundSynth {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, type, duration) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    shoot() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    jump() {
        this.playTone(150, 'square', 0.1);
    }

    explosion() {
        this.playTone(100, 'sawtooth', 0.2);
    }
}

class AssetManager {
    constructor() {
        this.images = {};
        this.toLoad = 0;
        this.loaded = 0;
    }

    queueImage(key, src) {
        this.toLoad++;
        const img = new Image();
        img.src = src;
        img.onload = () => {
            this.loaded++;
            console.log(`Loaded asset: ${key}`);
        };
        img.onerror = (e) => {
            console.error(`Failed to load asset: ${key} at ${src}`, e);
        };
        this.images[key] = img;
    }

    get(key) {
        return this.images[key];
    }
}

class InputHandler {
    constructor(game) {
        this.game = game;
        this.keys = {};

        // Keyboard Support
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyP", "KeyW"].indexOf(e.code) > -1) {
                e.preventDefault();
            }
            this.updateVisualControls(e.code, true);
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.updateVisualControls(e.code, false);
        });

        // Mouse Support
        window.addEventListener('mousedown', e => {
            if (e.target.id === 'pepe-coin') return;
            if (this.game.state === 'START') return;
            if (e.button === 0) {
                this.keys['Click'] = true;
                this.updateVisualControls('Click', true);
            }
        });
        window.addEventListener('mouseup', e => {
            if (e.button === 0) {
                this.keys['Click'] = false;
                this.updateVisualControls('Click', false);
            }
        });

        // Touch Support for Buttons
        this.setupTouchControls();
    }

    setupTouchControls() {
        const jumpBtn = document.getElementById('btn-jump');
        const shootBtn = document.getElementById('btn-shoot');
        const joystickArea = document.querySelector('.joystick-area');
        const stickHandle = document.getElementById('joystick');

        // Jump Button Touch
        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', e => {
                e.preventDefault();
                this.keys['KeyW'] = true; // Use KeyW as the internal jump key
                this.updateVisualControls('KeyW', true);
            }, { passive: false });

            jumpBtn.addEventListener('touchend', e => {
                e.preventDefault();
                this.keys['KeyW'] = false;
                this.updateVisualControls('KeyW', false);
            }, { passive: false });
        }

        // Shoot Button Touch
        if (shootBtn) {
            shootBtn.addEventListener('touchstart', e => {
                e.preventDefault();
                this.keys['Space'] = true; // Space is now Shoot
                this.updateVisualControls('Space', true);
            }, { passive: false });

            shootBtn.addEventListener('touchend', e => {
                e.preventDefault();
                this.keys['Space'] = false;
                this.updateVisualControls('Space', false);
            }, { passive: false });
        }

        // Virtual Joystick Touch
        if (joystickArea && stickHandle) {
            let joystickActive = false;
            let joystickCenter = { x: 0, y: 0 };

            joystickArea.addEventListener('touchstart', e => {
                e.preventDefault();
                joystickActive = true;
                const rect = joystickArea.getBoundingClientRect();
                joystickCenter = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
                this.handleJoystickMove(e.touches[0], joystickCenter);
            }, { passive: false });

            joystickArea.addEventListener('touchmove', e => {
                e.preventDefault();
                if (joystickActive) {
                    this.handleJoystickMove(e.touches[0], joystickCenter);
                }
            }, { passive: false });

            joystickArea.addEventListener('touchend', e => {
                e.preventDefault();
                joystickActive = false;
                this.resetJoystick();
            }, { passive: false });

            joystickArea.addEventListener('touchcancel', e => {
                joystickActive = false;
                this.resetJoystick();
            }, { passive: false });
        }
    }

    handleJoystickMove(touch, center) {
        const dx = touch.clientX - center.x;
        const dy = touch.clientY - center.y;
        const deadzone = 15;

        // Reset all directions first
        this.keys['ArrowLeft'] = false;
        this.keys['ArrowRight'] = false;
        this.keys['ArrowUp'] = false;
        this.keys['ArrowDown'] = false;

        // Horizontal
        if (dx < -deadzone) {
            this.keys['ArrowLeft'] = true;
            this.updateVisualControls('ArrowLeft', true);
            this.updateVisualControls('ArrowRight', false);
        } else if (dx > deadzone) {
            this.keys['ArrowRight'] = true;
            this.updateVisualControls('ArrowRight', true);
            this.updateVisualControls('ArrowLeft', false);
        } else {
            this.updateVisualControls('ArrowLeft', false);
            this.updateVisualControls('ArrowRight', false);
        }

        // Vertical
        if (dy < -deadzone) {
            this.keys['ArrowUp'] = true;
            this.updateVisualControls('ArrowUp', true);
            this.updateVisualControls('ArrowDown', false);
        } else if (dy > deadzone) {
            this.keys['ArrowDown'] = true;
            this.updateVisualControls('ArrowDown', true);
            this.updateVisualControls('ArrowUp', false);
        } else {
            this.updateVisualControls('ArrowUp', false);
            this.updateVisualControls('ArrowDown', false);
        }
    }

    resetJoystick() {
        this.keys['ArrowLeft'] = false;
        this.keys['ArrowRight'] = false;
        this.keys['ArrowUp'] = false;
        this.keys['ArrowDown'] = false;
        this.updateVisualControls('ArrowLeft', false);
        this.updateVisualControls('ArrowRight', false);
        this.updateVisualControls('ArrowUp', false);
        this.updateVisualControls('ArrowDown', false);
    }

    isDown(code) {
        return !!this.keys[code];
    }

    updateVisualControls(code, isDown) {
        const stick = document.getElementById('joystick');
        const jumpBtn = document.getElementById('btn-jump');
        const shootBtn = document.getElementById('btn-shoot');

        if (!stick || !jumpBtn || !shootBtn) return;

        if (code === 'ArrowLeft' || code === 'KeyA') {
            isDown ? stick.classList.add('stick-left') : stick.classList.remove('stick-left');
        }
        if (code === 'ArrowRight' || code === 'KeyD') {
            isDown ? stick.classList.add('stick-right') : stick.classList.remove('stick-right');
        }
        if (code === 'ArrowUp' || code === 'KeyW') {
            isDown ? stick.classList.add('stick-up') : stick.classList.remove('stick-up');
        }
        if (code === 'ArrowDown' || code === 'KeyS') {
            isDown ? stick.classList.add('stick-down') : stick.classList.remove('stick-down');
        }

        if (code === 'ArrowUp' || code === 'KeyW') {
            isDown ? jumpBtn.classList.add('pressed') : jumpBtn.classList.remove('pressed');
        }
        if (code === 'Space' || code === 'Click') {
            isDown ? shootBtn.classList.add('pressed') : shootBtn.classList.remove('pressed');
        }
    }
}

class Sprite {
    constructor(image, width, height) {
        this.image = image;
        this.width = width;
        this.height = height;
        this.frameIndex = 0;
        this.tickCount = 0;
        this.row = 0;
    }

    play(animName) {
        const anim = ANIMATIONS[animName];
        if (!anim) return;

        if (this.row !== anim.row) {
            this.row = anim.row;
            this.frameIndex = 0;
            this.tickCount = 0;
        }

        this.tickCount++;
        if (this.tickCount > anim.speed) {
            this.tickCount = 0;
            this.frameIndex = (this.frameIndex + 1) % anim.frames;
        }
    }

    draw(ctx, x, y, flipX = false) {
        if (!this.image) return;

        ctx.save();
        if (flipX) {
            ctx.translate(x + this.width, y);
            ctx.scale(-1, 1);
            x = 0;
            y = 0;
        } else {
            ctx.translate(x, y);
            x = 0;
            y = 0;
        }

        ctx.drawImage(
            this.image,
            this.frameIndex * this.width,
            this.row * this.height,
            this.width,
            this.height,
            x,
            y,
            this.width * 2,
            this.height * 2
        );
        ctx.restore();
    }
}

class Entity {
    constructor(game, x, y, width, height) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.vx = 0;
        this.vy = 0;
        this.markedForDeletion = false;
    }

    update(dt) {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx) {
        ctx.strokeStyle = 'red';
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}

class Projectile extends Entity {
    constructor(game, x, y, direction) {
        super(game, x, y, 16, 16);
        this.vx = direction * 10;
        this.image = game.assets.get('projectile');
    }

    update(dt) {
        super.update(dt);
        if (this.x > this.game.width || this.x < 0) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        if (this.image) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Enemy extends Entity {
    constructor(game) {
        super(game, game.width + 50, Math.random() * (GROUND_Y - 200) + 50, 64, 40);
        this.vx = -(Math.random() * 3 + 2);
        this.angle = 0;
        this.angleSpeed = Math.random() * 0.1 + 0.05;
        this.image = game.assets.get('helicopter');
    }

    update(dt) {
        super.update(dt);
        this.angle += this.angleSpeed;
        this.y += Math.sin(this.angle) * 1.5;

        if (this.x < -100) {
            this.markedForDeletion = true;
            // Penalty for letting enemy pass
            if (this.game.state === 'PLAYING') {
                this.game.lives -= 0.5;
                this.game.updateLivesUI();
                this.game.shakeHearts();
                if (this.game.lives <= 0) this.game.gameOver();
            }
        }
    }

    draw(ctx) {
        if (this.image) {
            ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

class ImpactEffect extends Entity {
    constructor(game, x, y) {
        super(game, x, y, 48, 48);
        this.image = game.assets.get('impact');
        this.timer = 0;
        this.maxTimer = 15; // Frames to stay visible
    }

    update() {
        this.timer++;
        if (this.timer > this.maxTimer) this.markedForDeletion = true;
    }

    draw(ctx) {
        if (this.image) {
            ctx.globalAlpha = 1 - (this.timer / this.maxTimer); // Fade out
            ctx.drawImage(this.image, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
            ctx.globalAlpha = 1.0;
        }
    }
}

// Game Config
const SPRITE_W = 424;
const SPRITE_H = 560;

class Player extends Entity {
    constructor(game) {
        super(game, 100, GROUND_Y - 100, 64, 64);
        this.frameIndex = 0;
        this.animTimer = 0;
        this.animState = 'idle';
        this.onGround = false;
        this.facingRight = true;
        this.speed = 5;
        this.jumpForce = -12;
        this.shootTimer = 0;
        this.shootInterval = 20;
        this.invincibilityTimer = 0;
        this.invincibilityDuration = 90; // ~1.5 seconds at 60fps
    }

    update(dt) {
        this.vy += GRAVITY;
        if (this.vy > TERMINAL_VELOCITY) this.vy = TERMINAL_VELOCITY;
        this.vx = 0;

        if (this.invincibilityTimer > 0) this.invincibilityTimer--;

        if (this.game.input.isDown('ArrowLeft') || this.game.input.isDown('KeyA')) {
            this.vx = -this.speed;
            this.facingRight = false;
            this.animState = 'run';
        } else if (this.game.input.isDown('ArrowRight') || this.game.input.isDown('KeyD')) {
            this.vx = this.speed;
            this.facingRight = true;
            this.animState = 'run';
        } else {
            this.animState = 'idle';
        }

        if ((this.game.input.isDown('ArrowUp') || this.game.input.isDown('KeyW')) && this.onGround) {
            this.vy = this.jumpForce;
            this.onGround = false;
            if (this.game.audio && this.game.audio.jump) this.game.audio.jump();
        }

        if (this.shootTimer > 0) this.shootTimer--;
        if ((this.game.input.isDown('Space') || this.game.input.isDown('Click')) && this.shootTimer === 0) {
            if (this.game.audio && this.game.audio.shoot) this.game.audio.shoot();
            const dir = this.facingRight ? 1 : -1;
            const px = this.x + (this.facingRight ? this.width : 0) - 8;
            this.game.projectiles.push(new Projectile(this.game, px, this.y + 10, dir));
            this.shootTimer = this.shootInterval;
        }

        const prevY = this.y;
        super.update(dt);

        if (this.x < 0) this.x = 0;
        if (this.x > this.game.width - this.width) this.x = this.game.width - this.width;

        // Platform Collisions
        if (this.vy > 0) {
            this.game.platforms.forEach(p => {
                if (this.x < p.x + p.width &&
                    this.x + this.width > p.x &&
                    prevY + this.height <= p.y &&
                    this.y + this.height >= p.y) {
                    this.y = p.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                }
            });
        }

        if (this.y + this.height > GROUND_Y) {
            this.y = GROUND_Y - this.height;
            this.vy = 0;
            this.onGround = true;
        }

        this.animTimer++;
        const currentSpeed = (this.animState === 'run') ? 15 : 45;
        if (this.animTimer > currentSpeed) {
            this.animTimer = 0;
            this.frameIndex = (this.frameIndex + 1) % 2;
        }
    }

    draw(ctx) {
        const idle1 = this.game.assets.get('player_f1');
        const idle2 = this.game.assets.get('player_f2');
        const walk1 = this.game.assets.get('player_walk1');
        const walk2 = this.game.assets.get('player_walk2');

        let framesToUse = [idle1, idle2];
        if (this.animState === 'run') framesToUse = [walk1, walk2];

        const currentImg = framesToUse[this.frameIndex] || idle1;
        const renderW = 60;
        const renderH = 80;
        const drawX = this.x + (this.width - renderW) / 2;
        const drawY = this.y + (this.height - renderH);

        ctx.save();
        if (!this.facingRight) {
            ctx.translate(drawX + renderW / 2, drawY + renderH / 2);
            ctx.scale(-1, 1);
            ctx.translate(-(drawX + renderW / 2), -(drawY + renderH / 2));
        }

        if (currentImg) {
            // Flash if invincible
            if (this.invincibilityTimer > 0 && Math.floor(this.invincibilityTimer / 5) % 2 === 0) {
                ctx.globalAlpha = 0.5;
            }
            ctx.drawImage(currentImg, 0, 0, SPRITE_W, SPRITE_H, drawX, drawY, renderW, renderH);
            ctx.globalAlpha = 1.0;
        }
        ctx.restore();
    }
}

class Platform {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    }
}

class Game {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.lastTime = 0;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('pepecoin_bestscore')) || 0;
        this.lives = 5;
        this.state = 'START';
        this.input = new InputHandler(this);
        this.assets = new AssetManager();
        this.audio = new SoundSynth();

        this.assets.queueImage('ground', './assets/flat_jungle_ground_tileset.png');
        this.assets.queueImage('player_f1', './assets/pepe_frame_1.png');
        this.assets.queueImage('player_f2', './assets/pepe_frame_2.png');
        this.assets.queueImage('player_walk1', './assets/pepe_frame_foot_walk_1.png');
        this.assets.queueImage('player_walk2', './assets/pepe_frame_foot_walk_2.png');
        this.assets.queueImage('projectile', './assets/projectile.png');
        this.assets.queueImage('impact', './assets/impact_effect.png');
        this.assets.queueImage('helicopter', './assets/fake_pepe.png');

        this.bgKeys = ['bg1', 'bg2', 'bg3', 'bg4'];
        this.assets.queueImage('bg1', './assets/Backgrounds/community-art2.avif');
        this.assets.queueImage('bg2', './assets/Backgrounds/king-pepekong.png');
        this.assets.queueImage('bg3', './assets/Backgrounds/pepe-park.png');
        this.assets.queueImage('bg4', './assets/Backgrounds/pepskimo.png');

        this.currentBgKey = this.bgKeys[Math.floor(Math.random() * this.bgKeys.length)];
        this.player = new Player(this);
        this.projectiles = [];
        this.enemies = [];
        this.platforms = [
            new Platform(150, 400, 150, 20),
            new Platform(400, 300, 200, 20),
            new Platform(100, 200, 120, 20)
        ];
        this.effects = [];
        this.enemyTimer = 0;
        this.enemyInterval = 100;
        this.updateLivesUI(); // Initial Hearts
        this.setupSettings();
    }

    updateLivesUI() {
        const container = document.getElementById('lives-display');
        if (!container) return;
        container.innerHTML = '';

        for (let i = 0; i < 5; i++) {
            const heart = document.createElement('div');
            heart.className = 'heart-icon';
            const lifeRequired = i + 1;

            if (this.lives < lifeRequired && this.lives > i) {
                heart.classList.add('half');
            } else if (this.lives < lifeRequired) {
                heart.style.opacity = '0'; // Empty
            }
            container.appendChild(heart);
        }
    }

    shakeHearts() {
        const hearts = document.querySelectorAll('.heart-icon');
        hearts.forEach(heart => {
            heart.classList.remove('shake');
            void heart.offsetWidth; // Trigger reflow
            heart.classList.add('shake');
        });
        setTimeout(() => {
            hearts.forEach(h => h.classList.remove('shake'));
        }, 400);
    }

    start() {
        // Setup Coin Logic
        const coin = document.getElementById('pepe-coin');
        if (coin) {
            coin.onclick = () => this.insertCoin();
        }
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    insertCoin() {
        if (this.state !== 'START') return;
        const coin = document.getElementById('pepe-coin');
        coin.classList.add('coin-inserted');
        this.audio.playTone(800, 'square', 0.1); // "Chime"
        setTimeout(() => {
            this.startGame();
        }, 500);
    }

    shake() {
        const cabinet = document.querySelector('.arcade-cabinet');
        cabinet.classList.remove('shake');
        void cabinet.offsetWidth; // Trigger reflow
        cabinet.classList.add('shake');
        setTimeout(() => cabinet.classList.remove('shake'), 400);
    }

    gameLoop(timestamp) {
        let deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.update(deltaTime);
        this.draw();
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(dt) {
        const anyInput = Object.values(this.input.keys).some(k => k === true);

        if (this.state === 'START') {
            // No longer checking anyInput here - insertion is handled by coin.onclick
            return;
        }

        if (this.state === 'GAMEOVER') {
            // No longer checking anyInput here - restart is handled by coin insert only
            return;
        }
        if (this.state === 'PLAYING') {
            this.player.update(dt);
            this.projectiles.forEach(p => p.update(dt));
            this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
            this.enemyTimer++;
            if (this.enemyTimer > this.enemyInterval) {
                this.enemies.push(new Enemy(this));
                this.enemyTimer = 0;
                if (this.enemyInterval > 30) this.enemyInterval -= 1;
            }
            this.enemies.forEach(e => e.update(dt));
            this.enemies = this.enemies.filter(e => !e.markedForDeletion);
            this.effects.forEach(eff => eff.update());
            this.effects = this.effects.filter(eff => !eff.markedForDeletion);
            this.checkCollisions();
        }
    }

    checkCollisions() {
        this.projectiles.forEach(p => {
            this.enemies.forEach(e => {
                if (!p.markedForDeletion && !e.markedForDeletion && this.checkAABB(p, e)) {
                    p.markedForDeletion = true;
                    e.markedForDeletion = true;
                    this.score += 100;
                    this.effects.push(new ImpactEffect(this, p.x + p.width / 2, p.y + p.height / 2));
                    this.audio.explosion();
                    document.getElementById('score').innerText = this.score;
                }
            });
        });

        this.enemies.forEach(e => {
            if (!e.markedForDeletion && this.player.invincibilityTimer === 0 && this.checkAABB(this.player, e)) {
                this.lives -= 1.0; // Penalty for direct hit (2 half-hearts)
                this.updateLivesUI();
                this.shakeHearts();
                this.audio.explosion();
                this.player.invincibilityTimer = this.player.invincibilityDuration;

                if (this.lives <= 0) {
                    this.gameOver();
                }
            }
        });
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.input.keys['Click'] = false;
        this.shake();
        this.audio.explosion();

        // Update best score
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('pepecoin_bestscore', this.bestScore);
        }
        this.updateLeaderboard(this.score);

        document.getElementById('final-score').innerText = this.score;
        document.getElementById('best-score').innerText = this.bestScore;
        document.getElementById('game-over-screen').classList.remove('hidden');

        // Setup retry coin interaction for both desktop and touch coins
        const desktopCoin = document.getElementById('desktop-retry-coin');
        const touchCoin = document.getElementById('touch-retry-coin');
        const coins = [desktopCoin, touchCoin].filter(c => c); // Filter out nulls

        const handleCoinInsert = (coin) => (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            // Play coin insert animation
            coin.classList.add('inserting');
            this.audio.playTone(400, 'sine', 0.1); // Coin sound

            // Remove Enter key listener
            window.removeEventListener('keydown', enterKeyHandler);

            // Wait for animation then restart
            setTimeout(() => {
                document.getElementById('game-over-screen').classList.add('hidden');
                coins.forEach(c => {
                    c.classList.remove('inserting');
                    c.classList.remove('active');
                });
                this.resetGame();
                this.state = 'PLAYING';
                document.getElementById('start-screen').classList.remove('active');
            }, 600);
        };

        // Enter key support for desktop
        const enterKeyHandler = (e) => {
            if (e.code === 'Enter' && this.state === 'GAMEOVER' && desktopCoin) {
                handleCoinInsert(desktopCoin)(null);
            }
        };
        window.addEventListener('keydown', enterKeyHandler);

        // Activate coins and set up handlers
        coins.forEach(coin => {
            coin.classList.remove('inserting');
            coin.classList.add('active');
            coin.onclick = handleCoinInsert(coin);
            coin.ontouchstart = handleCoinInsert(coin);
        });

        // Share logic
        const btnShare = document.getElementById('btn-share');
        if (btnShare) {
            btnShare.onclick = async () => {
                const text = `I just scored ${this.score} in $PEPECOIN ARCADE! 🐸🕹️\n\nCan you beat my high score? Play now at https://pepecoin-arcade.vercel.app #PEPECOIN #ARCADE #BASED`;
                const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

                // Broad detection for anything that feels like a phone/tablet
                const isMobile = ('ontouchstart' in window) ||
                    (navigator.maxTouchPoints > 0) ||
                    (window.innerWidth <= 1024) ||
                    (window.matchMedia("(pointer: coarse)").matches) ||
                    (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

                if (isMobile) {
                    // Try native share first
                    if (navigator.share) {
                        try {
                            await navigator.share({ text: text });
                            return;
                        } catch (e) {
                            console.log('Share prompt closed');
                        }
                    }
                    // Immediate redirect - no screenshot lag
                    window.location.href = tweetUrl;
                    return;
                }

                // Desktop Workflow (Screenshot + Clipboard)
                if (typeof html2canvas === 'undefined') {
                    window.open(tweetUrl, '_blank');
                    return;
                }

                const originalText = btnShare.innerText;
                btnShare.innerText = 'CAPTURING...';
                btnShare.style.opacity = '0.5';
                btnShare.style.pointerEvents = 'none';
                document.body.classList.add('screenshot-mode');

                try {
                    await new Promise(r => setTimeout(r, 300));
                    const canvas = await html2canvas(document.body, {
                        backgroundColor: '#1a1a1a',
                        useCORS: true,
                        scale: window.devicePixelRatio > 1 ? 2 : 1,
                        logging: false
                    });

                    document.body.classList.remove('screenshot-mode');

                    // 1. Download backup
                    const link = document.createElement('a');
                    link.download = `pepecoin-arcade-score-${this.score}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();

                    // 2. Clipboard Copy
                    try {
                        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                        if (navigator.clipboard && window.ClipboardItem) {
                            const data = [new ClipboardItem({ 'image/png': blob })];
                            await navigator.clipboard.write(data);
                        }
                    } catch (e) { console.error('Clip fail:', e); }

                    // 3. Open X
                    window.open(tweetUrl, '_blank');

                    setTimeout(() => {
                        alert("Screenshot copied! Just press Paste to attach it to your post! 🐸📸✂️");
                    }, 1000);
                } catch (err) {
                    console.error('Screenshot failed:', err);
                    window.open(tweetUrl, '_blank');
                } finally {
                    btnShare.innerText = originalText;
                    btnShare.style.opacity = '1';
                    btnShare.style.pointerEvents = 'auto';
                }
            };
        }
    }

    checkAABB(a, b) {
        return (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);
    }

    draw() {
        this.ctx.fillStyle = '#2d1b2e';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.state === 'PLAYING' || this.state === 'GAMEOVER') {
            const bgImg = this.assets.get(this.currentBgKey);
            if (bgImg) this.ctx.drawImage(bgImg, 0, 0, this.width, this.height);



            const groundImg = this.assets.get('ground');
            if (groundImg) {
                const tileSize = 64;
                const cols = Math.ceil(this.width / tileSize);
                for (let i = 0; i < cols; i++) {
                    this.ctx.drawImage(groundImg, 0, 0, tileSize, tileSize, i * tileSize, GROUND_Y, tileSize, tileSize);
                    this.ctx.drawImage(groundImg, 0, tileSize, tileSize, tileSize, i * tileSize, GROUND_Y + tileSize, tileSize, tileSize);
                }
            }
            this.ctx.fillStyle = '#444';
            this.platforms.forEach(p => {
                this.ctx.fillRect(p.x, p.y, p.width, p.height);
                this.ctx.strokeStyle = '#4ade80';
                this.ctx.strokeRect(p.x, p.y, p.width, p.height);
            });
            // Ensure full opacity for characters and entities
            this.ctx.globalAlpha = 1.0;
            this.ctx.globalCompositeOperation = 'source-over';

            this.player.draw(this.ctx);
            this.projectiles.forEach(p => p.draw(this.ctx));
            this.enemies.forEach(e => e.draw(this.ctx));
            this.effects.forEach(eff => eff.draw(this.ctx));
        }
    }

    startGame() {
        this.state = 'PLAYING';
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('score-display').style.opacity = '1';
        document.getElementById('lives-display').style.opacity = '1';
    }

    resetGame() {
        this.score = 0;
        this.player.x = 100;
        this.player.y = GROUND_Y - 100;
        this.player.vx = 0;
        this.player.vy = 0;
        this.enemies = [];
        this.projectiles = [];
        this.effects = [];
        this.lives = 5;
        this.player.invincibilityTimer = 0;
        this.enemyInterval = 100;
        this.currentBgKey = this.bgKeys[Math.floor(Math.random() * this.bgKeys.length)];
        document.getElementById('score').innerText = '0';
        this.updateLivesUI();
        this.input.keys = {}; // Fully clear all keys on reset
    }

    setupSettings() {
        const btnSettings = document.getElementById('btn-settings');
        const panel = document.getElementById('settings-panel');
        const btnClose = document.getElementById('close-settings');
        const toggleCRT = document.getElementById('toggle-crt');
        const toggleGlow = document.getElementById('toggle-glow');
        const scanlines = document.querySelector('.scanlines');
        const crtGlow = document.querySelector('.crt-glow');

        if (btnSettings) {
            btnSettings.onclick = () => {
                panel.classList.remove('hidden');
                this.updateLeaderboardUI();
                if (this.state === 'PLAYING') this.state = 'START'; // Pause game if needed
            };
        }

        if (btnClose) {
            btnClose.onclick = () => {
                panel.classList.add('hidden');
            };
        }

        if (toggleCRT) {
            toggleCRT.onchange = (e) => {
                scanlines.style.display = e.target.checked ? 'block' : 'none';
            };
        }

        if (toggleGlow) {
            toggleGlow.onchange = (e) => {
                crtGlow.style.display = e.target.checked ? 'block' : 'none';
            };
        }
    }

    updateLeaderboard(newScore) {
        let scores = JSON.parse(localStorage.getItem('pepecoin_leaderboard')) || [];
        const playerName = "PEPE_" + Math.floor(Math.random() * 999);
        scores.push({ name: playerName, score: newScore });
        scores.sort((a, b) => b.score - a.score);
        scores = scores.slice(0, 10); // Keep top 10
        localStorage.setItem('pepecoin_leaderboard', JSON.stringify(scores));
    }

    updateLeaderboardUI() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;

        let scores = JSON.parse(localStorage.getItem('pepecoin_leaderboard')) || [];
        if (scores.length === 0) {
            list.innerHTML = '<div class="leaderboard-item">NO SCORES YET</div>';
            return;
        }

        list.innerHTML = scores.map((s, i) => `
            <div class="leaderboard-item">
                <span class="rank">${i + 1}</span>
                <span class="name">${s.name}</span>
                <span class="score">${s.score}</span>
            </div>
        `).join('');
    }
}

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;
    const game = new Game(ctx, canvas.width, canvas.height);
    game.start();

    const nftStickers = ['nft0.png', 'nft1.png', 'nft2.png', 'nft3.png', 'nft4.png', 'nft5.png', 'nft6.png'];
    const regularStickers = ['Jockstrap.png', 'basedman-white-eye.png', 'basedman.png', 'basedman1.png', 'basedman2.png', 'brain-logo.webp', 'gun.png', 'heart.png'];
    const container = document.getElementById('sticker-container');
    container.innerHTML = '';

    const cabinetContainer = document.getElementById('sticker-container');
    const wallContainer = document.getElementById('wall-sticker-container');

    const createSticker = (targetContainer, filename, left, top, scale, rot, isWall) => {
        const wrapper = document.createElement('div');
        wrapper.className = isWall ? 'wall-sticker-wrapper' : 'sticker-wrapper';
        wrapper.style.left = left + (isWall ? 'vw' : '%');
        wrapper.style.top = top + (isWall ? 'vh' : '%');
        wrapper.style.transform = `rotate(${rot}deg) scale(${scale})`;

        // Link to basedman.io
        wrapper.style.cursor = 'pointer';
        wrapper.onclick = () => window.open('https://basedman.io', '_blank');

        // Create inner content wrapper for clipping the shine
        const imgSrc = `./assets/cabinet-sticker/${filename}`;
        const innerContent = document.createElement('div');
        innerContent.className = 'sticker-content';
        innerContent.style.setProperty('--sticker-mask', `url(${imgSrc})`);

        const img = document.createElement('img');
        img.src = imgSrc;
        img.className = isWall ? 'wall-sticker' : 'sticker';
        innerContent.appendChild(img);

        wrapper.appendChild(innerContent);

        if (isWall) {
            // Add pieces of tape for that DIY look
            const tape1 = document.createElement('div');
            tape1.className = 'tape tape-tl';
            const tape2 = document.createElement('div');
            tape2.className = 'tape tape-tr';
            wrapper.appendChild(tape1);
            wrapper.appendChild(tape2);
        }

        targetContainer.appendChild(wrapper);
    };

    // Scatter NFTs on the walls
    // Scatter NFTs on the walls - strict positioning to avoid cabinet overlap
    // Cabinet occupies roughly center 50% on wide screens, so keep stickers in outer 20%
    nftStickers.forEach((s, i) => {
        const isLeft = i % 2 === 0;
        // Left side: 2% to 18% width
        // Right side: 82% to 95% width
        const x = isLeft ? (2 + Math.random() * 16) : (82 + Math.random() * 13);
        const y = 5 + Math.random() * 80; // Spread vertically
        createSticker(wallContainer, s, x, y, 0.9, (Math.random() * 30 - 15), true);
    });

    // Regular stickers stay on the cabinet
    const moveLeftList = ['basedman-white-eye.png', 'basedman.png', 'basedman1.png', 'basedman2.png', 'brain-logo.webp', 'heart.png', 'Jockstrap.png'];
    regularStickers.forEach((s, i) => {
        if (i > 7) return;
        const isLeft = i % 2 === 0;
        let leftBase = isLeft ? 2 : 92;
        let scale = 0.6;

        if (moveLeftList.includes(s)) {
            leftBase -= 4.5;
            scale = 0.7;
        }

        createSticker(cabinetContainer, s, leftBase + Math.random() * 4, 10 + (i * 12) + (Math.random() * 4 - 2), scale, (Math.random() * 40 - 20), false);
    });
};
