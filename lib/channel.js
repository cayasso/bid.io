'use strict';

/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter
  , debug = require('debug')('bid.io:channel')
  , Bid = require('./bid')
  , parser = require('bid.io-parser')
  , encode = parser.encode
  , decode = parser.decode
  , packets = parser.packets
  , packetkeys = parser.packetslist
  , noop = function () {};

/**
 * Module exports.
 */

exports = module.exports = Channel;

/**
 * Channel constructor.
 *
 * @param {Server} server the server object
 * @param {Socket} conn incoming socket connection
 * @api private
 */

function Channel(name, server) {
  if (!(this instanceof Channel)) return new Channel(name, server);
  this.server = server;
  this.name = name;
  this.encode = encode;
  this.decode = decode;
  this.ns = server.ns();
  this.on('error', noop);
  this.store = new (server.store())(this, server.storeOptions);
  this.bid = new Bid(this.store);
  this.bind();
}

/**
 * Inherits from `EventEmitter`.
 */

Channel.prototype.__proto__ = Emitter.prototype;

/**
 * Create a new socket.io namespace.
 *
 * @param {Server} server server
 * @return {Channel} this
 * @api private
 */

Channel.prototype.bind = function bind(server) {
  this.io = this.server.io.of('/' + this.name);
  this.onconnection = this.onconnection.bind(this);
  this.io.on('connection', this.onconnection);
  return this;
};

/**
 * Called on incomming connections.
 *
 * @param {Socket} conn socket
 * @return {Channel} this
 * @api private
 */

Channel.prototype.onconnection = function onconnection(conn) {
  debug('incoming connection from %s ', conn.id);
  conn.on(this.ns, this.onstream(conn).bind(this));
  this.emit('connection', conn);
  this.server.emit('connection', this, conn);
  return this;
};

/**
 * Called with incoming stream data.
 *
 * @param {Object} data
 * @param {Function} fn callback
 * @return {Channel} this
 * @api private
 */

Channel.prototype.onstream = function onstream(conn) {
  return function (data, fn, flag) {

    var user = null
      , packet = decode(data.toString())
      , id = packet.id
      , type = packet.type
      , owner = packet.data.owner
      , query = packet.data.query
      , res = this.respond(conn, type, id, fn);

    if ('server' !== conn) {
      user = conn.handshake.user;
    }

    data = packet.data.update;

    if (!owner && user && user.id) {
      owner = { id: user.id, name: user.name, color: user.color };
    }

    console.log('bid.io-channel *********** START REQUEST ***********');
    console.log('bid.io-channel Bid ID => %s', id);
    console.log('bid.io-channel Type => %s', type);
    console.log('bid.io-channel Bid Owner => %j', owner);
    console.log('bid.io-channel User => %j', user);
    console.log('bid.io-channel Query => %j', query);
    console.log('bid.io-channel Data => %j', data);
    console.log('bid.io-channel *********** END REQUEST *************');

    //if (!owner) owner = null;
    debug('got packet %j', packet);

    if ('fetch' === type) {
      this.bid[type](id, res);
    } else if ('query' === type) {
      this.bid['find'](query, res);
    } else if ('update' === type) {
      this.bid[type](id, data, res, flag);
    } else if (type && this.bid[type]) {
      this.bid[type](id, owner, res);
    } else {
      this.emit('error', { message: 'Invalid method' });
    }
    return this;
  };
};

/**
 * Respond back to client.
 *
 * @param {Number} type the action type
 * @param {String|Number} id the bid id
 * @param {Function} fn callback
 * @return {Function}
 * @api private
 */

Channel.prototype.respond = function respond(conn, type, id, fn) {
  var channel = this;
  return function responder(err, res) {
    var packet;
    if (err || 'error' === type) {
      packet = encode({ id: id, type: 'error', data: err });
      channel.emit('error', err);
    } else {
      packet = encode({ id: id, type: type, data: res });
      channel.emit('stream', res);
    }

    if (fn) fn(packet);

    console.log('bid.io-channel *********** START RESPONSE ***********');
    console.log('bid.io-channel Bid ID => %s', id);
    console.log('bid.io-channel Type => %s', type);
    console.log('bid.io-channel Data => %j', res);
    console.log('bid.io-channel *********** END RESPONSE *************');

    if ('server' === conn) {
      return channel.io.emit(channel.ns, packet);
    }

    conn.broadcast.emit(channel.ns, packet);
  };
};

/**
 * Broadcast a message to all connected clients.
 *
 * @param {String} ev
 * @param {Mixed} data
 * @return {Channel} this
 * @api private
 */

Channel.prototype.broadcast = function (ev, data) {
  this.io.emit.apply(this.io, arguments);
};
