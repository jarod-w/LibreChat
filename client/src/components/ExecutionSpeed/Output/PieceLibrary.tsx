import type { KotlerResultPiece } from 'librechat-data-provider';
import type { Funnel } from './catalog';
import { FUNNEL_ORDER, FUNNEL_LABEL_KEYS, getPieceFunnel } from './catalog';
import { useLocalize } from '~/hooks';

type PieceStatus = 'done' | 'pending' | 'failed';

function pieceStatus(piece: KotlerResultPiece): PieceStatus {
  if (piece.error != null) {
    return 'failed';
  }
  if (piece.placeholders.length > 0) {
    return 'pending';
  }
  return 'done';
}

function groupByFunnel(pieces: KotlerResultPiece[]): Map<Funnel, KotlerResultPiece[]> {
  const grouped = new Map<Funnel, KotlerResultPiece[]>();
  for (const funnel of FUNNEL_ORDER) {
    grouped.set(funnel, []);
  }
  for (const piece of pieces) {
    grouped.get(getPieceFunnel(piece.piece_key))?.push(piece);
  }
  return grouped;
}

export default function PieceLibrary({
  pieces,
  selectedKey,
  onSelect,
}: {
  pieces: KotlerResultPiece[];
  selectedKey: string;
  onSelect: (pieceKey: string) => void;
}) {
  const localize = useLocalize();
  const grouped = groupByFunnel(pieces);

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-border-light bg-surface-primary">
      <div className="border-b border-border-light px-4 py-3">
        <h2 className="text-sm font-bold text-text-primary">
          {localize('com_execspeed_output_library_title')}
        </h2>
      </div>
      {FUNNEL_ORDER.map((funnel) => {
        const items = grouped.get(funnel) ?? [];
        if (items.length === 0) {
          return null;
        }
        return (
          <div key={funnel} className="px-2 py-2">
            <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              {localize(FUNNEL_LABEL_KEYS[funnel])}
            </div>
            {items.map((piece) => {
              const active = piece.piece_key === selectedKey;
              const status = pieceStatus(piece);
              return (
                <button
                  key={piece.piece_key}
                  type="button"
                  onClick={() => onSelect(piece.piece_key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-surface-tertiary font-semibold text-text-primary'
                      : 'text-text-secondary hover:bg-surface-secondary'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{piece.label}</span>
                  {status === 'done' && (
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      {localize('com_execspeed_output_status_done')}
                    </span>
                  )}
                  {status === 'pending' && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {localize('com_execspeed_output_status_pending')}
                    </span>
                  )}
                  {status === 'failed' && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                      aria-label={localize('com_execspeed_piece_failed')}
                    />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
