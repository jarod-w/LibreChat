import { useState } from 'react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import type { ProfileBrand, BrandInput, IndustryTaxonomy } from '~/data-provider/Profile';
import {
  useProfileBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
  useSetPrimaryBrandMutation,
} from '~/data-provider/Profile';
import { Field } from '~/components/Onboarding/ProfileFields';
import ProductsSection from './ProductsSection';
import { useLocalize } from '~/hooks';

function toInput(brand?: ProfileBrand): BrandInput {
  return {
    brand_name: brand?.brand_name ?? '',
    brand_tagline: brand?.brand_tagline ?? '',
    brand_keywords: brand?.brand_keywords ?? [],
    forbidden_expressions: brand?.forbidden_expressions ?? '',
  };
}

function BrandForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: BrandInput;
  saving: boolean;
  onSave: (data: BrandInput) => void;
  onCancel: () => void;
}) {
  const localize = useLocalize();
  const [data, setData] = useState<BrandInput>(initial);
  const [error, setError] = useState('');

  const set = (key: keyof BrandInput) => (v: string) => setData({ ...data, [key]: v });
  const setKeywords = (v: string) =>
    setData({ ...data, brand_keywords: v.split(',').map((s) => s.trim()).filter(Boolean) });

  const handleSave = () => {
    if (!data.brand_name?.trim()) {
      setError(localize('com_onboarding_brand_name_required'));
      return;
    }
    onSave(data);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-light p-3">
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
      />
      <Field
        id="forbidden_expressions"
        label={localize('com_onboarding_forbidden_expressions')}
        value={data.forbidden_expressions ?? ''}
        onChange={set('forbidden_expressions')}
        multiline
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="h-9">
          {localize('com_ui_cancel')}
        </Button>
        <Button type="button" variant="submit" onClick={handleSave} disabled={saving} className="h-9">
          {saving ? <Spinner /> : localize('com_ui_save')}
        </Button>
      </div>
    </div>
  );
}

export default function BrandsSection({
  tree,
  industryMajor,
}: {
  tree: IndustryTaxonomy;
  industryMajor: string;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data: brands = [], isLoading } = useProfileBrandsQuery({ enabled: true });
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const onError = () => showToast({ message: localize('com_profile_save_error'), status: 'error' });
  const onSaved = () => {
    showToast({ message: localize('com_profile_saved') });
    setEditingId(null);
  };

  const createBrand = useCreateBrandMutation({ onSuccess: onSaved, onError });
  const updateBrand = useUpdateBrandMutation({ onSuccess: onSaved, onError });
  const deleteBrand = useDeleteBrandMutation({
    onSuccess: () => {
      showToast({ message: localize('com_profile_saved') });
      setConfirmDeleteId(null);
    },
    onError,
  });
  const setPrimary = useSetPrimaryBrandMutation({ onError });

  const saving = createBrand.isLoading || updateBrand.isLoading;

  const handleSave = (data: BrandInput) => {
    if (editingId === 'new') {
      createBrand.mutate(data);
    } else if (typeof editingId === 'number') {
      updateBrand.mutate({ brandId: editingId, data });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">
          {localize('com_profile_brands_section')}
        </h3>
        {editingId == null && (
          <button
            type="button"
            onClick={() => setEditingId('new')}
            className="text-sm text-green-500 hover:underline"
          >
            + {localize('com_profile_add_brand')}
          </button>
        )}
      </div>

      {isLoading ? (
        <Spinner className="m-2" />
      ) : brands.length === 0 && editingId == null ? (
        <p className="text-sm text-text-secondary">{localize('com_ui_no_brands')}</p>
      ) : (
        brands.map((brand) =>
          editingId === brand.id ? (
            <BrandForm
              key={brand.id}
              initial={toInput(brand)}
              saving={saving}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={brand.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-tertiary">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === brand.id ? null : brand.id)}
                  className="flex-1 truncate text-left text-sm font-medium text-text-primary"
                >
                  {brand.brand_name ?? `#${brand.id}`}
                </button>
                {brand.is_primary && (
                  <span className="text-xs text-green-500">{localize('com_profile_primary')}</span>
                )}
                {!brand.is_primary && (
                  <button
                    type="button"
                    onClick={() => setPrimary.mutate(brand.id)}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    {localize('com_profile_set_primary')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingId(brand.id)}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  {localize('com_ui_edit')}
                </button>
                {confirmDeleteId === brand.id ? (
                  <button
                    type="button"
                    onClick={() => deleteBrand.mutate(brand.id)}
                    className="text-xs font-medium text-red-500 hover:underline"
                  >
                    {localize('com_profile_confirm_delete')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(brand.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    {localize('com_ui_delete')}
                  </button>
                )}
              </div>
              {expandedId === brand.id && (
                <ProductsSection brandId={brand.id} tree={tree} industryMajor={industryMajor} />
              )}
            </div>
          ),
        )
      )}

      {editingId === 'new' && (
        <BrandForm
          initial={toInput()}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
