import { useMemo } from 'react';
import { FileSources, FileContext } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';
import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';
import { useGetFiles } from '~/data-provider';
import { useAllProfileDocumentsQuery } from '~/data-provider/Profile';
import { DataTable, columns } from './Table';
import type { MyFile } from './Table';
import { useLocalize } from '~/hooks';

export function MyFilesModal({
  open,
  onOpenChange,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | HTMLDivElement | null>;
}) {
  const localize = useLocalize();

  const { data: files = [] } = useGetFiles<TFile[]>({
    select: (files) =>
      files.map((file) => {
        file.context = file.context ?? FileContext.unknown;
        file.filterSource = file.source === FileSources.firebase ? FileSources.local : file.source;
        return file;
      }),
  });

  // 营销档案文档存于 kotlerapi，与 LibreChat 文件分属两套存储；这里只读合并展示。
  const { data: profileDocs = [] } = useAllProfileDocumentsQuery({ enabled: open });

  const data: MyFile[] = useMemo(() => {
    const profileRows: MyFile[] = profileDocs.map((doc) => ({
      user: '',
      file_id: `profile-doc-${doc.id}`,
      filename: doc.filename,
      filepath: '',
      object: 'file',
      type: doc.content_type ?? '',
      bytes: doc.bytes ?? 0,
      embedded: false,
      usage: 0,
      context: FileContext.unknown,
      createdAt: doc.uploaded_at,
      updatedAt: doc.confirmed_at || doc.uploaded_at,
      isProfileDocument: true,
      profileStatus: doc.status,
    }));
    return [...files, ...profileRows];
  }, [files, profileDocs]);

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef}>
      <OGDialogContent
        title={localize('com_nav_my_files')}
        className="w-11/12 bg-background text-text-primary shadow-2xl"
      >
        <OGDialogHeader>
          <OGDialogTitle>{localize('com_nav_my_files')}</OGDialogTitle>
        </OGDialogHeader>
        <DataTable columns={columns} data={data} />
      </OGDialogContent>
    </OGDialog>
  );
}
