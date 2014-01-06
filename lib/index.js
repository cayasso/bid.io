'use strict';

/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter
  , http = require('http')
  , send = require('send')
  , parse = require('url').parse
  , sio = require('socket.io')
  , path = require('path')
  , Bid = require('./bid')
  , stores = require('./stores')
  , MemoryStore = stores.memory
  , debug = require('debug')('bid.io:server')
  , Channel = require('./channel');

/**
 * Module exports.
 */

module.exports = Server;

/**
 * Server constructor.
 *
 * ####Example:
 *
 *     var app = require('express')();
 *     var server = require('http').Server(app);
 *     var BidIO = require('bid.io');
 *
 *     // channels to open connection on
 *     var channels = {
 *       '1': 'Bid channel 1',
 *       '2': 'Bid channel 2',
 *       '3': 'Bid channel 3'
 *     };
 *
 *     // pass in server and options to bid.io
 *     var bio = BidIO(server, { channels: channels });
 *     // 3 channels are set wating for incoming connections
 *
 *     var Chnl2 = bio.getChannel('2');
 *
 *     // set bids to it
 *     Chnl2.bid.set({ id: 123, name: 'My bid' });
 *
 *     // later get the bid
 *     Chnl2.bid.get(123, function (err, bid) {
 *       console.log(bid.name); //--> My bid
 *     });
 *
 * @param {Object} srv socket io
 * @param {Object} opts options
 * @api public
 */

function Server(srv, opts) {
  if (!(this instanceof Server)) return new Server(srv, opts);
  opts = opts || {};
  this.autorun = undefined === opts.autorun ? true : opts.autorun;
  this.ns(opts.ns || 'stream');
  this.storeOptions = opts.storeOptions || {};
  this.store(stores[this.storeOptions.name || 'memory']);
  this.channels(opts.channels || {});
  this.chnls = {};
  if (srv) this.attach(srv, opts);
}

/**
 * Inherits from `EventEmitter`.
 */

Server.prototype.__proto__ = Emitter.prototype;

/**
 * Sets the incomming connection namespace for all channels.
 *
 * ####Example:
 *
 *     var app = require('express')();
 *     var server = require('http').Server(app);
 *     var bio = require('bid.io')();
 *
 *     // set data instead of the default `stream`
 *     bio.ns('data');
 *
 *     // now attaching http server
 *     bio.attach(server);
 *
 * @param {String} ns object
 * @return {Server|String} self when setting or value when getting
 * @api public
 */

Server.prototype.ns = function ns(v){
  if (!arguments.length) return this._ns;
  this._ns = v;
  return this;
};

/**
 * Sets the store for bids.
 *
 * @param {Store} store object
 * @return {Server|Store} self when setting or value when getting
 * @api public
 */

Server.prototype.store = function store(v){
  if (!arguments.length) return this._store;
  this._store = v;
  return this;
};

/**
 * Sets channels in advance.
 *
 * ####Example:
 *
 *     var app = require('express')();
 *     var server = require('http').Server(app);
 *     var bio = require('bid.io')();
 *
 *     // channels to open connection on
 *     var channels = {
 *       '1': 'Bid channel 1',
 *       '2': 'Bid channel 2',
 *       '3': 'Bid channel 3'
 *     };
 *
 *     // setting channels in advance
 *     bio.channels(channels);
 *
 *     // now attaching http server
 *     bio.attach(server);
 *
 * @param {Store} store object
 * @return {Server|Store} self when setting or value when getting
 * @api public
 */

Server.prototype.channels = function channels(v){
  if (!arguments.length) return this._channels;
  this._channels = v;
  return this;
};

/**
 * Attaches socket.io to a server or port.
 *
 * ####Example:
 *
 *     var app = require('express')();
 *     var server = require('http').Server(app);
 *     var bio = require('bid.io')();
 *
 *     // now attaching http server
 *     bio.attach(server);
 *
 * @param {http.Server|Number} srv http server or port
 * @param {Object} options passed to socket.io
 * @return {Server} self
 * @api public
 */

