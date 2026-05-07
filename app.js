const STORAGE_KEY = "vlux_expo_field_note_v2";
const CHECKS = [
  "프라이빗 라벨 가능성", "자사와 유사 컨셉", "신제형/신포장", "기능성 표현 방식",
  "원료 조합 참고", "수출 전략 참고", "진열/패키지 우수", "내 반려동물에게 사용하고 싶음"
];
const TAGS = ["신제형", "신포장", "기능성표현", "원료", "수출", "PB/OEM", "진열", "벤치마킹"];

let booths = load();
let editingPhotos = [];
let editingAudios = [];
let mediaRecorder = null;
let audioChunks = [];
let currentStream = null;

const $ = (id) => document.getElementById(id);

function load(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch(e){ return []; }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(booths)); render(); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function today(){ return new Date().toISOString().slice(0,10); }

function init(){
  $("checks").innerHTML = CHECKS.map((c,i)=>`<label class="check"><input type="checkbox" value="${c}" id="check${i}">${c}</label>`).join("");
  $("tagFilter").innerHTML += TAGS.map(t=>`<option value="${t}">${t}</option>`).join("");
  $("newBoothBtn").onclick = () => openDialog();
  $("navAdd").onclick = () => openDialog();
  $("closeDialogBtn").onclick = closeDialog;
  $("cancelBtn").onclick = closeDialog;
  $("boothForm").onsubmit = handleSubmit;
  $("deleteBoothBtn").onclick = deleteCurrent;
  $("searchInput").oninput = render;
  $("statusFilter").onchange = render;
  $("tagFilter").onchange = render;
  $("copyReportBtn").onclick = copyReport;
  $("downloadReportBtn").onclick = downloadReport;
  $("exportBtn").onclick = exportJson;
  $("importInput").onchange = importJson;
  $("clearBtn").onclick = clearAll;
  $("photoInput").onchange = handlePhotos;
  $("recordBtn").onclick = toggleRecording;
  ["bizScore","newScore","fitScore"].forEach(id=>{
    $(id).oninput = () => $(id+"Val").textContent = $(id).value;
  });
  registerSW();
  setupInstall();
  render();
}
document.addEventListener("DOMContentLoaded", init);

function render(){
  renderStats();
  renderList();
  $("reportText").value = makeReport();
}
function score(b){
  return ((Number(b.bizScore||0)+Number(b.newScore||0)+Number(b.fitScore||0))/3);
}
function renderStats(){
  $("totalCount").textContent = booths.length;
  $("reportCount").textContent = booths.filter(b=>b.status==="report").length;
  $("priorityCount").textContent = booths.filter(b=>b.priority==="A").length;
  $("avgScore").textContent = booths.length ? (booths.reduce((a,b)=>a+score(b),0)/booths.length).toFixed(1) : "0.0";
}
function renderList(){
  const q = $("searchInput").value.trim().toLowerCase();
  const st = $("statusFilter").value;
  const tag = $("tagFilter").value;
  const filtered = booths.filter(b=>{
    const hay = [b.brand,b.country,b.boothNo,b.category,b.oneLine,b.insight,b.applyIdea,b.questions].join(" ").toLowerCase();
    return (!q || hay.includes(q)) && (st==="all" || b.status===st) && (tag==="all" || (b.checks||[]).some(x=>x.includes(tag)) || (b.tags||[]).includes(tag));
  }).sort((a,b)=> (b.priority==="A")-(a.priority==="A") || score(b)-score(a));
  $("boothList").innerHTML = filtered.length ? filtered.map(cardHtml).join("") : `<div class="card booth-card"><h3>아직 기록이 없습니다.</h3><p class="meta">+ 부스 기록 버튼으로 첫 기록을 추가하세요.</p></div>`;
  document.querySelectorAll("[data-edit]").forEach(btn=>btn.onclick=()=>openDialog(btn.dataset.edit));
}
function cardHtml(b){
  const photos = (b.photos||[]).slice(0,4).map(p=>`<img class="thumb" src="${p.data}" alt="">`).join("");
  const audioPill = (b.audios||[]).length ? `<span class="pill">녹음 ${(b.audios||[]).length}개</span>` : "";
  const photoPill = (b.photos||[]).length ? `<span class="pill">사진 ${(b.photos||[]).length}장</span>` : "";
  const statusLabel = b.status==="report" ? "보고 포함" : b.status==="watch" ? "추적 필요" : "검토 전";
  return `<article class="booth-card card">
    <header>
      <div>
        <h3>${escapeHtml(b.brand||"무제")}</h3>
        <p class="meta">${escapeHtml([b.country,b.boothNo,b.category].filter(Boolean).join(" · "))}</p>
      </div>
      <span class="pill ${b.priority==="A"?"a":""}">${b.priority||"C"}</span>
    </header>
    <p>${escapeHtml(b.oneLine||"한 줄 역할 정의 미입력")}</p>
    <div class="pill-row">
      <span class="pill ${b.status}">${statusLabel}</span>
      <span class="pill">평균 ${score(b).toFixed(1)}</span>
      ${photoPill}${audioPill}
    </div>
    ${photos ? `<div class="thumb-row">${photos}</div>` : ""}
    <div class="card-actions"><button class="secondary" data-edit="${b.id}">열기/수정</button></div>
  </article>`;
}

