/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter;
var debug = require('debug')('bid.io:channel');
var Bid = require('./bid');
var parser = require('bid.io-parser');
var encode = parser.encode;
var decode = parser.decode;
var packets = parser.packets;
var packetkeys = parser.packetslist;

/**
 * Module exports.
 */

exports = module.exports = Channel;

/**
 * Dum error event listener to prevent uncaught exceptions.
 */

var dumerror = function () {};

/**
 * Channel constructor.
 *
 * @param {Server} server the server object
 * @param {Socket} conn incoming socket connection
 * @api private
 */

function Channel (name, server) {
  if (!(this instanceof Channel)) return new Channel(name, server);
  this.name = name;
  this.ns = server._ns;
  this.on('error', dumerror);
  this.store = new server._store;
  this.bid = new Bid(this.store);
  this.bind(server);
}

/**
 * Inherits from `EventEmitter`.
 */

Channel.prototype.__proto__ = Emitter.prototype;

/**
 * Create a new socket.io namespace.
 *
 * @param {Server} server server
 * @return {Channel} self
 * @api private
 */

Channel.prototype.bind = function (server) {
  var self = this;
  var io = server.io.of('/' + this.name);
  io.on('connection', function (conn) {
    server.emit('connection', self, conn);
    self.onconnection(conn);
  });
  this.io = io;
  return this;
};

/**
 * Called on incomming connections.
 *
 * @param {Socket} conn socket
 * @return {Channel} self
 * @api private
 */

Channel.prototype.onconnection = function (conn) {
  var self = this;
  debug('incoming connection from %s ', conn.id);
  conn.on(this.ns, function (data, fn) {
    self.onstream(conn, data, fn);
  });
  this.emit('connection', conn);
  return this;
};

/**
 * Called with incoming stream data.
 *
 * @param {Object} data
 * @param {Function} fn callback
 * @return {Channel} self
 * @api private
 */

Channel.prototype.onstream = function (conn, data, fn) {
  var packet = decode(data.toString());
  var user = {};
  var id = packet.id;
  var type = packet.type;
  var owner = packet.data.owner;
  owner = owner || user.id || null;
  debug('got packet %j', packet);

  if ('fetch' === type) {
    this.bid[type](id, this.respond(conn, type, id, fn));
  } else if (type && this.bid[type]) {
    this.bid[type](id, owner, this.respond(conn, type, id, fn));
  } else {
    this.emit('error', { message: 'Invalid method' });
  }

  return this;
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

Channel.prototype.respond = function (conn, type, id, fn) {
  var self = this;
  return function (err, res) {
    var packet;
    if (err || type === packets.error) {
      packet = encode({ id: id, type: 'error', data: err });
      self.emit('error', err);
    } else {
      packet = encode({ id: id, type: type, data: res });
      self.emit('stream', res);
    }
    if (fn) fn(packet);
    conn.emit(self.ns, packet);
    conn.broadcast.emit(self.ns, packet);
  };
};
