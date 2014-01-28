'use strict';

/**
 * Module dependencies.
 */

var DataStore = require('nedb')
  , Store = require('../../store')
  , debug = require('debug')('bids.io:store-nedb')
  , noop = function () {};

/**
 * Export `NeDB`.
 */

module.exports = NeDB;

/**
 * NeDB constructor.
 *
 * @param {Object} options
 * @api public
 */

function NeDB(channel, options) {
  Store.call(this, channel, options);
  debug('initializing store');
  this.db = new DataStore({ filename: __dirname + '/.data/channels/' + this.ns , autoload: true });
  this.db.ensureIndex({ fieldName: 'id', unique: true });
  if (this.fresh) this.clear();
}

/**
 * Inherits from `Store`.
 */

NeDB.prototype.__proto__ = Store.prototype;

/**
 * Get an entry.
 *
 * @param {String|Number} id
 * @param {Function} fn
 * @return {NeDB} this
 * @api public
 */

NeDB.prototype.get = function get(id, fn) {
  var store = this
    , query = { id: +id };
  fn = fn || noop;
  debug('set request for id %s with data $j', id);
  store.db.findOne(query, function get(err, data) {
    if (err) return fn(err);
    if (!data) return fn(null, null);
    debug('setting %s with data %j', id, data);
    fn(null, data);
  });
  return this;
};

/**
 * Set an entry.
 *
 * @param {String|Number} id
 * @param {Mixed} data
 * @param {Function} fn
 * @return {NeDB} this
 * @api public
 */

NeDB.prototype.set = function set(id, data, fn, flag) {
  debug('set request for id %s with data $j', id, data);
  var store = this
    , query = { id: +id }
    , update = {};

  // set a callback
  fn = fn || noop;

  // set flag
  flag = flag || {};

  var src = flag.src || 'app'
    , type = flag.type || 'create'
    , force = flag.force || false;

  store.db.findOne(query, function findOne(err, doc) {
    if (err) return fn(err);
    if (!doc) {
      debug('inserting data %j', data);
      return store.db.insert(data, fn);
    }

    Object.keys(data).forEach(function each(key){
      if (doc[key] !== data[key]) {
        if ('update' === type && 'app' === src) {
          if (force) {
            update[key] = data[key];
          } else {
            if (!/locked|state|owner|saleDate/.test(key)) {
              update[key] = data[key];
            }
          }
        } else {
          update[key] = data[key];
        }
      }
    });

    debug('setting %s with data %j', id, update);
    store.db.update(query, { $set: update }, function save(err) {
      if (err) return fn(err);
      store.db.findOne(query, function findOne(err, doc) {
        if (err) return fn(err);
        return fn(null, doc);
      });
    });
  });

  return this;
};

/**
 * Delete an entry.
 *
 * @param {String|Number} id
 * @param {Function} fn
 * @return {NeDB} this
 * @api public
 */

NeDB.prototype.del = function del(id, fn) {
  debug('delete request %s', id);
  fn = fn || noop;
  debug('deleting %s', id);
  this.db.remove({ id: +id }, {}, fn);
  return this;
};

/**
 * Find a `bid` or a group of bids.
 *
 * ####Example:
 *
 *     store.find(123, function(){
 *       // returns bid 123
 *     });
 *
 *     store.find({ id: 123 }, function(){
 *       // returns bid 123
 *     });
 *
 *     store.find({ state: 0, locked: 1 }, function(){
 *       // returns all bids that has state of 0 and are locked
 *     });
 *
 *     store.find({ details: 'Hello' }, function(){
 *       // returns all bids that contains the word 'Hello' in description
 *     });
 *
 *     store.find('all', function(){
 *       // returns all bids stored
 *     });
 *
 * @param {String|Number|Object} query options to use for finding
 * @param {Function} fn
 * @return {NeDB} this
 * @api public
 */

NeDB.prototype.find = function find(query, fn) {
  fn = fn || noop;
  if (!query) throw new Error('Invalid query parameter');
  if (query.id && 'all' !== query.id) {
    return this.db.findOne(query, fn);
  }
  delete query.id;
  this.db.find(query, fn);
  return this;
};

/**
 * Clear all objects.
 *
 * ####Example:
 *
 *     // this will wipe the bids database
 *     store.clear();
 *
 * @param {Function} fn
 * @return {NeDB} this
 * @api public
 */

NeDB.prototype.clear = function clear(fn) {
  fn = fn || noop;
  this.db.remove({}, { multi: true }, fn);
};
