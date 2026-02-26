# ProspectAI E2E Checklist

Date: 2026-02-26

## Flow

1. Register and login.
2. Create/select organization.
3. Connect WhatsApp instance in `/settings/whatsapp`.
4. Start extraction in `/extraction` (small sample: 5-10 leads).
5. Confirm leads appear in `/leads` with score and status.
6. Create campaign in `/campaigns/new` and launch.
7. Verify cadence queue schedules sends in worker logs.
8. Receive inbound WhatsApp reply and confirm it appears in `/inbox`.
9. Generate AI suggestion and send approved reply.
10. Move lead through pipeline in `/leads?view=board`.
11. Verify notification bell events for replies/extraction/pauses.
12. Pause and resume campaign in `/campaigns`.

## Verification Notes

- Manual hardware integration required for WhatsApp + Evolution API.
- Requires valid `APIFY_TOKEN` and at least one AI provider configured.
- Run worker in a separate terminal: `npm run worker`.
