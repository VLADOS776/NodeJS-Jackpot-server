"use strict";
var express = new require('express');
var app     = express();
var server  = require('http').Server(app);
var io      = require('socket.io')(server);

var config          = require("./libs/config");
var Jackpot         = require("./libs/jackpot");

var Game = new Jackpot();

io.set('origins', '*:*');
var port = process.env.PORT || 8020;

server.listen(port, () => console.log(`Listening on ${ port }`));

app.use((req,res) =>  {
    res.header("Access-Control-Allow-Origin", "/^(https?:\/\/.*?vlados.*?\/)/");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.end('Jackpot server for Open Case Simulator');
})

for (let i = 0; i < config.diff.length; i++)
    Game.newRoom(i);

var allPlayers = {};

var roomsPreview = {};

setInterval(function(){
    for (var i = 0; i < Game.rooms.length; i++) {
        roomsPreview[i] = {
            diff: Game.rooms[i].diff,
            players: clientsInRoom(i)
        }
    }
    io.in('select_room').emit('stats', roomsPreview);
}, config.statsInterval);

Game.on('countdown_start', function(event) {
    io.in(event.room).emit('countdown_start', event.time);
})

Game.on('winner', function(event) {
    io.in(event.room).emit('winner', event.all);
    io.to(event.winnerID).emit('you_win', event.winner)
})

Game.on('new_game', function(event) {
    io.in(event).emit('new_game');
})

io.on('connection', function(socket) {
    console.log("New connection: "+socket.id);
    
    socket.join('select_room');

    allPlayers[socket.id] = socket;

    socket.emit('stats', roomsPreview);

    socket.on('enterRoom', function(roomID){
        let result = Game.enterRoom(socket.id.toString(), roomID);
        socket.join(roomID);
        socket.leave('select_room');
        
        result.roomid = roomID;
        socket.emit('roomInfo', result);
        socket.emit('chances', Game.rooms[roomID].chances());
    });
    
    socket.on('leaveRoom', function(room) {
        if (typeof room == 'object' && typeof room.room != 'undefined' && room.room == 'all') {
            for(var room in socket.rooms) {
                socket.leave(room);
            }
            socket.join('select_room');
            console.log(`Игрок ${socket.id} вышел из всех комнат`);
        } else if (typeof room == 'number') {
            socket.leave(room);
            console.log(`Игрок ${socket.id} вышел из комнаты ${room}`);
        }
    })
    
    socket.on('bet', function(bet) {
        console.log(`Игрок ${socket.id} сделал ставку`);
        console.log(bet);
        
        io.in(bet.room).emit('bet',Game.rooms[bet.room].bet(bet, socket.id));
        io.in(bet.room).emit('chances', Game.rooms[bet.room].chances());
    })

    socket.on('disconnect', function(){
        console.log('disconect: ' + socket.id.toString());

        delete allPlayers[socket.id];
    });
    
})

function clientsInRoom(room) {
    return io.nsps['/'].adapter.rooms[room] ? io.nsps['/'].adapter.rooms[room].length : 0;
}