import { useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import type { ProfileDocument } from '~/data-provider/Profile';
import {
  useProfileDocumentsQuery,
  useExtractDocumentMutation,
  useConfirmDocumentMutation,
  useDeleteDocumentMutation,
} from '~/data-provider/Profile';
import { Field } from '~/components/Onboarding/ProfileFields';
import { useLocalize } from '~/hooks';

const ACCEPT = '.pdf,.docx,.pptx';
const ALLOWED = new Set(['pdf', 'docx', 'pptx']);
const LEGACY = new Set(['doc', 'ppt']);

function ext(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

function DocumentRow({
  doc,
  onDelete,
  deleting,
}: {
  doc: ProfileDocument;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [summary, setSummary] = useState(doc.extracted_summary ?? '');
  const [expanded, setExpanded] = useState(doc.status === 'draft');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const confirmDoc = useConfirmDocumentMutation({
    onSuccess: () => showToast({ message: localize('com_profile_saved') }),
    onError: () => showToast({ message: localize('com_profile_save_error'), status: 'error' }),
  });

  const isDraft = doc.status === 'draft';

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-light p-2">
      <div className="flex items-center gap-2">
        <FileText className="size-4 shrink-0 text-text-secondary" />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 truncate text-left text-sm text-text-primary"
        >
          {doc.filename}
        </button>
        <span className={`text-xs ${isDraft ? 'text-amber-500' : 'text-green-500'}`}>
          {isDraft
            ? localize('com_profile_document_draft')
            : localize('com_profile_document_confirmed')}
        </span>
        {confirmDelete ? (
          <button
            type="button"
            onClick={() => onDelete(doc.id)}
            disabled={deleting}
            className="text-xs font-medium text-red-500 hover:underline"
          >
            {localize('com_profile_confirm_delete')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-500 hover:underline"
          >
            {localize('com_ui_delete')}
          </button>
        )}
      </div>

      {expanded && (
        <>
          {isDraft && !doc.extracted_summary && (
            <p className="text-xs text-amber-500">
              {localize('com_profile_document_refine_failed')}
            </p>
          )}
          {isDraft ? (
            <>
              <Field
                id={`doc_summary_${doc.id}`}
                label={localize('com_profile_document_summary_label')}
                value={summary}
                onChange={setSummary}
                multiline
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="submit"
                  onClick={() =>
                    confirmDoc.mutate({ documentId: doc.id, extractedSummary: summary })
                  }
                  disabled={confirmDoc.isLoading}
                  className="h-8"
                >
                  {confirmDoc.isLoading ? (
                    <Spinner />
                  ) : (
                    localize('com_profile_document_confirm')
                  )}
                </Button>
              </div>
            </>
          ) : (
            <p className="whitespace-pre-wrap text-xs text-text-secondary">
              {doc.extracted_summary || localize('com_ui_none')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function DocumentsSection({
  brandId,
  productId = null,
}: {
  brandId: number;
  productId?: number | null;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: allDocs = [], isLoading } = useProfileDocumentsQuery(brandId);

  const docs = allDocs.filter((d) =>
    productId == null ? d.product_id == null : d.product_id === productId,
  );

  const extractDoc = useExtractDocumentMutation({
    onSuccess: (result) => {
      if (!result.refine_ok) {
        showToast({ message: localize('com_profile_document_refine_failed'), status: 'warning' });
      }
    },
    onError: () =>
      showToast({ message: localize('com_profile_document_upload_error'), status: 'error' }),
  });

  const deleteDoc = useDeleteDocumentMutation({
    onSuccess: () => showToast({ message: localize('com_profile_saved') }),
    onError: () => showToast({ message: localize('com_profile_save_error'), status: 'error' }),
  });

  const handleFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    const e = ext(file.name);
    if (LEGACY.has(e)) {
      showToast({ message: localize('com_profile_document_legacy_format'), status: 'error' });
      return;
    }
    if (!ALLOWED.has(e)) {
      showToast({ message: localize('com_profile_document_unsupported_format'), status: 'error' });
      return;
    }
    extractDoc.mutate({ file, brandId, productId });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-text-secondary">
          {localize('com_profile_documents_section')}
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={extractDoc.isLoading}
          className="flex items-center gap-1 text-xs text-green-500 hover:underline disabled:opacity-60"
        >
          <Upload className="size-3.5" />
          {localize('com_profile_upload_document')}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(ev) => {
            handleFile(ev.target.files?.[0]);
            ev.target.value = '';
          }}
        />
      </div>

      <p className="text-xs text-text-secondary">{localize('com_profile_documents_hint')}</p>

      {extractDoc.isLoading && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Spinner className="size-4" />
          {localize('com_profile_document_extracting')}
        </div>
      )}

      {isLoading ? (
        <Spinner className="m-2" />
      ) : docs.length === 0 ? (
        <p className="px-1 text-xs text-text-secondary">{localize('com_ui_no_documents')}</p>
      ) : (
        docs.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            onDelete={(id) => deleteDoc.mutate(id)}
            deleting={deleteDoc.isLoading}
          />
        ))
      )}
    </div>
  );
}
