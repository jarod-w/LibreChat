import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilState } from 'recoil';
import { useLocalize } from '~/hooks';
import { useProfileBrandsQuery, useProfileProductsQuery } from '~/data-provider/Profile';
import type { ProfileBrand, ProfileProduct } from '~/data-provider/Profile';
import brandProductStore from '~/store/brandProduct';

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? 'h-3.5 w-3.5'}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function BrandProductSelector() {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || buttonRef.current == null) {
      return;
    }
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuPos({ top: rect.bottom + 4, left: rect.left });
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const [activeBrandId, setActiveBrandId] = useRecoilState(brandProductStore.activeBrandId);
  const [activeBrandName, setActiveBrandName] = useRecoilState(brandProductStore.activeBrandName);
  const [activeProductId, setActiveProductId] = useRecoilState(brandProductStore.activeProductId);
  const [activeProductName, setActiveProductName] = useRecoilState(
    brandProductStore.activeProductName,
  );

  // 始终拉取当前登录用户的品牌/产品：既用于渲染正确的标签，也用于校正
  // localStorage 里残留的、属于上一个用户的选择（跨用户串档 bug）。
  const { data: brands = [], isSuccess: brandsLoaded } = useProfileBrandsQuery();
  const { data: products = [], isSuccess: productsLoaded } = useProfileProductsQuery(
    activeBrandId,
    { enabled: activeBrandId != null },
  );

  // 品牌校正：持久化的 activeBrandId 必须属于当前用户，否则回退到主品牌/首个品牌。
  useEffect(() => {
    if (!brandsLoaded) {
      return;
    }
    if (brands.length === 0) {
      if (activeBrandId != null) {
        setActiveBrandId(null);
        setActiveBrandName(null);
        setActiveProductId(null);
        setActiveProductName(null);
      }
      return;
    }
    const current = brands.find((b) => b.id === activeBrandId);
    if (current == null) {
      const fallback = brands.find((b) => b.is_primary) ?? brands[0];
      setActiveBrandId(fallback.id);
      setActiveBrandName(fallback.brand_name ?? String(fallback.id));
      setActiveProductId(null);
      setActiveProductName(null);
    } else if (current.brand_name && current.brand_name !== activeBrandName) {
      setActiveBrandName(current.brand_name);
    }
  }, [brandsLoaded, brands, activeBrandId, activeBrandName]);

  // 产品校正：持久化的 activeProductId 必须属于当前品牌，否则回退到主打/首个产品。
  useEffect(() => {
    if (!productsLoaded || activeBrandId == null) {
      return;
    }
    if (products.length === 0) {
      if (activeProductId != null) {
        setActiveProductId(null);
        setActiveProductName(null);
      }
      return;
    }
    const current = products.find((p) => p.id === activeProductId);
    if (current == null) {
      const fallback = products.find((p) => p.is_primary) ?? products[0];
      setActiveProductId(fallback.id);
      setActiveProductName(fallback.product_name ?? String(fallback.id));
    } else if (current.product_name && current.product_name !== activeProductName) {
      setActiveProductName(current.product_name);
    }
  }, [productsLoaded, products, activeBrandId, activeProductId, activeProductName]);

  const selectBrand = (brand: ProfileBrand) => {
    setActiveBrandId(brand.id);
    setActiveBrandName(brand.brand_name ?? String(brand.id));
    const primary = (brand.products ?? []).find((p) => p.is_primary) ?? brand.products?.[0];
    if (primary) {
      setActiveProductId(primary.id);
      setActiveProductName(primary.product_name ?? String(primary.id));
    } else {
      setActiveProductId(null);
      setActiveProductName(null);
    }
  };

  const selectProduct = (product: ProfileProduct) => {
    setActiveProductId(product.id);
    setActiveProductName(product.product_name ?? String(product.id));
    setOpen(false);
  };

  const label =
    activeBrandName
      ? activeProductName
        ? `${activeBrandName} · ${activeProductName}`
        : activeBrandName
      : localize('com_ui_brand_product');

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-1.5 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-medium hover:text-text-primary"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={localize('com_ui_brand_selector')}
      >
        <span className="max-w-40 truncate">{label}</span>
        <ChevronDown />
      </button>

      {open && menuPos != null &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* Dropdown */}
            <div
              role="listbox"
              aria-label={localize('com_ui_brand_selector')}
              style={{ top: menuPos.top, left: menuPos.left }}
              className="fixed z-50 w-64 rounded-xl border border-border-light bg-surface-secondary py-1 shadow-lg"
            >
              {brands.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-secondary">
                  {localize('com_ui_no_brands')}
                </p>
              ) : (
                brands.map((brand) => (
                  <div key={brand.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={brand.id === activeBrandId}
                      onClick={() => selectBrand(brand)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-tertiary ${
                        brand.id === activeBrandId ? 'text-green-500' : 'text-text-primary'
                      }`}
                    >
                      <span className="font-medium">
                        {brand.brand_name ?? `Brand ${brand.id}`}
                      </span>
                      {brand.is_primary && (
                        <span className="ml-auto text-xs text-text-secondary">
                          {localize('com_profile_primary_brand')}
                        </span>
                      )}
                    </button>

                    {brand.id === activeBrandId && (
                      <div className="ml-3 border-l border-border-light pl-3">
                        {products.length === 0 ? (
                          <p className="px-1 py-1.5 text-xs text-text-secondary">
                            {localize('com_ui_no_products')}
                          </p>
                        ) : (
                          products.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              role="option"
                              aria-selected={product.id === activeProductId}
                              onClick={() => selectProduct(product)}
                              className={`flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-xs transition-colors hover:bg-surface-tertiary ${
                                product.id === activeProductId
                                  ? 'text-green-500'
                                  : 'text-text-secondary'
                              }`}
                            >
                              {product.product_name ?? `Product ${product.id}`}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
