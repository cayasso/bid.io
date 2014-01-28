'use strict';

/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter
  , debug = require('debug')('bid.io:bid')
  , moment = require('moment')
  , noop = function () {};

/**
 * Module exports.
 */

exports = module.exports = Bid;

/**
 * Bid constructor.
 *
 * @param {Store|Object} store the store object
 * @api public
 */

function Bid(store) {
  this.store = store;
  this.on('error', noop);
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
 * @return {Bid} this
 * @api public
 */

Bid.prototype.set = function set(id, data, fn, flag) {
  fn = fn || noop;
  if (!id) {
    this.error('Missing bid id', fn);
    return this;
  }
  data = data || {};
  data.id = +id;
  data.owners = data.owners || {};
  data.owner = data.owner || null;
  data.locked = data.locked || 0;
  data.state = data.state || 0;
  data.active = ('active' in data) ? data.active : true;
  this.store.set(id, data, fn, flag);
  return this;
};

/**
 * Get a `bid` from store.
 *
 * @param {String|Number} id bid id
 * @param {Function} fn
 * @return {Bid} this
 * @api public
 */

Bid.prototype.get = function get(id, fn) {
  fn = fn || noop;
  this.store.get(id, fn);
  return this;
};

/**
 * Fetch a `bid` from store.
 *
 * @param {String|Number} id bid id
 * @param {Function} fn
 * @return {Bid} this
 * @api public
 */

Bid.prototype.fetch = function fetch(id, fn) {
  var self = this;
  fn = fn || noop;

  var query = { id: id, saleDate: this.today };

  this.find(query, function find(err, bid) {
    if (self.handleError(err, bid, fn)) return;
    if ('function' === typeof fn) fn(null, bid);
    self.emit('fetch', bid);
  });
};

/**
 * Find a `bid` from store.
 *
 * @param {Object} query the query object
 * @param {Function} fn the callback
 * @return {Bid} this
 * @api public
 */

Bid.prototype.find = function find(query, fn) {
  fn = fn || noop;

  // make sure we have a query object
  query = query || {};

  // format query when its an id
  if (/number|string/.test(typeof query)) {
    query = { id: query };
  }

  // format query when its all
  if ('all' === query) {
    query = { id: 'all' };
  }

  // search by sale date
  query.saleDate = this.today;

  // do the find
  this.store.find(query, fn);
  return this;
};

/**
 * Lock a `bid`.
 *
 * @param {String|Number} id bid id
 * @param {Object} owner
 * @param {Boolean} force
 * @param {Function} fn
 * @return {Bid} this
 * @api public
 */

Bid.prototype.lock = function lock(id, owner, force, fn) {
  var self = this;
  if ('function' === typeof force) {
    fn = force;
    force = null;
  }
  fn = fn || noop;
  owner = owner || {};
  self.get(id, function get(err, bid) {
    if (bid && force) bid.locked = 0;
    if (self.handleError(err, bid, owner.id, fn)) return;
    bid.locked = 1;
    bid.owner = owner;
    bid.owners[owner.id] = owner;
    return self.set(id, bid, function set(err, bid) {
      if (self.handleSetError(err, bid, fn)) return;
      fn(null, bid);
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
 * @param {Function} fn
 * @return {Bid} this
 * @api public
 */

Bid.prototype.claim = function (id, owner, fn) {
  return this.lock(id, owner, true, fn);
};

/**
 * Unlock a `bid`.
 *
 * @param {String|Number} bid id
 * @param {Object} owner the owner object
 * @param {Boolean} force
 * @param {Function} fn
 * @return {Bid} this
 * @api public
 */

Bid.prototype.unlock = function unlcok(id, owner, force, fn) {
  var self = this;
  if ('function' === typeof force) {
    fn = force;
    force = null;
  }
  fn = fn || noop;
  owner = owner || {};
  self.get(id, function get(err, bid) {
    if (self.handleError(err, bid, fn)) return;
    if (!bid.locked) return self.error('Bid is not locked', fn);
    if (null === bid.owner || owner.id === bid.owner.id || force) {
      bid.owner = null;
      bid.locked = 0;
      return self.set(id, bid, function set(err, bid) {
        if (self.handleSetError(err, bid, fn)) return;
        fn(null, bid);
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
 * @param {Function} fn
 * @return {Bid} this
 * @api public
 */

Bid.prototype.forceunlock = function forceunlock(id, oid, fn) {
  return this.unlock(id, oid, true, fn);
};

/**
 * Ser a `bid` to pending mode.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner the owner object
 * @param {Function} fn callback function
 * @return {Bid} this
 * @api public
 */

Bid.prototype.pending = function pending(id, owner, fn) {
  var self = this;
  fn = fn || noop;
  owner = owner || {};
  self.get(id, function get(err, bid) {
    if (self.handleError(err, bid, owner.id, fn)) return;
    bid.locked = 0;
    bid.state = 1;
    bid.owner = null;
    bid.owners[owner.id] = owner;
    return self.set(id, bid, function set(err, bid) {
      if (self.handleSetError(err, bid, fn)) return;
      fn(null, bid);
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
 * @return {Bid} this
 * @api public
 */

Bid.prototype.complete = function complete(id, owner, fn) {
  var self = this;
  fn = fn || noop;
  owner = owner || {};
  self.get(id, function get(err, bid) {
    if (self.handleError(err, bid, owner.id, fn)) return;
    bid.locked = 1;
    bid.state = 2;
    bid.owner = owner;
    bid.owners[owner.id] = owner;
    return self.set(id, bid, function set(err, bid) {
      if (self.handleSetError(err, bid, fn)) return;
      fn(null, bid);
      self.emit('complete', bid);
    });
  });
  return this;
};

/**
 * Force update a `bid`.
 *
 * @param {String|Number} id the bid id
 * @param {Object} data
 * @param {Function} fn
 * @return {Bid} this
 * @api public
 */

Bid.prototype.update = function update(id, data, fn, flag) {
  var self = this;
  fn = fn || noop;
  flag = flag || { type: 'update' };
  this.set(id, data, function set(err, bid) {
    if (err) return self.error(err, fn);
    fn(null, bid);
    self.emit('update', bid);
  }, flag);
  return this;
};

/**
 * Clear county store.
 *
 * @param {Function} fn callback function
 * @return {Bid} this
 * @api protected
 */

Bid.prototype.clear = function clear(fn) {
  return this.store.clear(fn || noop);
};

/**
 * Handle `bid` set errors.
 *
 * @param {String|Number|Object} error error object
 * @param {Function} fn callback function
 * @return {Boolean} it always return true
 * @api private
 */

Bid.prototype.handleSetError = function handleSetError(err, bid, fn) {
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
 * @param {Function} fn
 * @return {Boolean} it always return false
 * @api private
 */

Bid.prototype.handleError = function handleError(err, bid, oid, fn) {
  if ('function' === typeof oid) {
    fn = oid;
    oid = null;
  }
  if (err) return this.error(err, fn);
  if (!bid) return this.error('Bid not found', fn);
  if (2 === bid.state) return this.error('Bid is completed', fn);
  if (3 === bid.state) return this.error('Bid is not active', fn);
  if (3 < bid.state) return this.error('Unknown bid state', fn);
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

Bid.prototype.error = function error(err, fn) {
  var error;
  if ('number' === typeof err) {
    error = { code: err };
  } else if ('string' === typeof err) {
    error = { message: err };
  } else if (undefined !== err) {
    error = { data: err.data || '', message: err.message };
  } else {
    error = { message: 'Unknown error' };
  }
  if ('function' === typeof fn) fn(error);
  this.emit('error', error);
  return true;
};

// Lazy load todays date for query
Object.defineProperty(Bid.prototype, 'today', {
  get: function () {
    return moment().format('L');
  }
});