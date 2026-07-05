(function () {
  "use strict";

  var DEFAULTS = {
    enabled: true,
    latitude: 37.3349,
    longitude: -122.00902,
    horizontalAccuracy: 39,
    verticalAccuracy: 1000,
    altitude: 530,
    motionActivityType: 63,
    motionActivityConfidence: 467,
    failOpen: true,
    debug: false
  };

  var APPLE_WLOC_MARKER = ascii("AppleWLoc");
  var CELL_FIELD = { 22: true, 24: true };

  function clone(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (key) { out[key] = obj[key]; });
    return out;
  }

  function log(cfg, msg) {
    if (cfg && cfg.debug && typeof console !== "undefined" && console.log) {
      console.log("[ios-mock-location] " + msg);
    }
  }

  function ascii(value) {
    var out = new Uint8Array(value.length);
    for (var i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 255;
    return out;
  }

  function concat(parts) {
    var length = 0;
    parts.forEach(function (part) { length += part.length; });
    var out = new Uint8Array(length);
    var offset = 0;
    parts.forEach(function (part) {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function findBytes(bytes, needle, start) {
    outer: for (var i = start || 0; i <= bytes.length - needle.length; i += 1) {
      for (var j = 0; j < needle.length; j += 1) {
        if (bytes[i + j] !== needle[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  function bytesFromBody(body) {
    if (body == null) return new Uint8Array(0);
    if (body instanceof Uint8Array) return body;
    if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return new Uint8Array(body);
    if (Array.isArray(body)) return new Uint8Array(body);
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(body)) return new Uint8Array(body);
    if (typeof body === "string") {
      var out = new Uint8Array(body.length);
      for (var i = 0; i < body.length; i += 1) out[i] = body.charCodeAt(i) & 255;
      return out;
    }
    if (typeof body === "object" && typeof body.byteLength === "number") return new Uint8Array(body);
    throw new Error("unsupported body type");
  }

  function bodyFromBytes(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes);
    var s = "";
    for (var i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
    return s;
  }

  function base64ToBytes(value) {
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
    var bin = atob(value);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i) & 255;
    return out;
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    var s = "";
    for (var i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function readU16(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
  }

  function readU32(bytes, offset) {
    return ((bytes[offset] * 0x1000000) + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])) >>> 0;
  }

  function writeU16(value) {
    return new Uint8Array([(value >>> 8) & 255, value & 255]);
  }

  function writeU32(value) {
    return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
  }

  function encodeVarint(value) {
    if (typeof BigInt !== "undefined") {
      var b = BigInt(Math.trunc(Number(value)));
      if (b < 0) b = (1n << 64n) + b;
      var bytes = [];
      while (b > 127n) {
        bytes.push(Number((b & 127n) | 128n));
        b >>= 7n;
      }
      bytes.push(Number(b));
      return new Uint8Array(bytes);
    }
    var n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error("negative varint requires BigInt");
    var out = [];
    while (n > 127) {
      out.push((n & 127) | 128);
      n = Math.floor(n / 128);
    }
    out.push(n);
    return new Uint8Array(out);
  }

  function decodeVarint(bytes, offset) {
    var result = 0;
    var shift = 0;
    var pos = offset;
    while (pos < bytes.length) {
      var b = bytes[pos++];
      result += (b & 127) * Math.pow(2, shift);
      if ((b & 128) === 0) return { value: result, offset: pos };
      shift += 7;
      if (shift > 63) throw new Error("varint too long");
    }
    throw new Error("truncated varint");
  }

  function key(fieldNumber, wireType) {
    return encodeVarint(fieldNumber * 8 + wireType);
  }

  function fieldVarint(fieldNumber, value) {
    return concat([key(fieldNumber, 0), encodeVarint(value)]);
  }

  function fieldBytes(fieldNumber, value) {
    return concat([key(fieldNumber, 2), encodeVarint(value.length), value]);
  }

  function parseProto(bytes) {
    var fields = [];
    var pos = 0;
    while (pos < bytes.length) {
      var start = pos;
      var k = decodeVarint(bytes, pos);
      pos = k.offset;
      var fieldNumber = Math.floor(k.value / 8);
      var wireType = k.value & 7;
      if (fieldNumber < 1) throw new Error("invalid protobuf field");
      var rawEnd;
      var item = { fieldNumber: fieldNumber, wireType: wireType, start: start };
      if (wireType === 0) {
        var v = decodeVarint(bytes, pos);
        pos = v.offset;
        item.value = v.value;
      } else if (wireType === 1) {
        pos += 8;
      } else if (wireType === 2) {
        var len = decodeVarint(bytes, pos);
        pos = len.offset;
        rawEnd = pos + len.value;
        if (rawEnd > bytes.length) throw new Error("length-delimited field out of range");
        item.valueBytes = bytes.slice(pos, rawEnd);
        pos = rawEnd;
      } else if (wireType === 5) {
        pos += 4;
      } else {
        throw new Error("unsupported protobuf wire type " + wireType);
      }
      if (pos > bytes.length) throw new Error("protobuf overrun");
      item.raw = bytes.slice(start, pos);
      fields.push(item);
    }
    return fields;
  }

  function firstField(fields, number) {
    for (var i = 0; i < fields.length; i += 1) {
      if (fields[i].fieldNumber === number) return fields[i];
    }
    return null;
  }

  function coord(value) {
    return Math.trunc(Number(value) * 100000000);
  }

  function sanitizeConfig(input) {
    var cfg = clone(DEFAULTS);
    Object.keys(input || {}).forEach(function (key) {
      if (input[key] !== undefined && input[key] !== null && input[key] !== "") cfg[key] = input[key];
    });
    cfg.enabled = parseBool(cfg.enabled, true);
    cfg.failOpen = parseBool(cfg.failOpen, true);
    cfg.debug = parseBool(cfg.debug, false);
    ["latitude", "longitude", "horizontalAccuracy", "verticalAccuracy", "altitude", "motionActivityType", "motionActivityConfidence"].forEach(function (key) {
      cfg[key] = Number(cfg[key]);
    });
    if (!Number.isFinite(cfg.latitude) || cfg.latitude < -90 || cfg.latitude > 90) throw new Error("invalid latitude");
    if (!Number.isFinite(cfg.longitude) || cfg.longitude < -180 || cfg.longitude > 180) throw new Error("invalid longitude");
    return cfg;
  }

  function parseBool(value, fallback) {
    if (value === true || value === false) return value;
    if (value == null || value === "") return fallback;
    var s = String(value).toLowerCase();
    if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
    if (s === "0" || s === "false" || s === "no" || s === "off") return false;
    return fallback;
  }

  function patchLocationMessage(payload, cfg) {
    var fields = parseProto(payload);
    var skip = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 10: true, 11: true };
    var parts = [
      fieldVarint(1, coord(cfg.latitude)),
      fieldVarint(2, coord(cfg.longitude)),
      fieldVarint(3, Math.trunc(cfg.horizontalAccuracy)),
      fieldVarint(4, Math.trunc(cfg.verticalAccuracy)),
      fieldVarint(5, Math.trunc(cfg.altitude)),
      fieldVarint(10, Math.trunc(cfg.motionActivityType)),
      fieldVarint(11, Math.trunc(cfg.motionActivityConfidence))
    ];
    fields.forEach(function (field) {
      if (!skip[field.fieldNumber]) parts.push(field.raw);
    });
    return concat(parts);
  }

  function patchNestedLocation(payload, cfg) {
    var fields = parseProto(payload);
    var changed = false;
    var parts = fields.map(function (field) {
      if (field.fieldNumber === 1 && field.wireType === 2) {
        changed = true;
        return fieldBytes(1, patchLocationMessage(field.valueBytes, cfg));
      }
      return field.raw;
    });
    if (!changed) {
      parts.push(fieldBytes(1, patchLocationMessage(new Uint8Array(0), cfg)));
    }
    return concat(parts);
  }

  function patchAppleWLocPayload(payload, cfg) {
    var fields = parseProto(payload);
    var wifiCount = 0;
    var cellCount = 0;
    var parts = fields.map(function (field) {
      if (field.fieldNumber === 2 && field.wireType === 2) {
        wifiCount += 1;
        return fieldBytes(2, patchNestedLocation(field.valueBytes, cfg));
      }
      if (CELL_FIELD[field.fieldNumber] && field.wireType === 2) {
        cellCount += 1;
        return fieldBytes(field.fieldNumber, patchNestedLocation(field.valueBytes, cfg));
      }
      return field.raw;
    });
    return { bytes: concat(parts), wifiCount: wifiCount, cellCount: cellCount };
  }

  function parseArpc(bytes) {
    if (bytes.length < 13) return null;
    var methodLen = readU16(bytes, 9);
    var methodStart = 11;
    var methodEnd = methodStart + methodLen;
    if (methodEnd + 6 > bytes.length) return null;
    var statusLen = readU16(bytes, methodEnd);
    var statusStart = methodEnd + 2;
    var statusEnd = statusStart + statusLen;
    if (statusEnd + 4 > bytes.length) return null;
    var bodyLen = readU32(bytes, statusEnd);
    var bodyStart = statusEnd + 4;
    var bodyEnd = bodyStart + bodyLen;
    if (bodyEnd !== bytes.length) return null;
    return {
      prefix: bytes.slice(0, 9),
      method: bytes.slice(methodStart, methodEnd),
      status: bytes.slice(statusStart, statusEnd),
      body: bytes.slice(bodyStart, bodyEnd)
    };
  }

  function serializeArpc(packet) {
    return concat([
      packet.prefix,
      writeU16(packet.method.length),
      packet.method,
      writeU16(packet.status.length),
      packet.status,
      writeU32(packet.body.length),
      packet.body
    ]);
  }

  function extractPayload(bytes) {
    var arpc = parseArpc(bytes);
    if (arpc) return { kind: "arpc", packet: arpc, payload: arpc.body };

    var markerAt = findBytes(bytes, APPLE_WLOC_MARKER, 0);
    if (markerAt >= 0) {
      var payloadStart = markerAt + APPLE_WLOC_MARKER.length;
      return {
        kind: "marker",
        prefix: bytes.slice(0, payloadStart),
        suffix: new Uint8Array(0),
        payload: bytes.slice(payloadStart)
      };
    }

    parseProto(bytes);
    return { kind: "bare", payload: bytes };
  }

  function rebuild(wrapper, payload) {
    if (wrapper.kind === "arpc") {
      wrapper.packet.body = payload;
      return serializeArpc(wrapper.packet);
    }
    if (wrapper.kind === "marker") return concat([wrapper.prefix, payload, wrapper.suffix]);
    return payload;
  }

  function patchResponseBytes(input, options) {
    var cfg = sanitizeConfig(options || {});
    var original = bytesFromBody(input);
    if (!cfg.enabled) return { bytes: original, changed: false, disabled: true };
    var wrapper = extractPayload(original);
    var patched = patchAppleWLocPayload(wrapper.payload, cfg);
    var out = rebuild(wrapper, patched.bytes);
    return {
      bytes: out,
      changed: true,
      kind: wrapper.kind,
      wifiCount: patched.wifiCount,
      cellCount: patched.cellCount
    };
  }

  function parseArgs(raw) {
    var out = {};
    if (!raw) return out;
    if (typeof raw === "object") {
      Object.keys(raw).forEach(function (key) { out[key] = raw[key]; });
      return out;
    }
    String(raw).split(/[&;]/).forEach(function (pair) {
      if (!pair) return;
      var idx = pair.indexOf("=");
      var keyName = idx >= 0 ? pair.slice(0, idx) : pair;
      var value = idx >= 0 ? pair.slice(idx + 1) : "true";
      try { value = decodeURIComponent(value); } catch (_) {}
      out[keyName] = value;
    });
    return out;
  }

  function mergeConfig(a, b) {
    var out = clone(a);
    Object.keys(b || {}).forEach(function (keyName) {
      if (b[keyName] !== undefined && b[keyName] !== null && b[keyName] !== "") out[keyName] = b[keyName];
    });
    return out;
  }

  function readArgs() {
    if (typeof $argument !== "undefined") return parseArgs($argument);
    return {};
  }

  function fetchRemoteConfig(args, callback) {
    var url = args.configUrl || args.url || "";
    if (!url || typeof $httpClient === "undefined") return callback(null);
    $httpClient.get({ url: url, timeout: 3000 }, function (error, response, body) {
      if (error || !response || Number(response.status || response.statusCode || 0) >= 400) return callback(null);
      try {
        callback(JSON.parse(body));
      } catch (_) {
        callback(null);
      }
    });
  }

  function responseBodyFromRuntime() {
    if (typeof $response !== "undefined" && $response) {
      if ($response.bodyBytes) return bytesFromBody($response.bodyBytes);
      if ($response.body) {
        if (typeof $response.body === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test($response.body) && $response.body.length % 4 === 0) {
          try { return base64ToBytes($response.body); } catch (_) {}
        }
        return bytesFromBody($response.body);
      }
    }
    if (typeof $responseBody !== "undefined") return base64ToBytes($responseBody);
    if (typeof $body !== "undefined") return bytesFromBody($body);
    return new Uint8Array(0);
  }

  function finishResponse(bytes, info, cfg) {
    var headers = {};
    if (typeof $response !== "undefined" && $response && $response.headers) {
      Object.keys($response.headers).forEach(function (keyName) { headers[keyName] = $response.headers[keyName]; });
    }
    headers["Content-Length"] = String(bytes.length);
    headers["X-iOS-Mock-Location"] = info && info.changed ? "patched" : "pass";
    if (typeof $done === "function") {
      if (typeof $responseBody !== "undefined") {
        return $done({ body: bytesToBase64(bytes) });
      }
      return $done({ headers: headers, bodyBytes: bytes });
    }
    log(cfg, "patched bytes=" + bytes.length);
  }

  function passThrough() {
    if (typeof $done === "function") return $done({});
  }

  function runProxy() {
    var args = readArgs();
    if (typeof $request !== "undefined" && typeof $response === "undefined" && typeof $responseBody === "undefined" && typeof $body === "undefined") {
      if (typeof $done === "function") {
        return $done({ headers: mergeConfig($request.headers || {}, { "Accept-Encoding": "identity" }) });
      }
      return;
    }

    fetchRemoteConfig(args, function (remote) {
      var cfgInput = mergeConfig(args, remote || {});
      var cfg;
      try {
        cfg = sanitizeConfig(cfgInput);
        var result = patchResponseBytes(responseBodyFromRuntime(), cfg);
        log(cfg, "kind=" + result.kind + " wifi=" + result.wifiCount + " cell=" + result.cellCount);
        finishResponse(result.bytes, result, cfg);
      } catch (error) {
        try { cfg = cfg || sanitizeConfig(cfgInput); } catch (_) { cfg = clone(DEFAULTS); }
        log(cfg, "error: " + error.message);
        if (cfg.failOpen) return passThrough();
        if (typeof $done === "function") return $done({ status: "HTTP/1.1 502 Bad Gateway", body: "ios-mock-location failed: " + error.message });
      }
    });
  }

  var api = {
    DEFAULTS: DEFAULTS,
    parseProto: parseProto,
    fieldVarint: fieldVarint,
    fieldBytes: fieldBytes,
    patchLocationMessage: patchLocationMessage,
    patchNestedLocation: patchNestedLocation,
    patchAppleWLocPayload: patchAppleWLocPayload,
    patchResponseBytes: patchResponseBytes,
    parseArgs: parseArgs,
    sanitizeConfig: sanitizeConfig,
    bytesToBase64: bytesToBase64,
    base64ToBytes: base64ToBytes
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    runProxy();
  }
})();