function openDialog(id){
  $("boothForm").reset();
  $("boothId").value = id || "";
  $("deleteBoothBtn").classList.toggle("hidden", !id);
  $("dialogTitle").textContent = id ? "부스 기록 수정" : "새 부스 기록";
  editingPhotos = [];
  editingAudios = [];
  CHECKS.forEach((_,i)=>$("check"+i).checked=false);
  ["bizScore","newScore","fitScore"].forEach(x=>{ $(x).value=3; $(x+"Val").textContent=3; });
  if(id){
    const b = booths.find(x=>x.id===id);
    if(b){
      ["brand","country","boothNo","category","oneLine","insight","applyIdea","questions","status","priority"].forEach(k=>$(k).value=b[k]||"");
      ["bizScore","newScore","fitScore"].forEach(k=>{ $(k).value=b[k]||3; $(k+"Val").textContent=$(k).value; });
      CHECKS.forEach((c,i)=>$("check"+i).checked=(b.checks||[]).includes(c));
      editingPhotos = [...(b.photos||[])];
      editingAudios = [...(b.audios||[])];
    }
  } else {
    $("status").value="draft"; $("priority").value="C";
  }
  renderMediaPreviews();
  $("boothDialog").showModal();
}
function closeDialog(){
  stopRecording(true);
  $("boothDialog").close();
}
function handleSubmit(e){
  e.preventDefault();
  const id = $("boothId").value || uid();
  const data = {
    id, updatedAt: new Date().toISOString(), date: today(),
    brand:$("brand").value.trim(), country:$("country").value.trim(), boothNo:$("boothNo").value.trim(), category:$("category").value.trim(),
    oneLine:$("oneLine").value.trim(),
    checks: CHECKS.filter((_,i)=>$("check"+i).checked),
    bizScore:$("bizScore").value, newScore:$("newScore").value, fitScore:$("fitScore").value,
    insight:$("insight").value.trim(), applyIdea:$("applyIdea").value.trim(), questions:$("questions").value.trim(),
    status:$("status").value, priority:$("priority").value,
    photos: editingPhotos, audios: editingAudios
  };
  const idx = booths.findIndex(b=>b.id===id);
  if(idx>=0) booths[idx]=data; else booths.push(data);
  save(); closeDialog();
}
function deleteCurrent(){
  const id = $("boothId").value;
  if(!id) return;
  if(confirm("이 부스 기록을 삭제할까요?")){
    booths = booths.filter(b=>b.id!==id);
    save(); closeDialog();
  }
}

