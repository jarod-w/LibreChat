import React, { useEffect, useState } from 'react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import type { UserProfileInput } from '~/data-provider/Profile';
import {
  useProfileUserQuery,
  useUpsertProfileUserMutation,
  useIndustryTaxonomyQuery,
} from '~/data-provider/Profile';
import { Field, SelectField } from '~/components/Onboarding/ProfileFields';
import BrandsSection from './BrandsSection';
import { useLocalize } from '~/hooks';

function Profile() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data: taxonomy } = useIndustryTaxonomyQuery();
  const { data: user, isLoading } = useProfileUserQuery();
  const tree = taxonomy ?? {};

  const [data, setData] = useState<UserProfileInput>({});

  useEffect(() => {
    if (user) {
      setData({
        company_name: user.company_name ?? '',
        industry_major: user.industry_major ?? '',
        contact_name: user.contact_name ?? '',
        phone: user.phone ?? '',
        job_title: user.job_title ?? '',
      });
    }
  }, [user]);

  const upsertUser = useUpsertProfileUserMutation({
    onSuccess: () => showToast({ message: localize('com_profile_saved') }),
    onError: () => showToast({ message: localize('com_profile_save_error'), status: 'error' }),
  });

  const set = (key: keyof UserProfileInput) => (v: string) => setData({ ...data, [key]: v });

  return (
    <div className="flex flex-col gap-6 p-1 text-text-primary">
      <p className="text-sm text-text-secondary">{localize('com_profile_description')}</p>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-text-primary">
          {localize('com_profile_company_section')}
        </h3>
        {isLoading ? (
          <Spinner className="m-2" />
        ) : (
          <>
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
              options={Object.keys(tree)}
              placeholder={localize('com_ui_select')}
            />
            <div className="grid grid-cols-2 gap-3">
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
            <Field
              id="phone"
              label={localize('com_profile_phone')}
              value={data.phone ?? ''}
              onChange={set('phone')}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="submit"
                onClick={() => upsertUser.mutate(data)}
                disabled={upsertUser.isLoading}
                className="h-9"
              >
                {upsertUser.isLoading ? <Spinner /> : localize('com_ui_save')}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border-light pt-4">
        <BrandsSection tree={tree} industryMajor={data.industry_major ?? ''} />
      </div>
    </div>
  );
}

export default React.memo(Profile);
