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

var Emitter = require('./eventemitter2').EventEmitter2;
var debug = require('debug')('bid.io-client:channel');
var parser = require('./parser');
var url = require('./url');
var encode = parser.encode;
var decode = parser.decode;
var packets = parser.packets;
var slice = [].slice;
var actions;
var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
};

/**
 * Constants declarations.
 */

// Event delimiter
var DELIMITER = '::';

// Event wildcard
var WILDCARD = '*';

// Events black list
var EVENTS = [
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

// Actions white list
var ACTIONS = [
  'fetch',
  'query',
  'lock',
  'unlock',
  'pending',
  'complete',
  'error',
  'update'
];

// Actions regular expression
var ACTIONS_RE = new RegExp('^(' + ACTIONS.join('|') + ')$');

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

  Emitter.call(this, {
    delimiter: DELIMITER,
    wildcard: true
  });

  this.io = manager.io;
  this.opts = manager.opts;
  this.url = manager.url;
  this.ns = manager.ns || 'stream';
  this.name = name;
  this.watches = {};
  this.evts = {};
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
  var channel = this;
  var url = this.buildUrl(this.name);
  var l = EVENTS.length;

  this.socket = this.io.connect(url, this.opts);

  for (var i = 0; i < l; i++) {
    this.bind(EVENTS[i]);
  }

  this.socket.on(this.ns, function (packet) {
    channel.onstream.call(channel, packet);
  });

  return this;
};

/**
 * Called up on incoming stream message.
 *
 * @param {Object} packet
 * @return {Channel} self
 * @api private
 */

Channel.prototype.onstream = function (packet) {
  var raw = decode(packet);
  var id = raw.id;
  var action = raw.type;
  var data = raw.data;
  var event = this.ns + DELIMITER + (id || WILDCARD) + DELIMITER + action;
  this.emit(event, data, action);
  return this;
};

/**
 * Bind socket events to channel.
 *
 * @param {String} ev event name
 * @return {Channel} self
 * @api private
 */

