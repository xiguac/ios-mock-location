"use strict";

const assert = require("assert");
const core = require("../ios-mock-location");

function readFirstVarintField(bytes, number) {
  const fields = core.parseProto(bytes);
  const field = fields.find(item => item.fieldNumber === number);
  assert(field, `field ${number} should exist`);
  return field.value;
}

function location(lat, lng) {
  return Buffer.concat([
    Buffer.from(core.fieldVarint(1, Math.trunc(lat * 100000000))),
    Buffer.from(core.fieldVarint(2, Math.trunc(lng * 100000000))),
    Buffer.from(core.fieldVarint(3, 10))
  ]);
}

function nested(lat, lng) {
  return Buffer.from(core.fieldBytes(1, location(lat, lng)));
}

function applePayload() {
  return Buffer.concat([
    Buffer.from(core.fieldBytes(2, nested(1.1, 2.2))),
    Buffer.from(core.fieldBytes(22, nested(3.3, 4.4))),
    Buffer.from(core.fieldVarint(99, 7))
  ]);
}

const result = core.patchResponseBytes(applePayload(), {
  latitude: 39.9042,
  longitude: 116.4074,
  horizontalAccuracy: 25,
  verticalAccuracy: 50,
  altitude: 88
});

assert.strictEqual(result.changed, true);
assert.strictEqual(result.wifiCount, 1);
assert.strictEqual(result.cellCount, 1);

const root = core.parseProto(result.bytes);
const wifi = root.find(item => item.fieldNumber === 2);
const cell = root.find(item => item.fieldNumber === 22);
assert(wifi);
assert(cell);

const wifiLocation = core.parseProto(wifi.valueBytes).find(item => item.fieldNumber === 1).valueBytes;
const cellLocation = core.parseProto(cell.valueBytes).find(item => item.fieldNumber === 1).valueBytes;

assert.strictEqual(readFirstVarintField(wifiLocation, 1), 3990420000);
assert.strictEqual(readFirstVarintField(wifiLocation, 2), 11640740000);
assert.strictEqual(readFirstVarintField(wifiLocation, 3), 25);
assert.strictEqual(readFirstVarintField(wifiLocation, 4), 50);
assert.strictEqual(readFirstVarintField(wifiLocation, 5), 88);
assert.strictEqual(readFirstVarintField(cellLocation, 1), 3990420000);
assert.strictEqual(readFirstVarintField(cellLocation, 2), 11640740000);

assert.throws(() => core.sanitizeConfig({ latitude: 91, longitude: 0 }), /invalid latitude/);

const negative = core.patchResponseBytes(applePayload(), {
  latitude: 37.3349,
  longitude: -122.00902
});
assert.strictEqual(negative.changed, true);

console.log("core tests passed");
