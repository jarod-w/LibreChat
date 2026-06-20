import type { TranslationKeys } from '~/hooks';

/**
 * Nucleant 意图选择器常量。
 * 设计文档: nucleant/markdown/intent-selector-design.md §5
 *
 * key 为稳定标识，发送给 kotlerapi（见 kotlerapi/services/intent_catalog.py，勿改名）。
 * labelKey 走 i18n（en 值见 locales/en/translation.json，中文由本地化流程产出）。
 */

export interface IntentOption {
  key: string;
  labelKey: TranslationKeys;
  group: 'primary' | 'more';
}

/** 一级意图（单选）：primary 默认显示，more 收在「更多」弹层 */
export const INTENTS: IntentOption[] = [
  { key: 'seeding_graphic', labelKey: 'com_intent_seeding_graphic', group: 'primary' },
  { key: 'repurchase_script', labelKey: 'com_intent_repurchase_script', group: 'primary' },
  { key: 'product_detail_page', labelKey: 'com_intent_product_detail_page', group: 'primary' },
  { key: 'promotion_copy', labelKey: 'com_intent_promotion_copy', group: 'primary' },
  { key: 'acquisition_short_video', labelKey: 'com_intent_acquisition_short_video', group: 'more' },
  { key: 'campaign_teaser_graphic', labelKey: 'com_intent_campaign_teaser_graphic', group: 'more' },
  { key: 'campaign_teaser_video', labelKey: 'com_intent_campaign_teaser_video', group: 'more' },
  { key: 'landing_page', labelKey: 'com_intent_landing_page', group: 'more' },
  { key: 'group_buy_page', labelKey: 'com_intent_group_buy_page', group: 'more' },
  { key: 'dm_service_conversion', labelKey: 'com_intent_dm_service_conversion', group: 'more' },
  { key: 'livestream_closing', labelKey: 'com_intent_livestream_closing', group: 'more' },
  { key: 'referral_script', labelKey: 'com_intent_referral_script', group: 'more' },
];

export interface IntentFunctionOption {
  key: string;
  labelKey: TranslationKeys;
}

/** 意图职能（多选）：选中意图后展开 */
export const INTENT_FUNCTIONS: IntentFunctionOption[] = [
  { key: 'acquisition_seeding', labelKey: 'com_intent_fn_acquisition_seeding' },
  { key: 'understanding_edu', labelKey: 'com_intent_fn_understanding_edu' },
  { key: 'conversion_closing', labelKey: 'com_intent_fn_conversion_closing' },
  { key: 'trust_proof', labelKey: 'com_intent_fn_trust_proof' },
  { key: 'repurchase_retention', labelKey: 'com_intent_fn_repurchase_retention' },
  { key: 'referral_viral', labelKey: 'com_intent_fn_referral_viral' },
];

/**
 * 留空发送时的兜底文案（Q4）。功能性种子消息（发往 kotlerapi 的 user 消息），
 * 非纯 UI 文案，固定为中文以保证确定性，不走 i18n。
 */
export const DEFAULT_INTENT_MESSAGE = '开始做吧';
