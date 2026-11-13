import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowUpDown,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useDeletedEntities,
  useRestoreDeletedEntity,
  type DeletedEntity,
} from '@/hooks/useAdminConsole';
import { errorMessage } from '@/lib/utils';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Spinner,
  Tabs,
  useToast,
} from '@/components/ui';

type ArchiveTab = 'all' | DeletedEntity['entity_type'];
type SortOrder = 'newest' | 'oldest' | 'name';

const ENTITY_LABELS: Record<DeletedEntity['entity_type'], string> = {
  user: 'User account',
  university: 'University',
  company: 'Company',
};

const ENTITY_TONES: Record<DeletedEntity['entity_type'], 'blue' | 'violet' | 'emerald'> = {
  user: 'blue',
  university: 'violet',
  company: 'emerald',
};

function EntityIcon({ type, className }: { type: DeletedEntity['entity_type']; className?: string }) {
  if (type === 'user') return <Users className={className} />;
  if (type === 'university') return <GraduationCap className={className} />;
  return <Building2 className={className} />;
}

function formatArchivedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function RecycleBin() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const archive = useDeletedEntities();
  const restore = useRestoreDeletedEntity();

  const [tab, setTab] = useState<ArchiveTab>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [selectedItem, setSelectedItem] = useState<DeletedEntity | null>(null);

  const records = archive.data ?? [];

  const counts = useMemo(() => ({
    all: records.length,
    user: records.filter((record) => record.entity_type === 'user').length,
    university: records.filter((record) => record.entity_type === 'university').length,
    company: records.filter((record) => record.entity_type === 'company').length,
  }), [records]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = records.filter((record) => {
      const matchesCategory = tab === 'all' || record.entity_type === tab;
      const matchesSearch = !term ||
        record.display_name.toLowerCase().includes(term) ||
        ENTITY_LABELS[record.entity_type].toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });

    if (sort === 'name') result.sort((a, b) => a.display_name.localeCompare(b.display_name));
    else if (sort === 'oldest') result.sort((a, b) => a.deleted_at.localeCompare(b.deleted_at));
    else result.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    return result;
  }, [records, search, sort, tab]);

  if (profile?.role !== 'platform_admin') {
    return (
      <EmptyState
        icon={<ShieldCheck className="recycle-icon recycle-icon--large" />}
        title="Administrator access required"
        description="Only platform administrators can view and restore archived SIMS records."
      />
    );
  }

  const confirmRestore = async () => {
    if (!selectedItem) return;
    const item = selectedItem;
    try {
      await restore.mutateAsync({ id: item.entity_id, kind: item.entity_type });
      toast({
        title: 'Record restored',
        description: `${item.display_name} has been returned to its original section.`,
        tone: 'success',
      });
      setSelectedItem(null);
    } catch (error) {
      toast({
        title: 'Restore failed',
        description: errorMessage(error),
        tone: 'error',
      });
    }
  };

  const metricCards = [
    { label: 'User accounts', value: counts.user, helper: 'Archived profiles', type: 'user' as const },
    { label: 'Universities', value: counts.university, helper: 'Archived institutions', type: 'university' as const },
    { label: 'Companies', value: counts.company, helper: 'Archived organisations', type: 'company' as const },
  ];

  return (
    <main className="recycle-v2">
      <PageHeader
        title="Recycle Bin"
        description="Review archived records, track what has been removed, and restore items when needed."
      />

      <section className="recycle-v2__summary">
        <div className="recycle-v2__summary-copy">
          <span className="recycle-v2__eyebrow"><Archive size={14} /> ARCHIVE MANAGEMENT</span>
          <h2>Keep your platform organised.</h2>
          <p>Archived records are kept safely here instead of being permanently removed.</p>
        </div>
        <div className="recycle-v2__total">
          <span>Total archived records</span>
          <strong>{counts.all}</strong>
          <small>Across all categories</small>
        </div>
      </section>

      <section className="recycle-v2__metrics" aria-label="Archive categories">
        {metricCards.map((metric) => (
          <button
            type="button"
            key={metric.type}
            className={`recycle-v2__metric recycle-v2__metric--${metric.type}`}
            onClick={() => setTab(metric.type)}
          >
            <span className="recycle-v2__metric-icon"><EntityIcon type={metric.type} /></span>
            <span className="recycle-v2__metric-content">
              <span className="recycle-v2__metric-label">{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </span>
            <span className="recycle-v2__metric-arrow">View records →</span>
          </button>
        ))}
      </section>

      <Card className="recycle-v2__workspace">
        <div className="recycle-v2__workspace-head">
          <div>
            <div className="recycle-v2__section-kicker"><ShieldCheck size={14} /> CONTROL CENTRE</div>
            <h2>Archived records</h2>
            <p>Search, filter and restore records from one place.</p>
          </div>
          <div className="recycle-v2__workspace-count">
            <Archive size={15} />
            <span>{filteredRecords.length} shown</span>
          </div>
        </div>

        <div className="recycle-v2__toolbar">
          <label className="recycle-v2__search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by record name or category..."
              aria-label="Search archived records"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                <X size={15} />
              </button>
            )}
          </label>
          <label className="recycle-v2__sort">
            <ArrowUpDown size={15} />
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)} aria-label="Sort archived records">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        <div className="recycle-v2__tabs">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as ArchiveTab)}
            options={[
              { key: 'all', label: 'All records', count: counts.all },
              { key: 'user', label: 'Users', count: counts.user },
              { key: 'university', label: 'Universities', count: counts.university },
              { key: 'company', label: 'Companies', count: counts.company },
            ]}
          />
        </div>

        {archive.isLoading ? (
          <div className="recycle-v2__state"><Spinner /><span>Loading archived records...</span></div>
        ) : archive.isError ? (
          <div className="recycle-v2__error">
            <Alert tone="danger" title="Archive could not be loaded">{errorMessage(archive.error)}</Alert>
            <Button variant="secondary" onClick={() => void archive.refetch()}>Try again</Button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="recycle-v2__empty">
            <EmptyState
              icon={<Archive className="recycle-icon recycle-icon--large" />}
              title={search ? 'No records found' : tab === 'all' ? 'Your Recycle Bin is clear' : `No archived ${tab === 'user' ? 'users' : tab === 'university' ? 'universities' : 'companies'}`}
              description={search ? 'Try a different search term or clear the search.' : 'When a record is archived, it will appear here and can be restored.'}
            />
            {search && <Button variant="secondary" size="sm" onClick={() => setSearch('')}>Clear search</Button>}
          </div>
        ) : (
          <>
            <div className="recycle-v2__table-wrap">
              <table className="recycle-v2__table">
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Category</th>
                    <th>Date archived</th>
                    <th className="recycle-v2__actions-heading">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div className="recycle-v2__record">
                          <span className={`recycle-v2__record-icon recycle-v2__record-icon--${record.entity_type}`}>
                            <EntityIcon type={record.entity_type} />
                          </span>
                          <span className="recycle-v2__record-copy">
                            <strong>{record.display_name}</strong>
                            <small>Record ID: {record.entity_id.slice(0, 8)}…</small>
                          </span>
                        </div>
                      </td>
                      <td><Badge tone={ENTITY_TONES[record.entity_type]}>{ENTITY_LABELS[record.entity_type]}</Badge></td>
                      <td>
                        <span className="recycle-v2__date"><CalendarDays size={15} />{formatArchivedDate(record.deleted_at)}</span>
                      </td>
                      <td className="recycle-v2__actions-cell">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedItem(record)}>
                          <RotateCcw size={15} /> Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="recycle-v2__mobile-list">
              {filteredRecords.map((record) => (
                <article className="recycle-v2__mobile-record" key={record.id}>
                  <div className="recycle-v2__mobile-top">
                    <span className={`recycle-v2__record-icon recycle-v2__record-icon--${record.entity_type}`}>
                      <EntityIcon type={record.entity_type} />
                    </span>
                    <div className="recycle-v2__mobile-copy">
                      <strong>{record.display_name}</strong>
                      <Badge tone={ENTITY_TONES[record.entity_type]}>{ENTITY_LABELS[record.entity_type]}</Badge>
                    </div>
                  </div>
                  <div className="recycle-v2__mobile-bottom">
                    <span><Clock3 size={14} /> {formatArchivedDate(record.deleted_at)}</span>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedItem(record)}>
                      <RotateCcw size={15} /> Restore
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!archive.isLoading && !archive.isError && filteredRecords.length > 0 && (
          <footer className="recycle-v2__footer">
            <span>Showing {filteredRecords.length} of {counts.all} archived records</span>
            <span><CheckCircle2 size={14} /> Original data is preserved when archived</span>
          </footer>
        )}
      </Card>

      <div className="recycle-v2__notice">
        <ShieldCheck size={17} />
        <p><strong>Safe recovery:</strong> Restoring a record returns it to its original section. Existing archive history is retained for administration.</p>
      </div>

      <Modal
        open={Boolean(selectedItem)}
        onClose={() => !restore.isPending && setSelectedItem(null)}
        title="Restore archived record?"
        description={selectedItem ? selectedItem.display_name : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedItem(null)} disabled={restore.isPending}>Cancel</Button>
            <Button onClick={() => void confirmRestore()} loading={restore.isPending}>
              <RotateCcw size={15} /> Restore record
            </Button>
          </>
        }
      >
        <div className="recycle-v2__confirm">
          <span className="recycle-v2__confirm-icon"><RotateCcw size={20} /></span>
          <div>
            <strong>This record will become available again.</strong>
            <p>{selectedItem ? `${selectedItem.display_name} will be returned to the ${selectedItem.entity_type === 'user' ? 'user directory' : selectedItem.entity_type === 'university' ? 'universities list' : 'companies list'}.` : 'The selected record will be restored to its original area.'}</p>
          </div>
        </div>
      </Modal>
    </main>
  );
}
