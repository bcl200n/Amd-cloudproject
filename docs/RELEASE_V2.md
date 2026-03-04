# v2 Release Notes

Date: 2026-03-04

## Highlights

- Added dual-cycle world events:
  - `earthquake` (short window)
  - `city_update` (long window)
- Added automatic event scheduler and reconciler:
  - starts events by schedule
  - ends expired events automatically
- Added event-aware interaction analytics:
  - per-event window summary for `earthquake` and `city_update`
  - includes top event types, top actors, top dyads, timeline buckets
- Added bilingual UI switch (Chinese / English):
  - main page text
  - help modal
  - key action buttons
  - player/chat side panel
  - world events dashboard

## Deployment Notes

- Backend: Convex schema includes `worldEvents` and `worldEventSchedules`.
- Frontend: new world events dashboard component is enabled on the home page.
- Existing `main` branch is compatible with previous data, but running `convex dev`/deploy is required to apply schema updates.

## Common Commands

```bash
# build check
npm run build

# check current schedule
npx convex run worldEvents:worldEventSchedule '{"worldId":"<worldId>"}'

# tune schedule
npx convex run worldEvents:configureWorldEventSchedule '{
  "worldId":"<worldId>",
  "earthquakeIntervalMinMs":600000,
  "earthquakeIntervalMaxMs":1200000,
  "earthquakeDurationMinMs":180000,
  "earthquakeDurationMaxMs":300000,
  "cityUpdateIntervalMinMs":5400000,
  "cityUpdateIntervalMaxMs":9000000,
  "cityUpdateDurationMinMs":1200000,
  "cityUpdateDurationMaxMs":2400000
}'

# manual triggers (optional)
npx convex run worldEvents:triggerEarthquake '{"worldId":"<worldId>"}'
npx convex run worldEvents:triggerCityUpdate '{"worldId":"<worldId>"}'
```

## Rollback

```bash
# switch to a previous tag/commit locally
git checkout <old-tag-or-commit>

# or reset main to previous commit and force push only if required
# (coordinate before force push)
```