async function handlePhotos(e){
  const files = Array.from(e.target.files || []);
  if(!files.length) return;
  for(const file of files){
    if(!file.type.startsWith("image/")) continue;
    const data = await compressImage(file, 1400, 0.78);
    editingPhotos.push({id:uid(), name:file.name, data, createdAt:new Date().toISOString()});
  }
  e.target.value = "";
  renderMediaPreviews();
}
function compressImage(file, maxSize=1400, quality=.78){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let {width, height} = img;
        const ratio = Math.min(1, maxSize / Math.max(width,height));
        width = Math.round(width*ratio); height = Math.round(height*ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img,0,0,width,height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function renderMediaPreviews(){
  $("photoPreview").innerHTML = editingPhotos.map(p=>`<div class="photo-item"><img src="${p.data}" alt=""><button type="button" data-del-photo="${p.id}">×</button></div>`).join("");
  document.querySelectorAll("[data-del-photo]").forEach(btn=>btn.onclick=()=>{
    editingPhotos = editingPhotos.filter(p=>p.id!==btn.dataset.delPhoto);
    renderMediaPreviews();
  });
  $("audioList").innerHTML = editingAudios.map(a=>`<div class="audio-item"><audio controls src="${a.data}"></audio><button type="button" class="danger" data-del-audio="${a.id}">삭제</button></div>`).join("");
  document.querySelectorAll("[data-del-audio]").forEach(btn=>btn.onclick=()=>{
    editingAudios = editingAudios.filter(a=>a.id!==btn.dataset.delAudio);
    renderMediaPreviews();
  });
}

async function toggleRecording(){
  if(mediaRecorder && mediaRecorder.state === "recording"){
    stopRecording(false);
    return;
  }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    alert("이 브라우저에서는 녹음 기능을 지원하지 않습니다. iPhone은 최신 iOS Safari에서 시도해 주세요.");
    return;
  }
  try{
    currentStream = await navigator.mediaDevices.getUserMedia({audio:true});
    const mime = pickMime();
    mediaRecorder = new MediaRecorder(currentStream, mime ? {mimeType:mime} : undefined);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => { if(e.data && e.data.size) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      const type = mediaRecorder.mimeType || "audio/mp4";
      const blob = new Blob(audioChunks, {type});
      const data = await blobToDataURL(blob);
      editingAudios.push({id:uid(), name:`녹음_${new Date().toLocaleTimeString()}`, type, data, createdAt:new Date().toISOString()});
      renderMediaPreviews();
      cleanupStream();
    };
    mediaRecorder.start();
    $("recordBtn").textContent = "■ 녹음 종료";
    $("recordStatus").textContent = "녹음 중";
    $("recordStatus").classList.add("recording");
  }catch(err){
    console.error(err);
    alert("녹음을 시작할 수 없습니다. Safari 주소창에서 마이크 권한을 허용했는지 확인해 주세요.");
    cleanupStream();
  }
}
function pickMime(){
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  if(!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
  return candidates.find(t=>MediaRecorder.isTypeSupported(t)) || "";
}
function stopRecording(discard){
  if(mediaRecorder && mediaRecorder.state === "recording"){
    if(discard){
      mediaRecorder.onstop = () => cleanupStream();
    }
    mediaRecorder.stop();
  } else {
    cleanupStream();
  }
  $("recordBtn").textContent = "● 녹음 시작";
  $("recordStatus").textContent = "대기 중";
  $("recordStatus").classList.remove("recording");
}
function cleanupStream(){
  if(currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream=null; }
  mediaRecorder=null; audioChunks=[];
}
function blobToDataURL(blob){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function makeReport(){
  const selected = booths.filter(b=>b.status==="report" || b.priority==="A").sort((a,b)=>score(b)-score(a));
  const lines = [];
  lines.push("[Interzoo 2026 전시 참관 요약]");
  lines.push("");
  lines.push(`1. 전체 기록: ${booths.length}건 / 보고 후보: ${selected.length}건`);
  lines.push("");
  lines.push("2. 핵심 관찰");
  if(!selected.length) lines.push("- 아직 보고 포함 또는 A 우선순위로 지정된 부스가 없습니다.");
  selected.slice(0,10).forEach((b,i)=>{
    lines.push(`- ${i+1}) ${b.brand || "무제"} (${[b.country,b.category].filter(Boolean).join(", ") || "정보 미입력"})`);
    lines.push(`  · 시장 신호: ${b.oneLine || b.insight || "미입력"}`);
    if(b.applyIdea) lines.push(`  · 당사 적용: ${b.applyIdea}`);
    if(b.questions) lines.push(`  · 추가 확인: ${b.questions}`);
    if((b.photos||[]).length || (b.audios||[]).length) lines.push(`  · 첨부: 사진 ${(b.photos||[]).length}장, 녹음 ${(b.audios||[]).length}개`);
  });
  lines.push("");
  lines.push("3. 시사점");
  lines.push("- 단일 제품 도입 여부보다 반복적으로 확인되는 제형, 포장, 기능성 표현, 수출 메시지 구조를 중심으로 후속 검토가 필요합니다.");
  lines.push("- 우선순위 A 부스는 자료 요청, PB/OEM 가능성, MOQ, 단가, 국내 적용 시 표시 리스크를 추가 확인하는 것이 적절합니다.");
  return lines.join("\n");
}
async function copyReport(){
  await navigator.clipboard.writeText($("reportText").value);
  alert("보고서 내용을 복사했습니다.");
}
function downloadReport(){
  downloadFile("interzoo-report.txt", $("reportText").value, "text/plain");
}
function exportJson(){
  downloadFile("vlux-expo-field-note-backup.json", JSON.stringify(booths,null,2), "application/json");
}
function importJson(e){
  const file = e.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const data = JSON.parse(r.result);
      if(!Array.isArray(data)) throw new Error("not array");
      booths = data; save(); alert("복원했습니다.");
    }catch(err){ alert("JSON 파일을 읽을 수 없습니다."); }
  };
  r.readAsText(file);
}
function clearAll(){
  if(confirm("모든 기록을 삭제할까요? JSON 백업 후 진행을 권장합니다.")){
    booths=[]; save();
  }
}
function downloadFile(name, content, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function escapeHtml(s=""){
  return s.replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
function registerSW(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }
}
function setupInstall(){
  let deferredPrompt;
  window.addEventListener("beforeinstallprompt", e=>{
    e.preventDefault(); deferredPrompt=e; $("installBtn").classList.remove("hidden");
  });
  $("installBtn").onclick = async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $("installBtn").classList.add("hidden");
  };
}
