/* =========================================================================
 * 数学学霸模拟器 — 数据层（占位，后续替换真实数据即可）
 * -------------------------------------------------------------------------
 * 所有界面文案、题库、秘籍、报告数据都集中在这里。
 * 接入后端时，只需把下面的常量替换为接口返回的数据结构，
 * 保持字段名一致即可，界面无需改动。
 * ========================================================================= */

const APP_DATA = {
  /* ---------- 首页 ---------- */
  home: {
    brand: "数学学霸模拟器",
    greeting: "今天也是伟大的一天（大概）",
    subtitle: "数学不会背叛你，它只是不理你。",
    streakDays: 7,            // 连续打卡天数
    dailyQuest: {
      title: "今日份 KPI",
      desc: "做个挡位，剩下的交给玄学。",
      done: 1,                // 已完成
      total: 3,               // 目标
    },
    entries: [
      { id: "practice", icon: "target", label: "答题练习", desc: "假装很努力" },
      { id: "manual",   icon: "tri",    label: "功法秘籍", desc: "考前抱佛脚" },
      { id: "report",   icon: "bars",   label: "学习报告", desc: "看看错在哪" },
    ],
  },

  /* ---------- 趣味文案（搞笑层，可随意增删）---------- */
  fun: {
    quips: [
      "数学是假的，但 KPI 是真的。",
      "我算过了，你今天能行。",
      "别慌，错就错了，下次还错。",
      "柠檬补维C，刷题补……算了。",
      "这道题我也不会，但我嘴硬。",
    ],
    hype: [
      "深吸一口气，然后……算吧。",
      "准备好了吗？反正我没。",
      "这题不难，难的是你。",
      "稳住，我们能赢（大概）。",
      "脑力加载中……1%……",
    ],
    lowTime: "⏰ 要没时间了！脑子跟上！",
    miaoSubs: [
      "手起题落，这道题已去世。",
      "秒了。它甚至没反应过来。",
      "完美，像没学过一样自然。",
      "这题：我熟。你：我也熟。",
    ],
    interestingSubs: [
      "这题有点意思啊，意思是它认识你，你不认识它。",
      "标准答案长这样，记一下，下次还错。",
      "没事，错着错着就习惯了。",
      "它笑了一下，因为你写了这个。",
    ],
    again: [
      "换个挡位再战（嘴硬版）",
      "不服？换个挡位来。",
      "再战，这次带脑子",
    ],
    // —— 上瘾机制文案（联网调研：可变奖励 / 近失 / 里程碑 / BOSS / 首刷）——
    drops: [            // 可变奖励掉落（老虎机式：类型不可预测才上瘾）
      { xp: 10, msg: "🎁 神秘掉落！爽感 XP +10" },
      { xp: 5,  msg: "✨ 隐藏彩蛋！这题被柠檬猫标记了" },
      { xp: 8,  msg: "💎 稀有掉落：柠檬猫给你塞了分" },
      { xp: 6,  msg: "🍋 柠檬暴击！这一发 XP 暴涨" },
    ],
    nearMiss: [         // 答错但很快 / 擦边：近失效应，勾着再来一发
      "就差一点！再来一发就秒了。",
      "擦边了！这题已经认识你了。",
      "差之毫厘——下次必中。",
    ],
    milestones: [       // 一局内连对里程碑梯度鼓励（10/20/30…）
      { n: 10,  msg: "🔥 连对 10 题！基础超扎实" },
      { n: 20,  msg: "💪 连对 20 题，学霸潜质藏不住" },
      { n: 30,  msg: "👑 连对 30 题，这知识点刻进 DNA 了" },
      { n: 50,  msg: "🚀 连对 50 题，封神路上你最狂" },
      { n: 100, msg: "🌟 连对 100 题，数学之神已点头" },
    ],
    boss: [             // 顶部段位 BOSS 战
      "👹 BOSS 来袭！拿下它段位直接飞升",
      "🏯 终极试题镇守此关，破之封神",
      "⚡ 隐藏 BOSS：全国只有 1% 的人见过",
    ],
    firstBrush: "🌟 今日首刷！爽感 XP +5",
  },

  /* ---------- 段位系统：9 段（幽默 · 含数学家梗）----------
   * 中间段（第 5 段）是 ELO 稳定段位：匹配机制会把普通玩家悄悄焊在这里。
   * flavor 用于「段位榜」弹窗的一句吐槽。
   */
  ranks: [
    { name: "数数幼儿园", sub: "掰指算童",     icon: "🧒", flavor: "一根手指一个，两根手指两个，数到十就要脱鞋了。" },
    { name: "九九乘法表", sub: "在编公民",     icon: "🔢", flavor: "背得最熟的还是九九八十一，其余随缘。" },
    { name: "方程区",     sub: "临时工",       icon: "📝", flavor: "x 是几不重要，重要的是我先溜了。" },
    { name: "微积分",     sub: "预备役",       icon: "∫",  flavor: "导数积分略懂，牛顿莱布尼茨恕不奉陪。" },
    { name: "薛定谔",     sub: "既会又不会",   icon: "🐱", flavor: "做题前你会，发卷后你不会，叠加态实锤。（中间稳定段位）" },
    { name: "高斯",       sub: "附体体验卡",   icon: "🧠", flavor: "7 岁算出 1+2+…+100，你 7 岁在吃手。" },
    { name: "黎曼",       sub: "猜想围观群众", icon: "📐", flavor: "零点的故事听了十年，一个也没证出来。" },
    { name: "庞加莱",     sub: "自称得主",     icon: "🏆", flavor: "证书是 P 的，但气质是真的。" },
    { name: "上帝",       sub: "数学实习生",   icon: "👼", flavor: "宇宙的底稿你见过，但排版是你乱的。" },
  ],

  /* ---------- ELO 机制（无限爬塔）----------
   * 直接进关，关数一直往上爬；答对加分、答错减分，采用标准 ELO 公式。
   * 设计目标：
   *   1) 上分越来越难 —— K 因子随段位下降（高段每题只挪一点点）。
   *   2) 段位随分上涨 —— ELO 跨过阈值即升段。
   *   3) 普通玩家待在中间段位 —— 对手 ELO 用「橡皮筋」向中间拽：
   *        qElo = middle + (你的ELO − middle) × pull + (关数−1) × noiseStep
   *      pull 为负：你高于中间→对手变弱→赢几乎不加、输狠狠扣→被拽回中间；
   *      你低于中间→对手变强→赢加得多、输几乎不扣→被顶回中间。
   *   4) 挡位越高题越难 —— 每 bankSpan 关升一档题库（小学→前沿）。
   */
  elo: {
    start: 0,                                      // 起始 ELO，落在最小段（第 1 段 数数幼儿园）；橡胶筋会把普通玩家慢慢往中间拽
    middle: 1100,                                 // 橡皮筋锚点（中间段中心）
    pull: -0.15,                                  // 橡皮筋系数（负=往中间拉）：普通玩家被焊在中间段，但高手仍能往上爬
    noiseStep: 0,                                 // 对手 ELO 不随关数漂移（靠题库档 + K 因子体现“越爬越难”）
    rankThresholds: [0, 400, 600, 800, 1000, 1200, 1400, 1600, 1800], // 9 段下限
    kByRank:        [40, 38, 32, 28, 24, 20, 18, 16, 14],             // K 随段位下降（顶部略调高，让高手真能爬到封顶）
    bankSpan: 3,                                  // 每 3 关升一档题库（小学→前沿，题越来越难）
    tierStage: [0, 0, 1, 1, 2, 2, 3, 3, 4],       // 9 关 → 5 阶段映射：LV.7-8 抽大学题、LV.9 抽前沿题，最高段位也有对应题库
  },

  /* ---------- 功法秘籍：数学模型方法（小学 → 初中 → 高中 → 大学 → 前沿，五阶全覆盖）----------
   * 每个秘籍 = 一个数学模型/方法：一句话 intro + 心法 heart + 自带题库 bank。
   * 每题的 solution：idea=基本思路（口语化、幽默，不拘模板），steps=核心步骤（点列）。
   * 解析风格：基本思路随意发挥、能让人笑一下最好；核心步骤点列，末句收「答案就出来了。」
   */
  manuals: {},

  /* ---------- 题库：分挡位（难度递增，对应 ELO 爬塔）----------
   * 每个挡位有一个小题库 bank，每次随机抽 5 道作答。
   * 挡位越高，题越难：小学 → 初中 → 高中 → 大学 → 前沿。
   * type: "choice" | "fill"
   * choice: options 为选项数组，answer 为正确选项下标
   * fill:    answer 为正确字符串（忽略大小写与空格比较）
   * timeLimit: 秒
   */
  tiers: [
    {
      id: "t1", name: "小学", level: 1,
      bank: [
        { id: "e1", type: "choice", subject: "代数", stem: "化简：3x + 2x − x = ?", options: ["4x", "5x", "6x", "2x"], answer: 0, timeLimit: 20 },
        { id: "e2", type: "fill",   subject: "计算", stem: "计算：12 × 8 = ?", answer: "96", timeLimit: 15 },
        { id: "e3", type: "choice", subject: "几何", stem: "直角三角形两直角边为 3 和 4，斜边是？", options: ["5", "6", "7", "25"], answer: 0, timeLimit: 20 },
        { id: "e4", type: "fill",   subject: "公式", stem: "完全平方公式：(a + b)² = a² + ___ + b²", answer: "2ab", timeLimit: 20 },
        { id: "e5", type: "choice", subject: "分数", stem: "1/2 + 1/3 = ?", options: ["2/5", "5/6", "1/6", "3/4"], answer: 1, timeLimit: 25 },
        { id: "e6", type: "fill",   subject: "计算", stem: "100 ÷ 4 = ?", answer: "25", timeLimit: 15 },
        { id: "e7", type: "choice", subject: "百分数", stem: "小数 0.5 等于百分之几？", options: ["5%", "50%", "500%", "0.5%"], answer: 1, timeLimit: 15 },
        { id: "e8", type: "fill",   subject: "几何", stem: "边长为 5 的正方形，周长是？", answer: "20", timeLimit: 15 },
      ],
    },
    {
      id: "t2", name: "初中", level: 2,
      bank: [
        { id: "m1", type: "fill",   subject: "计算", stem: "√16 = ?", answer: "4", timeLimit: 15 },
        { id: "m2", type: "choice", subject: "方程", stem: "解方程 2x + 3 = 11，x = ?", options: ["3", "4", "5", "7"], answer: 1, timeLimit: 20 },
        { id: "m3", type: "choice", subject: "因式分解", stem: "x² − 9 可以分解成？", options: ["(x−3)(x+3)", "(x−9)(x+1)", "(x−3)²", "x(x−9)"], answer: 0, timeLimit: 25 },
        { id: "m4", type: "fill",   subject: "代数", stem: "化简：2(a + b) − (a − b) = ?", answer: "a+3b", timeLimit: 25 },
        { id: "m5", type: "choice", subject: "函数", stem: "一次函数 y = 2x + 1 的斜率是？", options: ["1", "2", "0", "2x"], answer: 1, timeLimit: 20 },
        { id: "m6", type: "fill",   subject: "计算", stem: "5² − 3² = ?", answer: "16", timeLimit: 15 },
        { id: "m7", type: "choice", subject: "比例", stem: "3 : 4 = 6 : ?", options: ["7", "8", "12", "9"], answer: 1, timeLimit: 20 },
        { id: "m8", type: "fill",   subject: "方程", stem: "若 3x = 12，则 x = ?", answer: "4", timeLimit: 15 },
      ],
    },
    {
      id: "t3", name: "高中", level: 3,
      bank: [
        { id: "h1", type: "choice", subject: "三角", stem: "sin(30°) 等于？", options: ["1/2", "√3/2", "1", "0"], answer: 0, timeLimit: 15 },
        { id: "h2", type: "fill",   subject: "导数", stem: "函数 f(x) = x³ 的导数是？", answer: "3x²", timeLimit: 20 },
        { id: "h3", type: "choice", subject: "函数", stem: "二次函数 y = ax²+bx+c 的对称轴 x = ?", options: ["−b/2a", "b/2a", "−c/2a", "−b/a"], answer: 0, timeLimit: 20 },
        { id: "h4", type: "choice", subject: "对数", stem: "log₂8 = ?", options: ["2", "3", "4", "8"], answer: 1, timeLimit: 20 },
        { id: "h5", type: "fill",   subject: "积分", stem: "∫2x dx = ?（只写不含常数的部分）", answer: "x²", timeLimit: 25 },
        { id: "h6", type: "choice", subject: "复数", stem: "虚数单位 i 满足 i² = ?", options: ["1", "−1", "i", "0"], answer: 1, timeLimit: 15 },
        { id: "h7", type: "choice", subject: "向量", stem: "两个向量垂直的充要条件是它们的点积为？", options: ["0", "1", "−1", "相等"], answer: 0, timeLimit: 20 },
        { id: "h8", type: "fill",   subject: "数列", stem: "等差数列 2, 5, 8, … 的第 4 项是？", answer: "11", timeLimit: 20 },
      ],
    },
    {
      id: "t4", name: "大学", level: 4,
      bank: [
        { id: "c1", type: "choice", subject: "极限", stem: "lim(x→0) sin x / x = ?", options: ["0", "1", "∞", "不存在"], answer: 1, timeLimit: 20 },
        { id: "c2", type: "fill",   subject: "积分", stem: "∫₀¹ x dx = ?", answer: "0.5", timeLimit: 20 },
        { id: "c3", type: "choice", subject: "矩阵", stem: "二阶行列式 |a b; c d| = ?", options: ["ad−bc", "ab−cd", "ac−bd", "ad+bc"], answer: 0, timeLimit: 25 },
        { id: "c4", type: "choice", subject: "导数", stem: "f(x) = eˣ 的导数是？", options: ["eˣ", "x·eˣ⁻¹", "ln x", "1/x"], answer: 0, timeLimit: 15 },
        { id: "c5", type: "fill",   subject: "级数", stem: "eˣ 在 x=0 处的一阶泰勒展开（近似）是？", answer: "1+x", timeLimit: 25 },
        { id: "c6", type: "choice", subject: "概率", stem: "互不相容事件 A、B，P(A∪B) = ?", options: ["P(A)+P(B)", "P(A)P(B)", "P(A)−P(B)", "0"], answer: 0, timeLimit: 25 },
        { id: "c7", type: "choice", subject: "线性代数", stem: "可逆方阵 A 与其逆满足 A·A⁻¹ = ?", options: ["I（单位阵）", "0", "A", "A²"], answer: 0, timeLimit: 20 },
        { id: "c8", type: "fill",   subject: "微积分", stem: "∫ cos x dx = ?（不含常数）", answer: "sin x", timeLimit: 20 },
      ],
    },
    {
      id: "t5", name: "前沿", level: 5,
      bank: [
        { id: "f1", type: "choice", subject: "形式化证明", stem: "Lean 这一证明助手基于哪种类型论？", options: ["依赖类型论(CIC)", "一阶逻辑", "朴素集合论", "直觉主义逻辑"], answer: 0, timeLimit: 30 },
        { id: "f2", type: "choice", subject: "AI 定理证明", stem: "DeepMind 的 AlphaProof（IMO 2024）用哪个证明助手生成证明？", options: ["Lean", "Coq", "Matlab", "Excel"], answer: 0, timeLimit: 30 },
        { id: "f3", type: "choice", subject: "数学史", stem: "四色定理首次被计算机辅助证明是在哪一年？", options: ["1976", "1996", "2005", "2024"], answer: 0, timeLimit: 25 },
        { id: "f4", type: "fill",   subject: "计算机代数", stem: "Python 中做符号计算的库是？", answer: "sympy", timeLimit: 25 },
        { id: "f5", type: "choice", subject: "形式化证明", stem: "Coq 与 Lean 共同依赖的逻辑基础是？", options: ["CIC（构造演算）", "ZFC 集合论", "皮亚诺算术", "布尔代数"], answer: 0, timeLimit: 30 },
        { id: "f6", type: "choice", subject: "自动定理证明", stem: "OpenAI 的 GPT-f 最早在哪个形式化系统上训练证明？", options: ["Metamath", "Lean", "Coq", "Isabelle"], answer: 0, timeLimit: 30 },
        { id: "f7", type: "choice", subject: "前沿工具", stem: "拓扑数据分析(TDA)中用来计算持续同调的常用工具是？", options: ["Ripser / GUDHI", "Photoshop", "Excel", "Word"], answer: 0, timeLimit: 30 },
        { id: "f8", type: "choice", subject: "AI 数学", stem: "四色定理的完全机器验证版是用哪个证明助手完成的？", options: ["Coq", "Word", "Lean", "Maple"], answer: 0, timeLimit: 30 },
      ],
    },
  ],

  /* ---------- 学习报告（占位）---------- */
  report: {
    accuracy: 86,        // 正确率 %
    bestStreak: 12,      // 最高连击
    avgTime: 14,         // 平均用时（秒/题）
    solved: 42,          // 累计答题数
    chips: [
      { label: "今日正确率", value: "86%", tone: "gold" },
      { label: "最高连击", value: "12", tone: "rose" },
      { label: "平均用时", value: "14s", tone: "gold" },
      { label: "累计题数", value: "42", tone: "rose" },
    ],
    recent: [
      { subject: "代数", result: "对", time: "12s" },
      { subject: "几何", result: "对", time: "9s" },
      { subject: "分数", result: "错", time: "21s" },
      { subject: "计算", result: "对", time: "8s" },
    ],
  },
};

// 暴露给全局（无打包工具，直接用 script 标签引入）
window.APP_DATA = APP_DATA;
