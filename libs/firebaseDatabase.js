var firebase = require('firebase');
var config = require('./config');

firebase.initializeApp({
    serviceAccount: {
        projectId: "admob-app-id-8282025074",
        clientEmail: "nodeserver@admob-app-id-8282025074.iam.gserviceaccount.com",
        privateKey: "PRIVATE_KEY_HERE"
    },
    databaseURL: "https://admob-app-id-8282025074.firebaseio.com/"
});

module.exports = firebase;