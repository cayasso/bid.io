
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
    fn && fn(null, this.data[id]);
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
    fn && fn(null, this.data[id]);
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
    fn && fn(null);
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