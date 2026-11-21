import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { validateLedger, createSummary, advanceEpisode, STAGES } from "../src/ledger.mjs";

const root=new URL("../",import.meta.url);
const catalog=JSON.parse(await readFile(new URL("../catalog/books.json",import.meta.url),"utf8"));
const episodePaths=(await readdir(new URL("../episodes/",import.meta.url))).filter((x)=>/^EP\d+\.json$/.test(x)).sort();
const episodes=await Promise.all(episodePaths.map(async(x)=>JSON.parse(await readFile(new URL("../episodes/"+x,import.meta.url),"utf8"))));
const clone=()=>structuredClone(episodes);
const evidence=(ep)=>{
  ep.lesson.scriptPath="scripts/episode-reviewed.md";
  ep.lesson.learningTarget="Let there be light";
  ep.lesson.adaptationDisclosure="Adapted English for learning. Biblical quotations are attributed separately.";
  ep.lesson.translationReviewed=true;
  ep.production.productionRevision="test-review-commit";
  ep.production.artifactSha256="a".repeat(64);
  ep.production.reviewUrl="https://example.org/review/"+ep.id;
  ep.production.qa={
    sourceAccuracy:true,englishNaturalness:true,translation:true,copyright:true,
    subtitles:true,audio:true,visual:true,lineSync:true,
    reviewer:"reviewer",reportUrl:"https://example.org/qa/"+ep.id
  };
  ep.approval={decision:"approved",by:"human-reviewer",at:"2026-11-21T10:00:00Z",evidence:"recorded explicit approval"};
  ep.delivery={provider:"youtube",channelId:"test-channel",
    publishAt:"2026-12-01T10:00:00Z",idempotencyKey:"test-"+ep.id,
    queueReceipt:"publisher-record-"+ep.id,videoId:"test-video-"+ep.id,
    videoUrl:"https://www.youtube.com/watch?v=test-"+ep.id,
    publishedAt:"2026-12-01T10:01:00Z",verifiedAt:"2026-12-01T10:05:00Z",readbackVerified:true};
};
test("initial manifest has 66 books, 1,189 chapters and Genesis 1–3 without gaps",()=>{
  assert.equal(catalog.books.length,66);
  assert.equal(catalog.books.reduce((n,b)=>n+b.chapters,0),1189);
  assert.deepEqual(validateLedger(catalog,episodes).errors,[]);
  const s=createSummary(catalog,episodes);
  assert.equal(s.plannedVerifiedVerses,80);
  assert.equal(s.publishedVerifiedVerses,0);
  assert.equal(s.nextToProduce,"EP001");
});
test("episode overlap and missing verse are rejected",()=>{
  const overlap=clone();overlap[1].passage.from.verse=5;
  assert.match(validateLedger(catalog,overlap).errors.join(" "),/Overlaps/);
  const gap=clone();gap[1].passage.from.verse=7;
  assert.match(validateLedger(catalog,gap).errors.join(" "),/Gap/);
});
test("a future episode cannot start after a missing canonical passage",()=>{
  const missing=clone();missing[8].passage.from.chapter=4;missing[8].passage.from.verse=1;
  assert.equal(validateLedger(catalog,missing).ok,false);
});
test("transitions are one-step and require source-script evidence",()=>{
  assert.throws(()=>advanceEpisode(catalog,episodes,"EP001","approved",{},"editor","bypass"),/single forward/);
  assert.throws(()=>advanceEpisode(catalog,episodes,"EP001","scripted",{},"editor","missing"),/Script evidence/);
  assert.throws(()=>advanceEpisode(catalog,episodes,"EP001","scripted",{sequence:99},"editor","overwrite"),/cannot change/);
  const patch={lesson:{scriptPath:"scripts/ep001.md",learningTarget:"let there be",adaptationDisclosure:"Quoted verses marked; dialog adapted."}};
  const {updated}=advanceEpisode(catalog,episodes,"EP001","scripted",patch,"editor","reviewed text");
  assert.equal(updated.state,"scripted");assert.equal(episodes[0].state,"planned");
  assert.equal(updated.events.length,1);
});
test("queueing requires approval and preceding queue receipts",()=>{
  const queued=clone();for(let i=0;i<2;i++){evidence(queued[i]);queued[i].state="approved";}
  queued[1].state="queued";
  assert.match(validateLedger(catalog,queued).errors.join(" "),/Cannot queue before/);
  queued[0].state="queued";
  queued[1].delivery.publishAt="2026-12-02T10:00:00Z";
  assert.equal(validateLedger(catalog,queued).ok,true);
  queued[1].delivery.publishAt=queued[0].delivery.publishAt;
  assert.match(validateLedger(catalog,queued).errors.join(" "),/strictly later/);
});
test("publishing the second episode before the first is confirmed is blocked",()=>{
  const set=clone();
  for(let i=0;i<2;i++){evidence(set[i]);set[i].state="queued";}
  set[1].delivery.publishAt="2026-12-02T10:00:00Z";
  set[1].state="published";
  assert.match(validateLedger(catalog,set).errors.join(" "),/Publishing out of order/);
  set[0].state="published";
  assert.equal(validateLedger(catalog,set).ok,true);
  set[1].delivery.videoId=set[0].delivery.videoId;
  assert.match(validateLedger(catalog,set).errors.join(" "),/Duplicate YouTube video ID/);
  set[1].delivery.videoId="test-video-EP002";
  set[1].delivery.readbackVerified=false;
  assert.match(validateLedger(catalog,set).errors.join(" "),/readback verification/);
});
test("holding an episode prevents transition without clearing its hold through review",()=>{
  const set=clone();set[0].holdReason="source review required";
  assert.throws(()=>advanceEpisode(catalog,set,"EP001","scripted",{}, "agent",""),/on hold/);
});
