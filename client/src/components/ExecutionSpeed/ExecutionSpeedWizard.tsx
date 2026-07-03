import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { Button, Spinner } from '@librechat/client';
import type { ExecutionSpeedPlan } from '~/data-provider/ExecutionSpeed';
import {
  useCreateExecutionSpeedPlanMutation,
  useConfirmExecutionSpeedPlanMutation,
} from '~/data-provider/ExecutionSpeed';
import {
  useProfileBrandsQuery,
  useProfileProductsQuery,
  useUpdateBrandMutation,
  useUpdateProductMutation,
} from '~/data-provider/Profile';
import { useLocalize } from '~/hooks';
import FactsStep from './FactsStep';
import PlanStep from './PlanStep';
import store from '~/store';

const STEPS = ['com_execspeed_step_facts', 'com_execspeed_step_plan'] as const;

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-200 ${
            i === current
              ? 'w-6 bg-green-500'
              : i < current
                ? 'w-4 bg-green-300'
                : 'w-4 bg-gray-200 dark:bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

/**
 * 执行速向导:填事实 → 系统推荐本轮方案 → 勾选 + 边界确认 → 落会话批量生成。
 * 设计文档: LibreChat/docs/execution-speed-ui.design.md §3–§5
 * 挂 Root children 下(带侧栏 chrome,✅ Q1);无档案引导去 /onboarding(✅ Q3);
 * 渠道/禁说编辑经 Profile mutation 回写档案(✅ Q4)。
 */
export default function ExecutionSpeedWizard() {
  const navigate = useNavigate();
  const localize = useLocalize();

  const [step, setStep] = useState(0);
  const [fieldError, setFieldError] = useState('');
  const [problem, setProblem] = useState('');
  const [eventNode, setEventNode] = useState('');
  const [channels, setChannels] = useState('');
  const [forbidden, setForbidden] = useState('');
  const [plan, setPlan] = useState<ExecutionSpeedPlan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [boundaryConfirmed, setBoundaryConfirmed] = useState(false);
  const [committing, setCommitting] = useState(false);

  const activeBrandId = useRecoilValue(store.activeBrandId);
  const activeProductId = useRecoilValue(store.activeProductId);
  const setActivePlanId = useSetRecoilState(store.activeExecutionSpeedPlanId);

  const { data: brands, isLoading: brandsLoading } = useProfileBrandsQuery();
  const brand = useMemo(() => {
    if (!brands?.length) {
      return null;
    }
    return (
      brands.find((b) => b.id === activeBrandId) ?? brands.find((b) => b.is_primary) ?? brands[0]
    );
  }, [brands, activeBrandId]);

  const { data: products } = useProfileProductsQuery(brand?.id ?? null);
  const product = useMemo(() => {
    if (!products?.length) {
      return null;
    }
    return (
      products.find((p) => p.id === activeProductId) ??
      products.find((p) => p.is_primary) ??
      products[0]
    );
  }, [products, activeProductId]);

  // 档案就绪后初始化可编辑草稿(仅在字段尚未被用户改动时)
  useEffect(() => {
    if (brand) {
      setForbidden((prev) => (prev === '' ? (brand.forbidden_expressions ?? '') : prev));
    }
  }, [brand]);
  useEffect(() => {
    if (product) {
      setChannels((prev) => (prev === '' ? (product.main_channels ?? []).join(', ') : prev));
    }
  }, [product]);

  const updateBrand = useUpdateBrandMutation();
  const updateProduct = useUpdateProductMutation();
  const createPlan = useCreateExecutionSpeedPlanMutation();
  const confirmPlan = useConfirmExecutionSpeedPlanMutation();

  const handleGeneratePlan = async () => {
    setFieldError('');
    if (!problem) {
      setFieldError(localize('com_execspeed_problem_required'));
      return;
    }
    try {
      // 回写档案(Q4):渠道/禁说改动先落档,kotlerapi /plan 读到的即最新档案
      const writebacks: Promise<unknown>[] = [];
      const channelList = channels
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (brand && forbidden !== (brand.forbidden_expressions ?? '')) {
        writebacks.push(
          updateBrand.mutateAsync({ brandId: brand.id, data: { forbidden_expressions: forbidden } }),
        );
      }
      if (product && channels !== (product.main_channels ?? []).join(', ')) {
        writebacks.push(
          updateProduct.mutateAsync({
            brandId: product.brand_profile_id,
            productId: product.id,
            data: { main_channels: channelList },
          }),
        );
      }
      await Promise.all(writebacks);

      const result = await createPlan.mutateAsync({
        current_problem: problem,
        facts: eventNode.trim() ? { event_node: eventNode.trim() } : undefined,
        brandId: brand?.id ?? null,
        productId: product?.id ?? null,
      });
      setPlan(result);
      setSelected(
        new Set(
          result.groups.flatMap((g) =>
            g.pieces.filter((p) => p.default_selected).map((p) => p.piece_key),
          ),
        ),
      );
      setBoundaryConfirmed(false);
      setStep(1);
    } catch (err) {
      setFieldError(localize('com_execspeed_plan_failed'));
      console.error('[ExecutionSpeed] create plan failed', err);
    }
  };

  const handleToggle = (pieceKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pieceKey)) {
        next.delete(pieceKey);
      } else {
        next.add(pieceKey);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!plan) {
      return;
    }
    setFieldError('');
    setCommitting(true);
    try {
      await confirmPlan.mutateAsync({
        plan_id: plan.plan_id,
        selected_piece_keys: Array.from(selected),
        boundary_confirmed: boundaryConfirmed,
      });
      // 落会话:置 plan 原子 → 到 /c/new,由 ExecutionSpeedAutoStart 自动发送种子消息
      setActivePlanId(plan.plan_id);
      navigate('/c/new');
    } catch (err) {
      setCommitting(false);
      setFieldError(localize('com_execspeed_confirm_failed'));
      console.error('[ExecutionSpeed] confirm plan failed', err);
    }
  };

  // ── 无档案守卫(✅ Q3):事实预填依赖档案,先去引导页 ──
  if (!brandsLoading && (!brands || brands.length === 0)) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border-light bg-surface-secondary p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold text-text-primary">
            {localize('com_execspeed_no_profile_title')}
          </h1>
          <p className="mb-6 text-sm text-text-secondary">
            {localize('com_execspeed_no_profile_desc')}
          </p>
          <Button
            type="button"
            variant="submit"
            onClick={() => navigate('/onboarding')}
            className="h-10 rounded-xl"
          >
            {localize('com_execspeed_no_profile_cta')}
          </Button>
        </div>
      </div>
    );
  }

  if (brandsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  const generating = createPlan.isLoading || updateBrand.isLoading || updateProduct.isLoading;

  return (
    <div className="h-full overflow-y-auto bg-surface-primary px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <StepIndicator current={step} total={2} />
          <button
            type="button"
            onClick={() => navigate('/c/new')}
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            {localize('com_ui_cancel')}
          </button>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-text-primary">
          {localize('com_execspeed_title')}
        </h1>
        <p className="mb-6 text-sm text-text-secondary">{localize('com_execspeed_subtitle')}</p>

        {/* Step tabs */}
        <div className="mb-6 flex gap-3 border-b border-border-light pb-3">
          {STEPS.map((k, i) => (
            <span
              key={k}
              className={`text-sm font-medium ${
                i === step ? 'text-green-500' : 'text-text-secondary'
              }`}
            >
              {localize(k)}
            </span>
          ))}
        </div>

        {/* Step content */}
        {step === 0 && brand && (
          <>
            <FactsStep
              brand={brand}
              product={product}
              problem={problem}
              onProblemChange={setProblem}
              eventNode={eventNode}
              onEventNodeChange={setEventNode}
              channels={channels}
              onChannelsChange={setChannels}
              forbidden={forbidden}
              onForbiddenChange={setForbidden}
              error={fieldError}
            />
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                variant="submit"
                onClick={handleGeneratePlan}
                disabled={generating}
                className="h-10 min-w-32 rounded-xl"
                data-testid="es-generate-plan"
              >
                {generating ? <Spinner /> : localize('com_execspeed_generate_plan')}
              </Button>
            </div>
          </>
        )}
        {step === 1 && plan && (
          <>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="mb-4 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              ← {localize('com_execspeed_back')}
            </button>
            <PlanStep
              plan={plan}
              selected={selected}
              onToggle={handleToggle}
              boundaryConfirmed={boundaryConfirmed}
              onBoundaryChange={setBoundaryConfirmed}
              onConfirm={handleConfirm}
              confirming={committing}
              error={fieldError}
            />
          </>
        )}
      </div>
    </div>
  );
}
