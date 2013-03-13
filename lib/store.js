/**
 * Module exports.
 */

module.exports = exports = Store;

/**
 * Store insterface.
 *
 * @api private
 */

function Store () { }

Store.prototype.set = function (id, bid, cb) {
	throw new Error('Store#set must be overridden by subclass');
};

Store.prototype.get = function (id, cb) {
	throw new Error('Store#get must be overridden by subclass');
};

Store.prototype.del = function (id, cb) {
	throw new Error('Store#del must be overridden by subclass');
};

Store.prototype.clear = function (id) {
	throw new Error('Store#clear must be overridden by subclass');
};
