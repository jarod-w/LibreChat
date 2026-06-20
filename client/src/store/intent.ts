import { atom } from 'recoil';

/**
 * Nucleant 意图选择器（intent selector）状态。
 * 设计文档: nucleant/markdown/intent-selector-design.md
 *
 * 单条消息生效（Q5）：发送后由 useSubmitMessage 重置，不做 localStorage 持久化。
 */

/** 当前选中的意图 key（单选）；null 表示未选 */
const activeIntent = atom<string | null>({
  key: 'activeIntent',
  default: null,
});

/** 当前选中的意图职能 key 列表（多选） */
const activeIntentFunctions = atom<string[]>({
  key: 'activeIntentFunctions',
  default: [],
});

export default { activeIntent, activeIntentFunctions };
