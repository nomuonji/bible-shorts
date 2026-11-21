#!/usr/bin/env node
import { readFile, readdir, writeFile, mkdir, copyFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateLedger, createSummary, advanceEpisode } from "../src/ledger.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2), command=args[0]??"help";
const opt=(name)=>{const i=args.indexOf("--"+name);return i>=0?args[i+1]:null;};
const readJSON=async(path)=>JSON.parse(await readFile(path,"utf8"));
const catalog=await readJSON(join(root,"catalog/books.json"));
const filenames=(await readdir(join(root,"episodes"))).filter((x)=>/^EP\d+\.json$/.test(x)).sort();
const episodes=await Promise.all(filenames.map((p)=>readJSON(join(root,"episodes",p))));
const result=validateLedger(catalog,episodes);
const asJSON=(value)=>console.log(JSON.stringify(value,null,2));
if(command==="validate"){
  asJSON(result);
  if(!result.ok)process.exitCode=1;
}else if(command==="summary"){
  if(!result.ok)throw Error(result.errors.join("\n"));
  asJSON(createSummary(catalog,episodes));
}else if(command==="plan" || command==="next"){
  if(!result.ok)throw Error(result.errors.join("\n"));
  const sorted=episodes.sort((a,b)=>a.sequence-b.sequence);
  asJSON(command==="next"?(sorted.find((e)=>e.state==="planned" && !e.holdReason)??null):sorted.map((e)=>({id:e.id,title:e.title.ja,ref:e.passage,state:e.state,hold:e.holdReason})));
}else if(command==="build"){
  if(!result.ok)throw Error("Invalid ledger: "+result.errors.join("\n"));
  const dist=join(root,"dist");
  await mkdir(dist,{recursive:true});
  for(const file of ["index.html","app.js","styles.css"])await copyFile(join(root,"web",file),join(dist,file));
  await writeFile(join(dist,"data.js"),"window.__BIBLE_SHORTS_DATA__ = "+JSON.stringify({generatedAt:new Date().toISOString(),catalog,episodes,summary:createSummary(catalog,episodes),warnings:result.warnings})+";\n");
  const data={generatedAt:new Date().toISOString(),catalog,episodes,summary:createSummary(catalog,episodes),warnings:result.warnings};
  await writeFile(join(dist,"data.json"),JSON.stringify(data,null,2)+"\n");
  console.log("Dashboard built: dist/index.html");
}else if(command==="advance"){
  if(!result.ok)throw Error("Existing ledger invalid:\n"+result.errors.join("\n"));
  const episodeID=args[1],nextState=args[2],patchPath=opt("patch"),actor=opt("actor"),note=opt("note")??"";
  if(!episodeID || !nextState || !patchPath || !actor)throw Error("Usage: advance EP001 scripted --patch ./evidence.json --actor username [--note text]");
  const patch=await readJSON(resolve(patchPath));
  const {updated}=advanceEpisode(catalog,episodes,episodeID,nextState,patch,actor,note);
  const outfile=join(root,"episodes",episodeID+".json");
  // Write atomically on the local filesystem; Git commit/PR is the external write receipt.
  const temp=outfile+".tmp-"+process.pid;
  await writeFile(temp,JSON.stringify(updated,null,2)+"\n");
  const {rename}=await import("node:fs/promises");
  await rename(temp,outfile);
  console.log("Updated "+episodeID+" to "+nextState+". Commit this file through review.");
}else if(command==="handoff"){
  if(!result.ok)throw Error(result.errors.join("\n"));
  const ep=episodes.find((e)=>e.id===args[1]);
  if(!ep)throw Error("Unknown episode.");
  if(!["scripted","rendered","qa_passed","approved"].includes(ep.state))throw Error("Handoff requires a source-reviewed script.");
  asJSON({
    contract:"bible-shorts/animation-factory-request/v1",episodeId:ep.id,
    sourceEdition:ep.lesson.sourceEdition,passage:ep.passage,
    scriptPath:ep.lesson.scriptPath,learningTarget:ep.lesson.learningTarget,
    renderer:ep.production.engine,style:ep.production.style,productionId:ep.production.productionId,
    publishAuthorized:false,notes:"Convert reviewed script to animation-factory productions/<productionId>/styled.json; render/inspect/QA before release."
  });
}else if(command==="publisher-sidecar"){
  if(!result.ok)throw Error(result.errors.join("\n"));
  const ep=episodes.find((e)=>e.id===args[1]),date=opt("at"),channelId=opt("channel");
  if(!ep || ep.state!=="approved")throw Error("Publishing handoff requires an explicitly approved episode.");
  if(!date || !channelId || !Number.isFinite(Date.parse(date)) || !/Z$|[+-]\d\d:\d\d$/.test(date) || Date.parse(date)<=Date.now())
    throw Error("Provide a future ISO 8601 --at and --channel. No upload will occur.");
  if(episodes.some((p)=>p.sequence<ep.sequence && !["queued","published"].includes(p.state)))
    throw Error("Previous episodes are not queued or published.");
  if(episodes.some((p)=>p.sequence<ep.sequence && p.delivery?.publishAt && Date.parse(p.delivery.publishAt)>=Date.parse(date)))
    throw Error("Scheduled time must follow all earlier episodes.");
  asJSON({
    title:ep.id+" "+ep.title.en,
    description:"Bible Shorts / "+ep.passage.book+" "+ep.passage.from.chapter+":"+ep.passage.from.verse+"–"+ep.passage.to.chapter+":"+ep.passage.to.verse+
      "\nWorld English Bible (66-book edition): https://ebible.org/engwebp/\nAdapted storytelling for English learning; not a verbatim scripture reading.",
    hashtags:"#BibleShorts #LearnEnglish #聖書",
    postNow:"YouTube",publishAt:date,
    expectedChannelId:channelId,idempotencyKey:"bible-shorts-"+ep.id+"-"+ep.production.artifactSha256.slice(0,16),
    sourceArtifactSha256:ep.production.artifactSha256,
    comment:"Handoff metadata only. Requires an already reviewed MP4, configured concept/channel and a separate authorized publisher action."
  });
}else{
  console.log("Bible Shorts: validate | summary | plan | next | build | advance | handoff | publisher-sidecar");
  if(command!=="help")process.exitCode=2;
}
