import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useOnboardingMutation, useIndustryTaxonomyQuery } from '~/data-provider/Profile';
import type { OnboardingPayload, IndustryTaxonomy } from '~/data-provider/Profile';
import { Field, SelectField } from './ProfileFields';

type UserData = NonNullable<OnboardingPayload['user']>;
type BrandData = NonNullable<OnboardingPayload['brand']>;
type ProductData = NonNullable<OnboardingPayload['product']>;

const STEPS = ['com_onboarding_step1', 'com_onboarding_step2', 'com_onboarding_step3'] as const;

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-200 ${
            i === current ? 'w-6 bg-green-500' : i < current ? 'w-4 bg-green-300' : 'w-4 bg-gray-200 dark:bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

function UserStep({
  data,
  onChange,
  tree,
}: {
  data: UserData;
  onChange: (d: UserData) => void;
  tree: IndustryTaxonomy;
}) {
  const localize = useLocalize();
  const set = (key: keyof UserData) => (v: string) => onChange({ ...data, [key]: v });
  const majorOptions = Object.keys(tree);
  return (
    <div className="flex flex-col gap-4">
      <Field
        id="company_name"
        label={localize('com_onboarding_company_name')}
        value={data.company_name ?? ''}
        onChange={set('company_name')}
      />
      <SelectField
        id="industry_major"
        label={localize('com_onboarding_industry_major')}
        value={data.industry_major ?? ''}
        onChange={set('industry_major')}
        options={majorOptions}
        placeholder={localize('com_ui_select')}
      />
      <Field
        id="contact_name"
        label={localize('com_onboarding_contact_name')}
        value={data.contact_name ?? ''}
        onChange={set('contact_name')}
      />
      <Field
        id="job_title"
        label={localize('com_onboarding_job_title')}
        value={data.job_title ?? ''}
        onChange={set('job_title')}
      />
    </div>
  );
}

function BrandStep({
  data,
  onChange,
  error,
}: {
  data: BrandData;
  onChange: (d: BrandData) => void;
  error: string;
}) {
  const localize = useLocalize();
  const set = (key: keyof BrandData) => (v: string) => onChange({ ...data, [key]: v });
  const setKeywords = (v: string) =>
    onChange({ ...data, brand_keywords: v.split(',').map((s) => s.trim()).filter(Boolean) });

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Field
        id="brand_name"
        label={`${localize('com_onboarding_brand_name')} *`}
        value={data.brand_name ?? ''}
        onChange={set('brand_name')}
      />
      <Field
        id="brand_tagline"
        label={localize('com_onboarding_brand_tagline')}
        value={data.brand_tagline ?? ''}
        onChange={set('brand_tagline')}
      />
      <Field
        id="brand_keywords"
        label={localize('com_onboarding_brand_keywords')}
        value={(data.brand_keywords ?? []).join(', ')}
        onChange={setKeywords}
        placeholder="e.g. AI, Marketing, SaaS"
      />
      <Field
        id="forbidden_expressions"
        label={localize('com_onboarding_forbidden_expressions')}
        value={data.forbidden_expressions ?? ''}
        onChange={set('forbidden_expressions')}
        multiline
        placeholder="e.g. No absolute claims like 'best' or 'cheapest'"
      />
    </div>
  );
}

