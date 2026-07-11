import { useState } from 'react';
import type { KotlerResultPiece } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { getPieceCatalog } from './catalog';
import { useLocalize } from '~/hooks';

type Tab = 'copy' | 'image' | 'usage';

const TABS: { key: Tab; labelKey: TranslationKeys }[] = [
  { key: 'copy', labelKey: 'com_execspeed_output_tab_copy' },
  { key: 'image', labelKey: 'com_execspeed_output_tab_image' },
  { key: 'usage', labelKey: 'com_execspeed_output_tab_usage' },
];

function UsageField({
  labelKey,
  valueKey,
}: {
  labelKey: TranslationKeys;
  valueKey: TranslationKeys;
}) {
  const localize = useLocalize();
  return (
    <div className="border-b border-border-light py-2.5 last:border-0">
      <div className="text-xs font-semibold text-text-secondary">{localize(labelKey)}</div>
      <div className="mt-0.5 text-sm text-text-primary">{localize(valueKey)}</div>
    </div>
  );
}

export default function PieceDetail({ piece }: { piece: KotlerResultPiece }) {
  const localize = useLocalize();
  const [tab, setTab] = useState<Tab>('copy');
  const catalog = getPieceCatalog(piece.piece_key);

  return (
    <section className="flex min-w-0 flex-1 flex-col px-6 py-5">
      <h2 className="text-xl font-bold text-text-primary">{piece.label}</h2>
      <div className="mt-3 flex gap-1.5">
        {TABS.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === key
                ? 'bg-surface-tertiary text-text-primary'
                : 'text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            {localize(labelKey)}
          </button>
        ))}
      </div>

      <div className="mt-4 min-w-0">
        {tab === 'copy' && (
          <MarkdownLite content={piece.copy_markdown ?? ''} codeExecution={false} />
        )}
        {tab === 'image' &&
          (piece.image_plan_markdown != null && piece.image_plan_markdown !== '' ? (
            <MarkdownLite content={piece.image_plan_markdown} codeExecution={false} />
          ) : (
            <p className="text-sm text-text-secondary">
              {localize('com_execspeed_output_no_image_plan')}
            </p>
          ))}
        {tab === 'usage' &&
          (catalog != null ? (
            <div>
              <UsageField
                labelKey="com_execspeed_output_usage_purpose"
                valueKey={catalog.purposeKey}
              />
              <UsageField
                labelKey="com_execspeed_output_usage_channel"
                valueKey={catalog.channelKey}
              />
              <UsageField labelKey="com_execspeed_output_usage_time" valueKey={catalog.timeKey} />
              <UsageField
                labelKey="com_execspeed_output_usage_signal"
                valueKey={catalog.signalKey}
              />
            </div>
          ) : (
            <p className="text-sm text-text-secondary">{localize('com_execspeed_output_empty')}</p>
          ))}
      </div>
    </section>
  );
}
