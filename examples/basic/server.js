var express = require('express');
var app = express();
var server = require('http').Server(app);
var counties = require('./channels');
var BidIO = require('../../');


// Express stuff
app.use(express.static(__dirname));

// loading counties (channels)
var options = {
	channels: counties
};

// passing in options
var bio = BidIO(server, options);
var cobbS=new Array();
for (var key in counties){
    console.log(counties[key]);
    if(key!= 0) {                    
        cobbS[key]=bio.getChannel(key);
        // listening to incomming connections on Cobb channel
        cobbS[key].on('connection', function (socket) {
                console.log('incoming connection from ', socket.id);
                socket.emit('Hi from the Cobb channel master');
        });

        bio.io.on('connection', function (socket) {
	console.log('CONNECTED');
	socket.emit('hi');
            socket.on('hi', function () {
                console.log('============ HI =============');
                socket.emit('hi');
            });            
            socket.on('restart', function () {
                process.exit();
            });
        });
// listening to in/out bid stream
    cobbS[key].on('stream', function (packet) {
	console.log('In/Out bid stream', packet);
    });

        for (var i = 1; i <= 10; i++) {
            cobbS[key].bid.set(i, { description: 'this is bid: ' + i +' in county '+counties[key]+'('+key+')', 
                    county:key
            });
        }
     }
 }

/* 
 * 
 * Hardcoded things are left in for whoever who wants to use them
 *
// getting the Cobb channel
var Cobb = bio.getChannel('32');

// listening to incomming connections on Cobb channel
Cobb.on('connection', function (socket) {
	console.log('incoming connection from ', socket.id);
	socket.emit('Hi from the Cobb channel master');
});

bio.io.on('connection', function (socket) {
	console.log('CONNECTED');

	socket.emit('hi');

	socket.on('hi', function () {

		console.log('============ HI =============');
		socket.emit('hi');
	});
});
// listening to in/out bid stream
Cobb.on('stream', function (packet) {
	console.log('In/Out bid stream', packet);
});

// lets add some bids to Cobb channel
for (var i = 1; i < 10; i++) {
	Cobb.bid.set(i, { description: 'this is bid: ' + i });
}

*/
//End of hardcoded comment, the rest was like that

/*Cobb.bid.get(2, function (err, bid) {
	console.log('Getting bid with id 2 ', bid);
});*/

// listening to in/out bid stream

/*
Cobb.on('stream.lock', function (packet) {
	console.log('In/Out bid stream', packet);
});

Cobb.on('stream.unlock', function (packet) {
	console.log('In/Out bid stream', packet);
});

Cobb.on('stream.complete', function (packet) {
	console.log('In/Out bid stream', packet);
});

Cobb.on('stream.fetch', function (packet) {
	console.log('In/Out bid stream', packet);
});

Cobb.on('stream.raw', function (packet) {
	console.log('In/Out bid stream', packet);
});
*/

// Watch bids
/*Cobb.watch(function (data, action) {
	console.log(data, event);
});
*/







/*
Cobb.on('connection', function (socket) {
	console.log('CONNECTED');
});*/

server.listen(process.env.PORT || 3000);