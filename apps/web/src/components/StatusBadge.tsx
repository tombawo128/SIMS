import { statusTone } from '@sims/shared';
import { Badge } from '@/components/ui';

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text =
    label ??
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  return <Badge tone={statusTone(status)}>{text}</Badge>;
}
