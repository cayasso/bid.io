
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
