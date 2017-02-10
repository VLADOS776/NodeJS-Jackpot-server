"use strict";
var config          = require("./config");
var firebase        = require('./firebaseDatabase');
var util            = require('util');
var EventEmitter    = require('events').EventEmitter;
var Prices          = require('./prices');
var log4js          = require('log4js');

var logger = log4js.getLogger();

var tickTimeout = 0,
    raiseInterval = 0;

var Jackpot = module.exports = function() {
    EventEmitter.call(this);
    
    Prices.init();
    
    //Игроки
    this.players = {};
    
    //Комнаты
    this.rooms = [];

    //Top игроков
    //this.top = {};
    
    //Получаем топ игроков при запуске
    //getTop();
};
util.inherits(Jackpot, EventEmitter);

Jackpot.prototype.stats = function() {
    "use strict";
    let stats = [];
    for (let i = 0; i < this.rooms.length; i++) {
        let room = this.rooms[i];
        stats[i] = {
            diff: room.diff,
            players: Object.keys(room.players).length,
            limits: room.limits
        }
    }
    return stats;
}

Jackpot.prototype.newRoom = function(diff) {
    if (!config.diff[diff]) {
        logger.error(`Нет такой сложности "${diff}"`);
        return false;
    }
    
    var newRoom = new JackpotRoom(diff);
    
    var self = this;
    
    newRoom.on('countdown_start', function(event) {
        self.emit('countdown_start', event);
    })
    
    newRoom.on('winner', function(event) {
        self.emit('winner', event)
    })
    
    newRoom.on('new_game', function(event) {
        self.emit('new_game', event)
    })
    
    this.rooms.push(newRoom);
    logger.info(`Создана комната ${diff}`);
}

Jackpot.prototype.enterRoom = function(playerID, room) {
    if (!this.rooms[room]) {
        logger.error(`Вход в несуществующую комнату ${room}`);
        return {};
    }
    
    logger.info(`Игрок ${playerID} вошел в комнату ${room}`);
    
    //this.rooms[room].players[playerID] = true;
    
    var playerBet = 0;
    for (var i = 0; i < this.rooms[room].bets.length; i++) {
        if (this.rooms[room].bets[i].playerid == playerID)
            playerBet += this.rooms[room].bets[i].weapons.length;
    }
    
    var returnObj = {
        players: this.rooms[room].players,
        bets: this.rooms[room].bets,
        gameStart: this.rooms[room].gameStart,
        history: this.rooms[room].history,
        gameStartIn: this.rooms[room].gameStartIn === 0 ? 0 : this.rooms[room].gameStartIn - Date.now(),
        limits: this.rooms[room].limits,
        playerBet: playerBet
    }
    
    if (this.rooms[room].winner != null)
        returnObj.winner = this.rooms[room].winner
    
    return returnObj
}

Jackpot.prototype.deletePlayer = function(id) {
    "use strict";
    if (this.players[id]) 
        delete this.players[id];
    for (let i = 0; i < this.rooms.length; i++) {
        if (this.rooms[i].players[id])
            delete this.rooms[i].players[id];
    }
}

var JackpotRoom = function(diff) {
    EventEmitter.call(this);
    
    //Комната
    this.diff = diff;
    
    //Игроки в игре
    this.players = {};
    
    //Ставки
    this.bets = [];
    
    //Началась ли игра
    this.gameStart = false;
    
    //Предыдущие победители
    this.history = [];

    //Игра начнется через
    this.gameStartIn = 0;
    
    //Последний билет
    this.lastTicket = 1;
    
    //Всего денег
    this.totalMoney = 0;
    
    //Всего предметов
    this.totalItems = 0;
    
    //Победитель
    this.winner = null;
    
    //Отсчет до старта
    this.startInTimeout = null;
    
    //Ограничение
    this.limits = config.diff[this.diff];
}
util.inherits(JackpotRoom, EventEmitter);

JackpotRoom.prototype.bet = function(bet, playerID) {
    // TODO проверять стоимость предметов
    // Не выходит ли за лимит комнаты
    
    bet.playerid = playerID;
    bet.itemsCost = 0;
    
    var weapons = bet.weapons;
    bet.weapons = [];
    
    for (var i = 0; i < weapons.length; i++) {
        var price = Prices.getPrice(weapons[i]);
        logger.debug(`Цена $${price} на предмет ${weapons[i].item_id}`);
        if (price < this.limits.min || price > this.limits.max) {
            logger.warn('Цена не подходит');
        } else {
            bet.itemsCost += price;
            bet.weapons.push(weapons[i]);
        }
    }
    
    
    if (typeof this.players[playerID] !== 'undefined') {
        this.players[playerID].itemsCost += bet.itemsCost;
    } else {
        this.players[playerID] = {
            itemsCost: bet.itemsCost,
            avatar: bet.avatar
        }
    }
    
    bet.tickets = {
        from: this.lastTicket,
        to: this.lastTicket + bet.itemsCost * 100
    }
    this.bets.push(bet);

    this.totalMoney += bet.itemsCost;
    this.totalItems += bet.weapons.length;

    for (var key in this.players) {
        this.players[key].chance = parseFloat(Math.round((this.players[key].itemsCost * 100) / this.totalMoney * 100) / 100);
    }
    
    if (Object.keys(this.players).length > 1 && this.gameStartIn === 0 && this.gameStart === false) {
        this.gameStartIn = Date.now() + config.timeLimit;
        logger.info('Начался обратный отсчет');
        this.emit('countdown_start', {time: (this.gameStartIn - Date.now()), room: this.diff});
        
        var that = this;
        this.startInTimeout = setTimeout(function() {
            that.start();
        }, this.gameStartIn - Date.now())
    }
    
    if (this.totalItems >= this.limits.items && this.gameStart === false || this.gameStartIn < 0) {
        this.start();
    }
    
    //this.bets.push(bet)
    this.lastTicket += bet.itemsCost * 100;

    logger.info(`Новая ставка от ${bet.nick}`);
    return bet;
}

