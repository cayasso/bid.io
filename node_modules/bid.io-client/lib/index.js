
/**
 * Module dependencies.
 */

var Manager = require('./manager');
var Channel = require('./channel');
var parser = require('./parser');

/**
 * Module exports.
 */

module.exports = exports = factory;

/**
 * Looks up an existing `Manager` for multiplexing.
 * If the user summons:
 *
 * @api public
 */

function factory(uri, opts) {
  opts = opts || {};
  io = ('undefined' !== typeof eio) ? eio : io;
  return new Manager(uri, opts);
}

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = parser.protocol;

/**
 * Expose constructors for standalone build.
 *
 * @api public
 */

exports.Manager = Manager;
exports.Socket = Channel;
