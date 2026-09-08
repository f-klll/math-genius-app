/* =========================================================================
 * 数学学霸模拟器 — 后端服务（零依赖 Node http）
 *   · 静态托管前端（同源，免去 CORS 烦恼）
 *   · 登录：微信 OAuth（生产结构）+ 开发模拟 / 手机号一键登录
 *   · 段位排行榜：全服排行 + 地区排行（真实持久化到 db.json）
 *
 * 运行：  node server/index.js   （可设 PORT / WX_APPID / WX_SECRET 环境变量）
 * ========================================================================= */
"use strict";
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8787;
const APP_DIR = path.join(__dirname, "..");          // math-genius-app/
const DB_FILE = path.join(__dirname, "db.json");
const WX_APPID = process.env.WX_APPID || "";
const WX_SECRET = process.env.WX_SECRET || "";

/* ---------------- 数据库（JSON 文件 + 防抖落盘） ---------------- */
let db = { users: {}, tokens: {} }; // users: id->{...}; tokens: token->userId
try {
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (!db.users) db.users = {};
  if (!db.tokens) db.tokens = {};
} catch (e) { console.error("db 读取失败，使用空库：", e.message); }
let _flushTimer = null;
function flushDb() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    fs.writeFile(DB_FILE, JSON.stringify(db), (err) => {
      if (err) console.error("db 写入失败：", err.message);
    });
  }, 300);
}

/* ---------------- 工具 ---------------- */
const now = () => Date.now();
const newId = () => "U" + now().toString(36) + crypto.randomBytes(4).toString("hex");
const newToken = () => crypto.randomBytes(18).toString("hex");
const jres = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  });
  res.end(body);
};
const sendErr = (res, code, msg) => jres(res, code, { ok: false, error: msg });
function readBody(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); } catch (e) { resolve({}); }
    });
  });
}
function authUser(req, body) {
  // 优先 body.token，其次 Authorization: Bearer
  let token = body && body.token;
  const ah = req.headers["authorization"] || "";
  if (!token && ah.startsWith("Bearer ")) token = ah.slice(7);
  if (!token) return null;
  const id = db.tokens[token];
  return id ? db.users[id] : null;
}

/* ---------------- 微信 OAuth（真实结构，缺凭证自动走开发模拟） ---------------- */
function wxGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(new Error("微信返回解析失败")); }
      });
    }).on("error", reject);
  });
}
async function wxExchange(code) {
  // 生产流程：code → access_token + openid → userinfo
  const tUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${WX_APPID}&secret=${WX_SECRET}&code=${code}&grant_type=authorization_code`;
  const t = await wxGet(tUrl);
  if (t.errcode) throw new Error("微信换取失败：" + t.errmsg);
  const uUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${t.access_token}&openid=${t.openid}&lang=zh_CN`;
  const u = await wxGet(uUrl);
  if (u.errcode) throw new Error("微信用户信息失败：" + u.errmsg);
  return { openid: t.openid, nickname: u.nickname, avatar: u.headimgurl || "🐱" };
}

const AVATARS = ["🐱", "🦊", "🐼", "🦁", "🐯", "🐸", "🐵", "🐧", "🦉", "🐰", "🐨", "🐢"];
const REGIONS = ["北京", "上海", "天津", "重庆", "广东", "江苏", "浙江", "山东", "四川", "湖北",
  "湖南", "河南", "河北", "福建", "安徽", "江西", "陕西", "山西", "辽宁", "吉林", "黑龙江",
  "云南", "贵州", "甘肃", "青海", "海南", "台湾", "中国香港", "中国澳门", "广西", "内蒙古",
  "宁夏", "新疆", "西藏"];

