import { useState } from 'react';
import { X } from 'lucide-react';
import { Switch } from '@librechat/client';

const inputCls =
  'webkit-dark-styles w-full rounded-xl border border-border-light bg-surface-primary px-3.5 py-2.5 text-sm text-text-primary focus:border-green-500 focus:outline-none';

export function ToggleField({
  label,
  id,
  checked,
  onChange,
}: {
  label: string;
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const labelId = `${id}-label`;
  return (
    <div className="flex items-center justify-between">
      <label id={labelId} htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        data-testid={id}
        aria-labelledby={labelId}
      />
    </div>
  );
}

export function Field({
  label,
  id,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} resize-none`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
      )}
    </div>
  );
}

/**
 * 多选 chips 字段：选中项按点击顺序追加（首项即主营，供后端「主小类」语义）。
 * - options：候选 chips；点击候选追加到末尾，点击已选项的 × 移除。
 * - allowCustom：允许用户自填（销售方式 / 产品属性）；industry_minor 关闭以保证取值在分类树内。
 */
export function ChipsField({
  label,
  id,
  value,
  onChange,
  options,
  allowCustom,
  disabled,
  emptyHint,
  customPlaceholder,
}: {
  label: string;
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  allowCustom?: boolean;
  disabled?: boolean;
  emptyHint?: string;
  customPlaceholder?: string;
}) {
  const [custom, setCustom] = useState('');

  const add = (v: string) => {
    const t = v.trim();
    if (!t || value.includes(t)) {
      return;
    }
    onChange([...value, t]);
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));
  const addCustom = () => {
    add(custom);
    setCustom('');
  };

  const available = options.filter((o) => !value.includes(o));
  const showEmptyHint = !!emptyHint && value.length === 0 && available.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5" id={id}>
          {value.map((chip) => (
            <span
              key={chip}
              className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs text-text-primary"
            >
              {chip}
              <button
                type="button"
                onClick={() => remove(chip)}
                aria-label={`${label}: ${chip}`}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {!disabled && available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => add(opt)}
              className="rounded-full border border-border-light px-2.5 py-1 text-xs text-text-secondary hover:border-green-500 hover:text-text-primary"
            >
              + {opt}
            </button>
          ))}
        </div>
      )}
      {allowCustom && !disabled && (
        <div className="flex gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder={customPlaceholder}
            className={inputCls}
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!custom.trim()}
            className="shrink-0 rounded-xl border border-border-light px-3 text-sm text-text-secondary hover:border-green-500 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
        </div>
      )}
      {showEmptyHint && <p className="text-xs text-text-secondary">{emptyHint}</p>}
    </div>
  );
}

export function SelectField({
  label,
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
