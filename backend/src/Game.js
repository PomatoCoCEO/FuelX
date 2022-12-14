import Cell from "./Cell.js";
import Player from "./Player.js";
import { utils } from "./utils.js";
import { io } from './index.js';

export default class Game {

    constructor(notify, notifyRoom) {
        this.observers = [];
        this.rooms = {};
        this.playerRoom = {};
        this.drillCost = 10;
        this.notify = notify;
        this.notifyRoom = notifyRoom;
    }

    instantiatePlayer(room, playerId, name, skin) {
        this.playerRoom[playerId] = room;
        this.rooms[room].players[playerId] = new Player({
            id: playerId,
            name: name,
            x: 0,
            y: 0,
            direction: 'down',
            game: this,
            skin
        });
    }

    shortId(playerId) {
        return (`${playerId}`).substring(0, 9);
    }

    subscribe(observerFunction) {
        this.observers.push(observerFunction);
    }

    notifyAll(command) {
        for(let observerFunction of this.observers)
            observerFunction(command);
    }

    disconnectPlayer(playerId) {
        const room = this.playerRoom[playerId]
        if(!room)
            return;
        delete this.rooms[room].players[playerId];
        delete this.playerRoom[playerId];
        this.notifyRoom(room, {
            type: 'disconnect-player',
            args: playerId
        });
        this.notifyRoom(room, {
            type: 'notification',
            args: {
                type: 'error',
                title: 'PLAYER',
                description: `${this.shortId(playerId)} left the game.`
            }
        });
        
        this.notifyAll({
            type: 'list-rooms',
            args: Object.values(this.rooms)
        });
    }

    connectPlayer({ room, playerId, name, skin }) {
        console.log(room);
        console.log(this.rooms);
        if(!this.rooms[room].players[playerId])
            this.instantiatePlayer(room, playerId, name, skin);
        this.notifyRoom(room, {
            type: 'connect-player',
            args: {
                players: Object.values(this.rooms[room].players),
                drills: Object.values(this.rooms[room].cells)
            }
        });
        this.notifyRoom(room, {
            type: 'notification',
            args: {
                type: 'success',
                title: 'PLAYER',
                description: `${this.shortId(playerId)} joined the game.`
            }
        });

        this.notifyAll({
            type: 'list-rooms',
            args: Object.values(this.rooms)
        });
    }

    sendKey({playerId, roomId}) {
        let room = this.rooms[roomId];

        if(!room) {
            console.log("there is no room, rooms are ", this.rooms, "and roomId is ", roomId);
            return;
        }
        // const player = this.rooms[room]. mplayers[playerId];
        console.log("Sending to ",playerId);
        io.to(playerId).emit("key", {
            args: room.key
        });
    }

    movePlayer({ playerId, direction }) {
        const room = this.playerRoom[playerId];
    
        if(!room)
            return;
        const player = this.rooms[room].players[playerId];
        // console.log(" player is here ");
        let pos = {
            x: player.x,
            y: player.y
        };

        const directionUpdate = {
            'up': ['y', -64],
            'down': ['y', 64],
            'left': ['x', -64],
            'right': ['x', 64],
        };
        let otherPlayerInPos = Object.values(this.rooms[room].players).find(p => p.x === pos.x && p.y === pos.y && p.id !== playerId && p.fuel > 0);
        if(otherPlayerInPos) {
            // player is leaving so this guy will no longer interact
            io.to(otherPlayerInPos.id).emit('terrain-mode',{});
        }
        let [property, change] = directionUpdate[direction];
        pos[property] += change;
        console.log("position: ",pos);

        let playersInPos = Object.values(this.rooms[room].players).filter(p => p.x === pos.x && p.y === pos.y && p.fuel > 0);
        console.log("length of players in pos",pos,"is",playersInPos.length);
        console.log("Player positions: ");
        for(let p of Object.values(this.rooms[room].players)){
            console.log("(",p.x,",",p.y,")");
        }
        console.log("cactus in pos: ", this.hasCactus(this.rooms[room], pos));
        if(playersInPos.length < 2 ){ // && !this.hasCactus(this.rooms[room], pos)) {
            player.move(direction);
            this.notifyRoom(room,
                {
                    type: 'move-player',
                    args: {
                        playerId,
                        direction
                    }
                }
            );
            if(playersInPos.length === 1) { // THERE IS ANOTHER PLAYER
                let otherPlayer = playersInPos[0];
                console.log("sending interaction mode");
                io.to(otherPlayer.id).emit('interaction-mode',{});
                io.to(player.id).emit('interaction-mode',{});
            }
            if(playersInPos.length === 0) { // player alone in terrain cell
                io.to(player.id).emit('terrain-mode',{});
            }
        }
        else {
            direction = "still";
            io.to(player.id).emit("move-player", {
                args: {
                    playerId,
                    direction // just for the sake of it working
                }
            })
        }

    }

    hasCactus(room, pos) {
        let hash_intermediate = utils.hashCode(utils.position(pos));
        console.log("intermediate hash: ",hash_intermediate);
        console.log("room key:", room.key);
        let hash = hash_intermediate ^ room.key;
        console.log("hash of position",pos,"is", hash,"and mod is", (hash%16));
        return ((hash % 16)%8 == 7);
    }

