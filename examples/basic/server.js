var express = require('express');
var app = express();
var server = require('http').Server(app);
var bio = require('../../')(server);


app.use(express.static(__dirname));


var Cobb = bio.getChannel('32');

for (var i = 1; i < 10; i++) {
	Cobb.bid.set(i, { description: 'this is bid: ' + i });
}

Cobb.on('connection', function (socket) {
	console.log('CONNECTED');
});

server.listen(process.env.PORT || 3000);