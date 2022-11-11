class Player extends GameObject {
    constructor(config) {
        super(config);
        this.id = config.id;
        this.name = config.name;
        this.fuel = 100;
        this.jerrycans = 0;
        this.directionUpdate = {
            'up': ['y', -2],
            'down': ['y', 2],
            'left': ['x', -2],
            'right': ['x', 2]
        }
        this.direction = config.direction || 'right';

        this.isPlayerControlled = config.isPlayerControlled || false;
        this.movingProgressRemaining = 0;
        this.sprite = new PlayerSprite({
            src: config.src || undefined,
            gameObject: this
        });
        this.drills = []; // for the drills in the user's inventory
        this.pending = [];
        this.element = document.createElement('div');
        this.element.classList.add("Character", "grid-cell");
        if(this.id === undefined)
            this.element.classList.add("you");
        this.element.innerHTML = (`
            <div class="Character_shadow grid-cell"></div>
                <div class="Character_name-container">
                    <span class="Character_name"></span>
                    <span class="Character_coins">0</span>
                </div>
            <div class="Character_you-arrow"></div>
        `);
        this.game.container.appendChild(this.element);
    }

    updateName(camera) {
        this.element.querySelector('.Character_name').innerHTML = (`${this.id}`).substring(0, 8);
        const left = (this.x - camera.x) + (448/2) - 32 + "px";
        const top = (this.y - camera.y) - (320/2) - 50 + "px";
        this.element.style.transform = `translate3d(${left}, ${top}, 0)`;
    }

    updatePosition() {
        const [property, change] = this.directionUpdate[this.direction];
        this[property] += change;
        this.movingProgressRemaining--;
    }

    updateSprite() {
        if(this.movingProgressRemaining > 0) {
            this.sprite.setAnimation('walk-' + this.direction);
        } else {
            this.sprite.setAnimation('idle-' + this.direction);
        }
        
    }

    startBehaviour(config, behavior) {
        this.direction = config.direction;
        this.action = config.action;
        if(behavior.type === 'walk') {
            this.game.healthBar.decrease(1);
            // TODO: Verify if next position is empty
            this.movingProgressRemaining = 32;
        }
    }

    updatePending() {
        if(this.movingProgressRemaining == 0) {
            if(this.pending.length > 0) {
                let p = this.pending.shift();
                this.startBehaviour(p.config, {
                    type: p.type
                });
            }
        }
    }

    forceUpdate(config) {
        this.pending.push({
            config,
            type: 'walk'
        });
    }

    update(config) {
        if(this.movingProgressRemaining > 0) {
            this.updatePosition();
        } else {
            if(this.isPlayerControlled){
                if(config.direction) {
                    this.game.socketHandler.movePlayer(config.direction);
                    this.startBehaviour(config, {
                        type: 'walk'
                    });
                }
                else if(config.action === 'commit-to-jerrycans') {
                    this.commitToJerrycans();
                }
                else if (config.action === 'drill') {
                    this.makeDrill();
                }
                else if (config.action === '') {
                    
                }
            }
        }
        this.updateSprite();
    }

    commitToJerrycans() { // commits the fuel to jerrycans
        let x = this.fuel / 2.0;
        this.jerrycans += x;
        this.fuel -= x;
        this.game.healthBar.decrease(x);
    }

    makeDrill() {
        if(this.fuel > 25 && this.game.isCellAvailable(this.x, this.y)) {
            let tile = this.game.cells[[this.x, this.y]];
            console.log("tile:", tile);
            this.game.gameObjects.decorations.push(new Drill({
                src: "static/images/drill.png",
                x: this.x,
                y: this.y,
                game: this.game,
                tile: tile
            })); // we need a timer function in the drill so that it can be replaced by a jerrycan
            this.fuel -= 25; // removes 25 fuel after the drill is placed
            this.game.healthBar.decrease(25);
        }
    }

    isDead() {
        return fuel <= 0;
    }
    
}