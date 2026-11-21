/**
 * Bible Shorts ledger: strict ordinal and publication gate.
 * Data (not scripts or MP4 files) is the source of truth in this repository.
 * No network requests, authentication, uploads, or publishing in this module.
 */
export const STAGES = ["planned", "scripted", "rendered", "qa_passed", "approved", "queued", "published"];
export const QA_FIELDS = ["sourceAccuracy", "englishNaturalness", "translation", "copyright", "subtitles", "audio", "visual", "lineSync"];
const NONEMPTY = (v) => typeof v === "string" && v.trim().length > 0;
const ISO_DATE = (v) => NONEMPTY(v) && Number.isFinite(Date.parse(v)) && /Z$|[+-]\d\d:\d\d$/.test(v);
const position = (bookOrder, c, v) => bookOrder * 1e7 + c * 1000 + v;
const numberIs = (v) => Number.isInteger(v) && v > 0;

export function validateLedger(catalog, episodes) {
  const errors = [], warnings = [];
  const books = catalog?.books ?? [];
  const byCode = new Map(books.map((b) => [b.code, b]));
  if (catalog?.canon !== "protestant-66" || books.length !== 66) errors.push("The initial canon must contain exactly 66 books.");
  if (books.reduce((n, b) => n + b.chapters, 0) !== 1189) errors.push("Book chapter counts must total 1189.");
  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    if (b.order !== i + 1 || !NONEMPTY(b.code) || !NONEMPTY(b.ja) || !numberIs(b.chapters)) errors.push("Invalid canonical book at order " + (i+1));
  }
  if (new Set(books.map((b) => b.code)).size !== books.length) errors.push("Duplicate canonical book code.");
  const seenIDs = new Set(), seenProductionIds = new Set(), seenVideoIds = new Set(), seenDeliveryKeys = new Set();
  let previous = null;
  const epList = [...episodes].sort((a,b) => a.sequence - b.sequence);
  for (const [index, ep] of epList.entries()) {
    const prefix = String(ep.id ?? "episode " + index) + ": ";
    if (!/^EP\d{3,}$/.test(ep.id ?? "") || ep.sequence !== index + 1 || ep.id !== "EP" + String(index+1).padStart(3, "0")) errors.push(prefix + "Episode IDs and sequence must be contiguous from EP001.");
    if (seenIDs.has(ep.id)) errors.push(prefix + "Duplicate episode ID.");
    seenIDs.add(ep.id);
    if (!NONEMPTY(ep.title?.ja) || !NONEMPTY(ep.title?.en)) errors.push(prefix + "Missing bilingual title.");
    if (!["narration", "dramatization", "overview"].includes(ep.format)) errors.push(prefix + "Unknown format.");
    if (!STAGES.includes(ep.state)) errors.push(prefix + "Unknown state " + ep.state);
    const book = byCode.get(ep.passage?.book);
    const start = ep.passage?.from, end = ep.passage?.to;
    let a, z;
    if (!book || !start || !end || !numberIs(start.chapter) || !numberIs(end.chapter) ||
      !numberIs(start.verse) || !numberIs(end.verse) || start.chapter > book.chapters || end.chapter > book.chapters) {
      errors.push(prefix + "Invalid canonical passage."); continue;
    }
    a = position(book.order, start.chapter, start.verse);
    z = position(book.order, end.chapter, end.verse);
    if (a > z) errors.push(prefix + "Reversed passage range.");
    for (const c of [start, end]) {
      const limit = catalog.verifiedVerseCounts?.[book.code]?.[String(c.chapter)];
      if (limit && c.verse > limit) errors.push(prefix + "Verse exceeds verified verse count in " + book.code + " " + c.chapter);
      if (!limit) warnings.push(prefix + "Verse count for " + book.code + " " + c.chapter + " is not verified; completeness cannot be claimed.");
    }
    if (previous) {
      if (a <= previous.endPos) errors.push(prefix + "Overlaps or reverses " + previous.ep.id + ".");
      const prev = previous.ep.passage;
      const previousBook = byCode.get(prev.book);
      const previousLimit = catalog.verifiedVerseCounts?.[previousBook.code]?.[String(prev.to.chapter)];
      let contiguous = false, known = false;
      if (prev.book === book.code && prev.to.chapter === start.chapter) {
        known = true; contiguous = start.verse === prev.to.verse + 1;
      } else if (prev.book === book.code && start.chapter === prev.to.chapter + 1) {
        known = Boolean(previousLimit);
        contiguous = prev.to.verse === previousLimit && start.verse === 1;
      } else if (book.order === previousBook.order + 1 && prev.to.chapter === previousBook.chapters && start.chapter === 1) {
        known = Boolean(previousLimit);
        contiguous = prev.to.verse === previousLimit && start.verse === 1;
      } else {
        known = true;
      }
      if (known && !contiguous) errors.push(prefix + "Gap in ordered passage sequence after " + previous.ep.id + ".");
      if (!known) warnings.push(prefix + "Passage adjacency is unverified; add source-checked verse counts.");
    } else if (book.order !== 1 || start.chapter !== 1 || start.verse !== 1) {
      errors.push(prefix + "Series must begin at Genesis 1:1.");
    }
    previous = {ep, endPos:z};
    if (ep.lesson?.sourceEdition !== "engwebp") errors.push(prefix + "Source edition is not the pinned WEB 66-book edition.");
    if (ep.production?.engine !== "animation-factory" || ep.production?.style !== "low-poly-3d" || !NONEMPTY(ep.production?.productionId)) errors.push(prefix + "Missing standard low-poly production configuration.");
    if (seenProductionIds.has(ep.production?.productionId)) errors.push(prefix + "Duplicate production ID.");
    seenProductionIds.add(ep.production?.productionId);
    const stage = STAGES.indexOf(ep.state);
    if (stage >= 1 && (!NONEMPTY(ep.lesson?.scriptPath) || !NONEMPTY(ep.lesson?.learningTarget) || !NONEMPTY(ep.lesson?.adaptationDisclosure)))
      errors.push(prefix + "Script evidence, learning target, and disclosure are mandatory.");
    if (stage >= 2 && (!NONEMPTY(ep.production?.productionRevision) || !/^[0-9a-f]{64}$/.test(ep.production?.artifactSha256 ?? "") || !NONEMPTY(ep.production?.reviewUrl)))
      errors.push(prefix + "Rendered evidence (revision, SHA256, review URL) is incomplete.");
    if (stage >= 3) {
      const q = ep.production?.qa;
      if (!q || !NONEMPTY(q.reviewer) || !NONEMPTY(q.reportUrl) || QA_FIELDS.some((key) => q[key] !== true) || ep.lesson?.translationReviewed !== true)
        errors.push(prefix + "Required QA checks, reviewer, report, or translation review missing.");
    }
    if (stage >= 4 && (ep.approval?.decision !== "approved" || !NONEMPTY(ep.approval?.by) || !ISO_DATE(ep.approval?.at) || !NONEMPTY(ep.approval?.evidence)))
      errors.push(prefix + "Explicit editorial approval evidence missing.");
    if (stage >= 5) {
      const d = ep.delivery;
      if (d?.provider !== "youtube" || !NONEMPTY(d?.channelId) || !ISO_DATE(d?.publishAt) || !NONEMPTY(d?.idempotencyKey) || !NONEMPTY(d?.queueReceipt))
        errors.push(prefix + "Queue receipt, YouTube channel, date or idempotency key missing.");
      if (seenDeliveryKeys.has(d?.idempotencyKey)) errors.push(prefix + "Duplicate idempotency key.");
      seenDeliveryKeys.add(d?.idempotencyKey);
      const older = epList.filter((p) => p.sequence < ep.sequence);
      if (older.some((p) => !["queued","published"].includes(p.state))) errors.push(prefix + "Cannot queue before all preceding episodes are queued or published.");
      if (older.some((p) => p.delivery?.publishAt && Date.parse(p.delivery.publishAt) >= Date.parse(d?.publishAt))) errors.push(prefix + "PublishAt must be strictly later than all preceding episode times.");
    }
    if (stage >= 6) {
      const d = ep.delivery;
      if (!NONEMPTY(d?.videoId) || !NONEMPTY(d?.videoUrl) || !ISO_DATE(d?.publishedAt) || !ISO_DATE(d?.verifiedAt) || d?.readbackVerified !== true)
        errors.push(prefix + "Published status needs YouTube video ID, URL, timestamps and readback verification.");
      if (epList.some((p) => p.sequence < ep.sequence && p.state !== "published")) errors.push(prefix + "Publishing out of order is prohibited.");
      if (seenVideoIds.has(d?.videoId)) errors.push(prefix + "Duplicate YouTube video ID.");
      seenVideoIds.add(d?.videoId);
    }
    if (ep.holdReason != null && !NONEMPTY(ep.holdReason)) errors.push(prefix + "Invalid hold reason.");
    if (!Array.isArray(ep.events)) errors.push(prefix + "Audit events must be an array.");
  }
  return {ok:errors.length === 0, errors, warnings};
}

