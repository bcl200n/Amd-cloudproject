import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';

type WorldEventType = 'earthquake' | 'city_update';

const DEFAULT_SCAN_LIMIT = 5000;
const MAX_SCAN_LIMIT = 20000;
const DEFAULT_TOP_DYADS = 20;
const MAX_TOP_DYADS = 100;
const DEFAULT_TOP_ACTORS = 20;
const MAX_TOP_ACTORS = 100;

const DEFAULT_SCHEDULE = {
  earthquakeIntervalMinMs: 10 * 60 * 1000,
  earthquakeIntervalMaxMs: 20 * 60 * 1000,
  earthquakeDurationMinMs: 3 * 60 * 1000,
  earthquakeDurationMaxMs: 5 * 60 * 1000,
  cityUpdateIntervalMinMs: 90 * 60 * 1000,
  cityUpdateIntervalMaxMs: 150 * 60 * 1000,
  cityUpdateDurationMinMs: 20 * 60 * 1000,
  cityUpdateDurationMaxMs: 40 * 60 * 1000,
};

function randomBetween(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function normalizeMinMax(min: number, max: number) {
  if (min <= max) {
    return { min, max };
  }
  return { min: max, max: min };
}

async function getOrCreateSchedule(ctx: any, worldId: string) {
  const existing = await ctx.db
    .query('worldEventSchedules')
    .withIndex('worldId', (q: any) => q.eq('worldId', worldId))
    .unique();
  if (existing) {
    return existing;
  }
  const now = Date.now();
  const scheduleId = await ctx.db.insert('worldEventSchedules', {
    worldId,
    ...DEFAULT_SCHEDULE,
    nextEarthquakeAt: now + randomBetween(1 * 60 * 1000, 2 * 60 * 1000),
    nextCityUpdateAt: now + randomBetween(15 * 60 * 1000, 25 * 60 * 1000),
  });
  return await ctx.db.get(scheduleId);
}

async function findActiveEvent(ctx: any, worldId: string, type: WorldEventType, now: number) {
  const rows = await ctx.db
    .query('worldEvents')
    .withIndex('worldId_type_status_endsAt', (q: any) =>
      q.eq('worldId', worldId).eq('type', type).eq('status', 'active'),
    )
    .collect();
  return rows.find((row: any) => row.endsAt > now) ?? null;
}

async function startEvent(
  ctx: any,
  worldId: string,
  type: WorldEventType,
  startedAt: number,
  durationMs: number,
  source: 'automatic' | 'manual',
) {
  const endsAt = startedAt + durationMs;
  const eventId = await ctx.db.insert('worldEvents', {
    worldId,
    type,
    startedAt,
    endsAt,
    status: 'active',
    payload: { source, durationMs },
  });
  await ctx.db.insert('socialEvents', {
    worldId,
    ts: startedAt,
    type: `${type}_started`,
    payload: {
      worldEventId: eventId,
      type,
      startedAt,
      endsAt,
      durationMs,
      source,
    },
  });
  return { eventId, endsAt };
}

async function closeExpiredEvents(ctx: any, worldId: string, now: number) {
  const activeRows = await ctx.db
    .query('worldEvents')
    .withIndex('worldId_status_endsAt', (q: any) => q.eq('worldId', worldId).eq('status', 'active'))
    .collect();
  let ended = 0;
  for (const event of activeRows) {
    if (event.endsAt > now) {
      continue;
    }
    await ctx.db.patch(event._id, { status: 'ended' });
    await ctx.db.insert('socialEvents', {
      worldId,
      ts: now,
      type: `${event.type}_ended`,
      payload: {
        worldEventId: event._id,
        type: event.type,
        startedAt: event.startedAt,
        endedAt: event.endsAt,
        durationMs: event.endsAt - event.startedAt,
      },
    });
    ended += 1;
  }
  return ended;
}

async function latestEventByType(ctx: any, worldId: string, type: WorldEventType) {
  return await ctx.db
    .query('worldEvents')
    .withIndex('worldId_type_startedAt', (q: any) => q.eq('worldId', worldId).eq('type', type))
    .order('desc')
    .first();
}

async function summarizeEventWindow(ctx: any, worldId: string, event: any, params: any) {
  const now = Date.now();
  const scanLimit = Math.max(1, Math.min(params.scanLimit ?? DEFAULT_SCAN_LIMIT, MAX_SCAN_LIMIT));
  const topDyadsLimit = Math.max(1, Math.min(params.topDyads ?? DEFAULT_TOP_DYADS, MAX_TOP_DYADS));
  const topActorsLimit = Math.max(
    1,
    Math.min(params.topActors ?? DEFAULT_TOP_ACTORS, MAX_TOP_ACTORS),
  );

  const fromTs = event.startedAt;
  const toTs = Math.min(event.endsAt, now);
  const typeCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();
  const dyadCounts = new Map<string, { actorA: string; actorB: string; count: number }>();
  const minuteCounts = new Map<number, number>();

  let scanned = 0;
  let inWindow = 0;
  const rows = ctx.db
    .query('socialEvents')
    .withIndex('worldId_ts', (q: any) => q.eq('worldId', worldId))
    .order('desc');
  for await (const socialEvent of rows) {
    if (socialEvent.ts < fromTs) {
      break;
    }
    scanned += 1;
    if (socialEvent.ts > toTs) {
      if (scanned >= scanLimit) {
        break;
      }
      continue;
    }
    inWindow += 1;
    typeCounts.set(socialEvent.type, (typeCounts.get(socialEvent.type) ?? 0) + 1);
    const minuteBucket = Math.floor((socialEvent.ts - fromTs) / 60000);
    minuteCounts.set(minuteBucket, (minuteCounts.get(minuteBucket) ?? 0) + 1);

    if (socialEvent.actorId) {
      actorCounts.set(socialEvent.actorId, (actorCounts.get(socialEvent.actorId) ?? 0) + 1);
    }
    if (socialEvent.actorId && socialEvent.targetId) {
      const [actorA, actorB] = [socialEvent.actorId, socialEvent.targetId].sort();
      const key = `${actorA}|${actorB}`;
      const current = dyadCounts.get(key);
      if (current) {
        current.count += 1;
      } else {
        dyadCounts.set(key, { actorA, actorB, count: 1 });
      }
    }
    if (scanned >= scanLimit) {
      break;
    }
  }

  const byType = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const topActors = [...actorCounts.entries()]
    .map(([actorId, count]) => ({ actorId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topActorsLimit);
  const topDyads = [...dyadCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topDyadsLimit);
  const timelinePerMinute = [...minuteCounts.entries()]
    .map(([minuteOffset, count]) => ({ minuteOffset, count }))
    .sort((a, b) => a.minuteOffset - b.minuteOffset);

  return {
    event: {
      id: event._id,
      type: event.type,
      status: event.status,
      startedAt: event.startedAt,
      endsAt: event.endsAt,
    },
    window: { fromTs, toTs },
    scanned,
    inWindow,
    byType,
    topActors,
    topDyads,
    timelinePerMinute,
  };
}

export const configureWorldEventSchedule = mutation({
  args: {
    worldId: v.id('worlds'),
    earthquakeIntervalMinMs: v.optional(v.number()),
    earthquakeIntervalMaxMs: v.optional(v.number()),
    earthquakeDurationMinMs: v.optional(v.number()),
    earthquakeDurationMaxMs: v.optional(v.number()),
    cityUpdateIntervalMinMs: v.optional(v.number()),
    cityUpdateIntervalMaxMs: v.optional(v.number()),
    cityUpdateDurationMinMs: v.optional(v.number()),
    cityUpdateDurationMaxMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const schedule = await getOrCreateSchedule(ctx, args.worldId);
    const current = {
      earthquakeIntervalMinMs: args.earthquakeIntervalMinMs ?? schedule.earthquakeIntervalMinMs,
      earthquakeIntervalMaxMs: args.earthquakeIntervalMaxMs ?? schedule.earthquakeIntervalMaxMs,
      earthquakeDurationMinMs: args.earthquakeDurationMinMs ?? schedule.earthquakeDurationMinMs,
      earthquakeDurationMaxMs: args.earthquakeDurationMaxMs ?? schedule.earthquakeDurationMaxMs,
      cityUpdateIntervalMinMs: args.cityUpdateIntervalMinMs ?? schedule.cityUpdateIntervalMinMs,
      cityUpdateIntervalMaxMs: args.cityUpdateIntervalMaxMs ?? schedule.cityUpdateIntervalMaxMs,
      cityUpdateDurationMinMs: args.cityUpdateDurationMinMs ?? schedule.cityUpdateDurationMinMs,
      cityUpdateDurationMaxMs: args.cityUpdateDurationMaxMs ?? schedule.cityUpdateDurationMaxMs,
    };
    const eInterval = normalizeMinMax(current.earthquakeIntervalMinMs, current.earthquakeIntervalMaxMs);
    const eDuration = normalizeMinMax(current.earthquakeDurationMinMs, current.earthquakeDurationMaxMs);
    const cInterval = normalizeMinMax(current.cityUpdateIntervalMinMs, current.cityUpdateIntervalMaxMs);
    const cDuration = normalizeMinMax(current.cityUpdateDurationMinMs, current.cityUpdateDurationMaxMs);

    await ctx.db.patch(schedule._id, {
      earthquakeIntervalMinMs: eInterval.min,
      earthquakeIntervalMaxMs: eInterval.max,
      earthquakeDurationMinMs: eDuration.min,
      earthquakeDurationMaxMs: eDuration.max,
      cityUpdateIntervalMinMs: cInterval.min,
      cityUpdateIntervalMaxMs: cInterval.max,
      cityUpdateDurationMinMs: cDuration.min,
      cityUpdateDurationMaxMs: cDuration.max,
      nextEarthquakeAt: Math.max(schedule.nextEarthquakeAt, now),
      nextCityUpdateAt: Math.max(schedule.nextCityUpdateAt, now),
    });
    return await ctx.db.get(schedule._id);
  },
});

export const worldEventSchedule = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    return await getOrCreateSchedule(ctx, args.worldId);
  },
});

