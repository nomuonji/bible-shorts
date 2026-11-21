# Bible Shorts — Agent Instructions

The source of truth for the series is this repository. It is **not** the Bible text provider, animation renderer or YouTube upload service.

1. Read README, catalog/source.json, catalog/books.json and docs/integrations.md. Preserve the 66-book canonical order and 1,189 chapters unless the user explicitly changes it.
2. Each episode has a contiguous passage (book/chapter/verse). Genesis 1:1–3:24 is already divided into 10 planned episodes; append new episodes without gaps or duplicate spans.
3. Use the pinned World English Bible 66-book edition (engwebp) for English source checking. Direct scripture quotations and adapted instructional dialogue must remain clearly distinguishable. No fabricated citations.
4. Low-poly 3D is the default Animation Factory look. English storytelling is primary; Japanese captions aid understanding. Choose a reusable learning target based on the actual story/script.
5. State machine: planned → scripted → rendered → qa_passed → approved → queued → published. Advance only one step via CLI. Require actual script, rendered asset hash, QA evidence, human editorial approval, queue receipt and YouTube readback at their stages.
6. Never invent artifact SHAs, approval identities, external receipts, video IDs, performance metrics, or copyright permissions. No credentials in the repository.
7. No unattended uploading or publishing from here. Never inherit a different project's channel credentials or permission to post. Before any publisher action confirm intended destination, reviewed MP4 and the actual user authorization.
8. Run npm run check for content changes and inspect the human-facing dashboard. CI success is not an editorial approval.
9. Canon coverage, delivery ledger and publication metrics live here; renderer contents live in animation-factory; SNS credential/service lives in video-publisher; My Portal can index/link but should not fork this ledger.