Server.prototype.attach = function attach(srv, opts) {
  if ('function' == typeof srv) {
    throw new Error('Invalid server instance.');
  }
  if ('number' == typeof srv) {
    debug('creating http server and binding to %d', srv);
    var port = srv;
    srv = http.Server(function createServer(req, res){
      res.writeHead(404);
      res.end();
    });
    srv.listen(port);
  }

  // initialize socketio
  debug('creating socket.io instance with opts %j', opts);
  sio = sio.listen(srv, opts);

  // attach static file serving
  this.serve(srv, '/bid.io.js');
  this.serve(srv, '/bid.io.min.js');

  // bind to engine events
  this.bind(sio);

  return this;
};

/**
 * Attaches the static file serving.
 *
 * @param {Function|http.Server} http server
 * @api private
 */

Server.prototype.serve = function serve(server, url) {
  debug('attaching client serving req handler');
  url = url || '/bid.io.js';
  var events = server.listeners('request').slice(0);
  server.removeAllListeners('request');
  server.on('request', function onrequest(req, res) {
    if (0 == req.url.indexOf(url)) {
      var path = parse(req.url).pathname.split('/').slice(-1);
      send(req, path)
      .root(__dirname + '/../client')
      .index(false)
      .pipe(res);
    } else {
      for (var i = 0, event; event = events[i]; i++) {
        event.call(server, req, res);
      }
    }
  });
};

/**
 * Binds connection.
 *
 * @param {Object} io socket.io object
 * @return {Server} self
 * @api private
 */

Server.prototype.bind = function bind(io) {
  var self = this;
  this.io = io;
  if (this.autorun) this.run();
  return this;
};

/**
 * Set and listen to each channel connection.
 *
 * @param {Function} fn
 * @return {Server} self
 * @api public
 */

Server.prototype.run = function run(fn) {
  var keys = Object.keys(this._channels);
  var len = keys.length;
  if (this._channels) {
    for (var name in this._channels) {
      this.setChannel(name);
      len--;
      if (len === 0) {
        debug('finish setting channels');
        process.nextTick(function tick() {
          this.emit('channels', this);
          if (fn) fn(this);
        }.bind(this));
      }
    }
  } else {
    debug('no channels loaded');
  }
  return this;
};

/**
 * Set a new `channel` connection for use.
 *
 * ####Example:
 *
 *     // set bids to it
 *     var myChannel = bid.setChannel('50', function (channel) {
 *       channel.bid.set({ id: 123, name: 'My bid' });
 *     });
 *
 *     myChannel.on('ready', function (conn) {
 *       // emit ready event to client
 *       conn.emit('ready');
 *     });
 *
 * @param {String} name the name of the `channel` to get
 * @return {Server} self
 * @api public
 */

Server.prototype.setChannel = function setChannel(name) {
  if (!this.io) {
    debug('socket.io object is not defined');
    return this;
  }
  debug('establishing channel %s connection', name);
  var self = this;

  this.chnls[name] = new Channel(name, this);
  return this;
};

/**
 * Get a stored `channel` connection for use.
 *
 * ####Example:
 *
 *     // get Cobb channel
 *     var Cobb = bid.getChannel('32');
 *
 *     // set bids to it
 *     Cobb.bid.set({ id: 123, name: 'My bid' });
 *
 *     // later get the bid
 *     Cobb.bid.get(123, function (err, bid) {
 *       console.log(bid.name); //--> My bid
 *     });
 *
 * @param {String} name the name of the `channel` to get
 * @return {Channel} the `channel` instance
 * @api public
 */

Server.prototype.getChannel = function getChannel(name) {
  var chnl = this.chnls[name];
  if (!chnl) {
    debug("Channel '%s' doesn't exist.", name);
    return null;
  }
  return chnl;
};

/**
 * BC with `io.listen`
 */

Server.listen = Server;