    isCellFree(room, pos) {
        // let hash = utils.hashCode(pos) ^ room.key;
        // if(this.hasCactus(room, pos)) return false;
        return !this.rooms[room].cells[pos];
    }

    placeDrill(room, x, y) {
        const pos = utils.position(x, y);
        if(!this.rooms[room].cells[pos])
            this.rooms[room].cells[pos] = new Cell({
                x,
                y
            });
        this.rooms[room].cells[pos].startDrill();
    }

    drill({ playerId }) {
        const room = this.playerRoom[playerId];
        if(!room)
            return;
        const player = this.rooms[room].players[playerId];

        const pos = utils.position(player.x, player.y);
        if(this.isCellFree(room, pos) && player.fuel >= this.drillCost) {
            player.updateFuel(player.fuel - this.drillCost);
            this.placeDrill(room, player.x, player.y);
            this.notifyRoom(room, {
                type: 'drill',
                args: {
                    playerId,
                    x: player.x,
                    y: player.y,
                    start: Date.now()
                }
            });
        }
    }

    collect({ playerId }) {
        const room = this.playerRoom[playerId];
        if(!room)
            return;
        const player = this.rooms[room].players[playerId];
        
        const pos = utils.position(player.x, player.y);
        if(this.rooms[room].cells[pos]) {
            this.rooms[room].cells[pos].collect(player);

            this.notifyRoom(room, {
                type: 'collect',
                args: {
                    playerId,
                    x: player.x,
                    y: player.y
                }
            });

            delete this.rooms[room].cells[pos];
        }
    }



    commit({playerId}) {
        const room = this.playerRoom[playerId];
        if(!room)
            return;
        const player = this.rooms[room].players[playerId];
        let sortedPlayersBefore = Object.values(this.rooms[room].players).sort((a,b) => b.jerrycans - a.jerrycans);
        console.log("players before: ",sortedPlayersBefore);
        player.commit();
        let sortedPlayersAfter = Object.values(this.rooms[room].players).sort((a,b) => b.jerrycans - a.jerrycans);
        console.log("players after: ",sortedPlayersAfter);
        for(let i = 0; i<sortedPlayersAfter.length; i++) {
            if(sortedPlayersAfter[i].id !== sortedPlayersBefore[i].id) {
                io.to(sortedPlayersAfter[i].id).emit('notification',
                    {
                        args: {
                            'type':'success',
                            'title':'RANK CNAHGE',
                            'description':'You are now in '+utils.ordinal(i+1)+' place'
                        } 
                        
                    });
            }
        }

    }

    attack({playerId}) {
        const room = this.playerRoom[playerId];
        if(!room)
            return;
        const player = this.rooms[room].players[playerId];
        const player2 = Object.values(this.rooms[room].players).find(p => p.x === player.x && p.y === player.y && p.id !== player.id);
        if(player2) {
            let sum_fuels = player.fuel + player2.fuel;
            let p1_ratio = player.fuel / sum_fuels;
            let spent_1 = Math.floor(player.fuel/2);
            let spent_2 = Math.floor(player2.fuel/2);
            let spent_sum = spent_1 + spent_2;
            if(Math.random() < p1_ratio) {
                // player 1 wins the fight
                player.updateFuel(Math.min(player.fuel - spent_1 + spent_sum/2,100));
                player2.updateFuel(Math.max(player2.fuel - spent_2,0));
                io.to(player.id).emit('notification',{
                    args:{
                        type: 'success',
                        title:'ATTACK',
                        description: 'You won'
                    }
                });
                io.to(player2.id).emit('notification',{
                    args:{
                        type: 'error',
                        title:'ATTACK',
                        description: `${player.id} defeated you`
                    }
                });
            } else {
                player.updateFuel(Math.max(player.fuel - spent_1,0));
                player2.updateFuel(Math.floor(player2.fuel - spent_2 + spent_sum/2));
                io.to(player.id).emit('notification',{
                    args:{
                        type: 'error',
                        title:'ATTACK',
                        description: 'You lost the attack'
                    }
                });
                io.to(player2.id).emit('notification',{
                    args:{
                        type: 'success',
                        title:'ATTACK',
                        description: `You defended yourself from ${player.id}`
                    }
                });
            }

            io.to(player.id).emit('attack', { 
            });

            io.to(player2.id).emit('attack', {
            });
        }
    }

