"use strict";

const fs = require("fs");
const path = require("path");

const target = process.env.LOCATION_FILE || path.join(__dirname, "..", "deploy", "github-pages", "loc.json");

function readNumber(name, fallback, min, max) {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return value;
}

function readInteger(name, fallback) {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return Math.round(value);
}

const current = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : {};

const next = {
  latitude: readNumber("LATITUDE", current.latitude ?? 37.3349, -90, 90),
  longitude: readNumber("LONGITUDE", current.longitude ?? -122.00902, -180, 180),
  altitude: readInteger("ALTITUDE", current.altitude ?? 530),
  horizontalAccuracy: readInteger("HORIZONTAL_ACCURACY", current.horizontalAccuracy ?? 39),
  verticalAccuracy: readInteger("VERTICAL_ACCURACY", current.verticalAccuracy ?? 1000)
};

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(next, null, 2) + "\n");
console.log(`updated ${target}`);
