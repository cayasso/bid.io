'use strict';

/**
 * Module dependencies.
 */

var mongodb = require('mongodb')
  , Store = require('../../store')
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
  debug('initializing store');
  //this.clear();
}

/**
 * Inherits from `Store`.
 */

Mongo.prototype.__proto__ = Store.prototype;

/**
 * Get an entry.
 *
 * @param {String|Number} id
 * @param {Function} fn
 * @return {Mongo} this
 * @api public
 */

Mongo.prototype.get = function get(id, fn) {
  console.log('======================== Mongo GET ======================', id);
  var store = this;
  fn = fn || noop;
  debug('set request for id %s with data $j', id, data);
  store.conn.then(function then(err, db) {
    if (err) return fn(err);
    db.collection(store.coll).findOne({ id: +id }, undefined, { safe: true }, function get(err, data) {
      console.log('============= RETURNING ===========', store.coll, id, err, data);
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

Mongo.prototype.set = function set(id, data, fn, remote) {
  console.log('======================== Mongo SET ======================', id, data, remote);
  debug('set request for id %s with data $j', id, data);
  fn = fn || noop;
  var store = this
    , query = { id: +id }
    , options = { safe: true };
  store.conn.then(function then(err, db) {
    if (err) return fn(err);
    var coll = db.collection(store.coll);
    coll.findOne(query, undefined, options, function (err, doc) {
      if (err) return fn(err);
      if (!doc) {
        debug('inserting data %j', data);
        return coll.insert(data, options, fn);
      }
      Object.keys(data).forEach(function each(key){
        if (doc[key] !== data[key]) {
          if (remote) {
            if (/locked|state/.test(key)) {
              if ('NOSALE' === doc.status || !doc.locked  && (0 === doc.state || 1 === doc.state)) {
                doc[key] = data[key];
              }
            } else {
              doc[key] = data[key];
            }
          } else {
            doc[key] = data[key];
          }
        }
      });
      debug('setting %s with data %j', id, doc);
      coll.save(doc, function save(err) {
        if (err) return fn(err);
        console.log('SAVING THIS STUFF', doc);
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
  console.log('======================== Mongo DEL ======================', id);
  debug('delete request %s', id);
  var store = this;
  fn = fn || noop;
  store.conn.then(function then(err, db) {
    if (err) return fn(err);
    debug('deleting %s', id);
    db.collection(store.coll).remove({ id: +id }, { safe: true }, fn);
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
  console.log('======================== Mongo FIND ======================', query);
  var store = this;
  fn = fn || noop;
  if (!query) throw new Error('Invalid query parameter');
  store.conn.then(function then(err, db) {
    if (err) return fn(err);
    if ('object' !== typeof query) {
      if ('all' !== query) {
        return db.collection(store.coll).findOne({ id: +query }, undefined, { safe: true }, fn);
      } else {
        query = {};
      }
    }
    db.collection(store.coll).find(query, {}, { safe: true }).toArray(fn);
  });
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
 * @return {Mongo} this
 * @api public
 */

Mongo.prototype.clear = function clear(fn) {
  var store = this;
  fn = fn || noop;
  store.conn.then(function then(err, db) {
    if (err) return fn(err);
    db.collection(store.coll).remove({}, { safe: true }, fn);
  });
};