    flee({playerId}) {
        const room = this.playerRoom[playerId];
        if(!room)
            return;
        const player = this.rooms[room].players[playerId];
        if(player.fuel < 25) return;
        const player2 = Object.values(this.rooms[room].players).find(p => p.x === player.x && p.y === player.y && p.id !== player.id);
        if(player2) {
            let directions = [ {x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: 0} ];
            let dirNames = [ "up", "down","left", "right"];
            let pos = {x: player.x, y: player.y};
            io.to(player2.id).emit('terrain-mode',{});
            for(let i = 0; i<3; i++) {
                let j;
                let noPlayersInCell;
                for(j = 1; j< 4; j++) {
                   let a = {x: pos.x + directions[i].x*j*64, y: pos.y + directions[i].y*j*64};
                   noPlayersInCell = Object.values(this.rooms[room].players).filter(p => p.x === a.x && p.y === a.y).length;
                   if(noPlayersInCell<2) continue;
                   else break;
                } 
                if(j == 4) {
                    player.x = pos.x + directions[i].x*3*64;
                    player.y = pos.y + directions[i].y*3*64;
                    player.updateFuel(player.fuel - 25);
                    this.notifyRoom(room, {
                        type: 'flee-player',
                        args: {
                            playerId,
                            direction: dirNames[i]
                        }
                    });
                    if(noPlayersInCell === 1) {
                        let otherPlayer = Object.values(this.rooms[room].players).find(p => p.x === player.x && p.y === player.y && p.id !== player.id && p.fuel > 0);
                        io.to(otherPlayer.id).emit('interaction-mode',{});
                        io.to(player.id).emit('interaction-mode',{});
                    }
                    else {
                        io.to(player.id).emit('terrain-mode',{});
                    }
                       
                }
                    break;
            }
                //! we need a RUN mode for this to work!
        }
    }
    

    steal({playerId}) {
        const room = this.playerRoom[playerId];
        if(!room)
            return;
        const player = this.rooms[room].players[playerId];
        const player2 = Object.values(this.rooms[room].players).find(p => p.x === player.x && p.y === player.y && p.id !== player.id);
        if(player2 && player2.fuel > 25) {
            if(Math.random() < 0.25) {
                player2.updateFuel(player2.fuel - 25);
                player.updateFuel(Math.min(100,player.fuel + 25));
                io.to(player.id).emit('notification',{
                    args:{
                        type: 'success',
                        title:'STEAL',
                        description: 'You stole from ' + player2.id
                    }
                });
                io.to(player2.id).emit('notification',{
                    args:{
                        type: 'error',
                        title:'STEAL',
                        description: player.id + ' stole from you'
                    }
                });

                io.to(player.id).emit('steal', {
                    args: {
                        type: 1
                    }
                });
    
                io.to(player2.id).emit('steal', {
                    args: {
                        type: 2
                    }
                });
            }
            else {
                io.to(player.id).emit('notification',{
                    args:{
                        type: 'error',
                        title:'STEAL',
                        description: 'You failed to steal from ' + player2.id
                    }
                    
                });
                io.to(player2.id).emit('notification',{
                    args:{
                        type: 'success',
                        title:'STEAL',
                        description: player.id + ' tried to steal from you'
                    }
                });

                io.to(player.id).emit('steal', {
                    args: {
                        type: 3
                    }
                });
    
                io.to(player2.id).emit('steal', {
                    args: {
                        type: 4
                    }
                });
            }
        }
    }

    share({playerId}) {
        const room = this.playerRoom[playerId];
        if(!room)
            return;
        const player = this.rooms[room].players[playerId];
        const player2 = Object.values(this.rooms[room].players).find(p => p.x === player.x && p.y === player.y && p.id !== player.id);
        if(player2 && player2.fuel < player.fuel) {
            let fuel1 = player.fuel;
            let fuel2 = player2.fuel;
            let half = Math.floor((fuel1 + fuel2) / 2);
            player2.updateFuel(half);
            player.updateFuel(fuel1 + fuel2 - half);
            io.to(player.id).emit('notification',{
                args: {
                    type: 'success',
                    title:'SHARE',
                    description: 'You shared fuel with ' + player2.id
                }
            });
            io.to(player2.id).emit('notification',{
                args: {
                    type: 'success',
                    title:'SHARE',
                    description: player.id + ' shared fuel with you'
                }
            });
            io.to(player.id).emit('share', {
                args: {
                    playerId
                }
            });

            io.to(player2.id).emit('share', {
                args: {
                    playerId
                }
            });
        } // so this is the share part
    }


    listRooms(socket, command) {
        this.notify(socket, {
            type: 'list-rooms',
            args: Object.values(this.rooms)
        });
    }

    createRoom(socket, command) {
        if(this.rooms[command.args.name]) {
            this.notify(socket, {
                type: 'notification',
                args: {
                    type: 'error',
                    title: 'ERROR',
                    description: 'Room already exists'
                }
            });
            return;
        }

        this.rooms[command.args.name] = {
            name: command.args.name,
            players: {},
            maxPlayers: 8,
            cells: {},
            exclusive: command.args.exclusive,
            password: command.args.password,
            key: Math.abs(Math.floor(Math.random()*(1<<31)))  // key is from a room
        }

        console.log("key for the room:", this.rooms[command.args.name].key);

        this.notify(socket, {
            type: 'create-room',
            args: this.rooms[command.args.name]
        });

        this.notify(socket, {
            type: 'notification',
            args: {
                type: 'success',
                title: 'ROOM CREATED',
                description: 'Room '+command.args.name+" created"
            }
        })

        this.notifyAll({
            type: 'list-rooms',
            args: Object.values(this.rooms)
        });
    }

}
