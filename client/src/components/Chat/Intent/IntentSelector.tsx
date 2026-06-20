import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useRecoilState } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { cn } from '~/utils';
import { INTENTS, INTENT_FUNCTIONS } from './constants';

/**
 * Nucleant 意图选择器：一级意图条（含「更多」弹层）+ 选中后的意图职能多选条。
 * 设计文档: nucleant/markdown/intent-selector-design.md §4 / §7
 *
 * 放置在落地首屏欢迎卡 + 输入框上方（方案 B）。仅落地态展示。
 */
function IntentSelector() {
  const localize = useLocalize();
  const [activeIntent, setActiveIntent] = useRecoilState(store.activeIntent);
  const [activeIntentFunctions, setActiveIntentFunctions] = useRecoilState(
    store.activeIntentFunctions,
  );
  const [showMore, setShowMore] = useState(false);

  const primaryIntents = useMemo(() => INTENTS.filter((i) => i.group === 'primary'), []);
  const moreIntents = useMemo(() => INTENTS.filter((i) => i.group === 'more'), []);

  const selectIntent = useCallback(
    (key: string) => {
      setShowMore(false);
      setActiveIntent((prev) => {
        // 取消选中：再次点击当前意图 → 收起职能条
        if (prev === key) {
          setActiveIntentFunctions([]);
          return null;
        }
        return key;
      });
    },
    [setActiveIntent, setActiveIntentFunctions],
  );

  const toggleFunction = useCallback(
    (key: string) => {
      setActiveIntentFunctions((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      );
    },
    [setActiveIntentFunctions],
  );

  const chipClass = (active: boolean) =>
    cn(
      'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200',
      active
        ? 'border-green-600/70 bg-green-50 font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400'
        : 'border-border-medium text-text-secondary hover:bg-surface-tertiary',
    );

  return (
    <div className="mx-auto mb-6 flex w-full max-w-3xl flex-col gap-3 px-4">
      {/* 一级意图条 */}
      <div className="flex flex-wrap items-center gap-2">
        {primaryIntents.map((intent) => (
          <button
            key={intent.key}
            type="button"
            aria-pressed={activeIntent === intent.key}
            onClick={() => selectIntent(intent.key)}
            className={chipClass(activeIntent === intent.key)}
          >
            {localize(intent.labelKey)}
          </button>
        ))}

        {/* 更多 */}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className={cn(
              chipClass(moreIntents.some((i) => i.key === activeIntent)),
              'inline-flex items-center gap-1',
            )}
          >
            {localize('com_intent_more')}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {showMore && (
            <>
              {/* 点击空白关闭 */}
              <div className="fixed inset-0 z-10" onClick={() => setShowMore(false)} />
              <div
                role="menu"
                className="absolute left-0 z-20 mt-1.5 flex max-h-80 w-56 flex-col overflow-y-auto rounded-xl border border-border-medium bg-surface-primary p-1.5 shadow-lg"
              >
                {moreIntents.map((intent) => (
                  <button
                    key={intent.key}
                    type="button"
                    role="menuitem"
                    onClick={() => selectIntent(intent.key)}
                    className={cn(
                      'rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150',
                      activeIntent === intent.key
                        ? 'bg-green-50 font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400'
                        : 'text-text-secondary hover:bg-surface-tertiary',
                    )}
                  >
                    {localize(intent.labelKey)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 意图职能条（选中意图后展开，多选） */}
      {activeIntent != null && (
        <div className="animate-fadeIn flex flex-col gap-2">
          <span className="text-xs text-text-tertiary">
            {localize('com_intent_functions_title')}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {INTENT_FUNCTIONS.map((fn) => (
              <button
                key={fn.key}
                type="button"
                aria-pressed={activeIntentFunctions.includes(fn.key)}
                onClick={() => toggleFunction(fn.key)}
                className={chipClass(activeIntentFunctions.includes(fn.key))}
              >
                {localize(fn.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(IntentSelector);
