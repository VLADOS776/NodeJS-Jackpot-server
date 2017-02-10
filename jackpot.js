"use strict";
var express = new require('express');
var app     = express();
var server  = require('http').Server(app);
var io      = require('socket.io')(server);
var log4js  =require('log4js');

var config      = require("./libs/config");
var Jackpot     = require("./libs/jackpot");
var logger      = log4js.getLogger();

var Game = new Jackpot();

io.set('origins', '*:*');
var port = process.env.PORT || 8020;

server.listen(port, () => logger.info(`Listening on ${ port }`));

app.use((req,res, next) =>  {
    var allowed = /^(https?)?(:\/\/vlados|.*?localhost|.*?192\.168\.1\.205|:\/\/.*?\/vlados.*?)/ig;
    var origin = req.headers.origin;
    if (allowed.test(origin))
        res.setHeader("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Credentials", "true");
    next();
})

app.get('/', (req, res) => {
    res.send('Jackpot server');
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
    io.to(event.winnerID).emit('you_win', event.winner)
    io.in(event.room).emit('winner', event.all);
    
    logger.info(`Отправляем вещи. Победитель: ${event.all.nickname} | ${event.all.chance}% (${event.winnerID})`)
})

Game.on('new_game', function(event) {
    io.in(event).emit('new_game');
})

io.on('connection', function(socket) {
    logger.info("Новое подключение: "+socket.id);
    
    socket.join('select_room');

    allPlayers[socket.id] = socket;

    socket.emit('stats', roomsPreview);

    socket.on('enterRoom', function(roomID){
        if (roomID < 0) return;
        let result = Game.enterRoom(socket.id.toString(), roomID);
        socket.join(roomID);
        socket.leave('select_room');
        
        result.roomid = roomID;
        socket.emit('roomInfo', result);
        socket.emit('chances', Game.rooms[roomID].chances());
    });
    
    socket.on('chat', function(event) {
        io.emit('chat', event);
    })
    
    
    socket.on('leaveRoom', function(room) {
        if (typeof room == 'object' && typeof room.room != 'undefined' && room.room == 'all') {
            for(var room in socket.rooms) {
                if (room != socket.id)
                    socket.leave(room);
            }
            socket.join('select_room');
            logger.info(`Игрок ${socket.id} вышел из всех комнат`);
        } else if (typeof room == 'number') {
            socket.leave(room);
            logger.info(`Игрок ${socket.id} вышел из комнаты ${room}`);
        }
    })
    
    socket.on('bet', function(bet) {
        logger.info(`Игрок ${socket.id} сделал ставку`);
        logger.debug(bet);
        
        io.in(bet.room).emit('bet',Game.rooms[bet.room].bet(bet, socket.id));
        io.in(bet.room).emit('chances', Game.rooms[bet.room].chances());
    })
    
    socket.on('items back', function(room) {
        var result = Game.rooms[room].itemsBack(socket.id);
        
        if (result) {
            socket.emit('items back', result);
        }
    })

    socket.on('disconnect', function(){
        logger.info('Игрок вышел из игры ' + socket.id.toString());

        delete allPlayers[socket.id];
    });
    
})

function clientsInRoom(room) {
    return io.nsps['/'].adapter.rooms[room] ? io.nsps['/'].adapter.rooms[room].length : 0;
}