Channel.prototype.bind = function (ev) {
  var self = this;
  this.evts[ev] = function () {
    var args = slice.call(arguments);
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
 * @api private
 */

Channel.prototype.unbind = function (ev) {
  this.socket.removeListener(ev, this.evts[ev]);
  return this;
};

/**
 * Disconnect from `channel`.
 *
 * @return {Channel} self
 * @api public
 */

Channel.prototype.disconnect = function () {
  var l = EVENTS.length;
  for (var i = 0; i < l; i++) {
    this.unbind(EVENTS[i]);
    this.socket.disconnect();
  }
  return this;
};

/**
 * Watch a `bid` or all `bids` in a `channel`.
 *
 * @param {String|Number} id the bid id or actions to watch
 * @param {String} actions the the actions to watch
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.watch = function (id, action, fn) {
  return this._watch(id, action, 'on', fn);
};

/**
 * Stop watching a `bid` or all `bids` from a `channel`.
 *
 * @param {String|Number} id the bid id to unwatch
 * @param {String|Array} action the action(s) to unwatch
 * @param {Function} fn the callback function
 * @return {Channel} self
 * @api public
 */

Channel.prototype.unwatch = function (id, action, fn) {
  return this._watch(id, action, 'off', fn);
};

/**
 * This is the actuall watch unwatch event.
 * 
 * @param {String|Number} id the bid id to unwatch
 * @param {String|Array} action the action(s) to watch or unwatch
 * @param {String} type the method type to execute, could be `off` or `on`
 * @param {Function} fn the callback function
 * @return {Channel} self
 * @api private
 */

Channel.prototype._watch = function (id, action, type, fn) {

  var event;
  var actions;

  if ('function' === typeof id) {
    fn = id; action = WILDCARD; id = WILDCARD;
  } else if (isArray(id) || ACTIONS_RE.test(id) || ~(id + '').indexOf(' ')) {
    fn = action; action = id; id = WILDCARD;
  } else if ('function' === typeof action){
    fn = action; action = WILDCARD;
  } else if (!id){
    id = WILDCARD;
  }

  // Lets create the event string
  event = this.ns + DELIMITER + id + DELIMITER;

  // if no callback is passed and its unwatch
  // envent then remove all the listeners
  if ('off' === type && !fn) {
    type = 'removeAllListeners';
  }

  // if action is valid then check to see if its
  // an array.
  if (action) {
    if (isArray(action)) {
      actions = action;
    } else {
      // if it is a string then convert it to an array
      if ('string' === typeof action && WILDCARD !== action) {
        actions = action.split(' ');
      }
    }
  }

  if (actions) {
    var l = actions.length;
    // add register each event by action
    for (var i = 0; i < l; i++) {
      action = actions[i];
      if (!ACTIONS_RE.test(action)) continue;
      this[type](event + action, fn);
    }
  } else {
    // register a wildcard event
    this[type](event + WILDCARD, fn);
  }

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
 * Update a `bid` data.
 *
 * @param {String|Number} id the bid id
 * @param {Object} data data object
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.update = function (id, data, fn) {
  return this.send('update', id, data, fn);
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

  // handle query and update cases
  data = ('query' === type) ?
  { query: owner } :
  (('update' === type) ?
    { update: owner } :
    { owner: owner });

  // encode our data
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
 * @param {String} str the provided url string
 * @return {String} url the chanel url
 * @api private
 */

Channel.prototype.buildUrl = function (channel, str) {
  var obj = url.parse(str || this.url);
  return [obj.protocol, '://', obj.authority, obj.path, '/', channel, '?', obj.query].join('');
};
});require.register("eventemitter2.js", function(module, exports, require, global){

/**
 * This is from https://github.com/hij1nx/EventEmitter2/blob/master/lib/eventemitter2.js
 */

var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
};
var defaultMaxListeners = 10;

function init() {
  this._events = {};
  if (this._conf) {
    configure.call(this, this._conf);
  }
}

function configure(conf) {
  if (conf) {

    this._conf = conf;

    conf.delimiter && (this.delimiter = conf.delimiter);
    conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
    conf.wildcard && (this.wildcard = conf.wildcard);
    conf.newListener && (this.newListener = conf.newListener);

    if (this.wildcard) {
      this.listenerTree = {};
    }
  }
}

function EventEmitter(conf) {
  this._events = {};
  this.newListener = false;
  configure.call(this, conf);
}

//
// Attention, function return type now is array, always !
// It has zero elements if no any matches found and one or more
// elements (leafs) if there are matches
//
function searchListenerTree(handlers, type, tree, i) {
  if (!tree) {
    return [];
  }
  var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
      typeLength = type.length, currentType = type[i], nextType = type[i+1];
  if (i === typeLength && tree._listeners) {
    //
    // If at the end of the event(s) list and the tree has listeners
    // invoke those listeners.
    //
    if (typeof tree._listeners === 'function') {
      handlers && handlers.push(tree._listeners);
      return [tree];
    } else {
      for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
        handlers && handlers.push(tree._listeners[leaf]);
      }
      return [tree];
    }
  }

  if ((currentType === '*' || currentType === '**') || tree[currentType]) {
    //
    // If the event emitted is '*' at this part
    // or there is a concrete match at this patch
    //
    if (currentType === '*') {
      for (branch in tree) {
        if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
          listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
        }
      }
      return listeners;
    } else if(currentType === '**') {
      endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
      if(endReached && tree._listeners) {
        // The next element has a _listeners, add it to the handlers.
        listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
      }

      for (branch in tree) {
        if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
          if(branch === '*' || branch === '**') {
            if(tree[branch]._listeners && !endReached) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
            }
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
          } else if(branch === nextType) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
          } else {
            // No match on this one, shift into the tree but not in the type array.
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
          }
        }
      }
      return listeners;
    }

    listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
  }

  xTree = tree['*'];
  if (xTree) {
    //
    // If the listener tree will allow any match for this part,
    // then recursively explore all branches of the tree
    //
    searchListenerTree(handlers, type, xTree, i+1);
  }

  xxTree = tree['**'];
  if(xxTree) {
    if(i < typeLength) {
      if(xxTree._listeners) {
        // If we have a listener on a '**', it will catch all, so add its handler.
        searchListenerTree(handlers, type, xxTree, typeLength);
      }

      // Build arrays of matching next branches and others.
      for(branch in xxTree) {
        if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
          if(branch === nextType) {
            // We know the next element will match, so jump twice.
            searchListenerTree(handlers, type, xxTree[branch], i+2);
          } else if(branch === currentType) {
            // Current node matches, move into the tree.
            searchListenerTree(handlers, type, xxTree[branch], i+1);
          } else {
            isolatedBranch = {};
            isolatedBranch[branch] = xxTree[branch];
            searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
          }
        }
      }
    } else if(xxTree._listeners) {
      // We have reached the end and still on a '**'
      searchListenerTree(handlers, type, xxTree, typeLength);
    } else if(xxTree['*'] && xxTree['*']._listeners) {
      searchListenerTree(handlers, type, xxTree['*'], typeLength);
    }
  }

  return listeners;
}

