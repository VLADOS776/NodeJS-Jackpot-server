var io              = require("../jackpot").io;
var Jackpot         = require("./jackpot");
var config          = require("./config");

var allPlayers = {};

var Players = module.exports = {
    newClient: function(socket) {
        console.log("New connection: "+socket.id);

        allPlayers[socket.id] = socket;
        
        
        socket.emit('stats', Jackpot.stats());

        socket.on('enterRoom', function(roomID){
            console.log('Игрок зашел в комнату', roomID);
            Jackpot.enterRoom(socket.id.toString(), roomID);
            socket.join(roomID);
        });

        socket.on('disconnect', function(){
            console.log('disconect: ' + socket.id.toString());

            delete allPlayers[socket.id];
        });
    },
    clientsInRoom: function(room) {
        var a = 0;
        return io.sockets.adapter.rooms[room].length;
    },
    sendTo: function(id) {
        return function(type, obj) {
            if (allPlayers[id])
                allPlayers[id].emit(type, obj);
        }
    },
}

/*
module.exports.newClient        = Players.newClient;
module.exports.clientsInRoom    = Players.clientsInRoom;
module.exports.sendTo           = Players.sendTo;
*/