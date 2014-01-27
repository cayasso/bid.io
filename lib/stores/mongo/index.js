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
  this.ensureIndex();
  debug('initializing store');
  //this.clear();
}

/**
 * Inherits from `Store`.
 */

Mongo.prototype.__proto__ = Store.prototype;

/**
 * Ensure an index for id is created.
 *
 * @return {Mongo} this
 * @api protected
 */

Mongo.prototype.ensureIndex = function ensureIndex() {
  var store = this;
  store.conn.then(function then(err, db){
    db.collection(store.ns).ensureIndex("id", function (err, index) {
      if (err) {
        debug('unable to create index');
        console.error('unable to create index');
        return;
      }
      debug('index %s created', index);;
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
  store.conn.then(function then(err, db) {
    if (err) return fn(err);
    db.collection(store.ns).findOne({ id: +id }, undefined, { safe: true }, function get(err, data) {
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
  


  debug('set request for id %s with data %j', id, data);
  fn = fn || noop;
  var store = this
    , query = { id: +id }
    , options = { safe: true };
  store.conn.then(function then(err, db) {
    if (err) return fn(err);
    var coll = db.collection(store.ns);

    coll.findOne(query, undefined, options, function findOne(err, doc) {

      if (err) return fn(err);

      if ('update' === remote && !doc) {
        console.log(remote, doc, query, options);
        return fn({ message: 'Bid not found' });
      }

      if (!doc) {
        debug('inserting data %j', data);
        return coll.insert(data, options, function (err, docs) {
          coll.findOne(query, fn);
        });
      }

      Object.keys(data).forEach(function each(key){
        if (doc[key] !== data[key]) {
          if (remote) {
            if (/locked|state|owner|owners/.test(key)) {
              /*if (!doc.locked && !doc.state) {
                doc[key] = data[key];
              }*/
              if (!doc.locked) {
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
  store.conn.then(function then(err, db) {
    if (err) return fn(err);
    debug('deleting %s', id);
    db.collection(store.ns).remove({ id: +id }, { safe: true }, fn);
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
  if (!query) throw new Error('Invalid query parameter');
  store.conn.then(function then(err, db) {
    if (err) return fn(err);
    if (query.id && 'all' !== query.id) {
      return db.collection(store.ns).findOne(query, undefined, { safe: true }, fn);
    }

    delete query.id;

    db.collection(store.ns).find(query, {}, { safe: true }).toArray(fn);

    /*if ('object' !== typeof query) {
      if ('all' !== query.id) {
        return db.collection(store.ns).findOne({ id: +query }, undefined, { safe: true }, fn);
      }
      delete query.id;
    }

    db.collection(store.ns).find(query, {}, { safe: true }).toArray(fn);*/
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
    db.collection(store.ns).remove({}, { safe: true }, fn);
  });
};
