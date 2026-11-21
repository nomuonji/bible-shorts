# Interoperability contracts

## Systems and responsibility

| Source | Owner |
| --- | --- |
| Bible Shorts | canon order, segments, lesson outlines, production refs, explicit approval, upload receipts |
| Animation Factory | low-poly 3D scenes, English audio and Japanese captions, MP4 and visual/technical QA |
| Shin-MotionMaker | optional high-complexity Remotion production; not an automatic upload path |
| Video Publisher | channel credentials, upload/queue scheduling, YouTube ID and metrics API |
| My Portal | view/navigation and orchestration; Git ledger remains canonical |

## Handoff (disabled for automation until tested)

1. Create a source-checked lesson script for an episode, keeping Scripture quotations and adapted dialogue separately attributed. Record the script path, one `learningTarget` and `adaptationDisclosure`; advance to `scripted`.
2. Use `node scripts/bible.mjs handoff EP001` to produce a **reference JSON** to send to Animation Factory. This is not a fabricated styled.json or an actual rendering trigger.
3. Implement real scenes in Animation Factory `productions/<id>/styled.json`, with `style:"low-poly-3d"`. After a real MP4 and review pack exist, save revision, SHA256, review URL and advance to rendered.
4. Review script fidelity, English, Japanese, license, captions, audio, visual composition and timing. Store eight QA results, reviewer and report URL; only then advance to qa_passed.
5. An authorized human editorial approval (identity, timestamp, evidence) is required before approved.
6. For Video Publisher, use `publisher-sidecar` to create upload **metadata** only. `incoming/<concept>/*.{mp4,json}` is an existing mechanism in the other repo, but verify its current contract, configured channel and idempotency controls before enabling it for Bible Shorts.
7. When the external queue has accepted an actual upload, record delivery.queueReceipt, channelId, publishAt, stable idempotencyKey and advance to queued. The previous episode must already be queued/published and its scheduled time must precede this one.
8. Only after YouTube readback verifies the public upload should delivery.videoId, videoUrl, actual publishedAt, verifiedAt and readbackVerified be saved, allowing published status. The previous episode must already be published.
9. Analytics should use observed snapshots (24h, 72h, 7d) tied to videoId; never count planned or rendered content as public performance.

No scheduled uploader, direct My Portal write API, or production deploy exists in this MVP. Turn these on only after verifying service credentials and explicit channel/publication policy.
