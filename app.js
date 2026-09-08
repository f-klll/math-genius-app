/* =========================================================================
 * 数学学霸模拟器 — 交互逻辑（柠檬苏打 · 可爱版 · ELO 无限爬塔）
 * 渲染数据、底部导航切换、ELO 答题引擎、段位系统、趣味瞬间（秒了 / 这题有点意思）
 * ========================================================================= */
(function () {
  "use strict";
  const D = window.APP_DATA;
  const FUN = D.fun;
  const ELO = D.elo;
  const RANKS = D.ranks;
  // 「秒了」且手速快的专属吐槽（学霸爽感）
  const MIAO_FAST = ["手起题落，神经元都在鼓掌。", "这题：我以为你还要想？", "秒了。隔壁高斯都点了赞。", "你的笔比闪电还讲道理。"];
  // 秘籍按 5 阶（小学→初中→高中→大学→前沿）分类；每个模型再拆成「子招式」(methods)
  const ALL_MODELS = () => [].concat(...D.manuals.categories.map((c) => c.models));
  const ALL_METHODS = () => [].concat(...ALL_MODELS().map((m) => m.methods || []));
  // 题目 id → 所属招式 id（收集完成用：答对首题即「习得」该招式）
  const Q_METHOD = (() => {
    const m = {};
    ALL_METHODS().forEach((me) => (me.bank || []).forEach((q) => { m[q.id] = me.id; }));
    return m;
  })();
  const $ = (id) => document.getElementById(id);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ---------------- 萌系 emoji 图标（替代几何线条） ---------------- */
  const EMOJI = {
    target: "🎯", tri: "🔺", bars: "📊", diff: "🔁",
    "tri-rt": "📐", peak: "⛰️", sum: "🧮", circle: "⭕", pct: "💯",
  };
  const icon = (id) => EMOJI[id] || "✨";

  /* ---------------- 可爱风 SVG（吉祥物 / 瞬间图标） ---------------- */
  const MASCOT_SVG = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 22 q11 -15 23 -10 q-4 13 -19 15 Z" fill="#5DC97E"/>
    <path d="M30 31 L23 11 L47 27 Z" fill="#FFD23F" stroke="#E0A92E" stroke-width="2.5"/>
    <path d="M70 31 L77 11 L53 27 Z" fill="#FFD23F" stroke="#E0A92E" stroke-width="2.5"/>
    <circle cx="50" cy="56" r="32" fill="#FFD23F" stroke="#E0A92E" stroke-width="2.5"/>
    <path d="M32 28 L29 19 L42 27 Z" fill="#FFE9A8"/>
    <path d="M68 28 L71 19 L58 27 Z" fill="#FFE9A8"/>
    <circle cx="40" cy="52" r="4.2" fill="#33301F"/>
    <circle cx="60" cy="52" r="4.2" fill="#33301F"/>
    <circle cx="33" cy="60" r="4.5" fill="#FFB0A0" opacity="0.65"/>
    <circle cx="67" cy="60" r="4.5" fill="#FFB0A0" opacity="0.65"/>
    <path d="M42 62 Q50 70 58 62" stroke="#33301F" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M22 56 L34 58 M22 62 L34 63" stroke="#E0A92E" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M78 56 L66 58 M78 62 L66 63" stroke="#E0A92E" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

  // 「秒了」→ 🤫 嘘脸（无水印版，用户原图去水印）
  const MIAO_IMG = '<img src="assets/correct-shh-clean.png" alt="秒了" class="moment-meme" />';
  // 「这题有点意思」→ 歪嘴坏笑（无水印版，用户原图去水印）
  const INTERESTING_IMG = '<img src="assets/wrong-smirk-clean.png" alt="这题有点意思" class="moment-meme" />';

  /* ---------------- 进度持久化（localStorage） ---------------- */
  const SAVE_KEY = "mgs_elo_v1";
  let progress = loadProgress();

  // 提前初始化登录态（避免启动期 checkStreak→saveProgress→syncRank 触发 let auth 暂时性死区）
  const AUTH_KEY = "mgs_auth_v1";
  const DEVICE_KEY = "mgs_device_v1";
  function loadDeviceId() {
    try {
      let d = localStorage.getItem(DEVICE_KEY);
      if (!d) { d = "DV" + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Date.now())); localStorage.setItem(DEVICE_KEY, d); }
      return d;
    } catch (e) { return "DV" + String(Date.now()); }
  }
  const DEVICE_ID = loadDeviceId();
  let auth = loadAuth();
  checkStreak();

  function loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p.elo === "number") return Object.assign({ qstats: {}, recent: [], bestCombo: 0, xp: 0, streak: 0, lastDay: "", todayBrush: "" }, p);
      }
    } catch (e) { /* 忽略损坏数据 */ }
    return {
      elo: ELO.start, tier: 0, bestElo: ELO.start,
      totalCorrect: 0, totalAnswered: 0, bestStreak: 0, games: 0,
      history: [],
      learned: [],          // 已习得的秘籍 id 列表
      qstats: {},           // 题目掌握度（spaced repetition 用）
      streak: 0,            // 连续打卡天数（损失厌恶）
      lastDay: "",          // 上次打卡日期
      todayBrush: "",       // 今日是否已首刷（领首刷奖励）
    };
  }
  function saveProgress() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* 隐私模式忽略 */ }
    syncRank(); // 登录后顺手把段位同步到全国榜（节流）
  }

  /* ---------------- 每日连签 / 可变奖励掉落（上瘾机制） ---------------- */
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  // 每日连签（损失厌恶）：隔天断签清零、今日已签保持；打开即签到
  function checkStreak() {
    const t = todayStr();
    if (progress.lastDay === t) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = y.getFullYear() + "-" + (y.getMonth() + 1) + "-" + y.getDate();
    progress.streak = (progress.lastDay === yStr) ? (progress.streak || 0) + 1 : 1;
    progress.lastDay = t;
    saveProgress();
  }
  // 可变奖励掉落：答对约 11% 触发，类型不可预测（老虎机式强化 → 上瘾核心）
  function maybeDrop() {
    if (Math.random() >= 0.11) return null;
    const d = pick(D.fun.drops);
    progress.xp = (progress.xp || 0) + d.xp;
    return d;
  }

  /* ---------------- ELO / 段位工具 ---------------- */
  // 返回 0..8（0=第1段）
  function rankIndexFor(elo) {
    const th = ELO.rankThresholds;
    let idx = 0;
    for (let i = 0; i < th.length; i++) if (elo >= th[i]) idx = i;
    return idx;
  }
  function kFor(rankIdx) { return ELO.kByRank[rankIdx]; }
  // 升到下一段需要的 ELO 下限；已满级返回 null
  function rankUpThreshold(rankIdx) {
    const th = ELO.rankThresholds;
    return rankIdx >= th.length - 1 ? null : th[rankIdx + 1];
  }
  // 标准 ELO 期望胜率
  function expectedScore(myElo, oppElo) {
    return 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
  }
  // 橡皮筋对手 ELO：往中间段拽
  function opponentElo(elo, tier) {
    return Math.round(
      ELO.middle + (elo - ELO.middle) * ELO.pull + (tier - 1) * ELO.noiseStep
    );
  }
  // 关数 → 题库档（题随关数变难）
  // 爬塔题源：直接复用秘籍 bank（按 5 阶段映射），不再用 data.js 里那套 40 题小库
  function stagePool(stageIdx) {
    const cat = D.manuals.categories[stageIdx];
    if (!cat) return [];
    const pool = [];
    cat.models.forEach((m) => (m.methods || []).forEach((me) => (me.bank || []).forEach((q) => pool.push(q))));
    return pool;
  }
  // 全阶段题池（缓存）：自适应拓宽题库时用，保证几乎不重复
  let _globalBank = null;
  function globalBank() {
    if (!_globalBank) {
      _globalBank = [];
      D.manuals.categories.forEach((c) =>
        c.models.forEach((m) => (m.methods || []).forEach((me) => (me.bank || []).forEach((q) => _globalBank.push(q)))));
    }
    return _globalBank;
  }
  // 9 关 → 5 阶段映射（让最高段位抽到大学/前沿题，题库不浪费、爬到顶也有对应难度）
  function stageIdxForTier(tier) {
    if (ELO.tierStage && ELO.tierStage[tier - 1] != null) {
      return Math.min(D.manuals.categories.length - 1, ELO.tierStage[tier - 1]);
    }
    return Math.min(D.manuals.categories.length - 1, Math.max(0, Math.floor((tier - 1) / ELO.bankSpan)));
  }
  function bankForTier(tier) {
    const idx = stageIdxForTier(tier);
    return { bank: stagePool(idx), name: D.manuals.categories[idx] ? D.manuals.categories[idx].stage : "" };
  }
  // 近 8 题正确率（难度自适应用）
  function recentAccuracy() {
    const a = (run && run.recentAcc) || [];
    if (a.length < 3) return null;
    const ok = a.reduce((s, v) => s + (v ? 1 : 0), 0);
    return ok / a.length;
  }
  // 难度自适应：连错→拉回简单(别劝退)，连对→上强度(别无聊)
  function adaptDifficulty(base) {
    const acc = recentAccuracy();
    if (acc == null) return base;
    if (acc < 0.4) return Math.max(0, base - 0.4);
    if (acc > 0.82) return Math.min(1, base + 0.28);
    return base;
  }
  // 智能抽题（迷恋算法 v2）：
  //  · 优先没做过的题；做过的按「间隔越久越优先」做 spaced repetition（艾宾浩斯式）
  //  · 心流区：历史正确率≈0.6 的题最优先；已 mastery 的降权(不腻)、太挫败的也降权
  //  · 硬剔除最近 16 题 → 绝不连续重复；某阶段快刷完时自动拓宽到全阶段，几乎刷不空
  //  · 约 7% 概率故意放一道「有间隔的旧题」→ 偶尔重复，强化记忆但不烦
  function scheduleNext() {
    const stageIdx = stageIdxForTier(run.tier);
    const r = rankIndexFor(run.elo);
    let hardRatio = [0, 0.12, 0.3, 0.5, 0.6, 0.72, 0.85, 0.95, 1][Math.min(8, r)] || 0.5;
    hardRatio = adaptDifficulty(hardRatio);
    const wantHard = Math.random() < hardRatio;
    const band = (arr) => arr.filter((q) => (wantHard ? q.level === "hard" : q.level !== "hard"));
    let pool = band(stagePool(stageIdx));
    const unseenOf = (arr) => arr.filter((q) => !progress.qstats[q.id]);
    if (pool.length < 24 || unseenOf(pool).length < 6) pool = band(globalBank()); // 拓宽，防刷空
    const recent = progress.recent || [];
    let cand = pool.filter((q) => !recent.includes(q.id)); // 硬剔除最近做过的
    if (!cand.length) cand = pool.slice();
    const now = Date.now();
    const scored = cand.map((q) => {
      const st = progress.qstats[q.id] || { n: 0, ok: 0, last: 0 };
      let s = 0;
      if (st.n === 0) {
        s += 1000; // 没做过 → 强优先
      } else {
        const since = (now - st.last) / 1000;
        s += Math.min(450, since / 20);        // 间隔越久越优先
        const acc = st.ok / st.n;
        s += (1 - Math.abs(acc - 0.6)) * 130;  // 心流区(正确率约 0.6)
        if (acc > 0.85 && st.n >= 3) s -= 70;  // 已 mastery → 降权(别腻)
        if (acc < 0.15 && st.n >= 2) s -= 40;  // 太挫败 → 降权
      }
      s += Math.random() * 18;
      return { q, s };
    });
    scored.sort((a, b) => b.s - a.s);
    let chosen = scored[0].q;
    if (scored.length > 3 && Math.random() < 0.07) { // 偶尔重复(有间隔的旧题)
      const old = scored.slice(1).find((x) => (progress.qstats[x.q.id] || {}).n > 0);
      if (old) chosen = old.q;
    }
    return chosen;
  }

  /* ---------------- 渲染首页 ---------------- */
  function renderHome() {
    const h = D.home;
    $("home-brand").textContent = h.brand;
    $("home-greet").textContent = h.greeting;
    $("home-sub").textContent = h.subtitle;
    $("home-mascot").innerHTML = MASCOT_SVG;

    const q = $("mascot-quip");
    const setQuip = () => { q.textContent = pick(FUN.quips); };
    setQuip();
    if (window.__quipTimer) clearInterval(window.__quipTimer);
    window.__quipTimer = setInterval(setQuip, 4200);

    $("streak-pill").textContent = "连续打卡 · " + (progress.streak || 0) + " 天" + ((progress.streak || 0) >= 3 ? " · 别断签！" : "");
    $("daily-title").textContent = h.dailyQuest.title;
    $("daily-desc").textContent = h.dailyQuest.desc;
    const pct = Math.round((h.dailyQuest.done / h.dailyQuest.total) * 100);
    $("progress-fill").style.width = pct + "%";
    $("progress-num").textContent = h.dailyQuest.done + "/" + h.dailyQuest.total;

    const grid = $("entry-grid");
    grid.innerHTML = "";
    h.entries.forEach((e) => {
      const card = document.createElement("div");
      card.className = "entry-card";
      card.innerHTML = `<span class="entry-ico">${icon(e.icon)}</span>
        <span class="entry-label">${e.label}</span>
        <span class="entry-desc">${e.desc}</span>`;
      card.addEventListener("click", () => goTab(e.id === "practice" ? "practice" : e.id));
      grid.appendChild(card);
    });

    updateHomeRank();
  }

  function updateHomeRank() {
    const idx = rankIndexFor(progress.elo);
    const r = RANKS[idx];
    $("rb-ico").textContent = r.icon;
    $("rb-rank").textContent = r.name + "·" + r.sub;
    $("rb-elo").textContent = "学霸分 " + progress.elo + " · 第 " + (idx + 1) + " 段";
  }

  /* ---------------- 渲染报告（ELO 动态统计） ---------------- */
  function renderReport() {
    const total = progress.totalAnswered;
    const acc = total ? Math.round((progress.totalCorrect / total) * 100) : 0;
    const idx = rankIndexFor(progress.elo);
    const r = RANKS[idx];
    const winRate = total ? Math.round((progress.totalCorrect / total) * 100) : 0;

    $("ring-num").textContent = acc + "%";
    $("report-ring").style.setProperty("--p", acc);

    const chips = [
      { label: "当前学霸分", value: String(progress.elo), tone: "gold" },
      { label: "当前段位", value: r.name, tone: "rose" },
      { label: "最高连击", value: "x" + (progress.bestCombo || 0), tone: "gold" },
      { label: "爽感 XP", value: String(progress.xp || 0), tone: "rose" },
      { label: "最高学霸分", value: String(progress.bestElo), tone: "gold" },
      { label: "累计题数", value: String(total), tone: "rose" },
    ];
    const row = $("chip-row");
    row.innerHTML = "";
    chips.forEach((c) => {
      const el = document.createElement("div");
      el.className = "chip " + (c.tone === "rose" ? "rose" : "gold");
      el.innerHTML = `<span class="chip-label">${c.label}</span><span class="chip-value">${c.value}</span>`;
      row.appendChild(el);
    });

    const list = $("recent-list");
    list.innerHTML = "";
    if (!progress.history.length) {
      list.innerHTML = `<div class="recent-item"><span class="recent-subj">还没打过</span>
        <span class="recent-meta"><span class="recent-result">去答题</span></span></div>`;
    } else {
      progress.history.slice().reverse().forEach((it) => {
        const el = document.createElement("div");
        el.className = "recent-item";
        el.innerHTML = `<span class="recent-subj">${it.subject}</span>
          <span class="recent-meta">
            <span class="recent-time">学霸分 ${it.delta >= 0 ? "+" : ""}${it.delta}</span>
            <span class="recent-result ${it.correct ? "ok" : "no"}">${it.correct ? "对" : "错"}</span>
          </span>`;
        list.appendChild(el);
      });
    }
  }

  /* ---------------- 渲染秘籍（数学模型 · 自带题库） ---------------- */
  function isLearned(id) { return progress.learned.indexOf(id) >= 0; }

  function renderManualLearned() {
    const methods = ALL_METHODS();
    const n = progress.learned.filter((id) => methods.some((m) => m.id === id)).length;
    $("learned-num").textContent = n;
    $("learned-total").textContent = methods.length;
    const pct = methods.length ? Math.round((n / methods.length) * 100) : 0;
    $("learned-fill").style.width = pct + "%";
  }

  // 某模型下已习得的招式数
  function methodLearnedCount(m) {
    return (m.methods || []).filter((x) => isLearned(x.id)).length;
  }

  function renderManual() {
    renderManualLearned();
    const m = D.manuals;
    const all = ALL_MODELS();

    // 今日必修卡
    const feat = all.find((x) => x.id === m.featured.modelId) || all[0];
    const fc = $("feature-card");
    fc.innerHTML = `
      <span class="feature-tag">${m.featured.tag}</span>
      <div class="feature-row">
        <span class="feature-ico">${feat.icon}</span>
        <div class="feature-meta">
          <h3 class="feature-name">${feat.name}</h3>
          <p class="feature-tip">${feat.intro}</p>
        </div>
      </div>
      <span class="feature-go">翻开秘籍 ›</span>`;
    fc.onclick = () => openModel(feat.id);

    // 分页分类列表：小学 → 初中·高中 → 大学 → 前沿
    const list = $("manual-list");
    list.innerHTML = "";
    m.categories.forEach((cat) => {
      const head = document.createElement("h3");
      head.className = "section-title";
      head.innerHTML = `${cat.icon} ${cat.stage} <span class="section-count">${cat.models.length} 部</span>`;
      list.appendChild(head);

      cat.models.forEach((mod) => {
        const total = (mod.methods || []).length;
        const got = methodLearnedCount(mod);
        let badge;
        if (got === 0) badge = "未习得";
        else if (got === total) badge = "📖 已习得";
        else badge = "📖 习得 " + got + "/" + total;
        const el = document.createElement("div");
        el.className = "manual-card" + (got === total ? " learnt" : "");
        el.innerHTML = `
          <div class="manual-top">
            <span class="manual-ico">${mod.icon}</span>
            <span class="manual-name">${mod.name}</span>
            <span class="manual-badge">${badge}</span>
          </div>
          <span class="manual-tip">${mod.intro}</span>
          <span class="manual-count">含 ${total} 招 · 点开拆招 ›</span>`;
        el.addEventListener("click", () => openModel(mod.id));
        list.appendChild(el);
      });
    });
  }

  /* ---------------- 秘籍详情：模型 → 子招式列表 → 招式题库 ---------------- */
  // 第 1 级：点开模型，展示它拆出的「子招式」列表
  function openModel(id) {
    const mod = ALL_MODELS().find((x) => x.id === id);
    if (!mod) return;
    $("manual-ico").textContent = mod.icon;
    $("manual-title").textContent = mod.name;
    $("manual-heart").textContent = mod.heart || mod.intro;

    const ql = $("manual-questions");
    ql.innerHTML = "";
    (mod.methods || []).forEach((me) => {
      const got = isLearned(me.id);
      const el = document.createElement("div");
      el.className = "manual-card method-card" + (got ? " learnt" : "");
      el.innerHTML = `
        <div class="manual-top">
          <span class="manual-ico">${mod.icon}</span>
          <span class="manual-name">${me.name}</span>
          <span class="manual-badge">${got ? "📖" : "未习得"}</span>
        </div>
        <span class="manual-tip">${me.intro}</span>
        <span class="manual-count">心法 + 题库 ${me.bank.length} 题（🟢简${me.bank.filter((q) => q.level === "easy").length} · 🔴进${me.bank.filter((q) => q.level === "hard").length}）· 点开看解析 ›</span>`;
      el.addEventListener("click", () => openMethod(id, me.id));
      ql.appendChild(el);
    });

    $("manual-modal").hidden = false;
  }

  // 招式题库难度筛选状态
  let curMethodFilter = "all";   // all | easy | hard
  let curMethodMe = null;

  // 第 2 级：点开某招式，展示心法 + 题库（带难度筛选）+ 解析
  function openMethod(modelId, methodId) {
    const mod = ALL_MODELS().find((x) => x.id === modelId);
    if (!mod) return;
    const me = (mod.methods || []).find((x) => x.id === methodId);
    if (!me) return;
    curMethodMe = me;
    curMethodFilter = "all";

    $("manual-ico").textContent = mod.icon;
    $("manual-title").textContent = me.name;
    $("manual-heart").textContent = me.heart;

    const ql = $("manual-questions");
    ql.innerHTML = "";

    // 返回上一层（招式列表）
    const back = document.createElement("button");
    back.className = "q-back";
    back.textContent = "‹ 返回「" + mod.name + "」";
    back.addEventListener("click", () => openModel(modelId));
    ql.appendChild(back);

    // 难度筛选条：全部 / 简单(理解概念) / 进阶(难点)
    const fbar = document.createElement("div");
    fbar.className = "q-filter";
    const cnt = {
      all: me.bank.length,
      easy: me.bank.filter((q) => q.level === "easy").length,
      hard: me.bank.filter((q) => q.level === "hard").length,
    };
    fbar.innerHTML =
      `<button data-f="all" class="active">全部 ${cnt.all}</button>` +
      `<button data-f="easy">🟢 简单 ${cnt.easy}</button>` +
      `<button data-f="hard">🔴 进阶 ${cnt.hard}</button>`;
    fbar.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        curMethodFilter = b.dataset.f;
        fbar.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
        renderMethodQuestions();
      });
    });
    ql.appendChild(fbar);

    // 题目容器（随筛选重渲染）
    const qlist = document.createElement("div");
    qlist.className = "q-list";
    ql.appendChild(qlist);

    renderMethodQuestions();

    // 浏览即习得（精确到招式）
    if (!isLearned(me.id)) {
      progress.learned.push(me.id);
      saveProgress();
      renderManualLearned();
      toast("📖 习得招式：" + me.name);
    }

    $("manual-modal").hidden = false;
  }

  // 按当前筛选渲染题目卡片
  function renderMethodQuestions() {
    const me = curMethodMe;
    const qlist = document.querySelector("#manual-questions .q-list");
    if (!qlist || !me) return;
    qlist.innerHTML = "";
    const list = me.bank.filter((q) => curMethodFilter === "all" || q.level === curMethodFilter);
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "q-empty";
      empty.textContent = "这个难度暂时没有题目 🤷";
      qlist.appendChild(empty);
      return;
    }
    list.forEach((q) => qlist.appendChild(buildQCard(q)));
  }

  // 构造单题卡片（含难度徽标）
  function buildQCard(q) {
    const card = document.createElement("div");
    card.className = "q-card lvl-" + q.level;
    const lvlTag = q.level === "hard"
      ? `<span class="q-level q-hard">🔴 进阶</span>`
      : `<span class="q-level q-easy">🟢 简单</span>`;
    const optsHtml = q.type === "choice"
      ? `<div class="q-opts">${q.options.map((o, i) =>
          `<div class="q-opt" data-i="${i}"><span class="q-key">${String.fromCharCode(65 + i)}</span><span>${o}</span></div>`).join("")}</div>`
      : `<div class="q-fill">把答案写上去，再点「看思路」对照 →</div>`;
    card.innerHTML = `
      <div class="q-card-head">${lvlTag}<span class="q-subj">${q.subject}</span></div>
      <div class="q-stem">${q.stem}</div>
      ${optsHtml}
      <button class="q-toggle">看思路 ▸</button>
      <div class="q-sol" hidden>
        <p class="q-idea">💡 ${q.solution.idea}</p>
        <div class="q-steps-label">核心步骤</div>
        <ol class="q-steps">${q.solution.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      </div>`;
    if (q.type === "choice") {
      card.querySelectorAll(".q-opt").forEach((opt) => {
        opt.addEventListener("click", () => {
          const picked = Number(opt.dataset.i);
          card.querySelectorAll(".q-opt").forEach((o) => (o.style.pointerEvents = "none"));
          if (picked === q.answer) opt.classList.add("correct");
          else { opt.classList.add("wrong"); card.querySelectorAll(".q-opt")[q.answer].classList.add("correct"); }
          reveal(card);
        });
      });
    }
    card.querySelector(".q-toggle").addEventListener("click", () => {
      const sol = card.querySelector(".q-sol");
      const open = sol.hidden;
      sol.hidden = !open;
      card.querySelector(".q-toggle").textContent = open ? "收起 ▴" : "看思路 ▸";
    });
    return card;
  }

  function reveal(card) {
    const sol = card.querySelector(".q-sol");
    if (sol.hidden) {
      sol.hidden = false;
      card.querySelector(".q-toggle").textContent = "收起 ▴";
    }
  }
  function closeManual() { $("manual-modal").hidden = true; }

  /* ---------------- 底部导航 ---------------- */
  const SCREEN_OF = { home: "screen-home", practice: "screen-practice", manual: "screen-manual", rank: "screen-rank", report: "screen-report" };
  function goTab(tab) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    Object.entries(SCREEN_OF).forEach(([k, id]) => {
      $(id).classList.toggle("active", k === tab);
    });
    if (tab === "report") renderReport();
    if (tab === "manual") renderManual();
    if (tab === "rank") renderRank();
    if (tab === "practice") startRun();
    document.querySelector(".viewport").scrollTop = 0;
  }

  /* ---------------- 登录 + 段位排行（真实后端） ---------------- */
  // 同源时直接用相对路径；以 file:// 打开时回退到本地后端地址
  const API_BASE = /^https?:/.test(location.protocol) ? "" : "http://localhost:8787";
  const REGION_LIST = ["北京", "上海", "天津", "重庆", "广东", "江苏", "浙江", "山东", "四川", "湖北",
    "湖南", "河南", "河北", "福建", "安徽", "江西", "陕西", "山西", "辽宁", "吉林", "黑龙江",
    "云南", "贵州", "甘肃", "青海", "海南", "台湾", "中国香港", "中国澳门", "广西", "内蒙古",
    "宁夏", "新疆", "西藏"];
  let _syncTimer = null, _lastSyncAt = 0;

  function loadAuth() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) { const a = JSON.parse(raw); if (a && a.token) return a; }
    } catch (e) { /* ignore */ }
    return { token: null, user: null };
  }
  function saveAuth() {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch (e) { /* ignore */ }
  }
  function isLoggedIn() { return !!(auth && auth.token); }

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (auth.token) headers["Authorization"] = "Bearer " + auth.token;
    const res = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    return { ok: res.ok, status: res.status, data };
  }

  // 登录态 UI（首页头像 + 排行页我的卡）
  function renderAuthUI() {
    const chip = $("login-chip"), ava = $("lc-ava"), tx = $("lc-tx");
    if (isLoggedIn() && auth.user) {
      ava.textContent = auth.user.avatar || "🙂";
      tx.textContent = auth.user.nickname || "学霸";
      chip.classList.add("on");
      $("rm-ava").textContent = auth.user.avatar || "🙂";
      $("rm-name").textContent = auth.user.nickname || "学霸";
      $("rm-login").hidden = true;
      $("rm-logout").hidden = false;
      const sub = $("rm-sub");
      if (auth.user.region) sub.textContent = "大区：" + auth.user.region + " · 段位学霸分 " + (auth.user.elo || 0);
      else sub.textContent = "还没选大区，去选一个地区榜吧 →";
    } else {
      ava.textContent = "🙂"; tx.textContent = "未登录";
      chip.classList.remove("on");
      $("rm-ava").textContent = "🙂";
      $("rm-name").textContent = "未登录";
      $("rm-sub").textContent = "登录后查看你的全国 / 地区排名";
      $("rm-login").hidden = false;
      $("rm-logout").hidden = true;
    }
  }

  // 同步段位（节流，避免每次结算都打请求）
  function syncRank() {
    if (!isLoggedIn()) return;
    const t = Date.now();
    if (t - _lastSyncAt < 4000) return;     // 4s 内只同步一次
    _lastSyncAt = t;
    const payload = { elo: progress.elo, xp: progress.xp || 0, tier: progress.tier, games: progress.totalAnswered || 0 };
    if (auth.user && auth.user.region) payload.region = auth.user.region;
    api("/api/rank/submit", { method: "POST", body: payload }).then((r) => {
      if (r.ok && r.data && r.data.user) {
        auth.user = Object.assign({}, auth.user, r.data.user);
        saveAuth();
        renderAuthUI();
      }
    }).catch(() => {});
  }

  function openLoginModal() {
    $("login-name").value = (auth.user && auth.user.nickname) || "";
    $("login-dev").textContent = "";
    $("login-modal").hidden = false;
  }
  function closeLoginModal() { $("login-modal").hidden = true; }

  // 退出登录：只清登录态，本地刷题进度（学霸分 / 招式 / 连击）保留，可继续离线刷
  function logout() {
    auth = { token: null, user: null };
    saveAuth();
    renderAuthUI();
    if ($("screen-rank").classList.contains("active")) renderRank();
    toast("👋 已退出登录");
  }

  async function doLogin(provider) {
    const name = ($("login-name").value || "").trim() || (provider === "phone" ? "手机学霸" : "微信学霸");
    const r = await api("/api/auth/wechat", { method: "POST", body: { provider, nickname: name, deviceId: DEVICE_ID } });
    if (r.ok && r.data && r.data.user) {
      auth = { token: r.data.token, user: r.data.user };
      saveAuth();
      renderAuthUI();
      closeLoginModal();
      toast("🎉 登录成功！已加入全国排行");
      // 没选地区就跳地区选择
      if (!auth.user.region) {
        setTimeout(openRegionModal, 350);
      } else {
        syncRank();
        renderRank();
      }
    } else {
      $("login-dev").textContent = "登录失败：" + ((r.data && r.data.error) || "未知错误");
    }
  }

  // 地区选择弹窗
  let _regionCallback = null;
  function openRegionModal(cb) {
    _regionCallback = cb || null;
    const grid = $("region-grid");
    grid.innerHTML = "";
    REGION_LIST.forEach((rg) => {
      const b = document.createElement("button");
      b.className = "region-cell" + (auth.user && auth.user.region === rg ? " cur" : "");
      b.textContent = rg;
      b.addEventListener("click", () => chooseRegion(rg));
      grid.appendChild(b);
    });
    $("region-modal").hidden = false;
  }
  function closeRegionModal() { $("region-modal").hidden = true; }
  async function chooseRegion(rg) {
    curRegion = rg;
    if (isLoggedIn()) {
      const r = await api("/api/rank/submit", { method: "POST", body: { region: rg } });
      if (r.ok && r.data && r.data.user) auth.user = Object.assign({}, auth.user, r.data.user);
      saveAuth();
      renderAuthUI();
    }
    closeRegionModal();
    if (_regionCallback) { const cb = _regionCallback; _regionCallback = null; cb(rg); }
    else { renderRank(); }
  }

  /* ---------------- 排行榜渲染 ---------------- */
  let curScope = "global";      // global | region
  let curRegion = null;

  async function renderRank() {
    renderAuthUI();
    // 我的排名
    if (isLoggedIn()) {
      const mine = await api("/api/rank/mine");
      if (mine.ok && mine.data) {
        const g = mine.data.global, reg = mine.data.region;
        const txt = "全国第 " + (g.rank || "-") + " / " + g.total +
          (reg ? "　·　" + reg.region + "第 " + (reg.rank || "-") + " / " + reg.total : "");
        $("rm-sub").textContent = txt;
        $("rm-login").hidden = true;
      }
    }
    // 切换标签显隐
    document.querySelectorAll(".rs-tab").forEach((t) => t.classList.toggle("active", t.dataset.scope === curScope));
    $("rank-region-bar").hidden = curScope !== "region";

    const list = $("rank-list");
    list.innerHTML = `<div class="rank-empty">加载中…</div>`;

    if (curScope === "region") {
      const region = (auth.user && auth.user.region) || curRegion;
      if (!region) {
        list.innerHTML = `<div class="rank-empty">还没选大区。<button class="rank-link" id="rank-pick-link">去选择地区 ›</button></div>`;
        const lk = $("rank-pick-link"); if (lk) lk.addEventListener("click", () => openRegionModal());
        return;
      }
      curRegion = region;
      $("rrb-pick").textContent = region + " ›";
      const r = await api("/api/rank/region?region=" + encodeURIComponent(region) + "&token=" + (auth.token || ""));
      if (r.ok && r.data) renderRankList(r.data.list, r.data.total, region, r.data.around);
      else list.innerHTML = `<div class="rank-empty">地区榜加载失败</div>`;
    } else {
      const r = await api("/api/rank/global?token=" + (auth.token || ""));
      if (r.ok && r.data) renderRankList(r.data.list, r.data.total, "全国", r.data.around);
      else list.innerHTML = `<div class="rank-empty">全国榜加载失败</div>`;
    }
  }

  function renderRankList(rows, total, scope, around) {
    const list = $("rank-list");
    list.innerHTML = "";
    if (!rows || !rows.length) {
      list.innerHTML = `<div class="rank-empty">还没有人上榜，去答题刷段位抢首杀！</div>`;
      return;
    }
    const head = document.createElement("div");
    head.className = "rank-head-row";
    head.innerHTML = `<span>${scope}共 ${total} 人</span><span>段位 · 学霸分</span>`;
    list.appendChild(head);

    rows.forEach((it) => list.appendChild(buildRankRow(it)));

    // 若我在 50 名外，补一段「我附近」的条目
    if (around && around.length) {
      const sep = document.createElement("div");
      sep.className = "rank-sep"; sep.textContent = "— 你在这儿 —";
      list.appendChild(sep);
      around.forEach((it) => list.appendChild(buildRankRow(it)));
    }
  }

  function buildRankRow(it) {
    const el = document.createElement("div");
    el.className = "rank-row" + (it.me ? " me" : "") + (it.rank <= 3 ? " top" + it.rank : "");
    const medal = it.rank === 1 ? "🥇" : it.rank === 2 ? "🥈" : it.rank === 3 ? "🥉" : it.rank;
    const tier = RANKS[Math.max(0, Math.min(RANKS.length - 1, it.tier || 0))];
    el.innerHTML = `
      <span class="rr-rank">${medal}</span>
      <span class="rr-ava">${it.avatar || "🙂"}</span>
      <span class="rr-name">${escapeHtml(it.nickname || "学霸")}</span>
      <span class="rr-meta"><span class="rr-tier">${(tier && tier.icon) || "🐱"} ${tier ? tier.name : ""}</span>
        <span class="rr-elo">${it.elo || 0}</span></span>`;
    return el;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------------- ELO 答题引擎（无限爬塔） ---------------- */
  let run = null;          // 当前一局的爬塔状态
  let timerHandle = null;

  function startRun() {
    clearInterval(timerHandle);
    run = {
      elo: progress.elo,
      tier: progress.tier,
      correct: 0,
      total: 0,
      streak: 0,
      combo: 0,
      startTs: 0,
      recentAcc: [],
      lastFast: false,
      boss: false,
      qElo: 0,
      currentQ: null,
      lastQ: null,
    };
    $("practice-title").textContent = "第 " + (run.tier + 1) + " 关";
    updateComboHud();
    updateRankHud();
    nextQuestion();
    toast(pick(FUN.hype));
  }

  function nextQuestion() {
    clearInterval(timerHandle);
    run.tier++;
    run.total++;
    const bank = bankForTier(run.tier);
    const q = scheduleNext();
    run.currentQ = q;
    run.qElo = opponentElo(run.elo, run.tier);
    if (run.tier > progress.tier) progress.tier = run.tier;

    $("practice-title").textContent = "第 " + run.tier + " 关 · " + bank.name;
    updateComboHud();
    updateRankHud();

    const wrap = $("quiz-wrap");
    wrap.hidden = false;
    wrap.innerHTML = "";

    const subj = document.createElement("span");
    subj.className = "quiz-subject";
    subj.textContent = q.subject;
    wrap.appendChild(subj);

    const stem = document.createElement("div");
    stem.className = "quiz-stem";
    stem.textContent = q.stem;
    wrap.appendChild(stem);

    if (q.type === "choice") {
      const list = document.createElement("div");
      list.className = "opt-list";
      q.options.forEach((opt, i) => {
        const o = document.createElement("div");
        o.className = "opt";
        o.innerHTML = `<span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${opt}</span>`;
        o.addEventListener("click", () => answerChoice(q, i, o, list));
        list.appendChild(o);
      });
      wrap.appendChild(list);
    } else {
      const input = document.createElement("input");
      input.className = "fill-input";
      input.type = "text";
      input.inputMode = "text";
      input.placeholder = "把答案写上去…";
      input.autocomplete = "off";
      const btn = document.createElement("button");
      btn.className = "fill-submit";
      btn.textContent = "交卷";
      btn.addEventListener("click", () => answerFill(q, input.value));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") answerFill(q, input.value); });
      wrap.appendChild(input);
      wrap.appendChild(btn);
      setTimeout(() => input.focus(), 50);
    }

    // BOSS 战：顶部段位抽到的进阶题，标成 BOSS，拿下它段位飞升（上瘾：史诗挑战）
    const boss = run.tier >= 7 && q.level === "hard";
    run.boss = boss;
    wrap.classList.toggle("boss", boss);
    if (boss) { subj.textContent = "👹 BOSS · " + q.subject; toast(pick(D.fun.boss)); }

    run.startTs = Date.now();
    startTimer(q.timeLimit);
  }

  function startTimer(sec) {
    run.timeLeft = sec;
    const el = $("timer");
    el.classList.remove("danger");
    el.textContent = sec + "s";
    timerHandle = setInterval(() => {
      run.timeLeft--;
      el.textContent = Math.max(0, run.timeLeft) + "s";
      if (run.timeLeft <= 5 && run.timeLeft > 0) el.classList.add("danger");
      if (run.timeLeft === 5) toast(FUN.lowTime);
      if (run.timeLeft <= 0) {
        clearInterval(timerHandle);
        const q = run.currentQ;
        run.streak = 0;
        const ans = q.type === "choice" ? q.options[q.answer] : q.answer;
        resolve(false, ans, "时间到。");
      }
    }, 1000);
  }

  function answerChoice(q, picked, node, list) {
    clearInterval(timerHandle);
    list.querySelectorAll(".opt").forEach((o) => (o.style.pointerEvents = "none"));
    const correct = picked === q.answer;
    if (correct) {
      node.classList.add("correct");
    } else {
      node.classList.add("wrong");
      list.children[q.answer].classList.add("correct");
    }
    resolve(correct, q.options[q.answer], "");
  }

  function answerFill(q, val) {
    clearInterval(timerHandle);
    // 关键：收起手机软键盘，否则反馈页「下一题」会被键盘挡住、点不到（选择题无输入框不受影响）
    if (document.activeElement && typeof document.activeElement.blur === "function") document.activeElement.blur();
    // 答案归一：忽略大小写与所有空白，避免「a + 3b」被判成错
    const norm = (s) => String(s).trim().replace(/\s+/g, "").toLowerCase();
    const given = norm(val);
    const want = norm(q.answer);
    const correct = given === want;
    resolve(correct, q.answer, "");
  }

  /* ---------------- ELO 结算 ---------------- */
  function resolve(correct, correctText, prefix) {
    const beforeRank = rankIndexFor(run.elo);
    const E = expectedScore(run.elo, run.qElo);
    const K = kFor(beforeRank);
    const delta = Math.round(K * (correct ? (1 - E) : (0 - E)));

    // 速度 & 连击（“秒题爽感”）：答对且用时 < 限时 45% 算「秒了」
    const ms = run.startTs ? Date.now() - run.startTs : 1e9;
    const fast = correct && ms < (run.currentQ.timeLimit || 60) * 1000 * 0.45;
    run.lastFast = fast;
    const preCombo = run.combo; // 断连击前的长度（损失厌恶：差一点破纪录最扎心）
    if (correct) { run.combo++; run.streak++; } else { run.combo = 0; run.streak = 0; }
    const comboMult = correct ? 1 + Math.min(0.6, Math.max(0, run.combo - 1) * 0.06) : 1; // 连击越高 ELO 加成越大
    const finalDelta = Math.round(delta * comboMult);

    run.elo = Math.max(0, run.elo + finalDelta);
    if (correct) {
      run.correct++; run.streak++;
      // 连对里程碑梯度鼓励（每 10 题，上瘾：看得见的成长）
      if (run.correct % 10 === 0) {
        const ms2 = (D.fun.milestones || []).find((x) => x.n === run.correct);
        if (ms2) setTimeout(() => toast(ms2.msg), 450);
      }
    }
    const afterRank = rankIndexFor(run.elo);
    // 近失效应 & 连击中断（损失厌恶）：答错但很快 → 勾着再来；刚断长连击 → 扎心
    const nearMiss = !correct && ms < (run.currentQ.timeLimit || 60) * 1000 * 0.7;
    const comboBreak = preCombo;

    // 持久化聚合
    progress.elo = run.elo;
    progress.tier = run.tier;
    progress.totalAnswered++;
    if (correct) progress.totalCorrect++;
    if (run.combo > (progress.bestCombo || 0)) progress.bestCombo = run.combo;
    // 爽感 XP：快答 +3 / 普通对 +1 / BOSS 额外 +3 / 今日首刷 +5 / 可变掉落额外加
    let xpGain = fast ? 3 : (correct ? 1 : 0);
    if (run.boss && correct) xpGain += 3;
    const tStr = todayStr();
    let firstBrush = false;
    if (correct && progress.todayBrush !== tStr) { xpGain += 5; progress.todayBrush = tStr; firstBrush = true; }
    const drop = maybeDrop();
    if (drop) xpGain += drop.xp;
    progress.xp = (progress.xp || 0) + xpGain;
    // 收集完成：答对某招式首题即「习得」该招式（答题即学 → 刷满秘籍解锁上帝）
    let learnedNew = null;
    const mid = Q_METHOD[run.currentQ.id];
    if (correct && mid && progress.learned.indexOf(mid) < 0) {
      progress.learned.push(mid);
      const me = ALL_METHODS().find((x) => x.id === mid);
      learnedNew = me ? me.name : null;
    }
    if (run.streak > progress.bestStreak) progress.bestStreak = run.streak;

    // 题目掌握度（spaced repetition 用）+ 最近题队列（防连续重复）+ 近 8 题对错（难度自适应用）
    const qid = run.currentQ.id;
    const st = progress.qstats[qid] || { n: 0, ok: 0, last: 0 };
    st.n++; if (correct) st.ok++; st.last = Date.now();
    progress.qstats[qid] = st;
    progress.recent = progress.recent || [];
    progress.recent.unshift(qid);
    if (progress.recent.length > 16) progress.recent.pop();
    run.recentAcc = run.recentAcc || [];
    run.recentAcc.push(correct);
    if (run.recentAcc.length > 8) run.recentAcc.shift();

    progress.history.push({ subject: run.currentQ.subject, correct, delta: finalDelta, elo: run.elo });
    if (progress.history.length > 12) progress.history.shift();
    if (run.elo > progress.bestElo) progress.bestElo = run.elo;
    saveProgress();

    // 上瘾反馈（优先级：稀有掉落 > 习得新招式 > 今日首刷）
    if (drop) toast(drop.msg);
    else if (learnedNew) toast("📜 习得新招式：" + learnedNew + "！");
    else if (firstBrush) toast(D.fun.firstBrush);

    updateComboHud();

    updateRankHud();
    updateHomeRank();

    if (correct) {
      showMiao(finalDelta, afterRank > beforeRank);
    } else {
      showInteresting(run.currentQ, correctText, finalDelta, prefix, afterRank < beforeRank, nearMiss, comboBreak);
    }
  }

  /* ---------------- 段位 HUD ---------------- */
  function updateComboHud() {
    const el = $("combo-chip");
    if (!el) return;
    const c = run ? run.combo : 0;
    if (c >= 2) {
      el.hidden = false;
      el.textContent = "🔥 连击 x" + c;
      el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    } else {
      el.hidden = true;
    }
  }

  function updateRankHud() {
    const idx = rankIndexFor(run.elo);
    const r = RANKS[idx];
    $("rank-name").textContent = r.icon + " " + r.name + "·" + r.sub;
    $("rank-opp").textContent = "对手学霸分 " + run.qElo;
    $("elo-chip").textContent = "⚡" + run.elo;
    const up = rankUpThreshold(idx);
    const fill = $("rank-fill");
    const next = $("rank-next");
    if (up == null) {
      fill.style.width = "100%";
      next.textContent = "封顶了，数学之神就是你";
    } else {
      const lo = ELO.rankThresholds[idx];
      const pct = Math.max(0, Math.min(100, ((run.elo - lo) / (up - lo)) * 100));
      fill.style.width = pct + "%";
      next.textContent = "距 " + RANKS[idx + 1].name + " 还差 " + (up - run.elo);
    }
  }

  /* ---------------- 趣味瞬间 ---------------- */
  function showMiao(delta, rankedUp) {
    $("miao-ico").innerHTML = MIAO_IMG;
    const fast = run.lastFast;
    const c = run.combo;
    $("moment-sub-miao").textContent = fast
      ? pick(MIAO_FAST) + (c >= 3 ? "　🔥" + c + " 连击！" : "")
      : pick(FUN.miaoSubs);
    $("miao-elo").textContent = "学霸分 +" + delta + " → " + run.elo + "　（对手 " + run.qElo + "）" + (c >= 2 ? "　🔥连击 x" + c : "");
    const card = $("moment-miao");
    if (fast) card.classList.add("flash"); else card.classList.remove("flash");
    burstConfetti();
    if (rankedUp) {
      const r = RANKS[rankIndexFor(run.elo)];
      toast("🎉 段位提升：" + r.name + "·" + r.sub + "！");
    }
    card.hidden = false;
  }

  function showInteresting(q, correctText, delta, prefix, rankDown, nearMiss, comboBreak) {
    $("interesting-ico").innerHTML = INTERESTING_IMG;
    $("interesting-answer").textContent =
      (prefix || "标准答案：") + correctText;
    let sub = pick(FUN.interestingSubs);
    if (comboBreak >= 5) sub = "🔥 连击中断！刚才 x" + comboBreak + " 超猛，差这一下就破纪录——再来一发！";
    else if (nearMiss) sub = pick(FUN.nearMiss);
    $("moment-sub-interesting").textContent = sub;
    $("interesting-elo").textContent = "学霸分 " + delta + " → " + run.elo + "　（对手 " + run.qElo + "）";
    // 答错解析：把解题思路塞进反馈弹层（之前被塞进 quiz-wrap，被弹层盖住看不见）
    const solBox = $("interesting-sol");
    if (q && q.solution) {
      solBox.hidden = false;
      const idea = (q.solution.idea || "").trim();
      $("interesting-sol-idea").textContent = idea ? "💡 " + idea : "";
      $("interesting-sol-idea").hidden = !idea;
      $("interesting-sol-steps").innerHTML = (q.solution.steps || []).map((s) => `<li>${s}</li>`).join("");
      $("interesting-sol-toggle").textContent = "看完整步骤 ▸";
      $("interesting-sol-steps").hidden = true;
    } else {
      solBox.hidden = true;
    }
    const wrap = $("quiz-wrap");
    wrap.classList.remove("shake");
    void wrap.offsetWidth;
    wrap.classList.add("shake");
    if (rankDown) {
      const r = RANKS[rankIndexFor(run.elo)];
      toast("📉 掉段了：" + r.name + "·" + r.sub);
    }
    $("moment-interesting").hidden = false;
  }

  function nextQuestionAfterMoment() {
    $("moment-miao").hidden = true;
    $("moment-interesting").hidden = true;
    nextQuestion();
  }

  /* ---------------- 段位塔弹窗（设计稿落地） ---------------- */
  function renderRankLadder() {
    const cur = rankIndexFor(progress.elo);
    // Hero 积分（开局 0，随答题增长）；进度条 = 当前段位内 ELO 爬升百分比
    $("rt-score-num").textContent = progress.xp || 0;
    const lo = ELO.rankThresholds[cur];
    const up = rankUpThreshold(cur);
    let pct = up == null ? 100 : Math.max(0, Math.min(100, Math.round((progress.elo - lo) / (up - lo) * 100)));
    const fill = $("rt-score-fill");
    if (fill) fill.style.width = pct + "%";

    const ladder = $("rank-ladder");
    ladder.innerHTML = "";
    RANKS.slice().reverse().forEach((r, ri) => {
      const idx = RANKS.length - 1 - ri; // 高段(LV.9)在顶，低段(LV.1)在底
      const tier = idx >= 6 ? "rose" : idx >= 3 ? "amber" : "green"; // 玫瑰→琥珀→绿
      const el = document.createElement("div");
      el.className = "ladder-row tier-" + tier + (idx === cur ? " cur" : "");
      const status = idx === cur ? "你在这 · 起点" : "未解锁";
      el.innerHTML = `
        <span class="ladder-ico">${r.icon}</span>
        <div class="ladder-body">
          <span class="ladder-name">LV.${idx + 1} ${r.name}·${r.sub}</span>
          <span class="ladder-flavor">${r.flavor}</span>
        </div>
        <span class="ladder-status">${status}</span>`;
      ladder.appendChild(el);
    });
    // 收集完成进度：刷题即习得招式，刷满秘籍解锁「上帝」——用完成欲驱动爬最高段位
    const total = ALL_METHODS().length;
    const got = progress.learned.filter((id) => ALL_METHODS().some((m) => m.id === id)).length;
    const rl = $("rt-learned");
    if (rl) rl.textContent = "📜 已习得招式 " + got + "/" + total + (got < total ? " · 还差 " + (total - got) + " 解锁上帝" : " · 全秘籍制霸，封神！");
  }
  function openRankModal() {
    renderRankLadder();
    $("rank-modal").hidden = false;
  }
  function closeRankModal() { $("rank-modal").hidden = true; }

  /* ---------------- 搞笑动效：表情包彩带 + 吐槽 toast ---------------- */
  function burstConfetti() {
    const layer = document.getElementById("confetti-layer");
    if (!layer) return;
    const emojis = ["🎉", "✨", "🍋", "💯", "⭐", "🥳"];
    for (let i = 0; i < 20; i++) {
      const s = document.createElement("span");
      s.className = "confetti";
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = Math.random() * 100 + "%";
      s.style.fontSize = (14 + Math.random() * 16) + "px";
      s.style.setProperty("--dx", (Math.random() * 140 - 70) + "px");
      s.style.animationDelay = (Math.random() * 0.15) + "s";
      s.style.animationDuration = (0.9 + Math.random() * 0.6) + "s";
      layer.appendChild(s);
      setTimeout(() => s.remove(), 1700);
    }
  }

  let toastHandle = null;
  function toast(msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    t.classList.add("show");
    clearTimeout(toastHandle);
    toastHandle = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => { t.hidden = true; }, 260);
    }, 1600);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById("tabbar").addEventListener("click", (e) => {
      const t = e.target.closest(".tab");
      if (t) goTab(t.dataset.tab);
    });
    document.querySelectorAll(".back-btn").forEach((b) =>
      b.addEventListener("click", () => goTab(b.dataset.nav))
    );
    $("daily-cta").addEventListener("click", () => goTab("practice"));
    $("home-mascot").addEventListener("click", () => {
      const q = $("mascot-quip");
      q.textContent = pick(FUN.quips);
      q.classList.remove("popq");
      void q.offsetWidth;
      q.classList.add("popq");
    });
    $("miao-next").addEventListener("click", nextQuestionAfterMoment);
    $("interesting-next").addEventListener("click", nextQuestionAfterMoment);
    $("interesting-sol-toggle").addEventListener("click", () => {
      const st = $("interesting-sol-steps");
      const open = st.hidden;
      st.hidden = !open;
      $("interesting-sol-toggle").textContent = open ? "收起 ▴" : "看完整步骤 ▸";
    });

    // 秘籍详情弹窗
    $("manual-close").addEventListener("click", closeManual);
    $("manual-modal").addEventListener("click", (e) => {
      if (e.target === $("manual-modal")) closeManual();
    });

    // 段位徽章 / 段位榜
    $("rank-badge").addEventListener("click", openRankModal);
    $("rt-climb").addEventListener("click", () => { closeRankModal(); goTab("practice"); });
    $("rank-close").addEventListener("click", closeRankModal);

    // 登录 / 排行
    $("login-chip").addEventListener("click", () => { if (isLoggedIn()) goTab("rank"); else openLoginModal(); });
    $("login-close").addEventListener("click", closeLoginModal);
    $("login-modal").addEventListener("click", (e) => { if (e.target === $("login-modal")) closeLoginModal(); });
    $("login-wx").addEventListener("click", () => doLogin("wechat"));
    $("login-phone").addEventListener("click", () => doLogin("phone"));
    $("rm-login").addEventListener("click", openLoginModal);
    $("rm-logout").addEventListener("click", logout);
    $("region-close").addEventListener("click", closeRegionModal);
    $("region-modal").addEventListener("click", (e) => { if (e.target === $("region-modal")) closeRegionModal(); });
    $("rrb-pick").addEventListener("click", () => openRegionModal());
    document.querySelectorAll(".rs-tab").forEach((t) =>
      t.addEventListener("click", () => { curScope = t.dataset.scope; renderRank(); }));
  }

  /* ---------------- 启动 ---------------- */
  renderHome();
  bind();
  renderAuthUI();
})();
