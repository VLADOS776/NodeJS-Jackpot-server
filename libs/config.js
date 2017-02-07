var config = {
    timeLimit: 10000,//60000,
    pauseAfterGame: 14000,
    minBets: 2,
    topCount: 10,
    statsInterval: 5000,
    
}

var diff = [{
        min: 0.1,
        max: 5,
        items: 50,
        perPlayer: 15
    }, {
        min: 5,
        max: 30,
        items: 50,
        perPlayer: 15
    }, {
        min: 30,
        max: 80,
        items: 50,
        perPlayer: 15
    }, {
        min: 80,
        max: 200,
        items: 50,
        perPlayer: 15
    }, {
        min: 200,
        max: 999999999,
        items: 50,
        perPlayer: 15
    }
]

config.diff = diff;

module.exports = config;