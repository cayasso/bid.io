/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter;
var debug = require('debug')('bid.io:bid');

/**
 * Module exports.
 */

exports = module.exports = Bid;

/**
 * Default error event listener to prevent uncaught exceptions.
 */

var defaultError = function () {};

/**
 * Bid constructor.
 *
 * @param {Store|Object} store the store object
 * @api public
 */

function Bid (store) {
  this.store = store;
  this.on('error', defaultError);
}

/**
 * Inherits from `EventEmitter`.
 */

Bid.prototype.__proto__ = Emitter.prototype;

/**
 * Set a `bid`.
 *
 * @param {String|Number} id bid id
 * @param {Object} data bid data
 * @param {Function} fn callback
 * @return {Bid} self
 * @api public
 */

Bid.prototype.set = function (id, data, fn) {
  if (!id) {
    this.error('Missing bid id', fn);
    return this;
  }
  data = data || {};
  data.id = id;
  data.owners = data.owners || {};
  data.owner = data.owner || null;
  data.locked = data.locked || 0;
  data.state = data.state || 0;
  this.store.set(id, data, fn);
  return this;
};

/**
 * Fetch a `bid` from store.
 *
 * @param {String|Number} bid id
 * @param {Function} callback
 * @return {Bid} self
 * @api public
 */

Bid.prototype.fetch =
Bid.prototype.get = function (id, fn) {
  this.store.get(id, function (err, bid) {
    if (this.handleError(err, bid, fn)) return;
    if (fn) fn(null, bid);
    this.emit('get', bid);
  }.bind(this));
  return this;
};

/**
 * Find a `bid` from store.
 *
 * @param {Object} query the query object
 * @param {Function} fn the callback
 * @return {Bid} self
 * @api public
 */

Bid.prototype.find = function (query, fn) {
  this.store.find(query, function (err, res) {
    if (fn) fn(null, res);
  }.bind(this));
  return this;
};

/**
 * Lock a `bid`.
 *
 * @param {String|Number} bid id
 * @param {Object} owner
 * @param {Function} callback
 * @return {Bid} self
 * @api public
 */

Bid.prototype.lock = function (id, owner, force, fn) { 
  owner = owner || {};
  if ('function' === typeof force) {
    fn = force;
    force = null;
  }
  var self = this;
  self.get(id, function (err, bid) {
    if (bid && force) bid.locked = 0;
    if (self.handleError(err, bid, owner.id, fn)) return;
    bid.locked = 1;
    bid.owner = owner;
    bid.owners[owner.id] = owner;
    return self.set(id, bid, function (err, bid) {
      if (self.handleSetError(err, bid, fn)) return;
      if (fn) fn(null, bid);
      self.emit('lock', bid);
    });
  });
  return this;
};

/**
 * Force lock a `bid`.
 *
 * @param {String|Number} bid id
 * @param {Object} owner object
 * @param {Function} callback
 * @return {Bid} self
 * @api public
 */

Bid.prototype.forcelock = function (id, owner, fn) {
  this.lock(id, owner, true, fn);
  return this;
};

/**
 * Unlock a `bid`.
 *
 * @param {String|Number} bid id
 * @param {Function} callback
 * @return {Bid} self
 * @api public
 */

Bid.prototype.unlock = function (id, owner, force, fn) {
  owner = owner || {};
  var self = this;
  if ('function' === typeof force) {
    fn = force;
    force = null;
  }
  self.get(id, function (err, bid) {
    if (self.handleError(err, bid, fn)) return;
    if (!bid.locked) return self.error('Bid is not locked', fn);
    if (owner.id === bid.owner.id || force) {
      bid.owner = null;
      bid.locked = 0;
      return self.set(id, bid, function (err, bid) {
        if (self.handleSetError(err, bid, fn)) return;
        if (fn) fn(null, bid);
        self.emit('unlock', bid);
      });
    }
    self.error({ message: 'Locked by another user', data: { owner: bid.owner } }, fn);
  });
  return this;
};

/**
 * Force unlock a `bid`.
 *
 * @param {String|Number} id the bid id
 * @param {String|Number} oid id
 * @param {Function} callback
 * @return {Bid} self
 * @api public
 */

Bid.prototype.forceunlock = function (id, oid, fn) {
  this.unlock(id, oid, true, fn);
  return this;
};

/**
 * Ser a `bid` to pending mode.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner the owner object
 * @param {Function} fn callback function
 * @return {Bid} self
 * @api public
 */

Bid.prototype.pending = function (id, owner, fn) {
  owner = owner || {};
  var self = this;
  self.get(id, function (err, bid) {
    if (self.handleError(err, bid, owner.id, fn)) return;
    bid.state = 1;
    bid.owner = owner;
    bid.owners[owner.id] = owner;
    return self.set(id, bid, function (err, bid) {
      if (self.handleSetError(err, bid, fn)) return;
      if (fn) fn(null, bid);
      self.emit('pending', bid);
    });
  });
  return this;
};

/**
 * Complete a `bid`.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner the owner object
 * @param {Function} fn callback function
 * @return {Bid} self
 * @api public
 */

Bid.prototype.complete = function (id, owner, fn) {
  owner = owner || {};
  var self = this;
  self.get(id, function (err, bid) {
    if (self.handleError(err, bid, owner.id, fn)) return;
    bid.locked = 1;
    bid.state = 2;
    bid.owner = owner;
    bid.owners[owner.id] = owner;
    return self.set(id, bid, function (err, bid) {
      if (self.handleSetError(err, bid, fn)) return;
      if (fn) fn(null, bid);
      self.emit('complete', bid);
    });
  });
  return this;
};

/**
 * Handle `bid` set errors.
 *
 * @param {String|Number|Object} error error object
 * @param {Function} fn callback function
 * @return {Boolean} it always return true
 * @api private
 */

Bid.prototype.handleSetError = function (err, bid, fn) {
  if (err) {
    return this.error(err, fn);
  } else if (!bid) {
    return this.error('Error saving bid', fn);
  }
};

/**
 * Handle `bid` errors.
 *
 * @param {String|Number|Object} err the error object
 * @param {Bid} bid the bid
 * @param {String|Number|Function} oid the owner id
 * @param {Function} callback
 * @return {Boolean} it always return false
 * @api private
 */

Bid.prototype.handleError = function (err, bid, oid, fn) {
  if ('function' === typeof oid) {
    fn = oid;
    oid = null;
  }
  if (err) return this.error(err, fn);
  if (!bid) return this.error('Bid not found', fn);
  if (bid.completed) return this.error('Bid is completed', fn);
  if (oid && bid.locked && bid.owner && oid !== bid.owner.id) {
    return this.error({ message: 'Locked by another user', data: { owner: bid.owner } }, fn);
  }
  return false;
};

/**
 * Normalize and send errors.
 *
 * @param {String|Number|Object} error error object
 * @param {Function} fn callback function
 * @return {Boolean} it always return true
 * @api private
 */

Bid.prototype.error = function (err, fn) {
  var error;
  if ('number' === typeof err) {
    error = { code: err };
  } else if ('string' === typeof err) {
    error = { message: err };
  } else {
    error = { data: err.data || '', message: err.message };
  }
  if (fn) fn(error);
  this.emit('error', error);
  return true;
};
