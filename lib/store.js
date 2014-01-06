'use strict';

/**
 * Module exports.
 */

module.exports = exports = Store;

/**
 * Store insterface.
 *
 * @api private
 */

function Store(channel, options) {
  this.channel = channel;
  this.options = options || {};
  this.ns = (options.coll || 'channel') + '-' + this.channel.name;
}

Store.prototype.set = function set(id, bid, fn) {
  throw new Error('Store#set must be overridden by subclass');
};

Store.prototype.get = function get(id, fn) {
  throw new Error('Store#get must be overridden by subclass');
};

Store.prototype.del = function del(id, fn) {
  throw new Error('Store#del must be overridden by subclass');
};

Store.prototype.find = function find(query, fn) {
  throw new Error('Store#del must be overridden by subclass');
};

Store.prototype.clear = function clear(id) {
  throw new Error('Store#clear must be overridden by subclass');
};