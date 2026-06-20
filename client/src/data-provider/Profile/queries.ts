import { request } from 'librechat-data-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';

/**
 * 档案接口经 LibreChat 后端代理（/api/kotler/profile/*）访问 kotlerapi，
 * 不再由浏览器直连。代理在 requireJwtAuth 之后以 X-LibreChat-User-Id 携带当前
 * 登录用户身份，kotlerapi 据此按用户隔离数据。使用共享 request 实例自动带上
 * 当前会话的 Authorization 头并处理 token 刷新。
 */
const PROFILE_BASE = '/api/kotler/profile';

async function profileFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${PROFILE_BASE}${path}`;
  const method = (options?.method ?? 'GET').toUpperCase();
  const body = options?.body != null ? JSON.parse(options.body as string) : undefined;
  switch (method) {
    case 'POST':
      return request.post(url, body) as Promise<T>;
    case 'PUT':
      return request.put(url, body) as Promise<T>;
    case 'DELETE':
      return request.delete<T>(url);
    default:
      return request.get<T>(url);
  }
}

// ── Types ────────────────────────────────────────────────────────────

export type ProfileBrand = {
  id: number;
  brand_name: string | null;
  brand_tagline: string | null;
  brand_keywords: string[];
  forbidden_expressions: string | null;
  is_primary: boolean;
  products?: ProfileProduct[];
};

export type ProfileProduct = {
  id: number;
  brand_profile_id: number;
  product_name: string | null;
  target_customers: string | null;
  industry_mid: string | null;
  industry_minor: string[];
  store_region: string | null;
  business_district_type: string | null;
  sales_model: string[];
  business_stage: string | null;
  price_band: string | null;
  product_attributes: string[];
  marketing_pain_points: string | null;
  main_channels: string[];
  main_competitors: string | null;
  is_primary: boolean;
};

/** 行业三级分类树：{大类: {中类: [小类, ...]}} */
export type IndustryTaxonomy = Record<string, Record<string, string[]>>;

/** 行业大类 → 候选项数组（销售方式 / 产品属性）：{大类: [候选, ...]} */
export type IndustryOptionMap = Record<string, string[]>;

export type OnboardingPayload = {
  user?: {
    company_name?: string;
    industry_major?: string;
    contact_name?: string;
    job_title?: string;
  };
  brand?: {
    brand_name?: string;
    brand_tagline?: string;
    brand_keywords?: string[];
    forbidden_expressions?: string;
  };
  product?: {
    product_name?: string;
    target_customers?: string;
    industry_mid?: string;
    industry_minor?: string[];
    marketing_pain_points?: string;
    main_channels?: string[];
    main_competitors?: string;
  };
};

export type ProfileUser = {
  id: number;
  company_name: string | null;
  company_website: string | null;
  industry_major: string | null;
  contact_name: string | null;
  phone: string | null;
  job_title: string | null;
};

export type UserProfileInput = {
  company_name?: string | null;
  company_website?: string | null;
  industry_major?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  job_title?: string | null;
};

export type BrandInput = {
  brand_name?: string | null;
  brand_tagline?: string | null;
  brand_keywords?: string[];
  forbidden_expressions?: string | null;
  is_primary?: boolean;
};

export type ProductInput = {
  product_name?: string | null;
  target_customers?: string | null;
  industry_mid?: string | null;
  industry_minor?: string[];
  store_region?: string | null;
  business_district_type?: string | null;
  sales_model?: string[];
  business_stage?: string | null;
  price_band?: string | null;
  product_attributes?: string[];
  marketing_pain_points?: string | null;
  main_channels?: string[];
  social_links?: Record<string, string>;
  main_competitors?: string | null;
  is_primary?: boolean;
};

// ── Queries ──────────────────────────────────────────────────────────

export const PROFILE_USER_KEY = 'profile-user';
export const PROFILE_BRANDS_KEY = 'profile-brands';
export const PROFILE_PRODUCTS_KEY = 'profile-products';
export const INDUSTRY_TAXONOMY_KEY = 'industry-taxonomy';
export const SALES_MODEL_OPTIONS_KEY = 'sales-model-options';
export const PRODUCT_ATTRIBUTE_OPTIONS_KEY = 'product-attribute-options';

export const useIndustryTaxonomyQuery = (
  config?: UseQueryOptions<IndustryTaxonomy>,
) =>
  useQuery<IndustryTaxonomy>(
    [INDUSTRY_TAXONOMY_KEY],
    () => profileFetch<IndustryTaxonomy>('/industry-taxonomy'),
    { staleTime: Infinity, refetchOnWindowFocus: false, ...config },
  );

export const useSalesModelOptionsQuery = (
  config?: UseQueryOptions<IndustryOptionMap>,
) =>
  useQuery<IndustryOptionMap>(
    [SALES_MODEL_OPTIONS_KEY],
    () => profileFetch<IndustryOptionMap>('/sales-model-options'),
    { staleTime: Infinity, refetchOnWindowFocus: false, ...config },
  );

export const useProductAttributeOptionsQuery = (
  config?: UseQueryOptions<IndustryOptionMap>,
) =>
  useQuery<IndustryOptionMap>(
    [PRODUCT_ATTRIBUTE_OPTIONS_KEY],
    () => profileFetch<IndustryOptionMap>('/product-attribute-options'),
    { staleTime: Infinity, refetchOnWindowFocus: false, ...config },
  );

export const useProfileBrandsQuery = (
  config?: UseQueryOptions<ProfileBrand[]>,
) =>
  useQuery<ProfileBrand[]>(
    [PROFILE_BRANDS_KEY],
    () => profileFetch<ProfileBrand[]>('/brands'),
    { refetchOnWindowFocus: false, ...config },
  );

export const useProfileProductsQuery = (
  brandId: number | null,
  config?: UseQueryOptions<ProfileProduct[]>,
) =>
  useQuery<ProfileProduct[]>(
    [PROFILE_PRODUCTS_KEY, brandId],
    () => profileFetch<ProfileProduct[]>(`/brands/${brandId}/products`),
    { enabled: brandId != null, refetchOnWindowFocus: false, ...config },
  );

export const useProfileUserQuery = (config?: UseQueryOptions<ProfileUser | null>) =>
  useQuery<ProfileUser | null>(
    [PROFILE_USER_KEY],
    () => profileFetch<ProfileUser | null>('/user'),
    { retry: false, refetchOnWindowFocus: false, ...config },
  );

// ── Mutations ────────────────────────────────────────────────────────

export const useOnboardingMutation = (
  options?: UseMutationOptions<unknown, Error, OnboardingPayload>,
) =>
  useMutation<unknown, Error, OnboardingPayload>(
    (payload) =>
      profileFetch('/onboarding', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    options,
  );

export const useUpsertProfileUserMutation = (
  options?: UseMutationOptions<ProfileUser, Error, UserProfileInput>,
) => {
  const queryClient = useQueryClient();
  return useMutation<ProfileUser, Error, UserProfileInput>(
    (payload) =>
      profileFetch<ProfileUser>('/user', { method: 'PUT', body: JSON.stringify(payload) }),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_USER_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useCreateBrandMutation = (
  options?: UseMutationOptions<ProfileBrand, Error, BrandInput>,
) => {
  const queryClient = useQueryClient();
  return useMutation<ProfileBrand, Error, BrandInput>(
    (payload) =>
      profileFetch<ProfileBrand>('/brands', { method: 'POST', body: JSON.stringify(payload) }),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_BRANDS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useUpdateBrandMutation = (
  options?: UseMutationOptions<ProfileBrand, Error, { brandId: number; data: BrandInput }>,
) => {
  const queryClient = useQueryClient();
  return useMutation<ProfileBrand, Error, { brandId: number; data: BrandInput }>(
    ({ brandId, data }) =>
      profileFetch<ProfileBrand>(`/brands/${brandId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_BRANDS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useDeleteBrandMutation = (
  options?: UseMutationOptions<unknown, Error, number>,
) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, number>(
    (brandId) => profileFetch(`/brands/${brandId}`, { method: 'DELETE' }),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_BRANDS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useSetPrimaryBrandMutation = (
  options?: UseMutationOptions<unknown, Error, number>,
) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, number>(
    (brandId) => profileFetch(`/brands/${brandId}/set-primary`, { method: 'POST' }),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_BRANDS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useCreateProductMutation = (
  options?: UseMutationOptions<ProfileProduct, Error, { brandId: number; data: ProductInput }>,
) => {
  const queryClient = useQueryClient();
  return useMutation<ProfileProduct, Error, { brandId: number; data: ProductInput }>(
    ({ brandId, data }) =>
      profileFetch<ProfileProduct>(`/brands/${brandId}/products`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_PRODUCTS_KEY]);
        queryClient.invalidateQueries([PROFILE_BRANDS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useUpdateProductMutation = (
  options?: UseMutationOptions<
    ProfileProduct,
    Error,
    { brandId: number; productId: number; data: ProductInput }
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation<
    ProfileProduct,
    Error,
    { brandId: number; productId: number; data: ProductInput }
  >(
    ({ brandId, productId, data }) =>
      profileFetch<ProfileProduct>(`/brands/${brandId}/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_PRODUCTS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useDeleteProductMutation = (
  options?: UseMutationOptions<unknown, Error, { brandId: number; productId: number }>,
) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { brandId: number; productId: number }>(
    ({ brandId, productId }) =>
      profileFetch(`/brands/${brandId}/products/${productId}`, { method: 'DELETE' }),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_PRODUCTS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useSetPrimaryProductMutation = (
  options?: UseMutationOptions<
    unknown,
    Error,
    { brandId: number; productId: number; isPrimary: boolean }
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { brandId: number; productId: number; isPrimary: boolean }>(
    ({ brandId, productId, isPrimary }) =>
      profileFetch(`/brands/${brandId}/products/${productId}/set-primary`, {
        method: 'POST',
        body: JSON.stringify({ is_primary: isPrimary }),
      }),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([PROFILE_PRODUCTS_KEY]);
        options?.onSuccess?.(...args);
      },
    },
  );
};
