import { CalendarDays } from 'lucide-react';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useLocalize } from '~/hooks';

export default function BattlePlan({ markdown }: { markdown: string | null }) {
  const localize = useLocalize();
  if (markdown == null || markdown === '') {
    return null;
  }
  return (
    <section className="border-t border-border-light px-6 py-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-green-600" />
        <h3 className="text-sm font-bold text-text-primary">
          {localize('com_execspeed_battle_plan')}
        </h3>
      </div>
      <MarkdownLite content={markdown} codeExecution={false} />
    </section>
  );
}
