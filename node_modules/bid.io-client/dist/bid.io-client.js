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

var debug = require('debug')('bid.io-client:channel');
var parser = require('./parser');
var encode = parser.encode;
var decode = parser.decode;

/**
 * Module exports.
 */

module.exports = Channel;

/**
 * Channel constructor.
 *
 * @param {String} name
 * @param {Object} options
 * @param {Function} callback
 * @api private
 */

function Channel (name, manager, fn) {
  this.opts = manager.opts;
  this.io = manager.io;
  this.url = manager.url;
  this.ns = manager.ns || 'stream';
  this.name = name;
  this.watches = {};
  this.actions = [
    'join',
    'leave',
    'fetch',
    'lock',
    'unlock',
    'complete',
    'error'
  ];
  this.connect(fn);
}

/**
 * Get a `socket` instance and connect to it.
 *
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.connect = function (fn) {
  var self = this;
  //io = ('undefined' !== typeof eio) ? eio : io;
  this.socket = this.io.connect(self.url + '/' + self.name, self.opts);
  this.socket.on('connect', function () {
    if (fn) fn(self);
  });
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
  this.send(parser.FETCH, id, fn);
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
  this.send(parser.LOCK, id, owner, fn);
  return this;
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
  this.send(parser.UNLOCK, id, owner, fn);
  return this;
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
  this.send(parser.COMPLETE, id, owner, fn);
  return this;
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
    action = action.toLowerCase();
    return ~actions.indexOf(action);
  };
  self.watches[bidId] = function cb (packet) {
    var result = decode(packet);
    var id = result.id;
    var type = result.type;
    var action = parser.types[type];
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
  if ('function' === typeof owner) {
    fn = owner;
    owner = null;
  }
  var data = { owner: owner };
  var packet = encode({ type: type, id: id, data: data });
  this.socket.emit(this.ns, packet, function (packet) {
    var result = decode(packet);
    if (parser.ERROR === result.type) {
      fn && fn(result.data);
    } else {
      fn && fn(null, result.data);
    }
  });
};
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

});require.register("manager.js", function(module, exports, require, global){
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

exports.types = [
  'JOIN',
  'LEAVE',
  'FETCH',
  'LOCK',
  'UNLOCK',
  'COMPLETE',
  'ERROR'
];

/**
 * Packet type `join`.
 *
 * @api public
 */

exports.JOIN = 0;

/**
 * Packet type `leave`.
 *
 * @api public
 */

exports.LEAVE = 1;

/**
 * Packet type `fetch`.
 *
 * @api public
 */

exports.FETCH = 2;

/**
 * Packet type `lock`.
 *
 * @api public
 */

exports.LOCK = 3;

/**
 * Packet type `unlock`.
 *
 * @api public
 */

exports.UNLOCK = 4;

/**
 * Packet type `complete`.
 *
 * @api public
 */

exports.COMPLETE = 5;

/**
 * Packet type `error`.
 *
 * @api public
 */

exports.ERROR = 6;

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
  str += obj.type;

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

  var p = {};
  var i = 0;
  var d = 0;

  // look up type
  p.type = Number(str.charAt(0));

  if (null == exports.types[p.type]) return error();

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
    } catch(e){ console.log(e);
      return error(e);
    }
  }

  debug('decoded %s as %j', str, p);
  return p;
};

function error(data){
  return {
    type: exports.ERROR,
    message: 'parser error'
  };
}

});var exp = require('index.js');if ("undefined" != typeof module) module.exports = exp;else bio = exp;
})();
