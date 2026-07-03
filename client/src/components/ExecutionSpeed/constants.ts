import type { TranslationKeys } from '~/hooks';

/**
 * 执行速(Execution Speed)常量。
 * 设计文档: LibreChat/docs/execution-speed-ui.design.md
 * key 与 kotlerapi services/plan_recommender.py 的 CURRENT_PROBLEMS 一一对应,勿改。
 */

export interface CurrentProblemOption {
  key: string;
  labelKey: TranslationKeys;
}

export const CURRENT_PROBLEMS: CurrentProblemOption[] = [
  { key: 'visibility_low', labelKey: 'com_execspeed_problem_visibility_low' },
  { key: 'view_no_buy', labelKey: 'com_execspeed_problem_view_no_buy' },
  { key: 'inquiry_lost', labelKey: 'com_execspeed_problem_inquiry_lost' },
  { key: 'no_repurchase', labelKey: 'com_execspeed_problem_no_repurchase' },
  { key: 'want_campaign', labelKey: 'com_execspeed_problem_want_campaign' },
  { key: 'content_capacity', labelKey: 'com_execspeed_problem_content_capacity' },
];

/** production_status → 徽章 i18n key + 样式(与方案确认屏/内容包卡片共用语义) */
export const STATUS_BADGES: Record<string, { labelKey: TranslationKeys; className: string }> = {
  recommended: {
    labelKey: 'com_execspeed_status_recommended',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  conditional: {
    labelKey: 'com_execspeed_status_conditional',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  gated: {
    labelKey: 'com_execspeed_status_conditional',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  sample_only: {
    labelKey: 'com_execspeed_status_sample_only',
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  },
};

/**
 * 落会话的功能种子串:发给 kotlerapi 的确定性文案,硬编码不进 i18n
 * (同 DEFAULT_INTENT_MESSAGE='开始做吧' 的约定)。
 */
export const ES_SEED_MESSAGE = '开始生成本轮内容';
