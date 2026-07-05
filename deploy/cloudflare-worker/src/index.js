import { WORKER_PAGE } from "./page.js";

const KV_KEY = "loc";

const DEFAULT_LOCATION = {
  latitude: 37.3349,
  longitude: -122.00902,
  altitude: 530,
  horizontalAccuracy: 39,
  verticalAccuracy: 1000
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS
    }
  });
}

function authorized(url, env) {
  return Boolean(env.TOKEN) && url.searchParams.get("token") === env.TOKEN;
}

async function readLocation(env) {
  try {
    const raw = await env.LOCATION_KV.get(KV_KEY);
    return normalizeLocation(raw ? { ...DEFAULT_LOCATION, ...JSON.parse(raw) } : DEFAULT_LOCATION);
  } catch (_) {
    return normalizeLocation(DEFAULT_LOCATION);
  }
}

async function writeLocation(env, value) {
  await env.LOCATION_KV.put(KV_KEY, JSON.stringify(normalizeLocation(value)));
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

async function handleSet(request, env, url) {
  if (!authorized(url, env)) return json({ error: "bad token" }, 403);
  let body;
  try {
    const text = await request.text();
    if (text.length > 10000) return json({ error: "payload too large" }, 413);
    body = JSON.parse(text || "{}");
  } catch (_) {
    return json({ error: "bad json" }, 400);
  }

  const latitude = numberInRange(body.latitude ?? body.lat, -90, 90);
  const longitude = numberInRange(body.longitude ?? body.lng, -180, 180);
  if (latitude === null || longitude === null) return json({ error: "bad coordinates" }, 400);

  const next = { ...(await readLocation(env)), latitude, longitude };
  setInteger(next, "altitude", body.altitude);
  setInteger(next, "horizontalAccuracy", body.horizontalAccuracy);
  setInteger(next, "verticalAccuracy", body.verticalAccuracy);
  await writeLocation(env, next);
  return json(next);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/health") {
      return json({ ok: true, kvConfigured: Boolean(env.LOCATION_KV), tokenConfigured: Boolean(env.TOKEN) });
    }

    if ((url.pathname === "/" || url.pathname === "/index.html") && request.method === "GET") {
      return html(WORKER_PAGE);
    }

    if (url.pathname === "/loc.json" && request.method === "GET") {
      if (!authorized(url, env)) return json({ error: "bad token" }, 403);
      return json(await readLocation(env));
    }

    if (url.pathname === "/set" && request.method === "POST") {
      return handleSet(request, env, url);
    }

    return new Response("not found", { status: 404, headers: CORS });
  }
};