function growListenerTree(type, listener) {

  type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

  //
  // Looks for two consecutive '**', if so, don't add the event at all.
  //
  for(var i = 0, len = type.length; i+1 < len; i++) {
    if(type[i] === '**' && type[i+1] === '**') {
      return;
    }
  }

  var tree = this.listenerTree;
  var name = type.shift();

  while (name) {

    if (!tree[name]) {
      tree[name] = {};
    }

    tree = tree[name];

    if (type.length === 0) {

      if (!tree._listeners) {
        tree._listeners = listener;
      }
      else if(typeof tree._listeners === 'function') {
        tree._listeners = [tree._listeners, listener];
      }
      else if (isArray(tree._listeners)) {

        tree._listeners.push(listener);

        if (!tree._listeners.warned) {

          var m = defaultMaxListeners;

          if (typeof this._events.maxListeners !== 'undefined') {
            m = this._events.maxListeners;
          }

          if (m > 0 && tree._listeners.length > m) {

            tree._listeners.warned = true;
            console.error('(node) warning: possible EventEmitter memory ' +
                          'leak detected. %d listeners added. ' +
                          'Use emitter.setMaxListeners() to increase limit.',
                          tree._listeners.length);
            console.trace();
          }
        }
      }
      return true;
    }
    name = type.shift();
  }
  return true;
}

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.

EventEmitter.prototype.delimiter = '.';

EventEmitter.prototype.setMaxListeners = function(n) {
  this._events || init.call(this);
  this._events.maxListeners = n;
  if (!this._conf) this._conf = {};
  this._conf.maxListeners = n;
};

EventEmitter.prototype.event = '';

EventEmitter.prototype.once = function(event, fn) {
  this.many(event, 1, fn);
  return this;
};

EventEmitter.prototype.many = function(event, ttl, fn) {
  var self = this;

  if (typeof fn !== 'function') {
    throw new Error('many only accepts instances of Function');
  }

  function listener() {
    if (--ttl === 0) {
      self.off(event, listener);
    }
    fn.apply(this, arguments);
  }

  listener._origin = fn;

  this.on(event, listener);

  return self;
};

