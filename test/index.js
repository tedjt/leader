
var assert = require('assert');
var Leader = require('..');

describe('leader', function () {

  it('should allow adding plugins', function (done) {
    var leader = Leader()
      .when(hasEmail, domain)
      .populate({ email: 'ilya@segment.io'}, function (err, person) {
        assert(!err);
        assert(person);
        assert(person.domain === 'segment.io');
        done();
      });
  });

  it('should wait for information to become available', function (done) {
    var leader = Leader()
      .when(hasEmail, domain)
      .when(hasDomain, crunchbase)
      .populate({ email: 'ilya@segment.io'}, function (err, person) {
        assert(!err);
        assert(person);
        assert(person.company.crunchbase === 'http://www.crunchbase.com/search?query=segment.io');
        done();
      });
  });

  it('should handle cache', function (done) {
    var leader = Leader()
      .when(hasEmail, domain)
      .when(hasDomain, crunchbase)
      .when(hasDomain, cachedModule)
      .conflict(handleConflict)
      .setCache(new CacheFn())
      .populate({ email: 'ilya@segment.io'}, function (err, person) {
        assert(!err);
        assert(person);
        assert(person.company.crunchbase === 'http://www.crunchbase.com/search?query=segment.io');
        assert(person.domain === 'segment.io');
        assert(person.cachedValue.firstKey = 'someCachedValue');
        done();
      });
  });

  it('should handle merge conflicts', function (done) {
    var leader = Leader()
      .when(hasEmail, domain)
      .when(hasDomain, crunchbase)
      .when(hasEmail, badDomain)
      .when(hasDomain, badDomain)
      .conflict(handleConflict)
      .populate({ email: 'ilya@segment.io'}, function (err, person) {
        assert(!err);
        assert(person);
        assert(person.company.crunchbase === 'http://www.crunchbase.com/search?query=segment.io');
        assert(person.domain === 'segment.io');
        done();
      });
  });

  it('should handle tiers', function (done) {
    var leader = Leader()
      .when(hasEmail, domain)
      .when(hasDomain, crunchbase)
      .when(function(person) {
        return person.email && !person.domain;
      }, function() {
        // should never execute
        assert(false);
      }, 1)
      .populate({ email: 'ilya@segment.io'}, function (err, person) {
        assert(!err);
        assert(person);
        assert(person.company.crunchbase === 'http://www.crunchbase.com/search?query=segment.io');
        assert(person.domain === 'segment.io');
        done();
      });
  });

  it('should handle timeouts', function (done) {
    var leader = Leader()
      .when(hasEmail, longFn, null, 500)
      .populate({ email: 'ilya@segment.io'}, function (err, person) {
        assert(err);
        done();
      });
  });

  it('should convert thrown errors to returned errors and finish executing', function (done) {
    var leader = Leader()
      .when(hasEmail, domain)
      .when(hasDomain, crunchbase)
      .when(hasDomain, throwError)
      .populate({ email: 'ilya@segment.io'}, function (err, person) {
        assert(err);
        assert(person);
        assert(person.company.crunchbase === 'http://www.crunchbase.com/search?query=segment.io');
        done();
      });
  });
});


function hasEmail (person) {
  return person.email != null;
}

function domain (person, context, next) {
  var tokens = person.email.split('@');
  person.domain = tokens[1];
  next();
}

function badDomain (person, context, next) {
  person.domain = 'someIncorrectDomain';
  next();
}

function hasDomain (person) {
  return person.domain != null;
}

function crunchbase (person, context, next) {
  person.company = {
    crunchbase: 'http://www.crunchbase.com/search?query=' + person.domain
  };
  next();
}

function cachedModule (person, context, next) {
  person.cachedValue = {
    firstKey: 'someNewValue'
  };
  next();
}

function longFn (person, context, next) {
  setTimeout(function() {
    next();
  }, 2000);
}

function throwError (person, context, next) {
  throw new Error('Thrown Error!!');
}

function handleConflict(key, existing, candidate, previousChoices, person, context) {
  var weightings = {
    '[0].domain': {
      'domain': 0.9,
      'badDomain': 0.3
    }
  };

  // default to the new value
  var returnValue = candidate;
  // possibly revert if we have an actual weighting
  var keyWeights = weightings[key];
  if (keyWeights) {
    var existingWeight = keyWeights[existing.fnName] || 0;
    var candidateWeight = keyWeights[candidate.fnName] || 0;
    if (existingWeight > candidateWeight) {
      returnValue = existing;
    }
  }

  return returnValue;
}

function CacheFn () {
  if (!(this instanceof CacheFn)) return new CacheFn();
  this.cache = {};
}
CacheFn.prototype.set = function(key, person, context, callback) {
  this.cache[key] = {
    person: person,
    context: context
  };
  if (key === 'cachedModule') {
    assert(person.cachedValue.firstKey === 'someNewValue');
  }
  callback(null);
};
CacheFn.prototype.get = function(key, person, context, callback) {
  if (key === 'cachedModule') {
    person.cachedValue.firstKey = 'someCachedValue';
    return callback(null, true);
  } else if (this.cache[key]) {
    // in reality use something like extend
    Object.keys(this.cache[key].person).forEach(function(k) {
      person[k] = this.cache[key].person[k];
    });
    return callback(null, true);
  }
  return callback(null, false);
};
