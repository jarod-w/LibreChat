import { useMutation, useQuery } from '@tanstack/react-query';
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

// ── Queries ──────────────────────────────────────────────────────────

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
