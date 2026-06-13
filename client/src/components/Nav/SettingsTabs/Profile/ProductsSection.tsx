import { useEffect, useState } from 'react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import type { ProfileProduct, ProductInput, IndustryTaxonomy } from '~/data-provider/Profile';
import {
  useProfileProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useSetPrimaryProductMutation,
} from '~/data-provider/Profile';
import { Field, SelectField } from '~/components/Onboarding/ProfileFields';
import { useLocalize } from '~/hooks';

function toInput(product?: ProfileProduct): ProductInput {
  return {
    product_name: product?.product_name ?? '',
    target_customers: product?.target_customers ?? '',
    industry_mid: product?.industry_mid ?? '',
    industry_minor: product?.industry_minor ?? '',
    marketing_pain_points: product?.marketing_pain_points ?? '',
    main_channels: product?.main_channels ?? [],
    main_competitors: product?.main_competitors ?? '',
  };
}

function ProductForm({
  initial,
  tree,
  industryMajor,
  saving,
  onSave,
  onCancel,
}: {
  initial: ProductInput;
  tree: IndustryTaxonomy;
  industryMajor: string;
  saving: boolean;
  onSave: (data: ProductInput) => void;
  onCancel: () => void;
}) {
  const localize = useLocalize();
  const [data, setData] = useState<ProductInput>(initial);
  const [error, setError] = useState('');

  const set = (key: keyof ProductInput) => (v: string) => setData({ ...data, [key]: v });
  const setChannels = (v: string) =>
    setData({ ...data, main_channels: v.split(',').map((s) => s.trim()).filter(Boolean) });
  const setMid = (v: string) => setData({ ...data, industry_mid: v, industry_minor: '' });

  const midOptions = industryMajor ? Object.keys(tree[industryMajor] ?? {}) : [];
  const minorOptions =
    industryMajor && data.industry_mid ? tree[industryMajor]?.[data.industry_mid] ?? [] : [];

  const handleSave = () => {
    if (!data.product_name?.trim()) {
      setError(localize('com_onboarding_product_name_required'));
      return;
    }
    onSave(data);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-light p-3">
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
      />
      <div className="grid grid-cols-2 gap-3">
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
          value={data.industry_minor ?? ''}
          onChange={set('industry_minor')}
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
      />
      <Field
        id="main_competitors"
        label={localize('com_onboarding_main_competitors')}
        value={data.main_competitors ?? ''}
        onChange={set('main_competitors')}
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

export default function ProductsSection({
  brandId,
  tree,
  industryMajor,
  autoNew = false,
  onAutoNewConsumed,
}: {
  brandId: number;
  tree: IndustryTaxonomy;
  industryMajor: string;
  autoNew?: boolean;
  onAutoNewConsumed?: () => void;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data: products = [], isLoading } = useProfileProductsQuery(brandId);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (!autoNew) {
      return;
    }
    setEditingId('new');
    onAutoNewConsumed?.();
  }, [autoNew, onAutoNewConsumed]);

  const onError = () => showToast({ message: localize('com_profile_save_error'), status: 'error' });
  const onSaved = () => {
    showToast({ message: localize('com_profile_saved') });
    setEditingId(null);
  };

  const createProduct = useCreateProductMutation({ onSuccess: onSaved, onError });
  const updateProduct = useUpdateProductMutation({ onSuccess: onSaved, onError });
  const deleteProduct = useDeleteProductMutation({
    onSuccess: () => {
      showToast({ message: localize('com_profile_saved') });
      setConfirmDeleteId(null);
    },
    onError,
  });
  const setPrimary = useSetPrimaryProductMutation({ onError });

  const saving = createProduct.isLoading || updateProduct.isLoading;

  const handleSave = (data: ProductInput) => {
    if (editingId === 'new') {
      createProduct.mutate({ brandId, data });
    } else if (typeof editingId === 'number') {
      updateProduct.mutate({ brandId, productId: editingId, data });
    }
  };

  return (
    <div className="ml-3 flex flex-col gap-2 border-l border-border-light pl-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-text-secondary">
          {localize('com_profile_products_section')}
        </span>
        {editingId == null && (
          <button
            type="button"
            onClick={() => setEditingId('new')}
            className="text-xs text-green-500 hover:underline"
          >
            + {localize('com_profile_add_product')}
          </button>
        )}
      </div>

      {isLoading ? (
        <Spinner className="m-2" />
      ) : products.length === 0 && editingId == null ? (
        <p className="px-1 py-1 text-xs text-text-secondary">{localize('com_ui_no_products')}</p>
      ) : (
        products.map((product) =>
          editingId === product.id ? (
            <ProductForm
              key={product.id}
              initial={toInput(product)}
              tree={tree}
              industryMajor={industryMajor}
              saving={saving}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={product.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-tertiary"
            >
              <span className="flex-1 truncate text-sm text-text-primary">
                {product.product_name ?? `#${product.id}`}
              </span>
              {product.is_primary && (
                <span className="text-xs text-green-500">{localize('com_profile_primary')}</span>
              )}
              {!product.is_primary && (
                <button
                  type="button"
                  onClick={() => setPrimary.mutate({ brandId, productId: product.id })}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  {localize('com_profile_set_primary')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingId(product.id)}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                {localize('com_ui_edit')}
              </button>
              {confirmDeleteId === product.id ? (
                <button
                  type="button"
                  onClick={() => deleteProduct.mutate({ brandId, productId: product.id })}
                  className="text-xs font-medium text-red-500 hover:underline"
                >
                  {localize('com_profile_confirm_delete')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(product.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  {localize('com_ui_delete')}
                </button>
              )}
            </div>
          ),
        )
      )}

      {editingId === 'new' && (
        <ProductForm
          initial={toInput()}
          tree={tree}
          industryMajor={industryMajor}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
