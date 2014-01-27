var name = 'mongo';
var moment = require('moment');
var Bid = require('../lib/bid');
var expect = require('expect.js');
var stores = require('../lib/stores');
var Store = stores[name];
var store = new Store({ name: 'test' }, {});
var bid = new Bid(store);
var date = moment().format('L');

var users = {
  jb: {
    id: 1,
    name: 'JB'
  },
  wc: {
    id: 2,
    name: 'WC'
  }
};

obj = { ids: 1 };

Object.defineProperty(obj, 'id', {
  get: function () {
    return obj.ids++;
  }
});

describe('bid', function() {

  beforeEach(function (done) {
    done();
  });

  beforeEach(function (done) {
    bid.clear(done);
    //done();
  });
  
  it('should provide multiple store options', function() {
    expect(stores).to.have.key('memory');
    expect(stores).to.have.key('mongo');
    expect(stores).to.have.key('nedb');
  });

  it('should set a bid', function(done) {
    var id = obj.id;
    var data = { id: id, saleDate: date };
    bid.set(id, data, function (err, doc) {
      if (err) return done(err);
      expect(doc).to.be.eql(data);
      done();
    });
  });

  it('should get a bid', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      bid.get(id, function (err, doc) {
        if (err) return done(err);
        expect(doc.id).to.be.eql(id);
        done();
      });
    });
  });

  it('should lock a bid', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(1);
        expect(doc.state).to.be.eql(0);
        done();
      });
    });
  });

  it('should unlock a bid', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(1);
        bid.unlock(id, users.jb, false, function (err, doc) {
          if (err) return done(err);
          expect(doc.locked).to.be.eql(0);
          done();
        });
      });
    });
  });

  it('should not allow locking a locked bid from another user', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        bid.lock(id, users.wc, false, function (err, doc) {
          if (err) {
            expect(err.message).to.be.eql('Locked by another user');
            return done();
          }
          done('Not');
        });
      });
    });
  });

  it('should not allow unlocking a locked bid from another user', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        bid.unlock(id, users.wc, false, function (err, doc) {
          if (err) {
            expect(err.message).to.be.eql('Locked by another user');
            return done();
          }
          done('Not');
        });
      });
    });
  });

  it('should force unlocking a bid', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        bid.forceunlock(id, users.jb, function (err, doc) {
          if (err) return done(err);
          expect(doc.locked).to.be.eql(0);
          done();
        });
      });
    });
  });

  it('should force unlocking a bid from another user', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        bid.forceunlock(id, users.wc, function (err, doc) {
          if (err) return done(err);
          expect(doc.locked).to.be.eql(0);
          done();
        });
      });
    });
  });

  it('should claim a bid from another user', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        bid.claim(id, users.wc, function (err, doc) {
          if (err) return done(err);
          expect(doc.locked).to.be.eql(1);
          done();
        });
      });
    });
  });

  it('should put a locked bid in pending mode', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(1);
        bid.pending(id, users.jb, function (err, doc) {
          if (err) return done(err);
          expect(doc.state).to.be.eql(1);
          done();
        });
      });
    });
  });

  it('should not allow another user to put a bid in pending mode', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(1);
        bid.pending(id, users.wc, function (err, doc) {
          if (err) {
            expect(err.message).to.be.eql('Locked by another user');
            return done();
          }
          done('Not');
        });
      });
    });
  });

  it('should allow completing a bid', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(1);
        bid.complete(id, users.jb, function (err, doc) {
          if (err) return done(err);
          expect(doc.state).to.be.eql(2);
          done();
        });
      });
    });
  });

  it('should not allow another user to complete a bid', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      expect(doc.locked).to.be.eql(0);
      bid.lock(id, users.jb, false, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(1);
        bid.complete(id, users.wc, function (err, doc) {
          if (err) {
            expect(err.message).to.be.eql('Locked by another user');
            return done();
          }
          done('Not');
        });
      });
    });
  });

  it('should fetch a bid', function(done) {
    var id = obj.id;
    bid.set(id, { id: id, saleDate: date }, function (err, doc) {
      if (err) return done(err);
      bid.fetch(id, function (err, doc) {
        if (err) return done(err);
        expect(doc.id).to.be.eql(id);
        done();
      });
    });
  });
  
  it('should find a single bid', function(done) {
    var id = obj.id;
    bid.set(id, { id: id, saleDate: date }, function (err, doc) {
      if (err) return done(err);
      bid.find(id, function (err, doc) {
        if (err) return done(err);
        expect(doc.id).to.be.eql(id);
        done();
      });
    });
  });

  it('should not find bid without saleDate', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      bid.find(id, function (err, doc) {
        if (err) return done(err);
        expect(doc).to.not.be.ok();
        done();
      });
    });
  });

  it('should find multiple bids matching the query', function(done) {
    var id = obj.id;
    bid.set(id, { id: id, a: 1, saleDate: date }, function (err, doc) {
      if (err) return done(err);
      var id = obj.id;
      bid.set(id, { id: id, a: 1, saleDate: date }, function (err, doc) {
        if (err) return done(err);
        var id = obj.id;
        bid.set(id, { id: id, a: 2, saleDate: date }, function (err, doc) {
          if (err) return done(err);
          bid.find({ a: 1 }, function (err, docs) {
            if (err) return done(err);
            expect(docs).to.be.an('array');
            expect(docs.length).to.be.eql(2);
            done();
          });
        });
      });
    });
  });

  it('should not find bids without a saleDate', function(done) {
    var id = obj.id;
    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      var id = obj.id;
      bid.set(id, { id: id }, function (err, doc) {
        if (err) return done(err);
        bid.find('all', function (err, docs) {
          if (err) return done(err);
          expect(docs).to.be.an('array');
          expect(docs.length).to.be.eql(0);
          done();
        });
      });
    });
  });

  it('should clear all bids', function(done) {
    var id = obj.id;
    bid.set(id, { id: id, saleDate: date }, function (err, doc) {
      if (err) return done(err);
      var id = obj.id;
      bid.set(id, { id: id, saleDate: date }, function (err, doc) {
        if (err) return done(err);
        var id = obj.id;
        bid.set(id, { id: id, saleDate: date }, function (err, doc) {
          if (err) return done(err);
          bid.clear(function (err, docs) {
            if (err) return done(err);
            bid.find('all', function (err, docs) {
              if (err) return done(err);
              expect(docs.length).to.be.eql(0);
              done();
            });
          });
        });
      });
    });
  });

  /*it('should save a bid', function(done) {

    var id = obj.id;
    var data = {
      "countyId":152,
      "vendorId":696,
      "status":"BTL",
      "pending":false,
      "vid":696,
      "locked":0,
      "state":2,
      "saleDate":"01/24/2014",
      "owner":null,
      "active":true,
      "id": id
    };

    bid.set(id, { id: id }, function (err, doc) {
      if (err) return done(err);
      //delete doc._id;
      expect(doc).to.be.eql(data);
      done();
    });

  });*/

  /*it('should mongo', function(done) {

    var id = 123456;
    var data = {
      "countyId":152,
      "vendorId":696,
      "status":"BTL",
      "pending":false,
      "vid":696,
      "locked":0,
      "state":2,
      "saleDate":"01/24/2014",
      "id":123456,
      "owners":{},
      "owner":null,
      "active":true
    };

    bid.set(id, data, function (err, doc) {
      if (err) return done(err);
      delete doc._id;
      expect(doc).to.be.eql(data);
      done();
    });
  });*/

});