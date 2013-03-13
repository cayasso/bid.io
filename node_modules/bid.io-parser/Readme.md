
# bid.io-protocol

  This repository contains the protocol specification and JavaScript
  parser for the Bid.IO protocol.

## Protocol version

  **Current protocol revision:** `1`.

## Parser API

### Parser#encode(Object:packet):String

  Encodes a `Packet` object as a string.

### Parser#decode(String:packet):Packet

  Returns a `Packet` object for the given string. If a parsing error
  occurs the returned packet is an error object.

### Parser#types

  Array of packet type keys.

### Packet

  Each packet is represented as a vanilla `Object` with a
  `type` key that can be one of the following:

  - `Packet#JOIN` (`0`)
  - `Packet#LEAVE` (`1`)
  - `Packet#FETCH` (`2`)
  - `Packet#LOCK` (`3`)
  - `Packet#UNLOCK` (`4`)
  - `Packet#COMPLETE` (`5`)
  - `Packet#ERROR` (`6`)

  All packts contains the fallowing properties:

  - `type` (`Number`) request `type`. 
  - `data` (`Object`) bid `data`.
  - `id` (`Number`) bid `id`.

## Running Tests

  To run the test suite just do:

  `$ make test`
