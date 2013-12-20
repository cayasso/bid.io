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

function Store (channel, options) {
  this.channel = channel;
  this.options = options || {};
  this.coll = (options.coll || 'bid') + '-' + this.channel.name;
}

Store.prototype.set = function (id, bid, fn) {
  throw new Error('Store#set must be overridden by subclass');
};

Store.prototype.get = function (id, fn) {
  throw new Error('Store#get must be overridden by subclass');
};

Store.prototype.del = function (id, fn) {
  throw new Error('Store#del must be overridden by subclass');
};

Store.prototype.find = function (query, fn) {
  throw new Error('Store#del must be overridden by subclass');
};

Store.prototype.clear = function (id) {
  throw new Error('Store#clear must be overridden by subclass');
};