/**
 * Nucleant 意图 → 输入框提示词预填模板。
 * 设计文档: LibreChat/docs/intent-prompt-prefill.design.md
 *
 * 选中「快捷创作」意图(+「意图职能」多选)后,把一份结构化提示词草稿写进输入框,
 * 用户只需补上 `【填写:…】` 占位处的产品/其它信息即可发送。
 *
 * 与 `DEFAULT_INTENT_MESSAGE` 同性质:功能性种子文本,固定中文、不走 i18n,
 * 保证发给 kotlerapi 的 prompt 确定。产出要求与 kotlerapi agent schema 对齐。
 */

/** 档案预填上下文:能填就填,填不到留占位(设计文档 Q5) */
export interface IntentPromptContext {
  productName?: string;
  sellingPoints?: string;
  targetCustomers?: string;
}

interface IntentTemplate {
  /** 骨架首句,`product` 已是产品名或占位串 */
  intro: (product: string) => string;
  /** 「产出要求:」后的内容 */
  output: string;
}

const placeholder = (label: string) => `【填写:${label}】`;

/** 各意图共用的写作合规约束(与 kotlerapi agent constraints 对齐) */
const COMPLIANCE_BLOCK = [
  '写作约束:',
  '- 价格/份数/好评/资质等未确认信息用【待确认】占位,禁止编造',
  '- 禁止「最/第一/100%/绝对」等绝对化表述,不贩卖焦虑',
  '- 若有品牌禁说清单,输出中不得出现等价说法',
].join('\n');

/** 每个意图一套骨架(intro + output),对齐 constants.ts 的 INTENTS[].key */
const INTENT_TEMPLATES: Record<string, IntentTemplate> = {
  seeding_graphic: {
    intro: (p) => `请为${p}创作一篇「种草图文」,用于小红书 / 大众点评等内容平台。`,
    output:
      '给出 3 个标题备选 + 正文(分段、真实场景、适度 emoji)+ 5-8 个话题标签;附配图拍摄要点(真实场景优先)。',
  },
  repurchase_script: {
    intro: (p) => `请为${p}撰写一组「复购话术」,用于社群 / 私信 / 到店场景触达老客。`,
    output:
      '按 talk_scripts 结构输出 ≥3 条话术:每条含 scene_name(如老客唤醒/会员复购券/周期提醒)、trigger(触发时机)、script(可直接发送正文);未确认优惠用【待确认】占位。',
  },
  product_detail_page: {
    intro: (p) => `请为${p}撰写「商品详情页」文案,用于电商 / 小程序商详。`,
    output:
      '按 8 个模块输出:首屏主张 / 核心卖点(安全·价值·体验) / 选品调 / 信任证据 / 规格价格 / FAQ / CTA / 底部。',
  },
  promotion_copy: {
    intro: (p) => `请为${p}设计「促销活动」机制与可直接发布的促销文案。`,
    output:
      '至少 3 个机制变体(各含机制名、触发条件、主文案、图位备注);另给朋友圈 / 社群 / 短信各 1 条短文案。',
  },
  acquisition_short_video: {
    intro: (p) => `请为${p}撰写「拉新短视频脚本」,用于抖音 / 视频号等平台获客。`,
    output:
      '给出 3 条不同 hook 类型(如痛点共鸣/反差对比/场景代入)的分镜脚本,每条含 3 秒钩子 + 口播 + 画面 + 字幕 + 结尾引导关注/到店。',
  },
  campaign_teaser_graphic: {
    intro: (p) => `请为${p}创作一篇「活动预热图文」,用于活动开始前造势。`,
    output: '悬念钩子 + 预热主文案 + 3 个标题备选 + 话题标签 + 配图要点。',
  },
  campaign_teaser_video: {
    intro: (p) => `请为${p}撰写一条「活动预热短视频脚本」,用于活动前引流蓄水。`,
    output:
      '给出 3 条不同 hook 类型的预热分镜脚本(悬念开头 + 口播 + 画面 + 字幕 + 活动预告)。',
  },
  landing_page: {
    intro: (p) => `请为${p}撰写「广告落地页」文案,用于承接投放流量。`,
    output:
      '按 7 个模块:钩子 / 痛点 / 方案 / 证据 / 套餐 / 唯一行动 / 消除顾虑;主标题一句话说清价值。',
  },
  group_buy_page: {
    intro: (p) => `请为${p}撰写「团购 / 套餐承接页」文案。`,
    output:
      '按团购页结构:礼物名 / 亮点 / 内容明细 / 为什么值得买 / 证据 / 场景 / 不适用人群 / 安全说明 / 行动号召。',
  },
  dm_service_conversion: {
    intro: (p) => `请为${p}撰写一组「私信 / 客服转化话术」,把咨询转化为下单。`,
    output:
      '覆盖五类场景(新客承接/价格异议/犹豫推进/已领券未下单/到店前提醒),每类含触发条件、开场、核心话术、异议应对、CTA。',
  },
  livestream_closing: {
    intro: (p) => `请为${p}撰写一组「直播成交话术」,用于直播间逼单转化。`,
    output:
      '按六段式结构:钩子留人 → 痛点共鸣 → 价值塑造 → 信任口碑 → 异议处理(≥5条) → 限时逼单;附 2 条可复用直播金句。',
  },
  referral_script: {
    intro: (p) => `请为${p}撰写一组「转介绍话术」,激励老客带新客。`,
    output:
      '按 talk_scripts 结构输出 ≥3 条:scene_name(如老带新邀请/晒单引导/社群裂变)、trigger(渠道场景)、script(可转发正文);KOC 场景可附 koc_brief;遵守转介绍红线(无现金返利/不拍人头/不分销层级)。',
  },
};

