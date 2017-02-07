"use strict";
var request = require('request'),
    fs = require('fs');

var Prices = module.exports = {
    weapons: {},
    prices: {},
    init: function() {
        request({
            url: 'https://vlados776.github.io/OpenCase_Beta2/scripts/weapons.js',
        }).pipe(fs.createWriteStream('temp/weapons.js'))
        .on('close', function() {
            fs.readFile('./temp/weapons.js', 'utf8', function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    let search = 'var Items = {';
                    Prices.weapons = eval('({' + data.substring(data.indexOf(search) + search.length) + ')').weapons;
                    console.log('Оружие загружено');
                }
            })
        })
        
        request({
            url: 'https://vlados776.github.io/OpenCase_Beta2/scripts/prices.js',
        }).pipe(fs.createWriteStream('temp/prices.js'))
        .on('close', function() {
            fs.readFile('./temp/prices.js', 'utf8', function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    let search = 'var Prices = {';
                    Prices.prices = eval('({' + data.substring(data.indexOf(search) + search.length) + ')');
                    console.log('Цены загружены');
                }
            })
        })
    },
    getPrice: function(item) {
        if (typeof item == 'undefined' || typeof item.item_id != 'number') return 0;
        
        item.quality = item.quality || 0;
        item.stattrak = item.stattrak || false;
        item.souvenir = item.souvenir || false;
        let cat = item.stattrak ? 'stattrak' : item.souvenir ? 'souvenir' : 'default';
        
        let itemPrices = Prices.prices[item.item_id];
        
        if (typeof itemPrices == 'undefined') {
            console.log('Предмет не найден');
            console.log(item);
            return 0
        }
        
        let prices = itemPrices.prices[cat][item.quality];
        if (typeof prices == 'undefined') return 0;
        let price = prices.market > 0 ? prices.market : prices.analyst > 0 ? prices.analyst : prices.opskins > 0 ? prices.opskins : 0;
        
        return price
    }
}