function ProductStep({
  data,
  onChange,
  error,
  tree,
  industryMajor,
}: {
  data: ProductData;
  onChange: (d: ProductData) => void;
  error: string;
  tree: IndustryTaxonomy;
  industryMajor: string;
}) {
  const localize = useLocalize();
  const set = (key: keyof ProductData) => (v: string) => onChange({ ...data, [key]: v });
  const setChannels = (v: string) =>
    onChange({ ...data, main_channels: v.split(',').map((s) => s.trim()).filter(Boolean) });
  const midOptions = industryMajor ? Object.keys(tree[industryMajor] ?? {}) : [];
  const minorOptions =
    industryMajor && data.industry_mid ? tree[industryMajor]?.[data.industry_mid] ?? [] : [];
  const setMid = (v: string) => onChange({ ...data, industry_mid: v, industry_minor: [] });
  // 引导页保持小类单选（轻量），提交时包装为数组以匹配后端 TEXT[]（首元素=主营）
  const setMinor = (v: string) => onChange({ ...data, industry_minor: v ? [v] : [] });

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Field
        id="product_name"
        label={`${localize('com_onboarding_product_name')} *`}
        value={data.product_name ?? ''}
        onChange={set('product_name')}
      />
      <Field
        id="target_customers"
        label={localize('com_onboarding_target_customers')}
        value={data.target_customers ?? ''}
        onChange={set('target_customers')}
        placeholder="e.g. SME owners, brand managers"
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          id="industry_mid"
          label={localize('com_onboarding_industry_mid')}
          value={data.industry_mid ?? ''}
          onChange={setMid}
          options={midOptions}
          disabled={midOptions.length === 0}
          placeholder={localize('com_ui_select')}
        />
        <SelectField
          id="industry_minor"
          label={localize('com_onboarding_industry_minor')}
          value={data.industry_minor?.[0] ?? ''}
          onChange={setMinor}
          options={minorOptions}
          disabled={minorOptions.length === 0}
          placeholder={localize('com_ui_select')}
        />
      </div>
      <Field
        id="marketing_pain_points"
        label={localize('com_onboarding_marketing_pain_points')}
        value={data.marketing_pain_points ?? ''}
        onChange={set('marketing_pain_points')}
        multiline
      />
      <Field
        id="main_channels"
        label={localize('com_onboarding_main_channels')}
        value={(data.main_channels ?? []).join(', ')}
        onChange={setChannels}
        placeholder="e.g. TikTok, WeChat"
      />
      <Field
        id="main_competitors"
        label={localize('com_onboarding_main_competitors')}
        value={data.main_competitors ?? ''}
        onChange={set('main_competitors')}
      />
    </div>
  );
}

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const localize = useLocalize();
  const [step, setStep] = useState(0);
  const [fieldError, setFieldError] = useState('');

  const [userData, setUserData] = useState<UserData>({});
  const [brandData, setBrandData] = useState<BrandData>({});
  const [productData, setProductData] = useState<ProductData>({});
  const [userFilled, setUserFilled] = useState(false);
  const [brandFilled, setBrandFilled] = useState(false);

  const { data: taxonomy } = useIndustryTaxonomyQuery();
  const tree = taxonomy ?? {};

  const handleUserChange = (d: UserData) => {
    if (d.industry_major !== userData.industry_major) {
      setProductData((p) => ({ ...p, industry_mid: '', industry_minor: [] }));
    }
    setUserData(d);
  };

  const onboarding = useOnboardingMutation({
    onSuccess: () => navigate('/c/new', { replace: true }),
    onError: () => navigate('/c/new', { replace: true }),
  });

  const finish = (includeProduct: boolean) => {
    const payload: OnboardingPayload = {};
    if (userFilled) payload.user = userData;
    if (brandFilled) payload.brand = brandData;
    if (includeProduct) payload.product = productData;
    if (Object.keys(payload).length > 0) {
      onboarding.mutate(payload);
    } else {
      navigate('/c/new', { replace: true });
    }
  };

  const handleNext = () => {
    setFieldError('');
    if (step === 0) {
      const hasAny = Object.values(userData).some((v) => v && String(v).trim());
      setUserFilled(Boolean(hasAny));
      setStep(1);
    } else if (step === 1) {
      if (brandData.brand_name?.trim()) {
        setBrandFilled(true);
        setStep(2);
      } else {
        setFieldError(localize('com_onboarding_brand_name_required'));
      }
    } else {
      if (productData.product_name?.trim()) {
        finish(true);
      } else {
        setFieldError(localize('com_onboarding_product_name_required'));
      }
    }
  };

  const handleSkip = () => {
    setFieldError('');
    if (step === 0) {
      setUserFilled(false);
      setStep(1);
    } else if (step === 1) {
      setBrandFilled(false);
      setStep(2);
    } else {
      finish(false);
    }
  };

  const stepLabels = STEPS.map((k) => localize(k));
  const isLast = step === 2;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border-light bg-surface-secondary p-8 shadow-sm">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <StepIndicator current={step} total={3} />
          <button
            type="button"
            onClick={() => navigate('/c/new', { replace: true })}
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            aria-label={localize('com_onboarding_skip_all')}
          >
            {localize('com_onboarding_skip_all')}
          </button>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-text-primary">
          {localize('com_onboarding_title')}
        </h1>
        <p className="mb-6 text-sm text-text-secondary">
          {localize('com_onboarding_subtitle')}
        </p>

        {/* Step tabs */}
        <div className="mb-6 flex gap-3 border-b border-border-light pb-3">
          {stepLabels.map((label, i) => (
            <span
              key={i}
              className={`text-sm font-medium ${
                i === step ? 'text-green-500' : 'text-text-secondary'
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Step content */}
        <div className="mb-8">
          {step === 0 && <UserStep data={userData} onChange={handleUserChange} tree={tree} />}
          {step === 1 && (
            <BrandStep data={brandData} onChange={setBrandData} error={fieldError} />
          )}
          {step === 2 && (
            <ProductStep
              data={productData}
              onChange={setProductData}
              error={fieldError}
              tree={tree}
              industryMajor={userData.industry_major ?? ''}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            aria-label={localize('com_onboarding_skip_step')}
          >
            {localize('com_onboarding_skip_step')}
          </button>
          <Button
            type="button"
            variant="submit"
            onClick={handleNext}
            disabled={onboarding.isLoading}
            className="h-10 min-w-24 rounded-xl"
            aria-label={isLast ? localize('com_onboarding_complete') : localize('com_onboarding_next')}
          >
            {onboarding.isLoading ? (
              <Spinner />
            ) : isLast ? (
              localize('com_onboarding_complete')
            ) : (
              localize('com_onboarding_next')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