export const reconcileWorldEvents = internalMutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ended = await closeExpiredEvents(ctx, args.worldId, now);
    const schedule = await getOrCreateSchedule(ctx, args.worldId);

    const activeEarthquake = await findActiveEvent(ctx, args.worldId, 'earthquake', now);
    const activeCityUpdate = await findActiveEvent(ctx, args.worldId, 'city_update', now);

    let nextEarthquakeAt = schedule.nextEarthquakeAt;
    let nextCityUpdateAt = schedule.nextCityUpdateAt;
    let startedEarthquake: string | null = null;
    let startedCityUpdate: string | null = null;

    if (!activeEarthquake && now >= schedule.nextEarthquakeAt) {
      const durationMs = randomBetween(
        schedule.earthquakeDurationMinMs,
        schedule.earthquakeDurationMaxMs,
      );
      const started = await startEvent(ctx, args.worldId, 'earthquake', now, durationMs, 'automatic');
      nextEarthquakeAt =
        started.endsAt +
        randomBetween(schedule.earthquakeIntervalMinMs, schedule.earthquakeIntervalMaxMs);
      startedEarthquake = started.eventId;
    }
    if (!activeCityUpdate && now >= schedule.nextCityUpdateAt) {
      const durationMs = randomBetween(
        schedule.cityUpdateDurationMinMs,
        schedule.cityUpdateDurationMaxMs,
      );
      const started = await startEvent(ctx, args.worldId, 'city_update', now, durationMs, 'automatic');
      nextCityUpdateAt =
        started.endsAt +
        randomBetween(schedule.cityUpdateIntervalMinMs, schedule.cityUpdateIntervalMaxMs);
      startedCityUpdate = started.eventId;
    }

    if (
      nextEarthquakeAt !== schedule.nextEarthquakeAt ||
      nextCityUpdateAt !== schedule.nextCityUpdateAt
    ) {
      await ctx.db.patch(schedule._id, { nextEarthquakeAt, nextCityUpdateAt });
    }

    return {
      now,
      ended,
      startedEarthquake,
      startedCityUpdate,
      nextEarthquakeAt,
      nextCityUpdateAt,
    };
  },
});