JackpotRoom.prototype.itemsBack = function(playerID) {
    if (Object.keys(this.players).length > 1 || typeof this.players[playerID] == 'undefined')
        return false
        
    logger.info(`Игрок ${playerID} забирает свою ставку`);
    
    var weapons = [];
    for (var i = 0; i < this.bets.length; i++) {
        if (this.bets[i].playerid == playerID) {
            weapons = weapons.concat(this.bets[i].weapons);
        }
    }
    this.newGame();
    
    return weapons.length >= 1 ? weapons : false;
}

JackpotRoom.prototype.newGame = function() {
    logger.info('Новая игра');
    this.gameStart = false;
    this.lastTicket = 1;
    this.gameStartIn = 0;
    this.bets = [];
    this.players = {};
    this.totalItems = 0;
    this.totalMoney = 0;
    this.winner = null;
    
    this.emit('new_game', this.diff);
}

JackpotRoom.prototype.chances = function() {
    var result = {};
    for (var key in this.players) {
        var player = this.players[key];
        result[key]={};
        
        //result[key].nick = player.nick;
        result[key].avatar = player.avatar;
        result[key].chance = player.chance;
    }
    return result;
}

JackpotRoom.prototype.start = function() {
    this.gameStart = true;
    this.startInTimeout = null;
    
    var winner = this.getWinner();
    
    
    if (typeof winner == 'undefined')
        for (var i = i; i < 5; i++) {
            winner = this.getWinner();
            if (typeof winner != 'undefined') break;
        }
    if (typeof winner == 'undefined')
        winner = this.bets[0];
    
    try {
        var ticket = Math.rand(winner.tickets.from, winner.tickets.to);
        var chances = this.players[winner.playerid].chance;
        var allWeapons = this.bets.reduce(function(all, current) {
            return all.concat(current.weapons)
        }, [])
    } catch (e) {
        this.newGame();
    }
    logger.debug('all Weapons', allWeapons);
    
    this.winner = {
        avatar: winner.avatar,
        nickname: winner.nick,
        chance: chances,
        ticket: ticket
    }
    
    var msg = {
        all: {
            avatar: winner.avatar,
            nickname: winner.nick,
            chance: chances,
            ticket: ticket
        },
        winner: {
            weapons: allWeapons
        },
        winnerID: winner.playerid
    };
    msg.room = this.diff;
    
    this.emit('winner', msg);
    
    var that = this;
    setTimeout(function() {
        that.newGame();
    }, config.pauseAfterGame)
}

JackpotRoom.prototype.getWinner = function() {
    var weight = [];
    for (var i = 0; i < this.bets.length; i++) {
        weight.push(this.bets[i].itemsCost);
    }
    
    var win = this.bets[getRandomItem(this.bets, weight)];
    
    return win
}

var getRandomItem = function(list, weight) {
    var total_weight = weight.reduce(function (prev, cur, i, arr) {
        return prev + cur;
    });
     
    var random_num = Math.rand(0, total_weight);
    var weight_sum = 0;
     
    var i = 0;
    for (var key in list) {
        weight_sum += weight[i];
        weight_sum = +weight_sum.toFixed(2);
        
        if (random_num <= weight_sum) {
            return key;
        }
        i++;
    }
};

function getTop() {
    firebase.database().ref('top/crash').once('value').then(function (snapshot) {
        Crash.top = snapshot.val();
        Crash.top.oneGame = cleanArray(Crash.top.oneGame);
    })
    
    var first = true;
    firebase.database().ref('top/crash/update').on('value', function(data) {
        if (first) {
            first = false;
        } else {
            firebase.database().ref('top/crash/update').remove();
            getTop();
        }
    })
}

function checkTop(profit) {
    for (var i = 0; i < Crash.top.oneGame.length; i++) {
    
        if (profit > parseInt(parseInt(Crash.top.oneGame[i].bet) * parseInt(Crash.top.oneGame[i].multiply) / 100) - parseInt(Crash.top.oneGame[i].bet)) {
            return i;
        }
    }
    
    //Если в топе игроков не хватает игроков, добавляем в конец
    if (Crash.top.oneGame.length < config.topCount)
        return i;
    else
        return -1;
}

function topUpdate(place, bet) {
    Crash.top.oneGame.splice(place, 0, bet);
    if (Crash.top.oneGame.length > config.topCount) {
        Crash.top.oneGame.splice(Crash.top.oneGame.length - 1, 1);
    }
    Crash.top.oneGame = cleanArray(Crash.top.oneGame);
    firebase.database().ref('top/crash/oneGame').set(Crash.top.oneGame);
}

function cleanArray(actual) {
  var newArray = new Array();
  for (var i = 0; i < actual.length; i++) {
    if (actual[i]) {
      newArray.push(actual[i]);
    }
  }
  return newArray;
}

Math.rand = function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}