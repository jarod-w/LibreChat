import { request } from 'librechat-data-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';

/**
 * 档案文档摄入接口，经 LibreChat 后端代理（/api/kotler/profile/documents/*）访问
 * kotlerapi。上传走 multipart（request.postMultiPart 复用同一 axios 实例，自动带
 * Authorization）；其余走共享 request 实例。
 * 设计文档: nucleant kotlerapi/markdown/profile_document_ingestion.design.md §5.2
 */
const DOCS_BASE = '/api/kotler/profile/documents';

// ── Types ────────────────────────────────────────────────────────────

export type ProfileDocumentStatus = 'draft' | 'confirmed';

export type ProfileDocument = {
  id: number;
  brand_id: number;
  product_id: number | null;
  file_id: string;
  filename: string;
  bytes: number | null;
  content_type: string | null;
  sha256: string;
  storage_backend: string;
  storage_key: string;
  extracted_summary: string | null;
  status: ProfileDocumentStatus;
  uploaded_at: string;
  confirmed_at: string;
};

export type ExtractDocumentResult = ProfileDocument & {
  refine_ok: boolean;
  refine_error: string | null;
};

export type ExtractDocumentInput = {
  file: File;
  brandId: number;
  productId?: number | null;
};

export type ConfirmDocumentInput = {
  documentId: number;
  extractedSummary?: string | null;
};

// ── Query keys ───────────────────────────────────────────────────────

export const PROFILE_DOCUMENTS_KEY = 'profile-documents';

// ── Queries ──────────────────────────────────────────────────────────

export const useProfileDocumentsQuery = (
  brandId: number | null,
  config?: UseQueryOptions<ProfileDocument[]>,
) =>
  useQuery<ProfileDocument[]>(
    [PROFILE_DOCUMENTS_KEY, brandId],
    () => request.get<ProfileDocument[]>(`${DOCS_BASE}?brand_id=${brandId}`),
    { enabled: brandId != null, refetchOnWindowFocus: false, ...config },
  );

// ── Mutations ────────────────────────────────────────────────────────

export const useExtractDocumentMutation = (
  options?: UseMutationOptions<ExtractDocumentResult, Error, ExtractDocumentInput>,
) => {
  const queryClient = useQueryClient();
  return useMutation<ExtractDocumentResult, Error, ExtractDocumentInput>(
    ({ file, brandId, productId }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('brand_id', String(brandId));
      if (productId != null) {
        formData.append('product_id', String(productId));
      }
      return request.postMultiPart(`${DOCS_BASE}/extract`, formData) as Promise<ExtractDocumentResult>;
    },
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_DOCUMENTS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useConfirmDocumentMutation = (
  options?: UseMutationOptions<ProfileDocument, Error, ConfirmDocumentInput>,
) => {
  const queryClient = useQueryClient();
  return useMutation<ProfileDocument, Error, ConfirmDocumentInput>(
    ({ documentId, extractedSummary }) =>
      request.post(`${DOCS_BASE}/confirm`, {
        document_id: documentId,
        extracted_summary: extractedSummary,
      }) as Promise<ProfileDocument>,
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_DOCUMENTS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useDeleteDocumentMutation = (
  options?: UseMutationOptions<unknown, Error, number>,
) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, number>(
    (documentId) => request.delete(`${DOCS_BASE}/${documentId}`),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_DOCUMENTS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};