/** 每个意图职能一行「导向」片段,多选时按选中顺序拼接,对齐 INTENT_FUNCTIONS[].key */
const FUNCTION_DIRECTIVES: Record<string, string> = {
  acquisition_seeding:
    '获客种草:首段用真实场景 + 情绪钩子降低「这和我有关」的门槛,标题带具体人群/场景。',
  understanding_edu:
    '理解教育:把卖点讲成用户听得懂的价值与对比,补齐认知差,避免堆砌参数。',
  conversion_closing:
    '转化成交:结尾给出明确行动指令(领券/下单/到店)与紧迫感理由,但不虚假限时。',
  trust_proof:
    '信任证明:自然嵌入可验证细节(食材/工艺/资质/口碑/复购),用具体画面而非空泛形容词。',
  repurchase_retention:
    '复购留存:强化记忆点与再次到店/下单理由,话术适合老客语境,避免像拉新广告。',
  referral_viral:
    '转介绍裂变:设计可分享的钩子与双方利益点(非现金返利),给出老客一键转发的短文案。',
};

/**
 * 组合意图骨架 + 产品信息块 + 职能导向段 + 产出要求 + 合规约束。
 * @returns 完整提示词草稿;无对应意图模板时返回 null(不注入)。
 */
export function buildIntentPrompt(
  intentKey: string,
  functionKeys: string[],
  ctx: IntentPromptContext,
): string | null {
  const template = INTENT_TEMPLATES[intentKey];
  if (!template) {
    return null;
  }

  const product = ctx.productName ?? placeholder('产品 / 品牌名称');
  const sellingPoints = ctx.sellingPoints ?? placeholder('1-3 条核心卖点');
  const audience = ctx.targetCustomers ?? placeholder('目标人群,如周边 3km 白领 / 家庭客');

  const productBlock = [
    '产品信息:',
    `- 核心卖点:${sellingPoints}`,
    `- 目标人群:${audience}`,
    `- 补充信息(可选):${placeholder('价格档位 / 门店位置 / 当前活动')}`,
  ].join('\n');

  const directives = functionKeys
    .map((key) => FUNCTION_DIRECTIVES[key])
    .filter((line): line is string => Boolean(line));
  const functionBlock = directives.length
    ? ['营销职能导向(本次内容需同时承担):', ...directives.map((line) => `- ${line}`)].join('\n')
    : '';

  return [
    template.intro(product),
    productBlock,
    functionBlock,
    `产出要求:${template.output}`,
    COMPLIANCE_BLOCK,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** 统计文本中尚未替换的 `【填写:…】` 占位符数量(Q7 软提示用) */
export function countUnfilledPlaceholders(text: string): number {
  const matches = text.match(/【填写:[^】]*】/g);
  return matches ? matches.length : 0;
}
