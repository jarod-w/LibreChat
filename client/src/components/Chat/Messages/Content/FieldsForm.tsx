import React, { useState, useCallback } from 'react';
import { useChatContext } from '~/Providers';
import type { FieldSpec } from '~/utils/nucleantFieldsUtils';

type Props = {
  fields: FieldSpec[];
};

const FieldsForm: React.FC<Props> = ({ fields }) => {
  const { ask } = useChatContext();
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = useCallback((field: string, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const isComplete = fields.every((f) => (values[f.field] ?? '').trim() !== '');

  const handleSubmit = useCallback(() => {
    if (submitted || !isComplete) {
      return;
    }
    setSubmitted(true);
    // Format as labeled natural language so IntentResolver LLM can run NER extraction
    const lines = fields.map((f) => `${f.question}：${values[f.field]}`);
    ask({ text: lines.join('\n') });
  }, [submitted, isComplete, fields, values, ask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, fieldIndex: number) => {
      if (e.key === 'Enter' && !e.shiftKey && fieldIndex === fields.length - 1) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, fields.length],
  );

  return (
    <div className="my-3 rounded-lg border border-border-medium bg-surface-secondary p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base">❓</span>
        <span className="text-sm font-semibold text-text-primary">请补充以下信息后继续</span>
      </div>

      <div className="space-y-3">
        {fields.map((f, idx) => (
          <div key={f.field}>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              {f.question}
            </label>

            {f.ui_type === 'single_choice' && f.options && f.options.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {f.options.map((opt) => {
                  const selected = values[f.field] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleChange(f.field, opt)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors
                        ${
                          selected
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'border-border-medium bg-surface-primary text-text-primary hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                        }
                        disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {selected ? `✓ ${opt}` : opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                disabled={submitted}
                value={values[f.field] ?? ''}
                onChange={(e) => handleChange(f.field, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                placeholder={f.ui_type === 'multi_choice' ? '多个用逗号分隔' : '请输入…'}
                className="w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={submitted || !isComplete}
          onClick={handleSubmit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          继续
        </button>
        {submitted && (
          <span className="text-xs text-text-tertiary">已提交，正在处理中…</span>
        )}
        {!submitted && !isComplete && (
          <span className="text-xs text-text-tertiary">请填写所有项目</span>
        )}
      </div>
    </div>
  );
};

export default FieldsForm;
