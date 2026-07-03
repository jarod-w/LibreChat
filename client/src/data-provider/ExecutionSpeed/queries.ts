import { request } from 'librechat-data-provider';
import { useMutation } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';

/**
 * 执行速接口经 LibreChat 后端代理(/api/kotler/execution-speed/*)访问 kotlerapi。
 * brandId/productId 放 body,由代理提升为 X-Brand-Id / X-Product-Id header。
 * 设计文档: LibreChat/docs/execution-speed-ui.design.md §4
 *          kotlerapi/markdown/execution_speed_plan.design.md §4.1 §4.2
 */
const ES_BASE = '/api/kotler/execution-speed';

// ── Types(对齐 kotlerapi 契约)────────────────────────────────────

export type PlanPiece = {
  piece_key: string;
  piece_label: string;
  agent: string;
  route_params: Record<string, string>;
  production_status: 'recommended' | 'conditional' | 'gated' | 'sample_only';
  default_selected: boolean;
  reason: string;
  condition_hint: string | null;
};

export type PlanGroup = {
  funnel: 'acquisition' | 'conversion' | 'retention_referral';
  funnel_label: string;
  pieces: PlanPiece[];
};

export type PlanBoundary = {
  forbidden: string[];
  cautious: string[];
  guarantee: string;
  source: string;
};

export type ExecutionSpeedPlan = {
  plan_id: string;
  verdict: { lead: string; why: string };
  groups: PlanGroup[];
  boundary: PlanBoundary;
};

export type CreatePlanInput = {
  current_problem: string;
  facts?: Record<string, unknown>;
  brandId?: number | null;
  productId?: number | null;
};

export type ConfirmPlanInput = {
  plan_id: string;
  selected_piece_keys: string[];
  boundary_confirmed: boolean;
};

export type ConfirmPlanResponse = {
  plan_id: string;
  status: 'confirmed';
  selected_count: number;
};

// ── Mutations ────────────────────────────────────────────────────

export const useCreateExecutionSpeedPlanMutation = (
  options?: UseMutationOptions<ExecutionSpeedPlan, Error, CreatePlanInput>,
) =>
  useMutation<ExecutionSpeedPlan, Error, CreatePlanInput>(
    (payload) => request.post(`${ES_BASE}/plan`, payload) as Promise<ExecutionSpeedPlan>,
    options,
  );

export const useConfirmExecutionSpeedPlanMutation = (
  options?: UseMutationOptions<ConfirmPlanResponse, Error, ConfirmPlanInput>,
) =>
  useMutation<ConfirmPlanResponse, Error, ConfirmPlanInput>(
    ({ plan_id, ...payload }) =>
      request.post(
        `${ES_BASE}/plan/${encodeURIComponent(plan_id)}/confirm`,
        payload,
      ) as Promise<ConfirmPlanResponse>,
    options,
  );