EventEmitter.prototype.emit = function() {

  this._events || init.call(this);

  var type = arguments[0];

  if (type === 'newListener' && !this.newListener) {
    if (!this._events.newListener) { return false; }
  }

  // Loop through the *_all* functions and invoke them.
  if (this._all) {
    var l = arguments.length;
    var args = new Array(l - 1);
    for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
    for (i = 0, l = this._all.length; i < l; i++) {
      this.event = type;
      this._all[i].apply(this, args);
    }
  }

  // If there is no 'error' event listener then throw.
  if (type === 'error') {

    if (!this._all &&
      !this._events.error &&
      !(this.wildcard && this.listenerTree.error)) {

      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  var handler;

  if(this.wildcard) {
    handler = [];
    var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
    searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
  }
  else {
    handler = this._events[type];
  }

  if (typeof handler === 'function') {
    this.event = type;
    if (arguments.length === 1) {
      handler.call(this);
    }
    else if (arguments.length > 1)
      switch (arguments.length) {
        case 2:
          handler.call(this, arguments[1]);
          break;
        case 3:
          handler.call(this, arguments[1], arguments[2]);
          break;
        // slower
        default:
          var l = arguments.length;
          var args = new Array(l - 1);
          for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
          handler.apply(this, args);
      }
    return true;
  }
  else if (handler) {
    var l = arguments.length;
    var args = new Array(l - 1);
    for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      this.event = type;
      listeners[i].apply(this, args);
    }
    return (listeners.length > 0) || this._all;
  }
  else {
    return this._all;
  }

};

EventEmitter.prototype.on = function(type, listener) {

  if (typeof type === 'function') {
    this.onAny(type);
    return this;
  }

  if (typeof listener !== 'function') {
    throw new Error('on only accepts instances of Function');
  }
  this._events || init.call(this);

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if(this.wildcard) {
    growListenerTree.call(this, type, listener);
    return this;
  }

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  }
  else if(typeof this._events[type] === 'function') {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }
  else if (isArray(this._events[type])) {
    // If we've already got an array, just append.
    this._events[type].push(listener);

    // Check for listener leak
    if (!this._events[type].warned) {

      var m = defaultMaxListeners;

      if (typeof this._events.maxListeners !== 'undefined') {
        m = this._events.maxListeners;
      }

      if (m > 0 && this._events[type].length > m) {

        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }
  }
  return this;
};

EventEmitter.prototype.onAny = function(fn) {

  if(!this._all) {
    this._all = [];
  }

  if (typeof fn !== 'function') {
    throw new Error('onAny only accepts instances of Function');
  }

  // Add the function to the event listener collection.
  this._all.push(fn);
  return this;
};

EventEmitter.prototype.addListener = EventEmitter.prototype.on;

EventEmitter.prototype.off = function(type, listener) {
  if (typeof listener !== 'function') {
    throw new Error('removeListener only takes instances of Function');
  }

  var handlers,leafs=[];

  if(this.wildcard) {
    var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
    leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
  }
  else {
    // does not use listeners(), so no side effect of creating _events[type]
    if (!this._events[type]) return this;
    handlers = this._events[type];
    leafs.push({_listeners:handlers});
  }

  for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
    var leaf = leafs[iLeaf];
    handlers = leaf._listeners;
    if (isArray(handlers)) {

      var position = -1;

      for (var i = 0, length = handlers.length; i < length; i++) {
        if (handlers[i] === listener ||
          (handlers[i].listener && handlers[i].listener === listener) ||
          (handlers[i]._origin && handlers[i]._origin === listener)) {
          position = i;
          break;
        }
      }

      if (position < 0) {
        continue;
      }

      if(this.wildcard) {
        leaf._listeners.splice(position, 1);
      }
      else {
        this._events[type].splice(position, 1);
      }

      if (handlers.length === 0) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
      return this;
    }
    else if (handlers === listener ||
      (handlers.listener && handlers.listener === listener) ||
      (handlers._origin && handlers._origin === listener)) {
      if(this.wildcard) {
        delete leaf._listeners;
      }
      else {
        delete this._events[type];
      }
    }
  }

  return this;
};

EventEmitter.prototype.offAny = function(fn) {
  var i = 0, l = 0, fns;
  if (fn && this._all && this._all.length > 0) {
    fns = this._all;
    for(i = 0, l = fns.length; i < l; i++) {
      if(fn === fns[i]) {
        fns.splice(i, 1);
        return this;
      }
    }
  } else {
    this._all = [];
  }
  return this;
};

EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

EventEmitter.prototype.removeAllListeners = function(type) {
  if (arguments.length === 0) {
    !this._events || init.call(this);
    return this;
  }

  if(this.wildcard) {
    var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
    var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      leaf._listeners = null;
    }
  }
  else {
    if (!this._events[type]) return this;
    this._events[type] = null;
  }
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if(this.wildcard) {
    var handlers = [];
    var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
    searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
    return handlers;
  }

  this._events || init.call(this);

  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

EventEmitter.prototype.listenersAny = function() {

  if(this._all) {
    return this._all;
  }
  else {
    return [];
  }

};

exports.EventEmitter2 = EventEmitter;
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

module.exports = exports = Factory;

/**
 * Looks up an existing `Manager` for multiplexing.
 * If the user summons:
 *
 * @api public
 */

function Factory(io, uri, opts) {
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
  error:        8,
  update:       9
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

  if (null == str) return error;

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
