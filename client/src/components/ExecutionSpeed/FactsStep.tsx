import type { ProfileBrand, ProfileProduct } from '~/data-provider/Profile';
import { Field } from '~/components/Onboarding/ProfileFields';
import { CURRENT_PROBLEMS } from './constants';
import { useLocalize } from '~/hooks';

const selectCls =
  'webkit-dark-styles w-full rounded-xl border border-border-light bg-surface-primary px-3.5 py-2.5 text-sm text-text-primary focus:border-green-500 focus:outline-none';

type FactsStepProps = {
  brand: ProfileBrand;
  product: ProfileProduct | null;
  problem: string;
  onProblemChange: (v: string) => void;
  eventNode: string;
  onEventNodeChange: (v: string) => void;
  channels: string;
  onChannelsChange: (v: string) => void;
  forbidden: string;
  onForbiddenChange: (v: string) => void;
  error: string;
};

function ReadonlyFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="truncate text-sm font-medium text-text-primary">{value || '—'}</span>
    </div>
  );
}

/** Step 1 · 填事实:档案预填(只读摘要 + 两个可回写字段)+ 本轮想解决的问题 */
export default function FactsStep({
  brand,
  product,
  problem,
  onProblemChange,
  eventNode,
  onEventNodeChange,
  channels,
  onChannelsChange,
  forbidden,
  onForbiddenChange,
  error,
}: FactsStepProps) {
  const localize = useLocalize();
  const industry = product?.industry_minor?.[0] || product?.industry_mid || '';

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 档案预填摘要(只读;去档案页修改) */}
      <div className="rounded-xl border border-border-light bg-surface-primary p-4">
        <div className="grid grid-cols-2 gap-3">
          <ReadonlyFact label={localize('com_execspeed_fact_brand')} value={brand.brand_name ?? ''} />
          <ReadonlyFact
            label={localize('com_execspeed_fact_product')}
            value={product?.product_name ?? ''}
          />
          <ReadonlyFact label={localize('com_execspeed_fact_industry')} value={industry} />
          <ReadonlyFact
            label={localize('com_execspeed_fact_audience')}
            value={product?.target_customers ?? ''}
          />
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          {localize('com_execspeed_facts_readonly_hint')}
        </p>
      </div>

      {/* 本轮想解决的问题(必填) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="es-problem" className="text-sm font-medium text-text-secondary">
          {localize('com_execspeed_problem_label')} *
        </label>
        <select
          id="es-problem"
          value={problem}
          onChange={(e) => onProblemChange(e.target.value)}
          className={selectCls}
        >
          <option value="" disabled>
            {localize('com_ui_select')}
          </option>
          {CURRENT_PROBLEMS.map((p) => (
            <option key={p.key} value={p.key}>
              {localize(p.labelKey)}
            </option>
          ))}
        </select>
      </div>

      {/* 活动节点(可选,影响预热/承接件的条件判定) */}
      <Field
        id="es-event-node"
        label={localize('com_execspeed_event_node_label')}
        value={eventNode}
        onChange={onEventNodeChange}
        placeholder={localize('com_execspeed_event_node_placeholder')}
      />

      {/* 可编辑 + 回写档案的两项(Q4) */}
      <Field
        id="es-channels"
        label={localize('com_execspeed_channels_label')}
        value={channels}
        onChange={onChannelsChange}
        placeholder="e.g. 小红书, 美团团购, 私域微信"
      />
      <Field
        id="es-forbidden"
        label={localize('com_execspeed_forbidden_label')}
        value={forbidden}
        onChange={onForbiddenChange}
        multiline
        placeholder="e.g. 最正宗, 全网最低价"
      />
    </div>
  );
}
