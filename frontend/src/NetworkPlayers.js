class NetworkPlayers {

    constructor(map) {
        this.map = map;
    }

    movePlayer({ playerId, direction }) {
        this.map.gameObjects.players[playerId].forceUpdate({
            direction: direction,
            type:"walk"
        });
    }

    
    fleePlayer({ playerId, direction }) {
        this.map.gameObjects.players[playerId].forceUpdate({
            direction: direction,
            type:"flee"
        });
    }

    addPlayer(player) {
        if(!this.map.gameObjects.players[player.id]) {
            let p = new Player({
                id: player.id,
                src: `static/images/${player.skin}`,
                name: player.name,
                isPlayerControlled: player.id === this.map.id,
                x: player.x,
                y: player.y,
                game: this.map.game,
                fuel: player.fuel,
                jerrycans: player.jerrycans,
                skin: player.skin
            });
            p.updateSprite();
            this.map.gameObjects.players[player.id] = p;
        }
    }

    removePlayer(playerId) {
        if(this.map.gameObjects.players[playerId]) {
            this.map.gameObjects.players[playerId].clean();
            delete this.map.gameObjects.players[playerId];
        }
    }

    updateFuel({ playerId, fuel }) {
        this.map.gameObjects.players[playerId].fuel = fuel;
        if(playerId === this.map.id)
            this.map.game.healthBar.update(fuel);
    }

    updateJerrycans({ playerId, fuel, jerrycans }) {
        if(this.map.id === playerId)
            this.map.game.audios.golden.play();
        this.map.gameObjects.players[playerId].fuel = fuel; // do you really want this?
        this.map.gameObjects.players[playerId].updateJerrycans({jerrycans:jerrycans});
    }
}
