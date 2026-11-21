const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusNames={planned:"企画済み",scripted:"台本完成",rendered:"映像生成済み",qa_passed:"品質確認済み",approved:"承認済み",queued:"予約済み",published:"公開済み"};
const formatNames={narration:"ナレーション",dramatization:"ドラマ",overview:"概要解説"};
let data=null, selectedBook="GEN",allBooks=false,statusFilter="all",searchBook="",searchEpisode="";
const verseLabel=(p)=>{
  if(!p)return "—";
  const a=p.from,b=p.to;
  return p.book+" "+a.chapter+":"+a.verse+"–"+(a.chapter===b.chapter?"":b.chapter+":")+b.verse;
};
const sortEpisodes=(episodes)=>[...episodes].sort((a,b)=>a.sequence-b.sequence);
const compareStamp=(stamp)=>{
  if(!stamp)return "—";
  try{return new Date(stamp).toLocaleString("ja-JP",{dateStyle:"medium",timeStyle:"short"});}catch{return stamp;}
};
function renderStats(){
  const s=data.summary;
  const stats=[
    [String(s.totalBooks),"正典の巻数","39巻 + 27巻"],
    [s.totalChapters.toLocaleString(),"全章数","正典の章目録"],
    [String(s.episodeCount),"企画済みエピソード","Genesis 1–3 を初期構成"],
    [String(s.states.published),"公開済み","未公開を完了扱いしない"]
  ];
  $("stats").innerHTML=stats.map((x)=>'<div class="stat"><label>'+escapeHTML(x[1])+'</label><div class="num">'+escapeHTML(x[0])+'</div><small>'+escapeHTML(x[2])+'</small></div>').join("");
}
function renderBooks(){
  let books=data.catalog.books;
  if(searchBook){
    books=books.filter((b)=>(b.ja+" "+b.en+" "+b.code).toLowerCase().includes(searchBook.toLowerCase()));
  }else if(!allBooks)books=books.slice(0,12);
  $("toggleBooks").textContent=allBooks?"最初の12巻":"全66巻を見る";
  $("books").innerHTML=books.map((b)=>{
    const count=data.episodes.filter((e)=>e.passage.book===b.code).length;
    return '<button type="button" class="book '+(selectedBook===b.code?"active":"")+'" data-book="'+escapeHTML(b.code)+'">'+
      '<span class="book-num">'+String(b.order).padStart(2,"0")+'</span><strong>'+escapeHTML(b.ja)+'<small>'+escapeHTML(b.en)+'</small></strong>'+
      '<span class="count">'+(count?count+" 話":"—")+'</span></button>';
  }).join("");
  if(!books.length)$("books").innerHTML='<div class="empty">一致する書名がありません。</div>';
  document.querySelectorAll("[data-book]").forEach((button)=>button.addEventListener("click",()=>{
    selectedBook=button.dataset.book;renderBooks();renderEpisodes();
  }));
}
function renderEpisodes(){
  const book=data.catalog.books.find((b)=>b.code===selectedBook);
  if(!book)return;
  const matching=data.episodes.filter((e)=>e.passage.book===selectedBook).sort((a,b)=>a.sequence-b.sequence);
  $("sectionTitle").textContent=book.ja+" / "+book.en;
  $("sectionSub").textContent=book.chapters+"章 · "+matching.length+"話を企画 · "+book.testament;
  const filtered=matching.filter((e)=>(statusFilter==="all"||e.state===statusFilter)&&
    (e.title.ja+" "+e.title.en+" "+verseLabel(e.passage)).toLowerCase().includes(searchEpisode.toLowerCase()));
  $("episodeList").innerHTML=filtered.map((e)=>'<button type="button" class="episode-row" data-episode="'+escapeHTML(e.id)+'">'+
    '<span class="episode-number">'+escapeHTML(e.id)+'</span>'+
    '<span class="episode-title"><strong>'+escapeHTML(e.title.ja)+'</strong><small>'+escapeHTML(e.title.en)+'</small></span>'+
    '<span class="verse-ref">'+escapeHTML(verseLabel(e.passage))+'</span>'+
    '<span class="status '+escapeHTML(e.holdReason?"hold":e.state)+'">'+escapeHTML(e.holdReason?"保留":statusNames[e.state]??e.state)+'</span>'+
    '<span class="chev">›</span></button>').join("");
  if(!filtered.length)$("episodeList").innerHTML='<div class="empty">この書巻・条件に該当するエピソードはまだありません。<br>未作成の範囲は「完了」ではなく「未構成」です。</div>';
  document.querySelectorAll("[data-episode]").forEach((button)=>button.addEventListener("click",()=>showDetail(button.dataset.episode)));
}
function showDetail(id){
  const e=data.episodes.find((ep)=>ep.id===id);
  if(!e)return;
  const field=(label,value)=>'<div><small>'+escapeHTML(label)+'</small><strong>'+escapeHTML(value??"未登録")+'</strong></div>';
  const title=escapeHTML(e.title.ja),reference=escapeHTML(verseLabel(e.passage));
  const next={planned:"原文確認・短尺の脚本・英語の学習表現を決める",scripted:"Animation Factoryへ制作を引き渡す",rendered:"映像・音声・字幕の品質を検証する",qa_passed:"人間の編集承認を取得する",approved:"公開先・時刻・動画ID重複を確認して予約する",queued:"予約状態と投稿結果をYouTubeで照合する",published:"公開後の実測を記録する"};
  $("detailBody").innerHTML='<h2 class="detail-title">'+escapeHTML(e.id)+' '+title+'</h2>'+
    '<p class="detail-sub">'+escapeHTML(e.title.en)+' · '+reference+'</p>'+
    '<div class="detail-grid">'+
    field("状態",e.holdReason?"保留："+e.holdReason:statusNames[e.state])+
    field("形式",formatNames[e.format]??e.format)+
    field("英語表現",e.lesson.learningTarget??"台本工程で設定")+
    field("画風",e.production.style)+
    field("制作ID",e.production.productionId)+
    field("最終公開",e.delivery?.videoUrl??"未公開")+
    '</div><p class="detail-note"><strong>次の工程：</strong>'+escapeHTML(next[e.state])+
    '<br><strong>典拠：</strong>World English Bible（66巻版）／'+reference+
    '<br><strong>注記：</strong>聖書本文の引用と脚色した会話は別管理。公開承認は動画完成と別のステータスです。</p>';
  $("details").showModal();
}
function renderNext(){
  const e=data.episodes.find((item)=>item.id===data.summary.nextToProduce);
  $("nextAction").innerHTML=e?'<p class="next-link">'+escapeHTML(e.id)+'｜'+escapeHTML(e.title.ja)+
    '<br><small>'+escapeHTML(verseLabel(e.passage))+' · 脚本未着手</small></p>':
    '<p>現在、未着手の候補はありません。追加の原典区分を確認してください。</p>';
}
async function init(){
  try{
    if(window.__BIBLE_SHORTS_DATA__) data=window.__BIBLE_SHORTS_DATA__;
    else {
      const response=await fetch("./data.json",{cache:"no-store"});
      if(!response.ok)throw Error("HTTP "+response.status);
      data=await response.json();
    }
    if(!data.catalog?.books || !data.episodes)throw Error("Unexpected data schema");
    renderStats();renderBooks();renderEpisodes();renderNext();
    $("generated").textContent="台帳生成 "+compareStamp(data.generatedAt);
  }catch(err){
    $("stats").innerHTML='<p class="loading">台帳を読み込めません: '+escapeHTML(err.message)+'</p>';
    $("books").innerHTML='<div class="empty">npm run build を実行し dist/ をWebサーバーで開いてください。</div>';
    $("episodeList").innerHTML='<div class="empty">現在の台帳は取得できませんでした。</div>';
  }
}
$("toggleBooks").addEventListener("click",()=>{allBooks=!allBooks;renderBooks();});
$("searchBooks").addEventListener("input",(event)=>{searchBook=event.target.value;renderBooks();});
$("statusFilter").addEventListener("change",(event)=>{statusFilter=event.target.value;renderEpisodes();});
$("searchEpisodes").addEventListener("input",(event)=>{searchEpisode=event.target.value;renderEpisodes();});
$("closeDetail").addEventListener("click",()=>$("details").close());
$("details").addEventListener("click",(event)=>{if(event.target===$("details"))$("details").close();});
init();
