import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import { ArrowLeft, MessageSquareText } from 'lucide-react';
import type { KotlerJobProgress } from 'librechat-data-provider';
import type { ContextType } from '~/common';
import type { TranslationKeys } from '~/hooks';
import { useRoundData } from './useRoundData';
import PieceLibrary from './PieceLibrary';
import PieceDetail from './PieceDetail';
import UsagePanel from './UsagePanel';
import BattlePlan from './BattlePlan';
import { useLocalize } from '~/hooks';

function GeneratingState({ progress }: { progress: KotlerJobProgress | null }) {
  const localize = useLocalize();
  const hasProgress = progress != null && progress.total > 0;
  const pct = hasProgress ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <Spinner className="h-6 w-6 animate-spin text-text-primary" />
      <p className="text-sm text-text-secondary">
        {localize('com_execspeed_output_generating_title')}
      </p>
      {hasProgress && (
        <div className="flex w-full max-w-sm flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="font-medium tabular-nums">
              {progress.done}/{progress.total}
            </span>
            {progress.current_label != null && progress.current_label !== '' && (
              <span>
                · {localize('com_execspeed_generating')}: {progress.current_label}
              </span>
            )}
          </div>
          <span
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary"
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemax={progress.total}
          >
            <span
              className="block h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 执行速产出工作台整页(P0):三栏(产出件目录 / 正文·图片·使用说明 / 素材检查)+ 底部作战表。
 * 读同一份 result_pack;生成中显示进度;修订暂经"回会话"按钮(内嵌 ChatView 为 P0.5)。
 * 设计文档: LibreChat/docs/execution-speed-output-workspace.design.md §2 §5 §6
 */
export default function OutputWorkspace() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { conversationId = '' } = useParams();
  const { setNavVisible } = useOutletContext<ContextType>();

  useEffect(() => {
    setNavVisible(false);
  }, [setNavVisible]);

  const { status, resultPack, progress } = useRoundData(conversationId);
  const pieces = useMemo(() => resultPack?.pieces ?? [], [resultPack]);

  const [selectedKey, setSelectedKey] = useState('');
  useEffect(() => {
    if (selectedKey === '' && pieces.length > 0) {
      setSelectedKey(pieces[0]?.piece_key ?? '');
    }
  }, [pieces, selectedKey]);

  const selectedPiece = useMemo(
    () => pieces.find((piece) => piece.piece_key === selectedKey) ?? pieces[0],
    [pieces, selectedKey],
  );

  const header = (
    <header className="flex items-center gap-3 border-b border-border-light px-5 py-3">
      <button
        type="button"
        onClick={() => navigate('/c/new')}
        aria-label={localize('com_ui_back')}
        className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold text-text-primary">
          {localize('com_execspeed_pack_title')}
        </h1>
        {resultPack?.verdict != null && resultPack.verdict !== '' && (
          <p className="truncate text-xs text-text-secondary">{resultPack.verdict}</p>
        )}
      </div>
      {conversationId !== '' && (
        <button
          type="button"
          onClick={() => navigate(`/c/${conversationId}`)}
          className="flex items-center gap-1.5 rounded-full border border-border-light px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-secondary"
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          {localize('com_execspeed_output_revision_title')}
        </button>
      )}
    </header>
  );

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {header}
        <GeneratingState progress={progress} />
      </div>
    );
  }

  if (status !== 'done') {
    let messageKey: TranslationKeys = 'com_execspeed_output_empty';
    if (status === 'failed') {
      messageKey = 'com_kotler_job_failed';
    } else if (status === 'expired') {
      messageKey = 'com_kotler_job_expired';
    }
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {header}
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-text-secondary">
          {localize(messageKey)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {header}
      <div className="flex min-h-0 flex-1">
        <PieceLibrary
          pieces={pieces}
          selectedKey={selectedPiece?.piece_key ?? ''}
          onSelect={setSelectedKey}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {selectedPiece != null && <PieceDetail piece={selectedPiece} />}
          <BattlePlan markdown={resultPack?.battle_plan_markdown ?? null} />
        </div>
        {selectedPiece != null && <UsagePanel piece={selectedPiece} />}
      </div>
    </div>
  );
}