export function createSummary(catalog, episodes) {
  const sorted = [...episodes].sort((a,b) => a.sequence-b.sequence);
  const planned = new Set(), published = new Set();
  const verified = catalog.verifiedVerseCounts ?? {};
  for (const ep of sorted) {
    const p = ep.passage;
    if (p?.book !== "GEN") continue;
    for (let c=p.from.chapter;c<=p.to.chapter;c++) {
      const max=verified.GEN?.[String(c)];
      if (!max) continue;
      const from=c===p.from.chapter?p.from.verse:1, to=c===p.to.chapter?p.to.verse:max;
      for(let v=from;v<=to;v++) {
        const key=c+":"+v;planned.add(key);
        if(ep.state==="published")published.add(key);
      }
    }
  }
  const states = Object.fromEntries(STAGES.map((state) => [state, sorted.filter((ep) => ep.state===state).length]));
  return {
    canon:catalog.canon,totalBooks:catalog.books.length,totalChapters:catalog.chapterCount,
    states,episodeCount:sorted.length,plannedVerifiedVerses:planned.size,publishedVerifiedVerses:published.size,
    verifiedGenesisVerses:Object.values(verified.GEN ?? {}).reduce((a,b)=>a+b,0),
    nextToProduce:sorted.find((e)=>!e.holdReason && e.state==="planned")?.id ?? null,
    nextToPublish:sorted.find((e)=>e.state!=="published")?.id ?? null
  };
}

