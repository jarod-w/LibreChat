import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';

const kotlerapiBase = (): string =>
  import.meta.env.VITE_KOTLERAPI_BASE_URL ?? 'http://localhost:8000';

async function profileFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${kotlerapiBase()}/v1/profile${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`profile api ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
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
  industry_minor: string | null;
  marketing_pain_points: string | null;
  main_channels: string[];
  main_competitors: string | null;
  is_primary: boolean;
};

/** 行业三级分类树：{大类: {中类: [小类, ...]}} */
export type IndustryTaxonomy = Record<string, Record<string, string[]>>;

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
    industry_minor?: string;
    marketing_pain_points?: string;
    main_channels?: string[];
    main_competitors?: string;
  };
};

export type ProfileUser = {
  id: number;
  company_name: string | null;
  industry_major: string | null;
  contact_name: string | null;
  phone: string | null;
  job_title: string | null;
};

export type UserProfileInput = {
  company_name?: string | null;
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
  industry_minor?: string | null;
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

export const useIndustryTaxonomyQuery = (
  config?: UseQueryOptions<IndustryTaxonomy>,
) =>
  useQuery<IndustryTaxonomy>(
    [INDUSTRY_TAXONOMY_KEY],
    () => profileFetch<IndustryTaxonomy>('/industry-taxonomy'),
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
