import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { KotlerResultPiece } from 'librechat-data-provider';
import { getPieceCatalog } from './catalog';
import { useLocalize } from '~/hooks';

export default function UsagePanel({ piece }: { piece: KotlerResultPiece }) {
  const localize = useLocalize();
  const catalog = getPieceCatalog(piece.piece_key);
  const placeholderCount = piece.placeholders.length;

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-border-light bg-surface-primary px-4 py-4">
      <h3 className="text-sm font-bold text-text-primary">
        {localize('com_execspeed_output_material_check')}
      </h3>

      <div className="mt-3 space-y-2">
        {catalog != null && (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span className="text-text-secondary">
              <span className="font-semibold text-text-primary">
                {localize('com_execspeed_output_material_missing')}:{' '}
              </span>
              {localize(catalog.materialKey)}
            </span>
          </div>
        )}
        {placeholderCount > 0 ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span className="text-text-secondary">
              {localize('com_execspeed_placeholders_count', { 0: placeholderCount })}
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <span className="text-text-secondary">
              {localize('com_execspeed_output_status_done')}
            </span>
          </div>
        )}
      </div>

      {catalog != null && (
        <>
          <h3 className="mt-6 text-sm font-bold text-text-primary">
            {localize('com_execspeed_output_usage_title')}
          </h3>
          <dl className="mt-2">
            <div className="border-b border-border-light py-2 last:border-0">
              <dt className="text-xs font-semibold text-text-secondary">
                {localize('com_execspeed_output_usage_channel')}
              </dt>
              <dd className="mt-0.5 text-sm text-text-primary">{localize(catalog.channelKey)}</dd>
            </div>
            <div className="border-b border-border-light py-2 last:border-0">
              <dt className="text-xs font-semibold text-text-secondary">
                {localize('com_execspeed_output_usage_time')}
              </dt>
              <dd className="mt-0.5 text-sm text-text-primary">{localize(catalog.timeKey)}</dd>
            </div>
            <div className="border-b border-border-light py-2 last:border-0">
              <dt className="text-xs font-semibold text-text-secondary">
                {localize('com_execspeed_output_usage_signal')}
              </dt>
              <dd className="mt-0.5 text-sm text-text-primary">{localize(catalog.signalKey)}</dd>
            </div>
          </dl>
        </>
      )}
    </aside>
  );
}
