'use strict';

/**
 * Module dependencies.
 */

var mongodb = require('mongodb')
  , Store = require('../../store')
  , StoreError = require('../error')
  , Connection = require('./connect')
  , debug = require('debug')('bids.io:store-mongo')
  , noop = function () {}
  , conn = null;

/**
 * Export `Mongo`.
 */

module.exports = Mongo;

/**
 * Mongo constructor.
 *
 * @param {Object} options
 * @api public
 */

function Mongo(channel, options) {
  Store.call(this, channel, options);
  this.conn = conn ? conn : (conn = new Connection(options));
  this.ensureIndex();
  debug('initializing store');
  //this.clear();
}

/**
 * Inherits from `Store`.
 */

Mongo.prototype.__proto__ = Store.prototype;

/**
 * Get database and collection.
 *
 * @return {Mongo} this
 * @api protected
 */

Mongo.prototype.coll = function clear(fn) {
  var ns = this.ns;
  this.conn.then(function then(err, db) {
    if (err) return fn(err);
    fn(err, db.collection(ns));
  });
  return this;
};

/**
 * Ensure an index for id is created.
 *
 * @return {Mongo} this
 * @api protected
 */

Mongo.prototype.ensureIndex = function ensureIndex() {
  this.coll(function collection(err, coll) {
    coll.ensureIndex('id', { unique: true }, function (err, index) {
      if (err) {
        debug('unable to create index');
        console.error('unable to create index');
        return;
      }
      debug('index %s created', index);
    });
  });
  return this;
};

/**
 * Get an entry.
 *
 * @param {String|Number} id
 * @param {Function} fn
 * @return {Mongo} this
 * @api public
 */

Mongo.prototype.get = function get(id, fn) {
  var store = this;
  fn = fn || noop;
  debug('set request for id %s with data %j', id);
  this.coll(function collection(err, coll) {
    if (err) return fn(err);
    coll.findOne({ id: +id }, undefined, { safe: true }, function get(err, data) {
      if (err) return fn(err);
      if (!data) return fn(null, null);
      debug('setting %s with data %j', id, data);
      fn(null, data);
    });
  });
  return this;
};

/**
 * Set an entry.
 *
 * @param {String|Number} id
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Mongo} this
 * @api public
 */

Mongo.prototype.set = function set(id, data, fn, flag) {
  
  debug('set request for id %s with data %j', id, data);
  
  // set a callback
  fn = fn || noop;

  // set flag
  flag = flag || {};

  var store = this
    , query = { id: +id }
    , options = { safe: true }
    , type = flag.type || 'create'
    , src = flag.src || 'app'
    , force = flag.force || false;

  this.coll(function collection(err, coll) {
    if (err) return fn(err);

    coll.findOne(query, undefined, options, function findOne(err, doc) {

      if (err) return fn(err);

      if ('update' === type && !doc) {
        return fn(new StoreError('Bid not found'));
      }

      if (!doc) {
        debug('inserting data %j', data);
        return coll.insert(data, options, function (err, docs) {
          coll.findOne(query, fn);
        });
      }

      Object.keys(data).forEach(function each(key){
        if (doc[key] !== data[key]) {
          if ('update' === type && 'app' === src) {
            if (force) {
              doc[key] = data[key];
            } else {
              if (!/locked|state|owner|saleDate/.test(key)) {
                doc[key] = data[key];
              }
            }
          } else {
            doc[key] = data[key];
          }
        }
      });

      debug('setting %s with data %j', id, doc);
      coll.save(doc, function save(err) {
        if (err) return fn(err);
        fn(null, doc);
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
 * @return {Mongo} this
 * @api public
 */

Mongo.prototype.del = function del(id, fn) {
  debug('delete request %s', id);
  var store = this;
  fn = fn || noop;
  this.coll(function collection(err, coll) {
    if (err) return fn(err);
    debug('deleting %s', id);
    coll.remove({ id: +id }, { safe: true }, fn);
  });
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
 * @return {Mongo} this
 * @api public
 */

Mongo.prototype.find = function find(query, fn) {
  var store = this;
  fn = fn || noop;
  if (!query) throw new StoreError('Invalid query parameter');
  this.coll(function collection(err, coll) {
    if (err) return fn(err);
    if (query.id && 'all' !== query.id) {
      return coll.findOne(query, undefined, { safe: true }, fn);
    }

    delete query.id;

    coll.find(query, {}, { safe: true }).toArray(fn);

  });
  return this;
};


// create, read, update delete


/**
 * Clear all objects.
 *
 * ####Example:
 *
 *     // this will wipe the bids database
 *     store.clear(fn);
 *
 * @param {Function} fn
 * @return {Mongo} this
 * @api public
 */

Mongo.prototype.clear = function clear(fn) {
  var store = this;
  fn = fn || noop;
  this.coll(function collection(err, coll) {
    if (err) return fn(err);
    coll.remove({}, { safe: true }, fn);
  });
};
