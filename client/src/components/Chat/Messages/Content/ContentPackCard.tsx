import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, CalendarDays } from 'lucide-react';
import type { KotlerResultPack, KotlerResultPiece } from 'librechat-data-provider';
import { STATUS_BADGES } from '~/components/ExecutionSpeed/constants';
import { useLocalize } from '~/hooks';
import { Text } from './Parts';
import Container from './Container';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('[ContentPackCard] clipboard write failed', err);
    }
  };
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleCopy();
      }}
      className="flex items-center gap-1 rounded-lg border border-border-light px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-green-500/60 hover:text-text-primary"
      aria-label={label}
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {label}
    </button>
  );
}

function PieceSection({
  piece,
  isCreatedByUser,
}: {
  piece: KotlerResultPiece;
  isCreatedByUser: boolean;
}) {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const [showImagePlan, setShowImagePlan] = useState(false);
  const badge = STATUS_BADGES[piece.production_status] ?? STATUS_BADGES.recommended;

  return (
    <div className="border-t border-border-light" id={`es-piece-${piece.piece_key}`}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-text-secondary" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-text-secondary" />
          )}
          <span className="text-sm font-medium text-text-primary">{piece.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
            {localize(badge.labelKey)}
          </span>
          {piece.placeholders.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {localize('com_execspeed_placeholders_count', { 0: piece.placeholders.length })}
            </span>
          )}
        </button>
        <span className="ml-auto flex gap-1.5">
          {piece.copy_markdown != null && (
            <CopyButton text={piece.copy_markdown} label={localize('com_execspeed_copy_text')} />
          )}
          {piece.image_plan_markdown != null && (
            <CopyButton
              text={piece.image_plan_markdown}
              label={localize('com_execspeed_copy_image_plan')}
            />
          )}
        </span>
      </div>

      {open && (
        <div className="px-4 pb-4 pl-10">
          {piece.error != null ? (
            <p className="text-sm text-red-500">{localize('com_execspeed_piece_failed')}</p>
          ) : (
            <>
              <Text
                text={piece.copy_markdown ?? ''}
                isCreatedByUser={isCreatedByUser}
                showCursor={false}
              />
              {piece.image_plan_markdown != null && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowImagePlan((v) => !v)}
                    className="text-xs text-text-secondary underline transition-colors hover:text-text-primary"
                  >
                    {showImagePlan
                      ? localize('com_execspeed_hide_image_plan')
                      : localize('com_execspeed_show_image_plan')}
                  </button>
                  {showImagePlan && (
                    <Text
                      text={piece.image_plan_markdown}
                      isCreatedByUser={isCreatedByUser}
                      showCursor={false}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 执行速内容包卡片:批量 job 完成后的结构化呈现(读 result_pack)。
 * 结构:判断头(含【待确认】计数)→ 作战表置顶 → 逐件手风琴 → 迭代提示。
 * 设计文档: LibreChat/docs/execution-speed-ui.design.md §5(Q7 ✅ ContentPackCard)
 */
export default function ContentPackCard({
  pack,
  isCreatedByUser,
}: {
  pack: KotlerResultPack;
  isCreatedByUser: boolean;
}) {
  const localize = useLocalize();
  const [battleOpen, setBattleOpen] = useState(true);
  const okPieces = pack.pieces.filter((p) => p.error == null);
  const placeholderTotal = pack.pieces.reduce((sum, p) => sum + p.placeholders.length, 0);

  return (
    <Container>
      <div className="my-2 overflow-hidden rounded-2xl border border-border-light bg-surface-primary">
        {/* 头部:判断 + 计数 */}
        <div className="flex flex-wrap items-start gap-2 border-b border-border-light bg-surface-secondary px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-text-primary">
                {localize('com_execspeed_pack_title')}
              </h3>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                {localize('com_execspeed_pack_count', { 0: okPieces.length })}
              </span>
            </div>
            {pack.verdict && <p className="mt-1 text-xs text-text-secondary">{pack.verdict}</p>}
          </div>
          {placeholderTotal > 0 && (
            <span className="rounded-full border border-amber-400/60 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              ⚠ {localize('com_execspeed_placeholders_count', { 0: placeholderTotal })}
            </span>
          )}
        </div>

        {/* 作战表置顶 */}
        {pack.battle_plan_markdown != null && (
          <div className="border-b border-border-light">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => setBattleOpen((v) => !v)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-expanded={battleOpen}
              >
                <CalendarDays className="h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm font-semibold text-text-primary">
                  {localize('com_execspeed_battle_plan')}
                </span>
              </button>
              <CopyButton
                text={pack.battle_plan_markdown}
                label={localize('com_execspeed_copy_text')}
              />
            </div>
            {battleOpen && (
              <div className="px-4 pb-4 pl-10">
                <Text
                  text={pack.battle_plan_markdown}
                  isCreatedByUser={isCreatedByUser}
                  showCursor={false}
                />
              </div>
            )}
          </div>
        )}

        {/* 逐件手风琴 */}
        {pack.pieces.map((piece) => (
          <PieceSection key={piece.piece_key} piece={piece} isCreatedByUser={isCreatedByUser} />
        ))}

        {/* 迭代提示 */}
        <div className="border-t border-border-light bg-surface-secondary px-4 py-2.5">
          <p className="text-xs text-text-secondary">{localize('com_execspeed_iterate_hint')}</p>
        </div>
      </div>
    </Container>
  );
}
