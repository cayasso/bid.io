var name = 'memory'
  , moment = require('moment')
  , Bid = require('../lib/bid')
  , expect = require('expect.js')
  , stores = require('../lib/stores')
  , users = require('./fixtures/users.json')
  , Store = stores[name]
  , store = new Store({ name: 'test' }, {})
  , bid = new Bid(store)
  , today = moment().format('L')
  , obj = { ids: 1 };

Object.defineProperty(obj, 'id', {
  get: function () {
    return obj.ids++;
  }
});

describe('Bid', function() {

  beforeEach(function (done) {
    done();
  });

  beforeEach(function (done) {
    bid.clear(done);
  });
  
  it('should provide multiple store options', function() {
    expect(stores).to.have.key('memory');
    expect(stores).to.have.key('mongo');
    expect(stores).to.have.key('nedb');
  });

  it('should fetch a bid', function(done) {
    var id = obj.id;
    bid.set(id, { id: id, saleDate: today }, function (err, doc) {
      if (err) return done(err);
      bid.fetch(id, function (err, doc) {
        if (err) return done(err);
        expect(doc.id).to.be.eql(id);
        done();
      });
    });
  });

  it('should not fetch a bid from a different sale date', function(done) {
    var id = obj.id;
    bid.set(id, { id: id, saleDate: '01/01/01' }, function (err, doc) {
      if (err) return done(err);
      bid.fetch(id, function (err, doc) {
        if (err) {
          expect(err.message).to.be('Bid not found');
          return done();
        }
        done('Not');
      });
    });
  });
   
  it('should clear all bids', function(done) {
    var id = obj.id;
    bid.set(id, { id: id, saleDate: today }, function (err, doc) {
      if (err) return done(err);
      var id = obj.id;
      bid.set(id, { id: id, saleDate: today }, function (err, doc) {
        if (err) return done(err);
        var id = obj.id;
        bid.set(id, { id: id, saleDate: today }, function (err, doc) {
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

  describe('#set', function () {

    it('should set a bid', function(done) {
      var id = obj.id;
      var data = { id: id, saleDate: today };
      bid.set(id, data, function (err, doc) {
        if (err) return done(err);
        expect(doc).to.be.eql(data);
        done();
      });
    });

  });

  describe('#get', function () {
    
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

  });

  describe('#lock', function () {

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

    it('should not lock another user bid', function(done) {
      var id = obj.id;
      bid.set(id, { id: id, owner: users.jb }, function (err, doc) {
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

    it('should emit lock event', function(done) {
      var id = obj.id;
      bid.set(id, { id: id }, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(0);
        bid.lock(id, users.jb, false);
      });

      bid.once('lock', function (doc) {
        expect(doc.locked).to.be.eql(1);
        expect(doc.state).to.be.eql(0);
        done();
      });
    });

  });

  describe('#unlock', function () {

    it('should unlock a bid', function(done) {
      var id = obj.id;
      bid.set(id, { id: id }, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(0);
        bid.lock(id, users.jb, false, function (err, doc) {
          if (err) return done(err);
          bid.unlock(id, users.jb, function (err, doc) {
            if (err) return done(err);
            expect(doc.locked).to.be.eql(0);
            done();
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
          bid.forceunlock(id, users.wc, function (err, doc) {
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

    it('should emit unlock event', function(done) {
      var id = obj.id;
      bid.set(id, { id: id }, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(0);
        bid.lock(id, users.jb, false, function (err, doc) {
          if (err) return done(err);
          bid.unlock(id, users.jb);
          bid.once('unlock', function (doc) {
            expect(doc.locked).to.be.eql(0);
            done();
          });
        });
      });
    });
  });

  describe('#claim', function () {
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

    it('should allow claiming a bid from same user', function(done) {
      var id = obj.id;
      bid.set(id, { id: id }, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(0);
        bid.lock(id, users.jb, false, function (err, doc) {
          if (err) return done(err);
          bid.claim(id, users.jb, function (err, doc) {
            if (err) return done(err);
            expect(doc.locked).to.be.eql(1);
            done();
          });
        });
      });
    });

  });

  describe('#pending', function () {

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

    it('should emit pending event', function(done) {
      var id = obj.id;
      bid.set(id, { id: id }, function (err, doc) {
        if (err) return done(err);
        expect(doc.locked).to.be.eql(0);
        bid.lock(id, users.jb, false, function (err, doc) {
          if (err) return done(err);
          expect(doc.locked).to.be.eql(1);
          bid.pending(id, users.jb);
          bid.once('pending', function (doc) {
            expect(doc.state).to.be.eql(1);
            done();
          });
        });
      });
    });

  });

  describe('#complete', function () {

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

    it('should not complete another user bid', function(done) {
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
  });

  describe('#find', function () {
    it('should find a single bid', function(done) {
      var id = obj.id;
      bid.set(id, { id: id, saleDate: today }, function (err, doc) {
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
      bid.set(id, { id: id, a: 1, saleDate: today }, function (err, doc) {
        if (err) return done(err);
        var id = obj.id;
        bid.set(id, { id: id, a: 1, saleDate: today }, function (err, doc) {
          if (err) return done(err);
          var id = obj.id;
          bid.set(id, { id: id, a: 2, saleDate: today }, function (err, doc) {
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
  });

  describe('update', function () {

    it('should update a bid', function (done) {
      var id = obj.id
        , data = { id: id, status: 'BTL', saleDate: today }
        , update = { status: 'TITLE' };

      bid.set(id, data, function (err, doc) {
        if (err) return done(err);
        expect(doc.status).to.be.eql('BTL');
        bid.update(id, update, function (err, doc) {
          if (err) return done(err);
          expect(doc.status).to.be.eql('TITLE');
          done();
        });
      });
    });

    it('should exclude updating state, locked, owner, saleDate fields', function (done) {

      var id = obj.id
        , date = '01/01/2013'
        , data = { id: id, status: 'BTL', saleDate: today }
        , update = { state: 1, locked: 1, owner: users.wc, saleDate: date };

      bid.set(id, data, function (err, doc) {
        if (err) return done(err);
        expect(doc.state).to.eql(0);
        bid.update(id, update, function (err, doc) {
          if (err) return done(err);
          expect(doc.state).to.eql(0);
          expect(doc.locked).to.eql(0);
          expect(doc.owner).to.eql(null);
          expect(doc.saleDate).to.be.eql(today);
          done();
        });
      });
    });

    it('should update state, locked, owner, saleDate fields when forced', function (done) {

      var id = obj.id
        , date = '01/01/2013'
        , data = { id: id, status: 'BTL', saleDate: today }
        , update = { state: 1, locked: 1, owner: users.wc, saleDate: date };

      bid.set(id, data, function (err, doc) {
        if (err) return done(err);
        expect(doc.state).to.be.eql(0);
        bid.update(id, update, function (err, doc) {
          if (err) return done(err);
          expect(doc.state).to.be.eql(1);
          expect(doc.locked).to.be.eql(1);
          expect(doc.saleDate).to.be.eql(date);
          expect(doc.owner).to.be.eql(users.wc);
          done();
        }, { force: true });
      });

    });

    it('should emit update event', function (done) {

      var id = obj.id
        , date = '01/01/2013'
        , data = { id: id, status: 'BTL', saleDate: today }
        , update = { state: 1, locked: 1, owner: users.wc };

      bid.set(id, data, function (err, doc) {
        if (err) return done(err);
        expect(doc.state).to.be.eql(0);
        bid.update(id, update, null, { force: true });
      });

      bid.once('update', function (doc) {
        expect(doc.state).to.be.eql(1);
        expect(doc.locked).to.be.eql(1);
        expect(doc.owner).to.be.eql(users.wc);
        done();
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