export const triggerEarthquake = mutation({
  args: {
    worldId: v.id('worlds'),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const schedule = await getOrCreateSchedule(ctx, args.worldId);
    const active = await findActiveEvent(ctx, args.worldId, 'earthquake', now);
    if (active) {
      throw new Error(`已有进行中的地震事件，结束时间 ${new Date(active.endsAt).toISOString()}`);
    }
    const bounds = normalizeMinMax(
      schedule.earthquakeDurationMinMs,
      schedule.earthquakeDurationMaxMs,
    );
    const durationMs =
      args.durationMs === undefined
        ? randomBetween(bounds.min, bounds.max)
        : Math.max(bounds.min, Math.min(args.durationMs, bounds.max));
    const started = await startEvent(ctx, args.worldId, 'earthquake', now, durationMs, 'manual');
    const nextEarthquakeAt =
      started.endsAt +
      randomBetween(schedule.earthquakeIntervalMinMs, schedule.earthquakeIntervalMaxMs);
    await ctx.db.patch(schedule._id, { nextEarthquakeAt });
    return {
      eventId: started.eventId,
      worldId: args.worldId,
      type: 'earthquake',
      startedAt: now,
      endsAt: started.endsAt,
      durationMs,
    };
  },
});

export const triggerCityUpdate = mutation({
  args: {
    worldId: v.id('worlds'),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const schedule = await getOrCreateSchedule(ctx, args.worldId);
    const active = await findActiveEvent(ctx, args.worldId, 'city_update', now);
    if (active) {
      throw new Error(`已有进行中的城市更新，结束时间 ${new Date(active.endsAt).toISOString()}`);
    }
    const bounds = normalizeMinMax(
      schedule.cityUpdateDurationMinMs,
      schedule.cityUpdateDurationMaxMs,
    );
    const durationMs =
      args.durationMs === undefined
        ? randomBetween(bounds.min, bounds.max)
        : Math.max(bounds.min, Math.min(args.durationMs, bounds.max));
    const started = await startEvent(ctx, args.worldId, 'city_update', now, durationMs, 'manual');
    const nextCityUpdateAt =
      started.endsAt +
      randomBetween(schedule.cityUpdateIntervalMinMs, schedule.cityUpdateIntervalMaxMs);
    await ctx.db.patch(schedule._id, { nextCityUpdateAt });
    return {
      eventId: started.eventId,
      worldId: args.worldId,
      type: 'city_update',
      startedAt: now,
      endsAt: started.endsAt,
      durationMs,
    };
  },
});

