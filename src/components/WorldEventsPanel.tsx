import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useI18n } from '../i18n';

function formatTs(ts?: number | null) {
  if (!ts) {
    return '-';
  }
  return new Date(ts).toLocaleString();
}

function StatusBadge({ active, activeText, inactiveText }: { active: boolean; activeText: string; inactiveText: string }) {
  return (
    <span
      className={
        active
          ? 'inline-flex items-center rounded bg-emerald-700 px-2 py-1 text-xs text-white'
          : 'inline-flex items-center rounded bg-slate-700 px-2 py-1 text-xs text-white'
      }
    >
      {active ? activeText : inactiveText}
    </span>
  );
}

function TopList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded border border-brown-600 p-2">
      <div className="text-xs text-brown-300 mb-1">{title}</div>
      {items.length === 0 ? <div className="text-sm text-brown-200/80">-</div> : null}
      {items.slice(0, 3).map((item) => (
        <div className="text-sm" key={item}>
          {item}
        </div>
      ))}
    </div>
  );
}

export default function WorldEventsPanel() {
  const { t } = useI18n();
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;

  const schedule = useQuery(api.worldEvents.worldEventSchedule, worldId ? { worldId } : 'skip');
  const current = useQuery(api.worldEvents.currentWorldEvents, worldId ? { worldId } : 'skip');
  const earthquakeSummary = useQuery(
    api.worldEvents.earthquakeInteractionSummary,
    worldId ? { worldId } : 'skip',
  );
  const cityUpdateSummary = useQuery(
    api.worldEvents.cityUpdateInteractionSummary,
    worldId ? { worldId } : 'skip',
  );

  if (!worldId) {
    return null;
  }

  const earthquakeActive = !!current?.earthquake;
  const cityUpdateActive = !!current?.cityUpdate;

  const earthquakeTypes =
    earthquakeSummary?.byType?.slice(0, 3).map((x) => `${x.type}: ${x.count}`) ?? [];
  const earthquakeActors =
    earthquakeSummary?.topActors?.slice(0, 3).map((x) => `${x.actorId}: ${x.count}`) ?? [];
  const earthquakeDyads =
    earthquakeSummary?.topDyads?.slice(0, 3).map((x) => `${x.actorA} ↔ ${x.actorB}: ${x.count}`) ?? [];

  const cityTypes = cityUpdateSummary?.byType?.slice(0, 3).map((x) => `${x.type}: ${x.count}`) ?? [];
  const cityActors =
    cityUpdateSummary?.topActors?.slice(0, 3).map((x) => `${x.actorId}: ${x.count}`) ?? [];
  const cityDyads =
    cityUpdateSummary?.topDyads?.slice(0, 3).map((x) => `${x.actorA} ↔ ${x.actorB}: ${x.count}`) ?? [];

  return (
    <section className="mx-auto w-full max-w-[1400px] mt-4 mb-2 game-frame bg-brown-900/90 text-brown-100 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-2xl tracking-wide">{t('events_panel_title')}</h2>
        <div className="text-sm text-brown-300">{t('events_panel_subtitle')}</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
        <div className="rounded border border-brown-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl">{t('event_earthquake')}</h3>
            <StatusBadge
              active={earthquakeActive}
              activeText={t('status_active')}
              inactiveText={t('status_inactive')}
            />
          </div>
          <div className="text-sm mb-1">
            {t('started_at')}: {formatTs(current?.earthquake?.startedAt ?? earthquakeSummary?.event?.startedAt)}
          </div>
          <div className="text-sm mb-1">
            {t('ends_at')}: {formatTs(current?.earthquake?.endsAt ?? earthquakeSummary?.event?.endsAt)}
          </div>
          <div className="text-sm mb-3">
            {t('next_at')}: {formatTs(schedule?.nextEarthquakeAt)}
          </div>
          <div className="text-sm mb-2">
            {t('interactions_in_window')}: {earthquakeSummary?.inWindow ?? t('no_data')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <TopList title={t('top_event_types')} items={earthquakeTypes} />
            <TopList title={t('top_actors')} items={earthquakeActors} />
            <TopList title={t('top_dyads')} items={earthquakeDyads} />
          </div>
        </div>

        <div className="rounded border border-brown-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl">{t('event_city_update')}</h3>
            <StatusBadge
              active={cityUpdateActive}
              activeText={t('status_active')}
              inactiveText={t('status_inactive')}
            />
          </div>
          <div className="text-sm mb-1">
            {t('started_at')}: {formatTs(current?.cityUpdate?.startedAt ?? cityUpdateSummary?.event?.startedAt)}
          </div>
          <div className="text-sm mb-1">
            {t('ends_at')}: {formatTs(current?.cityUpdate?.endsAt ?? cityUpdateSummary?.event?.endsAt)}
          </div>
          <div className="text-sm mb-3">
            {t('next_at')}: {formatTs(schedule?.nextCityUpdateAt)}
          </div>
          <div className="text-sm mb-2">
            {t('interactions_in_window')}: {cityUpdateSummary?.inWindow ?? t('no_data')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <TopList title={t('top_event_types')} items={cityTypes} />
            <TopList title={t('top_actors')} items={cityActors} />
            <TopList title={t('top_dyads')} items={cityDyads} />
          </div>
        </div>
      </div>
    </section>
  );
}
