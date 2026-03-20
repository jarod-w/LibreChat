import React, { useState, useCallback } from 'react';
import type { Agents } from 'librechat-data-provider';
import { useChatContext } from '~/Providers';

type ClarificationOptionsProps = {
  clarification: Agents.ClarificationOptionsContent['clarification_options'];
};

const ClarificationOptions: React.FC<ClarificationOptionsProps> = ({ clarification }) => {
  const { ask } = useChatContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!clarification) {
    return null;
  }

  const { question, options, allow_custom_input } = clarification;

  const handleOptionClick = useCallback(
    (option: Agents.ClarificationOption) => {
      if (submitted) {
        return;
      }

      // value 为 null 表示自定义输入选项，聚焦到输入框
      if (option.value === null) {
        setSelectedId(option.id);
        return;
      }

      setSelectedId(option.id);
      setSubmitted(true);
      ask({ text: option.value });
    },
    [submitted, ask],
  );

  const handleCustomSubmit = useCallback(() => {
    if (submitted || !customText.trim()) {
      return;
    }
    setSubmitted(true);
    ask({ text: customText.trim() });
  }, [submitted, customText, ask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCustomSubmit();
      }
    },
    [handleCustomSubmit],
  );

  return (
    <div className="my-3">
      {/* 问题标题 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🤔</span>
        <span className="text-base font-semibold text-text-primary">{question}</span>
      </div>

      {/* 选项卡片网格 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = selectedId === option.id;
          const isCustom = option.value === null;
          const isDisabled = submitted && !isSelected;

          return (
            <button
              key={option.id}
              type="button"
              disabled={submitted && !isCustom}
              onClick={() => handleOptionClick(option)}
              className={`group flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all duration-150
                ${
                  isSelected && submitted
                    ? 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-900/20'
                    : isSelected && isCustom
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                      : isDisabled
                        ? 'cursor-not-allowed border-border-light bg-surface-secondary opacity-50'
                        : 'cursor-pointer border-border-medium bg-surface-primary hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                }`}
            >
              <span
                className={`text-sm font-medium ${
                  isSelected && submitted
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-text-primary'
                }`}
              >
                {isSelected && submitted ? `✅ ${option.label}` : option.label}
              </span>
              {option.description && (
                <span className="mt-0.5 text-xs text-text-secondary">{option.description}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 自定义输入区域 */}
      {allow_custom_input && selectedId && options.find((o) => o.id === selectedId)?.value === null && !submitted && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的自定义描述..."
            className="flex-1 rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-blue-500 focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customText.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            发送
          </button>
        </div>
      )}

      {/* 已提交提示 */}
      {submitted && (
        <div className="mt-2 text-xs text-text-tertiary">
          已选择，正在处理中...
        </div>
      )}
    </div>
  );
};

export default ClarificationOptions;