export const currentEarthquake = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    return await findActiveEvent(ctx, args.worldId, 'earthquake', Date.now());
  },
});

export const currentCityUpdate = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    return await findActiveEvent(ctx, args.worldId, 'city_update', Date.now());
  },
});

export const currentWorldEvents = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return {
      earthquake: await findActiveEvent(ctx, args.worldId, 'earthquake', now),
      cityUpdate: await findActiveEvent(ctx, args.worldId, 'city_update', now),
    };
  },
});

export const latestEarthquake = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    return await latestEventByType(ctx, args.worldId, 'earthquake');
  },
});

export const latestCityUpdate = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    return await latestEventByType(ctx, args.worldId, 'city_update');
  },
});

export const earthquakeInteractionSummary = query({
  args: {
    worldId: v.id('worlds'),
    worldEventId: v.optional(v.id('worldEvents')),
    scanLimit: v.optional(v.number()),
    topDyads: v.optional(v.number()),
    topActors: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const event = args.worldEventId
      ? await ctx.db.get(args.worldEventId)
      : await latestEventByType(ctx, args.worldId, 'earthquake');
    if (!event || event.worldId !== args.worldId || event.type !== 'earthquake') {
      return null;
    }
    return await summarizeEventWindow(ctx, args.worldId, event, args);
  },
});

export const cityUpdateInteractionSummary = query({
  args: {
    worldId: v.id('worlds'),
    worldEventId: v.optional(v.id('worldEvents')),
    scanLimit: v.optional(v.number()),
    topDyads: v.optional(v.number()),
    topActors: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const event = args.worldEventId
      ? await ctx.db.get(args.worldEventId)
      : await latestEventByType(ctx, args.worldId, 'city_update');
    if (!event || event.worldId !== args.worldId || event.type !== 'city_update') {
      return null;
    }
    return await summarizeEventWindow(ctx, args.worldId, event, args);
  },
});
