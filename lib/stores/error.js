'use strict';

/**
 * Module exports.
 */

module.exports = StoreError;

/**
 * Generic Bucket error.
 *
 * @constructor
 * @param {String} message The reason for the error
 * @api public
 */

function StoreError(message) {
  Error.call(this);
  Error.captureStackTrace(this, this.constructor);
  this.message = message;
  this.name = this.constructor.name;
}

/**
 * Inherits from `Strategy`.
 */

StoreError.prototype.__proto__ = Error.prototype;