function upsertUser({ openid, nickname, avatar, region, provider, deviceId }) {
  // 优先按 openid（真实微信）→ 设备 ID（开发模拟稳定身份）→ 同昵称去重
  let user = openid ? Object.values(db.users).find((u) => u.openid === openid) : null;
  if (!user && deviceId) user = Object.values(db.users).find((u) => u.deviceId === deviceId) || null;
  if (!user && provider === "wechat") {
    user = Object.values(db.users).find((u) => u.provider === "wechat" && u.nickname === nickname) || null;
  }
  if (!user) {
    user = {
      id: newId(), openid: openid || "", deviceId: deviceId || "", provider: provider || "guest",
      nickname: nickname || "学霸" + crypto.randomBytes(2).toString("hex").slice(0, 4),
      avatar: avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
      region: region || "", elo: 0, xp: 0, tier: 0, bestElo: 0, games: 0,
      createdAt: now(), updatedAt: now(),
    };
    db.users[user.id] = user;
  } else {
    if (deviceId) user.deviceId = deviceId;
    if (nickname) user.nickname = nickname;
    if (avatar) user.avatar = avatar;
    if (region) user.region = region;
    user.updatedAt = now();
  }
  const token = newToken();
  db.tokens[token] = user.id;
  flushDb();
  return { token, user: publicUser(user) };
}
function publicUser(u) {
  return { id: u.id, nickname: u.nickname, avatar: u.avatar, region: u.region,
    elo: u.elo, xp: u.xp, tier: u.tier, bestElo: u.bestElo, games: u.games };
}

/* ---------------- 排行计算 ---------------- */
// 按 ELO 降序排序；并列时按 updatedAt 早的靠前（先到的更牛）
function sortedByElo(list) {
  return list.slice().sort((a, b) => (b.elo - a.elo) || (a.updatedAt - b.updatedAt));
}
function leaderboard(scope, region, limit, aroundId) {
  let arr = Object.values(db.users).filter((u) => typeof u.elo === "number");
  if (scope === "region") arr = arr.filter((u) => u.region === region);
  const ranked = sortedByElo(arr);
  const total = ranked.length;
  const list = ranked.slice(0, limit || 50).map((u, i) => ({
    rank: i + 1, nickname: u.nickname, avatar: u.avatar, elo: u.elo,
    tier: u.tier, region: u.region,
  }));
  let mine = null;
  if (aroundId) {
    const idx = ranked.findIndex((u) => u.id === aroundId);
    if (idx >= 0) {
      mine = { rank: idx + 1, total, user: publicUser(ranked[idx]) };
      // 若我在 50 名外，补一段「我附近」的条目
      if (idx >= limit) {
        const s = Math.max(0, idx - 2);
        const slice = ranked.slice(s, idx + 3).map((u, i) => ({
          rank: s + i + 1, nickname: u.nickname, avatar: u.avatar, elo: u.elo,
          tier: u.tier, region: u.region, me: u.id === aroundId,
        }));
        return { ok: true, total, list, mine, around: slice };
      }
    }
  }
  // 给榜单里标注「我」
  if (aroundId) {
    list.forEach((it) => { if (it.nickname && db.users[aroundId] && it.nickname === db.users[aroundId].nickname && it.elo === db.users[aroundId].elo) it.me = true; });
  }
  return { ok: true, total, list, mine: mine || null };
}

