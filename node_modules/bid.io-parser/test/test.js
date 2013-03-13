var parser = require('..');
var expect = require('expect.js');
var encode = parser.encode;
var decode = parser.decode;

// tests encoding and decoding a packet

function test(obj){
  expect(decode(encode(obj))).to.eql(obj);
}

describe('parser', function(){

  it('exposes types', function(){
    expect(parser.JOIN).to.be.a('number');
    expect(parser.LEAVE).to.be.a('number');
    expect(parser.FETCH).to.be.a('number');
    expect(parser.LOCK).to.be.a('number');
    expect(parser.UNLOCK).to.be.a('number');
    expect(parser.COMPLETE).to.be.a('number');
    expect(parser.ERROR).to.be.a('number');
  });

  it('encodes fetch', function(){
    test({
      type: parser.LOCK,
      id: 123456,
      data: { owner: { id: 123456, name: 'a' } }
    });
  });

  it('encodes lock', function(){
    test({
      type: parser.LOCK,
      id: 123456,
      data: { owner: { id: 123456, name: 'a' } }
    });
  });

  it('encodes unlock', function(){
    test({
      type: parser.LOCK,
      id: 123456,
      data: { owner: { id: 123456 } }
    });
  });

  it('encodes complete', function(){
    test({
      type: parser.LOCK,
      id: 123456,
      data: { owner: { id: 123456, name: 'a' } }
    });
  });

});