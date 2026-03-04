import { v } from 'convex/values';
import { query } from './_generated/server';

const DEFAULT_EVENT_LIMIT = 100;
const MAX_EVENT_LIMIT = 500;
const DEFAULT_LOOKBACK_MS = 60 * 60 * 1000;
const DEFAULT_SCAN_LIMIT = 2000;
const MAX_SCAN_LIMIT = 10000;
const DEFAULT_TOP_DYADS = 20;
const MAX_TOP_DYADS = 100;
const DEFAULT_TOP_ACTORS = 20;
const MAX_TOP_ACTORS = 100;

export const recentSocialEvents = query({
  args: {
    worldId: v.id('worlds'),
    limit: v.optional(v.number()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requestedLimit = args.limit ?? DEFAULT_EVENT_LIMIT;
    const limit = Math.max(1, Math.min(requestedLimit, MAX_EVENT_LIMIT));
    const events = [];
    if (args.type) {
      const type = args.type;
      const rows = ctx.db
        .query('socialEvents')
        .withIndex('worldId_type_ts', (q) => q.eq('worldId', args.worldId).eq('type', type))
        .order('desc');
      for await (const row of rows) {
        events.push(row);
        if (events.length >= limit) {
          break;
        }
      }
      return events;
    }
    const rows = ctx.db
      .query('socialEvents')
      .withIndex('worldId_ts', (q) => q.eq('worldId', args.worldId))
      .order('desc');
    for await (const row of rows) {
      events.push(row);
      if (events.length >= limit) {
        break;
      }
    }
    return events;
  },
});

export const interactionSummary = query({
  args: {
    worldId: v.id('worlds'),
    lookbackMs: v.optional(v.number()),
    scanLimit: v.optional(v.number()),
    topDyads: v.optional(v.number()),
    topActors: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const lookbackMs = Math.max(1, args.lookbackMs ?? DEFAULT_LOOKBACK_MS);
    const cutoff = now - lookbackMs;
    const scanLimit = Math.max(1, Math.min(args.scanLimit ?? DEFAULT_SCAN_LIMIT, MAX_SCAN_LIMIT));
    const topDyadsLimit = Math.max(1, Math.min(args.topDyads ?? DEFAULT_TOP_DYADS, MAX_TOP_DYADS));
    const topActorsLimit = Math.max(
      1,
      Math.min(args.topActors ?? DEFAULT_TOP_ACTORS, MAX_TOP_ACTORS),
    );

    const typeCounts = new Map<string, number>();
    const actorCounts = new Map<string, number>();
    const dyadCounts = new Map<string, { actorA: string; actorB: string; count: number }>();

    let scanned = 0;
    let inWindow = 0;
    const rows = ctx.db
      .query('socialEvents')
      .withIndex('worldId_ts', (q) => q.eq('worldId', args.worldId))
      .order('desc');
    for await (const event of rows) {
      if (event.ts < cutoff) {
        break;
      }
      scanned += 1;
      inWindow += 1;
      typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);

      if (event.actorId) {
        actorCounts.set(event.actorId, (actorCounts.get(event.actorId) ?? 0) + 1);
      }
      if (event.actorId && event.targetId) {
        const [actorA, actorB] = [event.actorId, event.targetId].sort();
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

    return {
      worldId: args.worldId,
      window: {
        fromTs: cutoff,
        toTs: now,
        lookbackMs,
      },
      scanned,
      inWindow,
      byType,
      topActors,
      topDyads,
    };
  },
});
