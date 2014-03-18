
var Emitter = require('events').EventEmitter;
var inherit = require('util').inherits;
var parallel = require('parallel-ware');

/**
 * Expose `Leader`.
 */

module.exports = Leader;

/**
 * Initialize a `Leader` instance.
 */

function Leader (options) {
  if (!(this instanceof Leader)) return new Leader(options);
  this.middleware = parallel();
  this.options = options;
  this.when(instant, initPerson, -1);
}

/**
 * Inherit from `Emitter`.
 */

inherit(Leader, Emitter);

/**
 * Sets the `max` amount of middleware executing concurrently.
 *
 * @param {Number} max
 * @return {Leader}
 */

Leader.prototype.concurrency = function (max) {
  this.middleware.concurrency(max);
  return this;
};

/**
 * Adds a middleware plugin.
 *
 * @pram {Object} plugin
 * @return {Leader}
 */

Leader.prototype.use = function (plugin, tier, timeout) {
  if (typeof plugin !== 'object') throw new Error('plugin must be an object.');
  if (typeof plugin.wait !== 'function') throw new Error('plugin.wait must be a function.');
  if (typeof plugin.fn !== 'function') throw new Error('plugin.wait must be a function.');
  return this.when(plugin.wait, plugin.fn, tier || plugin.tier);
};

/**
 * Adds a merge function to handle how middleware modules
 * populate the same fields.
 *
 * @pram {Object} plugin
 * @return {Leader}
 */

Leader.prototype.merge = function (plugin) {
};

/**
 * Adds a middleware `fn` with a `wait` function.
 *
 * @pram {Function} wait [optional]
 * @param {Function} fn
 * @return {Leader}
 */

Leader.prototype.when = function (wait, fn, tier, timeout) {
  this.middleware.when(wait, fn, tier, timeout);
  this.proxy(fn);
  return this;
};

Leader.prototype.conflict = function (fn) {
  this.middleware.conflict(fn);
  return this;
};

Leader.prototype.setCache = function (fn) {
  this.middleware.setCache(fn);
  return this;
};

/**
 * Proxy event from the fn.
 *
 * @param {Function} fn
 * @return {Leader}
 */

Leader.prototype.proxy = function (fn) {
  var self = this;
  if (fn instanceof Emitter) {
    var name = fn.name || fn.prototype.name || 'unknown';
    name = name.toLowerCase();
    events(fn, function (event, args) {
      self.emit(name + ':' + event, args);
    });
  }
  return this;
};

/**
 * Populate information about a `person`.
 *
 * @param {Object} person
 * @param {Function} callback
 */

Leader.prototype.populate = function (person, callback) {
  if (typeof person !== 'object') throw new Error('Person must be an object.');
  // set at very low tier to make sure it runs first
  // initialize empty to let initPerson run - set values
  // appropriately for conflict resolution.
  var callbackExecuted = false;

  var context = {};
  var emitter = this.middleware.run(person, context, function(err, person, context) {
    if (callbackExecuted) return;
    callbackExecuted = true;
    callback(err, person, context);
  });
  emitter.leader = this;

  if (this.options && this.options.maxTime) {
    setTimeout(function() {
      if (callbackExecuted) return;
      callbackExecuted = true;
      callback(new Error('Timeout triggered early completion'), person, context);
    }, this.options.maxTime);
  }
  return emitter;
};

// initialized person and associates keys with the `initPerson` plugin
// useful for conflict resolution
function initPerson(person, context, next) {
  return next();
}

function instant(person, context) {
  return true;
}
