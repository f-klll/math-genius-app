// 数学学霸模拟器 — Cloudflare Pages Functions（/api/* 的 catch-all）
// 从零依赖 Node 服务（server/index.js）移植到 Workers 运行时：
//   · 存储：Cloudflare KV（绑定名 DB），整库以 JSON 存于 key "db"
//   · 路由：functions/api/[[path]].js 拦截所有 /api/* 请求
//   · 微信 OAuth：使用 fetch（Workers 原生），无需 Node https 模块
//
// 前端在 HTTPS 下 API_BASE=""，自动走同源 /api/* → 被本 Functions 接管。

const AVATARS = ["🐱", "🦊", "🐼", "🦁", "🐯", "🐸", "🐵", "🐧", "🦉", "🐰", "🐨", "🐢"];
const REGIONS = ["北京", "上海", "天津", "重庆", "广东", "江苏", "浙江", "山东", "四川", "湖北",
  "湖南", "河南", "河北", "福建", "安徽", "江西", "陕西", "山西", "辽宁", "吉林", "黑龙江",
  "云南", "贵州", "甘肃", "青海", "海南", "台湾", "中国香港", "中国澳门", "广西", "内蒙古",
  "宁夏", "新疆", "西藏"];

function json(code, obj, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      ...extraHeaders,
    },
  });
}
function err(code, msg) { return json(code, { ok: false, error: msg }); }

async function readBody(req) {
  try {
    const t = await req.text();
    return t ? JSON.parse(t) : {};
  } catch (e) { return {}; }
}

function newId() { return "U" + Date.now().toString(36) + Math.random().toString(16).slice(2, 10); }
function newToken() { return crypto.randomUUID().replace(/-/g, "") + Math.random().toString(16).slice(2, 6); }

function publicUser(u) {
  return { id: u.id, nickname: u.nickname, avatar: u.avatar, region: u.region,
    elo: u.elo, xp: u.xp, tier: u.tier, bestElo: u.bestElo, games: u.games };
}
function sortedByElo(list) {
  return list.slice().sort((a, b) => (b.elo - a.elo) || (a.updatedAt - b.updatedAt));
}
function leaderboard(db, scope, region, limit, aroundId) {
  let arr = Object.values(db.users).filter((u) => typeof u.elo === "number");
  if (scope === "region") arr = arr.filter((u) => u.region === region);
  const ranked = sortedByElo(arr);
  const total = ranked.length;
  const list = ranked.slice(0, limit || 50).map((u, i) => ({
    rank: i + 1, nickname: u.nickname, avatar: u.avatar, elo: u.elo, tier: u.tier, region: u.region,
  }));
  let mine = null;
  if (aroundId) {
    const idx = ranked.findIndex((u) => u.id === aroundId);
    if (idx >= 0) {
      mine = { rank: idx + 1, total, user: publicUser(ranked[idx]) };
      if (idx >= limit) {
        const s = Math.max(0, idx - 2);
        const slice = ranked.slice(s, idx + 3).map((u, i) => ({
          rank: s + i + 1, nickname: u.nickname, avatar: u.avatar, elo: u.elo, tier: u.tier, region: u.region, me: u.id === aroundId,
        }));
        return { ok: true, total, list, mine, around: slice };
      }
    }
  }
  if (aroundId) {
    list.forEach((it) => { if (it.nickname && db.users[aroundId] && it.nickname === db.users[aroundId].nickname && it.elo === db.users[aroundId].elo) it.me = true; });
  }
  return { ok: true, total, list, mine: mine || null };
}
function authUser(db, req, body) {
  let token = body && body.token;
  const ah = req.headers.get("authorization") || "";
  if (!token && ah.startsWith("Bearer ")) token = ah.slice(7);
  if (!token) return null;
  const id = db.tokens[token];
  return id ? db.users[id] : null;
}
async function wxExchange(code, WX_APPID, WX_SECRET) {
  const tUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${WX_APPID}&secret=${WX_SECRET}&code=${code}&grant_type=authorization_code`;
  const t = await (await fetch(tUrl)).json();
  if (t.errcode) throw new Error("微信换取失败：" + t.errmsg);
  const uUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${t.access_token}&openid=${t.openid}&lang=zh_CN`;
  const u = await (await fetch(uUrl)).json();
  if (u.errcode) throw new Error("微信用户信息失败：" + u.errmsg);
  return { openid: t.openid, nickname: u.nickname, avatar: u.headimgurl || "🐱" };
}

