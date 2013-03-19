
/**
 * Module dependencies.
 */

var Store = require('../store');
var debug = require('debug')('bids.io:store-memory');

/**
 * Module exports.
 */

module.exports = exports = Memory;

/**
 * Memory store constructor.
 *
 * @api public
 */

function Memory () {
  Store.call(this);
  this.name = 'memory';
  this.data = {};
}

/**
 * Inherits from `Store`.
 */

Memory.prototype.__proto__ = Store.prototype;

/**
 * Sets a `bid` object.
 *
 * ####Example:
 *
 *     store.set(123, { name: 'My bid'}, function(err, bid){
 *       console.log(bid);
 *     });
 *
 * @param {String|Number} id the id to set
 * @param {Object} data the data to store
 * @param {Function} fn the callback function
 * @return {Memory} self
 * @api public
 */

Memory.prototype.set = function (id, data, fn) {
  this.async(function () {
    this.data[id] = data;
    if (fn) fn(null, this.data[id]);
  });
  return this;
};

/**
 * Gets a `bid`.
 *
 * ####Example:
 *
 *     store.get(123, function(err, bid){
 *       console.log(bid);
 *     });
 *
 * @param {String|Number} id the id to get
 * @param {Function} fn the callback function
 * @return {Memory} self
 * @api public
 */

Memory.prototype.get = function (id, fn) {
  this.async(function () {
    if (fn) fn(null, this.data[id]);
  });
  return this;
};

/**
 * Delete a `bid`.
 *
 * ####Example:
 *
 *     store.del(123, function(){
 *       // returns when 123 is deleted
 *     });
 *
 * @param {String|Number} id the id to delete
 * @param {Function} fn the callback function
 * @return {Memory} self
 * @api public
 */

Memory.prototype.del = function (id, fn) {
  this.async(function () {
    delete this.data[id];
    if (fn) fn(null);
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
 * @param {Function} fn callback function that returns an array of bids
 * @return {Memory} self
 * @api public
 */

Memory.prototype.find = function (query, fn) {
  if (!query) throw new Error('Invalid query parameter');
  if ('object' !== typeof query) {
    query = {id: query};
  }
  var result = [], count = 0, dcount = 0, index, key, data = this.data;
  this.async(function () {
    for (var k in query) { count += 1; }
    for (var h in data) { dcount += 1; }
    if (!dcount) {
      if (fn) fn(null, []);
      return;
    } else if (query.id && query.id === 'all') {
      result = data;
    } else {
      if (count) {
        for (key in data) {
          var bid = data[key];
          if (isMatch(bid, query)) {
            result.push(bid);
            if (count === 1 && undefined !== query.id) {
              index = key;
              break;
            }
          }
        }
      } else {
        if (fn) fn(null, []);
      }
    }
    if (fn) fn(null, result, index);
  });
  return this;
};

/**
 * Clear the entire data object
 *
 * ####Example:
 *
 *     // this will wipe the store object
 *     store.clear();
 *
 * @return {Memory} self
 * @api public
 */

Memory.prototype.clear = function () {
  this.data = {};
  return this;
};

/**
 * Method for performing async calls
 *
 * @param {Function} fn callback to convert to async
 * @api private
 */

Memory.prototype.async = function (fn) {
  process.nextTick(fn.bind(this));
};

/**
 * Match a single object with search criteria.
 *
 * @param {Object} obj Object to search in.
 * @param {Object} query the query
 * @return {Boolean}
 * @api private
 */

function isMatch (obj, query) {
  var count = 0, matched = 0, q, k;
  function fn(q, i) {
    var o = obj[i];
    count += 1;
    if ('number' === typeof o) {
      if (o === q) { matched += 1; }
    } else if ('string' === typeof o) {
      if (o && o.match(new RegExp(q, "i")) !== null) { matched += 1; }
    } else if (o == q) {
      matched += 1;
    }
  }
  for (k in query) { fn(query[k], k); }
  return matched === count;
}
