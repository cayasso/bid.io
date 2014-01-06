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
  this.clear();
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
  console.log('======================== NeDB GET ======================', id);
  var store = this
    , query = { id: +id };
  fn = fn || noop;
  debug('set request for id %s with data $j', id);
  store.db.findOne(query, function get(err, data) {
    console.log('============= RETURNING ===========', id, err, data);
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

NeDB.prototype.set = function set(id, data, fn, remote) {
  console.log('======================== NeDB SET ======================', id, data, remote);
  debug('set request for id %s with data $j', id, data);
  var store = this
    , query = { id: +id }
    , update = {};
  fn = fn || noop;

  store.db.findOne(query, function findOne(err, doc) {
    if (err) return fn(err);
    if (!doc) {
      debug('inserting data %j', data);
      return store.db.insert(data, fn);
    }
    Object.keys(data).forEach(function each(key){
      if (doc[key] !== data[key]) {
        if (remote) {
          if (/locked|state|owner|owners/.test(key)) {
            if (!doc.locked && !doc.state) {
              update[key] = data[key];
            }
          } else {
            update[key] = data[key];
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
        console.log('XXXXXXXXXXXX XXXXXXXXXXXXXXXXXX XXXXXX');
        console.log('SAVING THIS STUFF',query, update, doc);
        console.log('XXXXXXXXXXXX XXXXXXXXXXXXXXXXXX XXXXXX');
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
  console.log('======================== NeDB DEL ======================', id);
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
  console.log('======================== NeDB FIND ======================', query);
  fn = fn || noop;
  if (!query) throw new Error('Invalid query parameter');
  if ('object' !== typeof query) {
    if ('all' !== query) {
      return this.db.findOne({ id: +query }, fn);
    } else {
      query = {};
    }
  }
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