// 内存兜底：当 Cloudflare 未绑定 KV（DB）时，用进程内 Map 暂存，避免 /api 全挂。
// 注意：内存存储仅在单个 isolate 生命周期内有效，冷启动会清空——仅作为“未配置 KV”时的降级。
const _mem = new Map();
function memoryKv() {
  return {
    async get(k) { return _mem.has(k) ? _mem.get(k) : null; },
    async put(k, v) { _mem.set(k, v); },
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const WX_APPID = env.WX_APPID || "";
  const WX_SECRET = env.WX_SECRET || "";
  const url = new URL(request.url);
  const p = url.pathname;
  const q = url.searchParams;

  if (request.method === "OPTIONS") return json(204, {});

  const DB = env.DB || memoryKv();
  async function loadDb() {
    let db = null;
    try { db = JSON.parse((await DB.get("db")) || "null"); } catch (e) { db = null; }
    if (!db) db = { users: {}, tokens: {} };
    if (!db.users) db.users = {};
    if (!db.tokens) db.tokens = {};
    return db;
  }
  async function saveDb(db) { await DB.put("db", JSON.stringify(db)); }

  function upsertUser(db, { openid, nickname, avatar, region, provider, deviceId }) {
    let user = openid ? Object.values(db.users).find((u) => u.openid === openid) : null;
    if (!user && deviceId) user = Object.values(db.users).find((u) => u.deviceId === deviceId) || null;
    if (!user && provider === "wechat") user = Object.values(db.users).find((u) => u.provider === "wechat" && u.nickname === nickname) || null;
    const now = Date.now();
    if (!user) {
      user = {
        id: newId(), openid: openid || "", deviceId: deviceId || "", provider: provider || "guest",
        nickname: nickname || "学霸" + Math.random().toString(16).slice(2, 6),
        avatar: avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
        region: region || "", elo: 0, xp: 0, tier: 0, bestElo: 0, games: 0,
        createdAt: now, updatedAt: now,
      };
      db.users[user.id] = user;
    } else {
      if (deviceId) user.deviceId = deviceId;
      if (nickname) user.nickname = nickname;
      if (avatar) user.avatar = avatar;
      if (region) user.region = region;
      user.updatedAt = now;
    }
    const token = newToken();
    db.tokens[token] = user.id;
    return { token, user: publicUser(user) };
  }

  // 健康检查
  if (p === "/api/health") return json(200, { ok: true, ts: Date.now() });
  // 前端配置
  if (p === "/api/config") return json(200, { ok: true, wechatEnabled: !!WX_APPID });

  // 登录：微信 / 手机号（开发模拟）
  if (p === "/api/auth/wechat" && request.method === "POST") {
    const body = await readBody(request);
    const provider = body.provider === "phone" ? "phone" : "wechat";
    try {
      let info = null;
      if (body.code && WX_APPID && WX_SECRET) info = await wxExchange(body.code, WX_APPID, WX_SECRET);
      else {
        const av = provider === "phone" ? "🦊" : "🐱";
        const base = body.nickname || (provider === "phone" ? "手机学霸" : "微信学霸");
        info = { openid: "", nickname: base, avatar: body.avatar || av };
      }
      const db = await loadDb();
      const r = upsertUser(db, { openid: info.openid, nickname: info.nickname, avatar: info.avatar, region: body.region || "", provider, deviceId: body.deviceId || "" });
      await saveDb(db);
      return json(200, { ok: true, ...r, dev: !WX_APPID });
    } catch (e) { return err(502, e.message); }
  }

  // 以下路由共用一份 db
  const db = await loadDb();

  // 当前用户
  if (p === "/api/me" && request.method === "GET") {
    const u = authUser(db, request, {});
    if (!u) return err(401, "未登录");
    return json(200, { ok: true, user: publicUser(u) });
  }

  // 提交段位（upsert best elo / xp / tier / region）
  if (p === "/api/rank/submit" && request.method === "POST") {
    const body = await readBody(request);
    const u = authUser(db, request, body);
    if (!u) return err(401, "未登录");
    if (typeof body.elo === "number") { u.elo = Math.max(0, Math.round(body.elo)); if (u.elo > (u.bestElo || 0)) u.bestElo = u.elo; }
    if (typeof body.xp === "number") u.xp = Math.max(u.xp || 0, Math.round(body.xp));
    if (typeof body.tier === "number") u.tier = Math.max(u.tier || 0, Math.round(body.tier));
    if (typeof body.games === "number") u.games = Math.max(u.games || 0, Math.round(body.games));
    if (body.nickname) u.nickname = body.nickname;
    if (body.avatar) u.avatar = body.avatar;
    if (body.region) u.region = body.region;
    u.updatedAt = Date.now();
    await saveDb(db);
    return json(200, { ok: true, user: publicUser(u) });
  }

  // 我的排名（全服 + 地区）
  if (p === "/api/rank/mine" && request.method === "GET") {
    const u = authUser(db, request, {});
    if (!u) return err(401, "未登录");
    const g = leaderboard(db, "global", null, 50, u.id);
    const region = u.region;
    const r = region ? leaderboard(db, "region", region, 50, u.id) : null;
    return json(200, { ok: true,
      global: { rank: g.mine ? g.mine.rank : null, total: g.total },
      region: r ? { rank: r.mine ? r.mine.rank : null, total: r.total, region } : null,
      regions: REGIONS });
  }

  // 全服榜
  if (p === "/api/rank/global" && request.method === "GET") {
    const token = q.get("token");
    const u = token ? db.users[db.tokens[token]] : null;
    const limit = Math.min(200, Math.max(10, Number(q.get("limit")) || 50));
    const r = leaderboard(db, "global", null, limit, u ? u.id : null);
    return json(200, { ok: true, regions: REGIONS, ...r });
  }

  // 地区榜
  if (p === "/api/rank/region" && request.method === "GET") {
    const region = q.get("region");
    if (!region) return err(400, "缺少 region 参数");
    const token = q.get("token");
    const u = token ? db.users[db.tokens[token]] : null;
    const limit = Math.min(200, Math.max(10, Number(q.get("limit")) || 50));
    const r = leaderboard(db, "region", region, limit, u ? u.id : null);
    return json(200, { ok: true, region, ...r });
  }

  return err(404, "API 不存在：" + p);
}
