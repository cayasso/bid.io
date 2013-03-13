/**
 * Module dependencies.
 */

var debug = require('debug')('bid.io-client:channel');
var parser = require('./parser');
var encode = parser.encode;
var decode = parser.decode;

/**
 * Module exports.
 */

module.exports = Channel;

/**
 * Channel constructor.
 *
 * @param {String} name channel name
 * @param {Manager} manager manager instance
 * @param {Function} fn callback
 * @api private
 */

function Channel (name, manager, fn) {
  this.opts = manager.opts;
  this.io = manager.io;
  this.url = manager.url;
  this.ns = manager.ns || 'stream';
  this.name = name;
  this.watches = {};
  this.actions = [
    'join',
    'leave',
    'fetch',
    'lock',
    'unlock',
    'complete',
    'error'
  ];
  this.connect(fn);
}

/**
 * Get a `socket` instance and connect to it.
 *
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.connect = function (fn) {
  var self = this;
  //io = ('undefined' !== typeof eio) ? eio : io;
  this.socket = this.io.connect(self.url + '/' + self.name, self.opts);
  this.socket.on('connect', function () {
    if (fn) fn(self);
  });
  return this;
};

/**
 * Fetch a `bid` from server.
 *
 * @param {String|Number} id the bid id
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.fetch = function (id, fn) {
  this.send(parser.FETCH, id, fn);
};

/**
 * Lock a `bid` by opening it.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object with at least an id attribute
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.open = function (id, owner, fn) {
  this.send(parser.LOCK, id, owner, fn);
  return this;
};

/**
 * Cancel a `bid` by unlocking it.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object with at least an id attribute
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.cancel = function (id, owner, fn) {
  this.send(parser.UNLOCK, id, owner, fn);
  return this;
};

/**
 * Complete (close) a `bid`.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object with at least an id attribute
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.complete = function (id, owner, fn) {
  this.send(parser.COMPLETE, id, owner, fn);
  return this;
};

/**
 * Watch a `bid` or all `bids` in a `channel`.
 *
 * @param {String|Number} bidId the bid id or actions to watch
 * @param {String} actions the the actions to watch
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.watch = function (bidId, actions, fn) {
  if ('function' === typeof bidId) {
    fn = bidId;
    actions = '*';
    bidId = null;
  } else if (~this.actions.indexOf(bidId)) {
    fn = actions;
    actions = bidId;
    bidId = null;
  } else if ('function' === typeof actions){
    fn = actions;
    actions = '*';
  }

  var self = this;
  var args = [].slice.apply(arguments);

  // validate action
  var valid = function (action) {
    actions = actions.toString();
    action = action.toLowerCase();
    return ~actions.indexOf(action);
  };
  self.watches[bidId] = function cb (packet) {
    var result = decode(packet);
    var id = result.id;
    var type = result.type;
    var action = parser.types[type];
    var isValid = valid(action);

    if (bidId && id == bidId && isValid) {
      return fn(result.data, action);
    }
    if (bidId && id == bidId && valid('*')) {
      return fn(result.data, action);
    }
    if (bidId && id != bidId) {
      return;
    }
    if (!bidId && isValid || valid('*')) {
      return fn(result.data, action);
    }
  };
  self.socket.on(this.ns, self.watches[bidId]);
  return this;
};

/**
 * Stop watching a `bid` or all `bids` from a `channel`.
 *
 * @param {String|Number} id the bid id to unwatch
 * @return {Channel} self
 * @api public
 */

Channel.prototype.unwatch = function (id) {
  var watch = this.watches[id];
  if (watch) {
    this.socket.removeListener(this.ns, watch);
    delete this.watches[id];
    console.log('unwatching bid: ', id, 'actions: ', actions);
  }
  return this;
};

/**
 * Send response to server.
 *
 * @param {Number} type request type
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object
 * @return {Channel} self
 * @api private
 */

Channel.prototype.send = function (type, id, owner, fn) {
  if ('function' === typeof owner) {
    fn = owner;
    owner = null;
  }
  var data = { owner: owner };
  var packet = encode({ type: type, id: id, data: data });
  this.socket.emit(this.ns, packet, function (packet) {
    var result = decode(packet);
    if (parser.ERROR === result.type) {
      fn && fn(result.data);
    } else {
      fn && fn(null, result.data);
    }
  });
};