"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.TOKEN || "";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "loc.json");
const PAGE_FILE = path.join(__dirname, "page.html");

const DEFAULT_LOCATION = {
  latitude: 37.3349,
  longitude: -122.00902,
  altitude: 530,
  horizontalAccuracy: 39,
  verticalAccuracy: 1000
};

function readLocation() {
  try {
    return normalizeLocation({ ...DEFAULT_LOCATION, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) });
  } catch (_) {
    return normalizeLocation(DEFAULT_LOCATION);
  }
}

function writeLocation(value) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalizeLocation(value), null, 2));
}

function send(res, status, type, body) {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function checkToken(url, res) {
  if (!TOKEN) {
    send(res, 500, "application/json", JSON.stringify({ error: "TOKEN env var is required" }));
    return false;
  }
  if (url.searchParams.get("token") !== TOKEN) {
    send(res, 403, "application/json", JSON.stringify({ error: "bad token" }));
    return false;
  }
  return true;
}

function readJsonBody(req, callback) {
  let body = "";
  req.on("data", chunk => {
    body += chunk;
    if (body.length > 10000) req.destroy();
  });
  req.on("end", () => {
    try {
      callback(null, JSON.parse(body || "{}"));
    } catch (error) {
      callback(error);
    }
  });
}

function numberInRange(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function setInteger(target, key, value) {
  if (value === undefined || value === null || value === "") return;
  const n = Number(value);
  if (Number.isFinite(n)) target[key] = Math.round(n);
}

function normalizeLocation(value) {
  return {
    latitude: Number(value.latitude),
    longitude: Number(value.longitude),
    altitude: Math.round(Number(value.altitude)),
    horizontalAccuracy: Math.round(Number(value.horizontalAccuracy)),
    verticalAccuracy: Math.round(Number(value.verticalAccuracy))
  };
}

function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    return send(res, 204, "text/plain", "");
  }

  if (url.pathname === "/health") {
    return send(res, 200, "application/json", JSON.stringify({ ok: true, tokenConfigured: Boolean(TOKEN) }));
  }

  if ((url.pathname === "/" || url.pathname === "/index.html") && req.method === "GET") {
    return send(res, 200, "text/html; charset=utf-8", fs.readFileSync(PAGE_FILE, "utf8"));
  }

  if (url.pathname === "/loc.json" && req.method === "GET") {
    if (!checkToken(url, res)) return;
    return send(res, 200, "application/json", JSON.stringify(readLocation()));
  }

  if (url.pathname === "/set" && req.method === "POST") {
    if (!checkToken(url, res)) return;
    return readJsonBody(req, (error, body) => {
      if (error) return send(res, 400, "application/json", JSON.stringify({ error: "bad json" }));
      const latitude = numberInRange(body.latitude ?? body.lat, -90, 90);
      const longitude = numberInRange(body.longitude ?? body.lng, -180, 180);
      if (latitude === null || longitude === null) {
        return send(res, 400, "application/json", JSON.stringify({ error: "bad coordinates" }));
      }
      const next = { ...readLocation(), latitude, longitude };
      setInteger(next, "altitude", body.altitude);
      setInteger(next, "horizontalAccuracy", body.horizontalAccuracy);
      setInteger(next, "verticalAccuracy", body.verticalAccuracy);
      writeLocation(next);
      return send(res, 200, "application/json", JSON.stringify(next));
    });
  }

  return send(res, 404, "text/plain", "not found");
}

if (require.main === module) {
  http.createServer(handler).listen(PORT, () => {
    console.log(`ios-mock-location picker listening on http://127.0.0.1:${PORT}`);
  });
}

module.exports = { handler, readLocation, writeLocation };
