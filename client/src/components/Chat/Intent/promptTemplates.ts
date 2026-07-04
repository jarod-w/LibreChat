/**
 * Nucleant 意图 → 输入框提示词预填模板。
 * 设计文档: LibreChat/docs/intent-prompt-prefill.design.md
 *
 * 选中「快捷创作」意图(+「意图职能」多选)后,把一份结构化提示词草稿写进输入框,
 * 用户只需补上 `【填写:…】` 占位处的产品/其它信息即可发送。
 *
 * 与 `DEFAULT_INTENT_MESSAGE` 同性质:功能性种子文本,固定中文、不走 i18n,
 * 保证发给 kotlerapi 的 prompt 确定。具体营销文案待业务定稿(设计文档 Q6)。
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

/** 每个意图一套骨架(intro + output),对齐 constants.ts 的 INTENTS[].key */
const INTENT_TEMPLATES: Record<string, IntentTemplate> = {
  seeding_graphic: {
    intro: (p) => `请为${p}创作一篇「种草图文」,用于小红书 / 大众点评等内容平台。`,
    output: '给出 3 个标题备选 + 正文(分段、真实场景、适度 emoji)+ 5-8 个话题标签。',
  },
  repurchase_script: {
    intro: (p) => `请为${p}撰写一组「复购话术」,用于社群 / 私信 / 到店场景触达老客。`,
    output: '给出 3-5 条可直接发送的话术,每条注明触发场景与复购理由。',
  },
  product_detail_page: {
    intro: (p) => `请为${p}撰写「商品详情页」文案,用于电商 / 小程序商详。`,
    output: '首屏主卖点 + 卖点分点详述 + 使用场景 + 信任背书 + 行动号召。',
  },
  promotion_copy: {
    intro: (p) => `请为${p}设计一次「促销活动」的机制与文案。`,
    output: '促销机制说明 + 主推文案 + 3 条渠道分发短文案(朋友圈 / 社群 / 短信)。',
  },
  acquisition_short_video: {
    intro: (p) => `请为${p}撰写一条「拉新短视频脚本」,用于抖音 / 视频号等平台获客。`,
    output: '3 秒开头钩子 + 分镜脚本(口播 + 画面 + 字幕)+ 结尾引导关注 / 到店。',
  },
  campaign_teaser_graphic: {
    intro: (p) => `请为${p}创作一篇「活动预热图文」,用于活动开始前造势。`,
    output: '悬念钩子 + 预热主文案 + 3 个标题备选 + 话题标签。',
  },
  campaign_teaser_video: {
    intro: (p) => `请为${p}撰写一条「活动预热短视频脚本」,用于活动前引流蓄水。`,
    output: '悬念开头 + 分镜脚本(口播 + 画面 + 字幕)+ 结尾活动预告。',
  },
  landing_page: {
    intro: (p) => `请为${p}撰写「广告落地页」文案,用于承接投放流量。`,
    output: '主标题 + 副标题 + 卖点分区 + 用户见证 + 表单 / 行动号召。',
  },
  group_buy_page: {
    intro: (p) => `请为${p}撰写「团购 / 套餐承接页」文案。`,
    output: '套餐组合与价格锚点 + 核心卖点 + 限时限量说明 + 行动号召。',
  },
  dm_service_conversion: {
    intro: (p) => `请为${p}撰写一组「私信 / 客服转化话术」,把咨询转化为下单。`,
    output: '按咨询意图分类的话术(开场 / 答疑 / 逼单)+ 常见异议应答。',
  },
  livestream_closing: {
    intro: (p) => `请为${p}撰写一组「直播成交话术」,用于直播间逼单转化。`,
    output: '产品讲解话术 + 价格 / 福利话术 + 3 波逼单话术 + 互动引导。',
  },
  referral_script: {
    intro: (p) => `请为${p}撰写一组「转介绍话术」,激励老客带新客。`,
    output: '转介绍邀请话术 + 利益点说明 + 可直接转发给好友的文案。',
  },
};

/** 每个意图职能一行「导向」片段,多选时按选中顺序拼接,对齐 INTENT_FUNCTIONS[].key */
const FUNCTION_DIRECTIVES: Record<string, string> = {
  acquisition_seeding: '获客种草:用真实场景 + 情绪钩子吸引路人,降低"这和我有关"的门槛。',
  understanding_edu: '理解教育:把卖点讲成用户能听懂的价值,补齐认知差、建立品类认知。',
  conversion_closing: '转化成交:给出明确的行动指令与理由,制造紧迫感推动即时下单。',
  trust_proof: '信任证明:自然嵌入可信细节(食材 / 工艺 / 资质 / 口碑 / 复购),打消顾虑。',
  repurchase_retention: '复购留存:强化复购理由与记忆点,唤醒老客再次到店 / 下单。',
  referral_viral: '转介绍裂变:设计可分享的钩子与利益点,促使老客主动带新客。',
};

/**
 * 组合意图骨架 + 产品信息块 + 职能导向段 + 产出要求。
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

  return [template.intro(product), productBlock, functionBlock, `产出要求:${template.output}`]
    .filter(Boolean)
    .join('\n\n');
}

/** 统计文本中尚未替换的 `【填写:…】` 占位符数量(Q7 软提示用) */
export function countUnfilledPlaceholders(text: string): number {
  const matches = text.match(/【填写:[^】]*】/g);
  return matches ? matches.length : 0;
}