export function advanceEpisode(catalog, episodes, episodeID, nextState, patch, actor, note) {
  const old = episodes.find((e)=>e.id===episodeID);
  if(!old)throw Error("Unknown episode " + episodeID);
  if(!NONEMPTY(actor))throw Error("An accountable actor is required.");
  if(old.holdReason)throw Error("Episode is on hold: " + old.holdReason);
  const from=STAGES.indexOf(old.state), to=STAGES.indexOf(nextState);
  if(from<0 || to!==from+1)throw Error("Only a single forward transition is permitted: " + old.state + " -> " + nextState);
  if(patch === null || Array.isArray(patch) || typeof patch !== "object")throw Error("Patch must be a JSON object.");
  const allowed = new Set(["lesson","production","approval","delivery","metrics"]);
  for (const key of Object.keys(patch)) if(!allowed.has(key))throw Error("Patch cannot change " + key);
  const updated=structuredClone(old);
  for(const [field,value] of Object.entries(patch)){
    if(value===null || typeof value !== "object" || Array.isArray(value))throw Error("Expected object patch for " + field);
    updated[field]={...(updated[field]??{}),...value};
  }
  updated.state=nextState;
  updated.events.push({at:new Date().toISOString(),from:old.state,to:nextState,actor,note:note??""});
  const changed=episodes.map((e)=>e.id===episodeID?updated:e);
  const result=validateLedger(catalog,changed);
  if(!result.ok)throw Error("Ledger rejected transition:\n"+result.errors.join("\n"));
  return {episodes:changed,updated};
}
