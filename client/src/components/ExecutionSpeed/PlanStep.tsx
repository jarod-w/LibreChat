import { Button, Spinner } from '@librechat/client';
import type { ExecutionSpeedPlan, PlanPiece } from '~/data-provider/ExecutionSpeed';
import { STATUS_BADGES } from './constants';
import { useLocalize } from '~/hooks';

type PlanStepProps = {
  plan: ExecutionSpeedPlan;
  selected: Set<string>;
  onToggle: (pieceKey: string) => void;
  boundaryConfirmed: boolean;
  onBoundaryChange: (v: boolean) => void;
  onConfirm: () => void;
  confirming: boolean;
  error: string;
};

function PieceRow({
  piece,
  checked,
  onToggle,
}: {
  piece: PlanPiece;
  checked: boolean;
  onToggle: () => void;
}) {
  const localize = useLocalize();
  const badge = STATUS_BADGES[piece.production_status] ?? STATUS_BADGES.recommended;
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-light bg-surface-primary p-3 transition-colors hover:border-green-500/50"
      data-testid={`es-piece-${piece.piece_key}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 accent-green-600"
        aria-label={piece.piece_label}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{piece.piece_label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
            {localize(badge.labelKey)}
          </span>
        </span>
        <span className="text-xs text-text-secondary">
          {piece.condition_hint ?? piece.reason}
        </span>
      </span>
    </label>
  );
}

function BoundaryConfirm({
  plan,
  confirmed,
  onChange,
}: {
  plan: ExecutionSpeedPlan;
  confirmed: boolean;
  onChange: (v: boolean) => void;
}) {
  const localize = useLocalize();
  const { boundary } = plan;
  return (
    <div className="rounded-xl border border-amber-400/50 bg-surface-primary p-4">
      <h3 className="mb-2 text-sm font-semibold text-text-primary">
        {localize('com_execspeed_boundary_title')}
      </h3>
      <div className="mb-3 flex flex-col gap-2 text-xs text-text-secondary">
        <p>
          <span className="font-medium text-text-primary">
            {localize('com_execspeed_boundary_forbidden')}:
          </span>{' '}
          {boundary.forbidden.join('; ')}
        </p>
        <p>
          <span className="font-medium text-text-primary">
            {localize('com_execspeed_boundary_cautious')}:
          </span>{' '}
          {boundary.cautious.join('; ')}
        </p>
        <p>
          <span className="font-medium text-text-primary">
            {localize('com_execspeed_boundary_guarantee')}:
          </span>{' '}
          {boundary.guarantee}
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-surface-secondary p-2.5">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-green-600"
          data-testid="es-boundary-confirm"
        />
        <span className="text-xs text-text-secondary">
          {localize('com_execspeed_boundary_confirm_label')}
        </span>
      </label>
    </div>
  );
}

/** Step 2 · 确认本轮方案:判断条 + 分组勾选清单 + 表达边界确认 + 侧栏计数 */
export default function PlanStep({
  plan,
  selected,
  onToggle,
  boundaryConfirmed,
  onBoundaryChange,
  onConfirm,
  confirming,
  error,
}: PlanStepProps) {
  const localize = useLocalize();
  const count = selected.size;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* 判断条 */}
        <div className="rounded-xl border-l-4 border-green-600 bg-surface-primary p-4">
          <p className="text-sm font-semibold text-text-primary">{plan.verdict.lead}</p>
          <p className="mt-1 text-xs text-text-secondary">{plan.verdict.why}</p>
        </div>

        {/* 分组清单 */}
        {plan.groups.map((group) => (
          <div key={group.funnel} className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
              {group.funnel_label}
            </h3>
            {group.pieces.map((piece) => (
              <PieceRow
                key={piece.piece_key}
                piece={piece}
                checked={selected.has(piece.piece_key)}
                onToggle={() => onToggle(piece.piece_key)}
              />
            ))}
          </div>
        ))}

        <BoundaryConfirm plan={plan} confirmed={boundaryConfirmed} onChange={onBoundaryChange} />
      </div>

      {/* 侧栏:计数 + 确认 */}
      <div className="flex flex-col gap-3 rounded-xl border border-border-light bg-surface-primary p-4 md:sticky md:top-4 md:w-56 md:flex-shrink-0">
        <div>
          <div className="text-2xl font-bold text-text-primary">{count}</div>
          <div className="text-xs text-text-secondary">
            {localize('com_execspeed_selected_count')}
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button
          type="button"
          variant="submit"
          onClick={onConfirm}
          disabled={confirming || count === 0 || !boundaryConfirmed}
          className="h-10 rounded-xl"
          data-testid="es-confirm-generate"
        >
          {confirming ? <Spinner /> : localize('com_execspeed_confirm_generate')}
        </Button>
        <p className="text-[11px] leading-relaxed text-text-secondary">
          {localize('com_execspeed_confirm_note')}
        </p>
      </div>
    </div>
  );
}
