(function(){var global = this;
/*!
 * debug
 * Copyright(c) 2012 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Create a debugger with the given `name`.
 *
 * @param {String} name
 * @return {Type}
 * @api public
 */

function debug(name) {
  if (!debug.enabled(name)) return function(){};

  return function(fmt){
    var curr = new Date;
    var ms = curr - (debug[name] || curr);
    debug[name] = curr;

    fmt = name
      + ' '
      + fmt
      + ' +' + debug.humanize(ms);

    // This hackery is required for IE8
    // where `console.log` doesn't have 'apply'
    window.console
      && console.log
      && Function.prototype.apply.call(console.log, console, arguments);
  }
}

/**
 * The currently active debug mode names.
 */

debug.names = [];
debug.skips = [];

/**
 * Enables a debug mode by name. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} name
 * @api public
 */

debug.enable = function(name) {
  localStorage.debug = name;

  var split = (name || '').split(/[\s,]+/)
    , len = split.length;

  for (var i = 0; i < len; i++) {
    name = split[i].replace('*', '.*?');
    if (name[0] === '-') {
      debug.skips.push(new RegExp('^' + name.substr(1) + '$'));
    }
    else {
      debug.names.push(new RegExp('^' + name + '$'));
    }
  }
};

/**
 * Disable debug output.
 *
 * @api public
 */

debug.disable = function(){
  debug.enable('');
};

/**
 * Humanize the given `ms`.
 *
 * @param {Number} m
 * @return {String}
 * @api private
 */

debug.humanize = function(ms) {
  var sec = 1000
    , min = 60 * 1000
    , hour = 60 * min;

  if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
  if (ms >= min) return (ms / min).toFixed(1) + 'm';
  if (ms >= sec) return (ms / sec | 0) + 's';
  return ms + 'ms';
};

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

debug.enabled = function(name) {
  for (var i = 0, len = debug.skips.length; i < len; i++) {
    if (debug.skips[i].test(name)) {
      return false;
    }
  }
  for (var i = 0, len = debug.names.length; i < len; i++) {
    if (debug.names[i].test(name)) {
      return true;
    }
  }
  return false;
};

// persist

if (window.localStorage) debug.enable(localStorage.debug);function require(p, parent){ var path = require.resolve(p) , mod = require.modules[path]; if (!mod) throw new Error('failed to require "' + p + '" from ' + parent); if (!mod.exports) { mod.exports = {}; mod.call(mod.exports, mod, mod.exports, require.relative(path), global); } return mod.exports;}require.modules = {};require.resolve = function(path){ var orig = path , reg = path + '.js' , index = path + '/index.js'; return require.modules[reg] && reg || require.modules[index] && index || orig;};require.register = function(path, fn){ require.modules[path] = fn;};require.relative = function(parent) { return function(p){ if ('debug' == p) return debug; if ('.' != p.charAt(0)) return require(p); var path = parent.split('/') , segs = p.split('/'); path.pop(); for (var i = 0; i < segs.length; i++) { var seg = segs[i]; if ('..' == seg) path.pop(); else if ('.' != seg) path.push(seg); } return require(path.join('/'), parent); };};require.register("channel.js", function(module, exports, require, global){
/**
 * Module dependencies.
 */

var Emitter = require('./events').EventEmitter;
var debug = require('debug')('bid.io-client:channel');
var parser = require('./parser');
var url = require('./url');
var encode = parser.encode;
var decode = parser.decode;
var packets = parser.packets;

/**
 * Module exports.
 */

module.exports = Channel;

/**
 * Channel constructor.
 *
 * @param {String} name channel name
 * @param {Manager} manager manager instance
 * @param {Function} fn callback
 * @api private
 */

function Channel (name, manager) {
  this.io = manager.io;
  this.opts = manager.opts;
  this.url = manager.url;
  this.ns = manager.ns || 'stream';
  this.name = name;
  this.watches = {};
  this.evts = {};
  this.actions = [
    'fetch',
    'query',
    'lock',
    'unlock',
    'pending',
    'complete',
    'error'
  ];
  this.events = [
    'message',
    'close',
    'connect',
    'connecting',
    'connect_failed',
    'reconnect',
    'reconnecting',
    'reconnect_failed',
    'disconnect'
  ];
  this.connect();
}

/**
 * Inherits from `EventEmitter`.
 */

Channel.prototype.__proto__ = Emitter.prototype;

/**
 * Get a `socket` instance and connect to it.
 *
 * @return {Channel} self
 * @api public
 */

Channel.prototype.connect = function () {
  var url = this.buildUrl(this.name);
  this.socket = this.io.connect(url, this.opts);
  for (var i = 0, e; e = this.events[i]; i++) {
    this.bind(e);
  }
  return this;
};

/**
 * Disconnect from `channel`.
 *
 * @return {Channel} self
 * @api public
 */

Channel.prototype.disconnect = function () {
  for (var i = 0, e; e = this.events[i]; i++) {
    this.unbind(e);
    this.socket.disconnect();
  }
  return this;
};

/**
 * Bind socket events to channel.
 *
 * @param {String} ev event name
 * @return {Channel} self
 * @api public
 */

Channel.prototype.bind = function (ev) {
  var self = this;
  this.evts[ev] = function () {
    var args = Array.prototype.slice.call(arguments);
    self.emit.apply(self, [ev].concat(args));
  };
  self.socket.on(ev, this.evts[ev]);
  return this;
};

/**
 * Bind socket events to channel.
 *
 * @param {String} ev event name
 * @return {Channel} self
 * @api public
 */

Channel.prototype.unbind = function (ev) {
  this.socket.removeListener(ev, this.evts[ev]);
  return this;
};

/**
 * Fetch a `bid` from server.
 *
 * @param {String|Number} id the bid id
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.fetch = function (id, fn) {
  return this.send('fetch', id, fn);
};

/**
 * Fetch a `bid` or `bids` from server.
 *
 * @param {String|Number|Object} query
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.find = function (query, fn) {
  return this.send('query', '', query, fn);
};

/**
 * Lock a `bid` by opening it.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object with at least an id attribute
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.open = function (id, owner, fn) {
  return this.send('lock', id, owner, fn);
};

/**
 * Cancel a `bid` by unlocking it.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object with at least an id attribute
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.cancel = function (id, owner, fn) {
  return this.send('unlock', id, owner, fn);
};

/**
 * Claim a `bid`.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object with at least an id attribute
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.claim = function (id, owner, fn) {
  return this.send('claim', id, owner, fn);
};

/**
 * Set `bid` to pending.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object with at least an id attribute
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.pending = function (id, owner, fn) {
  return this.send('pending', id, owner, fn);
};

/**
 * Complete (close) a `bid`.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object with at least an id attribute
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.complete = function (id, owner, fn) {
  return this.send('complete', id, owner, fn);
};

/**
 * Force unlock a `bid`.
 *
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object with at least an id attribute
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.forceunlock = function (id, owner, fn) {
  return this.send('forceunlock', id, owner, fn);
};

/**
 * Watch a `bid` or all `bids` in a `channel`.
 *
 * @param {String|Number} bidId the bid id or actions to watch
 * @param {String} actions the the actions to watch
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.watch = function (bidId, actions, fn) {
  if ('function' === typeof bidId) {
    fn = bidId;
    actions = '*';
    bidId = null;
  } else if (~this.actions.indexOf(bidId)) {
    fn = actions;
    actions = bidId;
    bidId = null;
  } else if ('function' === typeof actions){
    fn = actions;
    actions = '*';
  }

  var self = this;
  var args = [].slice.apply(arguments);

  // validate action
  var valid = function (action) {
    actions = actions.toString();
    return ~actions.indexOf(action);
  };
  self.watches[bidId] = function cb (packet) {
    var result = decode(packet);
    var id = result.id;
    var type = result.type;
    var action = type;
    var isValid = valid(action);

    if (bidId && id == bidId && isValid) {
      return fn(result.data, action);
    }
    if (bidId && id == bidId && valid('*')) {
      return fn(result.data, action);
    }
    if (bidId && id != bidId) {
      return;
    }
    if (!bidId && isValid || valid('*')) {
      return fn(result.data, action);
    }
  };
  self.socket.on(this.ns, self.watches[bidId]);
  return this;
};

/**
 * Stop watching a `bid` or all `bids` from a `channel`.
 *
 * @param {String|Number} id the bid id to unwatch
 * @return {Channel} self
 * @api public
 */

Channel.prototype.unwatch = function (id) {
  var watch = this.watches[id];
  if (watch) {
    this.socket.removeListener(this.ns, watch);
    delete this.watches[id];
    console.log('unwatching bid: ', id, 'actions: ', actions);
  }
  return this;
};

/**
 * Send response to server.
 *
 * @param {Number} type request type
 * @param {String|Number} id the bid id
 * @param {Object} owner owner object
 * @return {Channel} self
 * @api private
 */

Channel.prototype.send = function (type, id, owner, fn) {
  var data;
  if ('function' === typeof owner) {
    fn = owner;
    owner = null;
  }
  data = ('query' === type) ? { query: owner } : { owner: owner };
  var packet = encode({ type: type, id: id, data: data });
  this.request(packet, fn);
  return this;
};

/**
 * Send request to the server.
 *
 * @param {Object} packet
 * @param {Function} fn callback function
 * @return {Channel} self
 * @api private
 */

Channel.prototype.request = function (packet, fn) {
  this.socket.emit(this.ns, packet, this.response(fn));
  return this;
};

/**
 * Handle response from the server.
 *
 * @param {Function} fn callback function
 * @return {Function}
 * @api private
 */

Channel.prototype.response = function (fn) {
  return function (packet) {
    var result = decode(packet);
    if ('error' == result.type) {
      if (fn) fn(result.data);
    } else {
      if (fn) fn(null, result.data);
    }
  };
};

/**
 * Build a `channel` url.
 *
 * @param {String} channel the channel name
 * @param {String} urlStr the provided url
 * @return {String} url the chanel url
 * @api private
 */

Channel.prototype.buildUrl = function (channel, urlStr) {
  var obj = url.parse(urlStr || this.url);
  return [obj.protocol, '://', obj.authority, obj.path, '/', channel, '?', obj.query].join('');
};

});require.register("events.js", function(module, exports, require, global){
/**
 * Expose constructor.
 */

exports.EventEmitter = EventEmitter;

/**
 * Event emitter constructor.
 *
 * @api public.
 */

function EventEmitter () {};

/**
 * Adds a listener
 *
 * @api public
 */

EventEmitter.prototype.on = function (name, fn) {
  if (!this.$events) {
    this.$events = {};
  }

  if (!this.$events[name]) {
    this.$events[name] = fn;
  } else if (isArray(this.$events[name])) {
    this.$events[name].push(fn);
  } else {
    this.$events[name] = [this.$events[name], fn];
  }

  return this;
};

EventEmitter.prototype.addListener = EventEmitter.prototype.on;

/**
 * Adds a volatile listener.
 *
 * @api public
 */

EventEmitter.prototype.once = function (name, fn) {
  var self = this;

  function on () {
    self.removeListener(name, on);
    fn.apply(this, arguments);
  }

  on.listener = fn;
  this.on(name, on);

  return this;
};

/**
 * Removes a listener.
 *
 * @api public
 */

EventEmitter.prototype.removeListener = function (name, fn) {
  if (this.$events && this.$events[name]) {
    var list = this.$events[name];

    if (isArray(list)) {
      var pos = -1;

      for (var i = 0, l = list.length; i < l; i++) {
        if (list[i] === fn || (list[i].listener && list[i].listener === fn)) {
          pos = i;
          break;
        }
      }

      if (pos < 0) {
        return this;
      }

      list.splice(pos, 1);

      if (!list.length) {
        delete this.$events[name];
      }
    } else if (list === fn || (list.listener && list.listener === fn)) {
      delete this.$events[name];
    }
  }

  return this;
};

/**
 * Removes all listeners for an event.
 *
 * @api public
 */

EventEmitter.prototype.removeAllListeners = function (name) {
  if (name === undefined) {
    this.$events = {};
    return this;
  }

  if (this.$events && this.$events[name]) {
    this.$events[name] = null;
  }

  return this;
};

/**
 * Gets all listeners for a certain event.
 *
 * @api publci
 */

EventEmitter.prototype.listeners = function (name) {
  if (!this.$events) {
    this.$events = {};
  }

  if (!this.$events[name]) {
    this.$events[name] = [];
  }

  if (!isArray(this.$events[name])) {
    this.$events[name] = [this.$events[name]];
  }

  return this.$events[name];
};

/**
 * Emits an event.
 *
 * @api public
 */

EventEmitter.prototype.emit = function (name) {
  if (!this.$events) {
    return false;
  }

  var handler = this.$events[name];

  if (!handler) {
    return false;
  }

  var args = Array.prototype.slice.call(arguments, 1);

  if ('function' == typeof handler) {
    handler.apply(this, args);
  } else if (isArray(handler)) {
    var listeners = handler.slice();

    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
  } else {
    return false;
  }

  return true;
};

/**
 * Checks if the given object is an Array.
 *
 *     isArray([]); // true
 *     isArray({}); // false
 *
 * @param Object obj
 * @api public
 */

function isArray (obj) {
  return '[object Array]' === Object.prototype.toString.call(obj);
}

});require.register("index.js", function(module, exports, require, global){

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

function factory(io, uri, opts) {
  opts = opts || {};
  if (!io.protocol || !io.connect ) {
    throw Error('Please include socket.io client.');
  }
  return new Manager(io, uri, opts);
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
exports.Channel = Channel;

});require.register("manager.js", function(module, exports, require, global){
/**
 * Module dependencies.
 */

var Channel = require('./channel');
var debug = require('debug')('bid.io-client:manager');
var FORCE_NEW_CONNECTION = 'force new connection';

/**
 * Module exports.
 */

module.exports = Manager;

/**
 * Manager constructor.
 *
 * @param {Object} io socket.io client object
 * @param {String} url the connection url
 * @param {Object} opts options
 * @api public
 */

function Manager (io, url, opts) {
  opts = opts || {};
  this.url = url;
  this.io = io;
  this.opts = opts;
  this.chnls = {};
}

/**
 * Connect with regular `socket.io`.
 *
 * @param {String|Object} url the connection `url` or `options`
 * @param {Object} opts `socket.io` connection options
 * @return {Socket} socket insntance
 * @api public
 */

Manager.prototype.connect = function (url, opts) {
  if ('string' !== typeof url) {
    opts = url;
    url = null;
  }
  url = url || this.url;
  return this.io.connect(url, opts);
};

/**
 * Connect to a `channel`.
 *
 * @param {String} name the channel name
 * @param {Function} fn callback function
 * @return {Manager} self
 * @api public
 */

Manager.prototype.join = function (name, opts) {
  opts = opts || {};
  debug('joining channel %s', name);
  var fnc = opts[FORCE_NEW_CONNECTION];
  var chnl = this.chnls[name];
  if (fnc) this.opts[FORCE_NEW_CONNECTION] = fnc;
  if (chnl && !fnc) return chnl;
  chnl = new Channel(name, this);
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

/**
 * Get a stored `channel` connection for use.
 *
 * @param {String} name the name of the `channel` to get
 * @return {Channel} the `channel` instance
 * @api public
 */

Manager.prototype.getChannel = function (name) {
  var chnl = this.chnls[name];
  if (!chnl) return debug("Channel '%s' doesn't exist.", name);
  return chnl;
};

});require.register("parser.js", function(module, exports, require, global){

/**
 * Module dependencies.
 */

var debug = require('debug')('bid.io-parser');

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = 1;

/**
 * Packet types.
 *
 * @api public
 */

var packets = exports.packets = {
  fetch:        0,
  query:        1,
  lock:         2,
  unlock:       3,
  pending:      4,
  complete:     5,
  claim:        6,
  forceunlock:  7,
  error:        8
};

/**
 * Packet keys.
 *
 * @api public
 */

var packetslist = exports.packetslist = keys(packets);

/**
 * Premade error packet.
 */

var error = { type: 'error', data: 'parser error' };

/**
 * Encode.
 *
 * @param {Object} packet
 * @return {String} encoded
 * @api public
 */

exports.encode = function(obj){
  var str = '';

  // first is type
  str += packets[obj.type];

  // immediately followed by the bid id
  if (null != obj.id) {
    str += obj.id;
  }

  // json data
  if (null != obj.data) {
    str += JSON.stringify(obj.data);
  }

  debug('encoded %j as %s', obj, str);
  return str;
};

/**
 * Decode.
 *
 * @param {String} str
 * @return {Object} packet
 * @api public
 */

exports.decode = function (str) {

  var p = {}, i = 0;

  // look up type
  p.type = packetslist[Number(str.charAt(0))];
  if (null == p.type) return error;

  // look up id
  var next = str.charAt(i + 1);
  if ('' != next && Number(next) == next) {
    p.id = '';
    while (++i) {
      var c = str.charAt(i);
      if (null == c || Number(c) != c) {
        --i;
        break;
      }
      p.id += str.charAt(i);
      if (i + 1 == str.length) break;
    }
  }

  // look up json data
  if (str.charAt(++i)) {
    try {
      p.data = JSON.parse(str.substr(i));
    } catch(e){
      return error;
    }
  }

  debug('decoded %s as %j', str, p);
  return p;
};

/**
 * Gets the keys for an object.
 *
 * @return {Array} keys
 * @api private
 */

function keys (obj){
  if (Object.keys) return Object.keys(obj);
  var arr = [];
  var has = Object.prototype.hasOwnProperty;
  for (var i in obj) {
    if (has.call(obj, i)) {
      arr.push(i);
    }
  }
  return arr;
}
});require.register("url.js", function(module, exports, require, global){
/**
 * Module exports
 */

exports.parse = parse;

/**
 * Parses an URI
 *
 * @author Steven Levithan <stevenlevithan.com> (MIT license)
 * @api public
 */

var re = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
var parts = ['source', 'protocol', 'authority', 'userInfo', 'user', 'password',
             'host', 'port', 'relative', 'path', 'directory', 'file', 'query',
             'anchor'];

function parse (str) {
  var m = re.exec(str || '') , uri = {} , i = 14;
  while (i--) {
    uri[parts[i]] = m[i] || '';
  }
 
  return uri;
}
});var exp = require('index.js');if ("undefined" != typeof module) module.exports = exp;else bio = exp;
})();
