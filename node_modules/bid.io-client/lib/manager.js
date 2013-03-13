/**
 * Module dependencies.
 */

var Channel = require('./channel');
var debug = require('debug')('bid.io-client:manager');

if ('undefined' === typeof eio && 'undefined' === typeof io ) {
  throw Error('Please include socket.io client.');
}

/**
 * Module exports.
 */

module.exports = Manager;

/**
 * Manager constructor.
 *
 * @param {String} url the connection url
 * @param {Object} opts options
 * @api public
 */

function Manager (url, opts) {
  opts = opts || {};
  this.url = url;
  this.io = io;
  this.opts = opts;
  this.chnls = {};
}

/**
 * Connect to a `channel`.
 *
 * @param {String} name the channel name
 * @param {Function} fn callback function
 * @return {Manager} self
 * @api public
 */

Manager.prototype.join = function (name, fn) {
  debug('joining channel %s', name);
  var chnl = new Channel(name, this, fn);
  this.chnls[name] = chnl;
  return this.chnls[name];
};

/**
 * Disconnect to a `channel`.
 *
 * @param {String} name the channel name
 * @return {Manager} self
 * @api public
 */

Manager.prototype.leave = function (name) {
  var chnl = this.chnls[name];
  if (chnl) {
    debug('disconnecting from channel %s', name);
    chnl.disconnect();
    delete this.chnls[name];
  } else {
    debug('unable to find channel %s', name);
  }
  return this;
};
