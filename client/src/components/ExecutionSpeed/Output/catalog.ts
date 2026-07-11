import type { TranslationKeys } from '~/hooks';

/**
 * 产出工作台 · 件级"使用打法"目录(Q2=A:前端 catalog 常量)。
 *
 * ⚠️ 通用性:这里是**按件类型(piece_key)的通用打法**,不是"这条内容专属";
 *    内容专属留 Phase 2 由 kotlerapi 在 plan/catalog 返回。
 * ⚠️ piece_key 权威来源:kotlerapi `services/plan_recommender.py` 的 `EXEC_PIECES`,
 *    逐条对齐、勿新造 key。
 *
 * 设计文档: LibreChat/docs/execution-speed-output-workspace.design.md §3.2
 */

export type Funnel = 'acquisition' | 'conversion' | 'retention_referral';

/** 漏斗分组展示顺序(同 kotlerapi `_FUNNEL_ORDER`) */
export const FUNNEL_ORDER: Funnel[] = ['acquisition', 'conversion', 'retention_referral'];

export const FUNNEL_LABEL_KEYS: Record<Funnel, TranslationKeys> = {
  acquisition: 'com_execspeed_output_funnel_acquisition',
  conversion: 'com_execspeed_output_funnel_conversion',
  retention_referral: 'com_execspeed_output_funnel_retention_referral',
};

export interface PieceCatalogEntry {
  funnel: Funnel;
  purposeKey: TranslationKeys;
  channelKey: TranslationKeys;
  timeKey: TranslationKeys;
  signalKey: TranslationKeys;
  materialKey: TranslationKeys;
}

/** 未知 piece_key(词表演进/新增件)回退到的分组 */
export const FALLBACK_FUNNEL: Funnel = 'conversion';

export const PIECE_CATALOG: Record<string, PieceCatalogEntry> = {
  seeding_graphic: {
    funnel: 'acquisition',
    purposeKey: 'com_execspeed_output_seeding_graphic_purpose',
    channelKey: 'com_execspeed_output_seeding_graphic_channel',
    timeKey: 'com_execspeed_output_seeding_graphic_time',
    signalKey: 'com_execspeed_output_seeding_graphic_signal',
    materialKey: 'com_execspeed_output_seeding_graphic_material',
  },
  acquisition_short_video: {
    funnel: 'acquisition',
    purposeKey: 'com_execspeed_output_acquisition_short_video_purpose',
    channelKey: 'com_execspeed_output_acquisition_short_video_channel',
    timeKey: 'com_execspeed_output_acquisition_short_video_time',
    signalKey: 'com_execspeed_output_acquisition_short_video_signal',
    materialKey: 'com_execspeed_output_acquisition_short_video_material',
  },
  campaign_teaser_graphic: {
    funnel: 'acquisition',
    purposeKey: 'com_execspeed_output_campaign_teaser_graphic_purpose',
    channelKey: 'com_execspeed_output_campaign_teaser_graphic_channel',
    timeKey: 'com_execspeed_output_campaign_teaser_graphic_time',
    signalKey: 'com_execspeed_output_campaign_teaser_graphic_signal',
    materialKey: 'com_execspeed_output_campaign_teaser_graphic_material',
  },
  campaign_teaser_video: {
    funnel: 'acquisition',
    purposeKey: 'com_execspeed_output_campaign_teaser_video_purpose',
    channelKey: 'com_execspeed_output_campaign_teaser_video_channel',
    timeKey: 'com_execspeed_output_campaign_teaser_video_time',
    signalKey: 'com_execspeed_output_campaign_teaser_video_signal',
    materialKey: 'com_execspeed_output_campaign_teaser_video_material',
  },
  product_detail_page: {
    funnel: 'conversion',
    purposeKey: 'com_execspeed_output_product_detail_page_purpose',
    channelKey: 'com_execspeed_output_product_detail_page_channel',
    timeKey: 'com_execspeed_output_product_detail_page_time',
    signalKey: 'com_execspeed_output_product_detail_page_signal',
    materialKey: 'com_execspeed_output_product_detail_page_material',
  },
  landing_page: {
    funnel: 'conversion',
    purposeKey: 'com_execspeed_output_landing_page_purpose',
    channelKey: 'com_execspeed_output_landing_page_channel',
    timeKey: 'com_execspeed_output_landing_page_time',
    signalKey: 'com_execspeed_output_landing_page_signal',
    materialKey: 'com_execspeed_output_landing_page_material',
  },
  group_buy_page: {
    funnel: 'conversion',
    purposeKey: 'com_execspeed_output_group_buy_page_purpose',
    channelKey: 'com_execspeed_output_group_buy_page_channel',
    timeKey: 'com_execspeed_output_group_buy_page_time',
    signalKey: 'com_execspeed_output_group_buy_page_signal',
    materialKey: 'com_execspeed_output_group_buy_page_material',
  },
  promo_copy: {
    funnel: 'conversion',
    purposeKey: 'com_execspeed_output_promo_copy_purpose',
    channelKey: 'com_execspeed_output_promo_copy_channel',
    timeKey: 'com_execspeed_output_promo_copy_time',
    signalKey: 'com_execspeed_output_promo_copy_signal',
    materialKey: 'com_execspeed_output_promo_copy_material',
  },
  dm_service_conversion: {
    funnel: 'conversion',
    purposeKey: 'com_execspeed_output_dm_service_conversion_purpose',
    channelKey: 'com_execspeed_output_dm_service_conversion_channel',
    timeKey: 'com_execspeed_output_dm_service_conversion_time',
    signalKey: 'com_execspeed_output_dm_service_conversion_signal',
    materialKey: 'com_execspeed_output_dm_service_conversion_material',
  },
  livestream_closing: {
    funnel: 'conversion',
    purposeKey: 'com_execspeed_output_livestream_closing_purpose',
    channelKey: 'com_execspeed_output_livestream_closing_channel',
    timeKey: 'com_execspeed_output_livestream_closing_time',
    signalKey: 'com_execspeed_output_livestream_closing_signal',
    materialKey: 'com_execspeed_output_livestream_closing_material',
  },
  repurchase_script: {
    funnel: 'retention_referral',
    purposeKey: 'com_execspeed_output_repurchase_script_purpose',
    channelKey: 'com_execspeed_output_repurchase_script_channel',
    timeKey: 'com_execspeed_output_repurchase_script_time',
    signalKey: 'com_execspeed_output_repurchase_script_signal',
    materialKey: 'com_execspeed_output_repurchase_script_material',
  },
  referral_script: {
    funnel: 'retention_referral',
    purposeKey: 'com_execspeed_output_referral_script_purpose',
    channelKey: 'com_execspeed_output_referral_script_channel',
    timeKey: 'com_execspeed_output_referral_script_time',
    signalKey: 'com_execspeed_output_referral_script_signal',
    materialKey: 'com_execspeed_output_referral_script_material',
  },
};

export function getPieceCatalog(pieceKey: string): PieceCatalogEntry | undefined {
  return PIECE_CATALOG[pieceKey];
}

export function getPieceFunnel(pieceKey: string): Funnel {
  return PIECE_CATALOG[pieceKey]?.funnel ?? FALLBACK_FUNNEL;
}