/* ---------------- API 路由 ---------------- */
async function handleApi(req, res, url) {
  const p = url.pathname;
  const q = url.searchParams;

  if (req.method === "OPTIONS") return jres(res, 204, {});

  // 健康检查
  if (p === "/api/health") return jres(res, 200, { ok: true, ts: now() });

  // 前端配置（是否启用真实微信 OAuth）
  if (p === "/api/config") return jres(res, 200, { ok: true, wechatEnabled: !!WX_APPID });

  // 登录：微信 / 手机号（开发模拟）
  if (p === "/api/auth/wechat" && req.method === "POST") {
    const body = await readBody(req);
    const provider = body.provider === "phone" ? "phone" : "wechat";
    try {
      let info = null;
      if (body.code && WX_APPID && WX_SECRET) {
        info = await wxExchange(body.code); // 真实微信流程
      } else {
        // 开发模拟：没有真实凭证时，按 provider 造一个账户（保留用户起的昵称，不再追加随机后缀）
        const av = provider === "phone" ? "🦊" : "🐱";
        const base = body.nickname || (provider === "phone" ? "手机学霸" : "微信学霸");
        info = { openid: "", nickname: base, avatar: body.avatar || av };
      }
      const r = upsertUser({ openid: info.openid, nickname: info.nickname,
        avatar: info.avatar, region: body.region || "", provider, deviceId: body.deviceId || "" });
      return jres(res, 200, { ok: true, ...r, dev: !WX_APPID });
    } catch (e) {
      return sendErr(res, 502, e.message);
    }
  }

  // 当前用户
  if (p === "/api/me" && req.method === "GET") {
    const body = {};
    const u = authUser(req, body);
    if (!u) return sendErr(res, 401, "未登录");
    return jres(res, 200, { ok: true, user: publicUser(u) });
  }

  // 提交段位（upsert best elo / xp / tier / region）
  if (p === "/api/rank/submit" && req.method === "POST") {
    const body = await readBody(req);
    const u = authUser(req, body);
    if (!u) return sendErr(res, 401, "未登录");
    if (typeof body.elo === "number") {
      u.elo = Math.max(0, Math.round(body.elo));
      if (u.elo > (u.bestElo || 0)) u.bestElo = u.elo;
    }
    if (typeof body.xp === "number") u.xp = Math.max(u.xp || 0, Math.round(body.xp));
    if (typeof body.tier === "number") u.tier = Math.max(u.tier || 0, Math.round(body.tier));
    if (typeof body.games === "number") u.games = Math.max(u.games || 0, Math.round(body.games));
    if (body.nickname) u.nickname = body.nickname;
    if (body.avatar) u.avatar = body.avatar;
    if (body.region) u.region = body.region;
    u.updatedAt = now();
    flushDb();
    return jres(res, 200, { ok: true, user: publicUser(u) });
  }

  // 我的排名（全服 + 地区）
  if (p === "/api/rank/mine" && req.method === "GET") {
    const u = authUser(req, {});
    if (!u) return sendErr(res, 401, "未登录");
    const g = leaderboard("global", null, 50, u.id);
    const region = u.region;
    const r = region ? leaderboard("region", region, 50, u.id) : null;
    return jres(res, 200, {
      ok: true,
      global: { rank: g.mine ? g.mine.rank : null, total: g.total },
      region: r ? { rank: r.mine ? r.mine.rank : null, total: r.total, region } : null,
      regions: REGIONS,
    });
  }

  // 全服榜
  if (p === "/api/rank/global" && req.method === "GET") {
    const token = q.get("token");
    const u = token ? db.users[db.tokens[token]] : null;
    const limit = Math.min(200, Math.max(10, Number(q.get("limit")) || 50));
    const r = leaderboard("global", null, limit, u ? u.id : null);
    return jres(res, 200, { ok: true, regions: REGIONS, ...r });
  }

  // 地区榜
  if (p === "/api/rank/region" && req.method === "GET") {
    const region = q.get("region");
    if (!region) return sendErr(res, 400, "缺少 region 参数");
    const token = q.get("token");
    const u = token ? db.users[db.tokens[token]] : null;
    const limit = Math.min(200, Math.max(10, Number(q.get("limit")) || 50));
    const r = leaderboard("region", region, limit, u ? u.id : null);
    return jres(res, 200, { ok: true, region, ...r });
  }

  return sendErr(res, 404, "API 不存在：" + p);
}

/* ---------------- 静态文件托管 ---------------- */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp",
};
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const filePath = path.normalize(path.join(APP_DIR, rel));
  if (!filePath.startsWith(APP_DIR)) return sendErr(res, 403, "forbidden");
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Not Found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

/* ---------------- 启动 ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    try { await handleApi(req, res, url); }
    catch (e) { console.error("API 错误：", e); sendErr(res, 500, "服务器内部错误"); }
  } else {
    serveStatic(req, res, url);
  }
});
server.listen(PORT, () => {
  console.log("✅ 数学学霸模拟器 后端已启动");
  console.log("   本地预览： http://localhost:" + PORT + "/");
  console.log("   微信登录： " + (WX_APPID ? "已启用真实 OAuth" : "开发模拟（未配置 WX_APPID）"));
});
