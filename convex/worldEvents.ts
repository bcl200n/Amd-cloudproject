import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';

const EARTHQUAKE_MIN_MS = 3 * 60 * 1000;
const EARTHQUAKE_MAX_MS = 5 * 60 * 1000;
const DEFAULT_SCAN_LIMIT = 5000;
const MAX_SCAN_LIMIT = 20000;
const DEFAULT_TOP_DYADS = 20;
const MAX_TOP_DYADS = 100;
const DEFAULT_TOP_ACTORS = 20;
const MAX_TOP_ACTORS = 100;

function normalizeEarthquakeDuration(input?: number) {
  if (input === undefined) {
    return (
      EARTHQUAKE_MIN_MS + Math.floor(Math.random() * (EARTHQUAKE_MAX_MS - EARTHQUAKE_MIN_MS + 1))
    );
  }
  return Math.max(EARTHQUAKE_MIN_MS, Math.min(input, EARTHQUAKE_MAX_MS));
}

export const reconcileEarthquakes = internalMutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const activeRows = await ctx.db
      .query('worldEvents')
      .withIndex('worldId_status_endsAt', (q) => q.eq('worldId', args.worldId).eq('status', 'active'))
      .collect();

    let ended = 0;
    for (const event of activeRows) {
      if (event.endsAt > now) {
        continue;
      }
      await ctx.db.patch(event._id, { status: 'ended' });
      await ctx.db.insert('socialEvents', {
        worldId: args.worldId,
        ts: now,
        type: 'earthquake_ended',
        payload: {
          worldEventId: event._id,
          startedAt: event.startedAt,
          endedAt: event.endsAt,
          durationMs: event.endsAt - event.startedAt,
        },
      });
      ended += 1;
    }
    return { now, ended };
  },
});

export const triggerEarthquake = mutation({
  args: {
    worldId: v.id('worlds'),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const durationMs = normalizeEarthquakeDuration(args.durationMs);
    const endsAt = now + durationMs;

    const activeRows = await ctx.db
      .query('worldEvents')
      .withIndex('worldId_status_endsAt', (q) => q.eq('worldId', args.worldId).eq('status', 'active'))
      .collect();
    for (const event of activeRows) {
      if (event.endsAt > now) {
        throw new Error(
          `已有进行中的地震事件，结束时间 ${new Date(event.endsAt).toISOString()}`,
        );
      }
      await ctx.db.patch(event._id, { status: 'ended' });
    }

    const eventId = await ctx.db.insert('worldEvents', {
      worldId: args.worldId,
      type: 'earthquake',
      startedAt: now,
      endsAt,
      status: 'active',
      payload: { requestedDurationMs: args.durationMs ?? null, durationMs },
    });
    await ctx.db.insert('socialEvents', {
      worldId: args.worldId,
      ts: now,
      type: 'earthquake_started',
      payload: {
        worldEventId: eventId,
        startedAt: now,
        endsAt,
        durationMs,
      },
    });

    return { eventId, worldId: args.worldId, startedAt: now, endsAt, durationMs };
  },
});

export const currentEarthquake = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query('worldEvents')
      .withIndex('worldId_type_startedAt', (q) => q.eq('worldId', args.worldId).eq('type', 'earthquake'))
      .order('desc')
      .take(10);
    const active = rows.find((row) => row.status === 'active' && row.startedAt <= now && now < row.endsAt);
    return active ?? null;
  },
});

export const latestEarthquake = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('worldEvents')
      .withIndex('worldId_type_startedAt', (q) => q.eq('worldId', args.worldId).eq('type', 'earthquake'))
      .order('desc')
      .first();
    return row ?? null;
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
    const now = Date.now();
    const scanLimit = Math.max(1, Math.min(args.scanLimit ?? DEFAULT_SCAN_LIMIT, MAX_SCAN_LIMIT));
    const topDyadsLimit = Math.max(1, Math.min(args.topDyads ?? DEFAULT_TOP_DYADS, MAX_TOP_DYADS));
    const topActorsLimit = Math.max(
      1,
      Math.min(args.topActors ?? DEFAULT_TOP_ACTORS, MAX_TOP_ACTORS),
    );

    const event = args.worldEventId
      ? await ctx.db.get(args.worldEventId)
      : await ctx.db
          .query('worldEvents')
          .withIndex('worldId_type_startedAt', (q) =>
            q.eq('worldId', args.worldId).eq('type', 'earthquake'),
          )
          .order('desc')
          .first();
    if (!event || event.worldId !== args.worldId) {
      return null;
    }

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
      .withIndex('worldId_ts', (q) => q.eq('worldId', args.worldId))
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
  },
});
