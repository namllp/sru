(async () => {
'use strict';
const editorMode=document.documentElement.dataset.app==='editor';
const $=id=>document.getElementById(id);
function removeLegacyReadouts(root=document){
 root.querySelectorAll('#decoder .readout,#followCase,#folowcase,#caseTitle,#matchedInfo,#caseTags,#photoSource,.photo-source,#circuitPanel .muted,#downloadCircuit,#guidePanel,#manual2024Panel,a[href="#guidePanel"]').forEach(el=>el.remove());
}
removeLegacyReadouts();
function arrangeWorkspace(root=document){
 const workspace=root.querySelector('#visualWorkspace'),components=root.querySelector('#componentPanel'),images=workspace?.querySelector('.image-panel');
 if(workspace&&components&&images){images.id='imagePanel';workspace.insertBefore(components,images);const toolbar=images.querySelector('.workspace-toolbar');if(toolbar)components.insertBefore(toolbar,components.querySelector('.component-list'));for(const id of ['circuitPanel']){const panel=root.querySelector('#'+id);if(panel){panel.classList.add('panel','detail-panel');panel.open=true;images.appendChild(panel);}}const a=components.querySelector('.section-number'),b=images.querySelector('.section-number');if(a)a.textContent='02';if(b)b.textContent='03';}
}
arrangeWorkspace();
if(!$('appError')){const host=document.createElement('p');host.id='appError';host.className='notice';host.hidden=true;host.setAttribute('role','alert');$('decoder').appendChild(host);}

function reportStartupError(message){const host=$('appError');host.hidden=false;host.textContent=message;}
const originalHTML='<!doctype html>\n'+document.documentElement.outerHTML;
const embeddedProject=JSON.parse($('sruProject')?.textContent||'null');
let project=window.SRU_PROJECT_DATA?JSON.parse(JSON.stringify(window.SRU_PROJECT_DATA)):embeddedProject;
if(!project||project.external){reportStartupError('Thiếu data/sru_project.js. Giải nén đầy đủ bộ SRU và giữ thư mục data cạnh HTML.');return;}
if(!window.SRULookupCrypto){reportStartupError('Thiếu data/lookup_crypto.js. Giữ thư mục data cạnh HTML.');return;}
const emptyLookup={schemaVersion:1,errors:{},commands:{},modules:{},statusMessages:{},source:''};
let tables;
try{await SRULookupCrypto.scrubLegacyCache();tables=await SRULookupCrypto.openTables(window.SRU_MDATA_DATA||(editorMode?emptyLookup:null),window.SRU_MSTATUS_DATA||(editorMode?{statuses:{}}:null),validateTables);}
catch(e){reportStartupError('Không mở được bảng tra: '+e.message);$('mdata').disabled=true;$('mstatus').disabled=true;return;}
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?crypto.randomUUID().slice(0,8):Date.now().toString(36)+Math.random().toString(36).slice(2,6));
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||uid('module');
const typeNames={sensor:'Sensor',belt:'Dây curoa',board:'Board / bo mạch',cable:'Dây / cáp',connector:'Connector',motor:'Motor',solenoid:'Solenoid',motor_solenoid:'Motor / Solenoid',timing:'Timing cơ khí',timing_response:'Timing phản hồi',mechanism:'Cơ cấu',other:'Khác'};
const displayFields={description:'Description / mô tả MData',components:'Linh kiện & liên kết',links:'Danh sách liên kết',componentNames:'Tên mô tả linh kiện',images:'Ảnh vị trí',wiring:'Sơ đồ dây',scopeHint:'Thông tin module / linh kiện theo MData',viewStatus:'Dòng trạng thái dưới ảnh',photoCaption:'Tên ảnh đang xem'};
// Physical ownership stays on moduleId; shared boards are referenced, never copied.
function connectionParts(r){return [r.componentId,r.cableId,r.connectorId,r.boardId].filter(Boolean);}
function moduleBoards(id){return [...new Set([...(mod(id)?.boardIds||[]),...(project.connections||[]).filter(r=>r.moduleId===id&&recordVisible(r)).map(r=>r.boardId)])];}
function belongsToModule(c,id){return c?.moduleId===id||(c?.type==='board'&&moduleBoards(id).includes(c.id));}
function connectionVisible(r){return recordVisible(r)&&recordVisible(mod(r.moduleId))&&connectionParts(r).every(componentVisible);}
function relevantConnections(){const scope=relatedScope();return (project.connections||[]).filter(r=>connectionVisible(r)&&(!scope||connectionParts(r).every(id=>scope.ids.has(id)))&&(selected.length?connectionParts(r).some(id=>selected.includes(id)):r.moduleId===moduleId));}
function expandElectricalScope(roots,ids,modules){
 // Follow cables/connectors toward boards; stop at boards to avoid exposing other branches.
 const queue=[...roots],seen=new Set(queue);
 while(queue.length){const id=queue.shift();if(part(id)?.type==='board')continue;
  for(const l of project.links){if(l.type!=='electrical'||!l.verified||!recordVisible(l)||!(l.from===id||l.to===id))continue;
   const next=l.from===id?l.to:l.from;if(!componentVisible(next)||!['cable','connector','board'].includes(part(next)?.type))continue;
   ids.add(next);if(!seen.has(next)){seen.add(next);queue.push(next);}
  }
 }
 for(const r of project.connections||[]){if(!connectionVisible(r)||!r.verified)continue;
  // A shared board being selected does not reveal every attached sensor.
  if(![r.componentId,r.cableId,r.connectorId].some(id=>roots.has(id)))continue;
  connectionParts(r).forEach(id=>ids.add(id));modules.add(r.moduleId);
 }
 for(const mid of [...modules])for(const id of mod(mid)?.boardIds||[])if(componentVisible(id))ids.add(id);
}
function renderConnectionPaths(){
 const host=$('connectionPaths');if(!host)return;const rows=relevantConnections();
 host.innerHTML=rows.map(r=>`<article class="connection-card">${r.name?`<strong>${esc(r.name)}</strong>`:''}${r.verified?`<button data-walk-route="${esc(r.id)}">Theo đường dây này</button>`:''}<div class="connection-chain">${connectionParts(r).map(id=>`<button data-link-target="${esc(id)}">${esc(componentShortName(id))}</button>`).join('<span aria-hidden="true">→</span>')}</div><div class="connection-meta">${[r.componentPort&&'Đầu linh kiện: '+r.componentPort,r.boardPort&&'Cổng board: '+r.boardPort,r.pins&&'Chân: '+r.pins,r.signal&&'Tín hiệu / nguồn: '+r.signal].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div>${r.note?`<p>${esc(r.note)}</p>`:''}<div class="button-row">${(r.photoIds||[]).filter(id=>photoVisible(photo(id))).map((id,i)=>`<button data-reference-photo="${esc(id)}">Ảnh dây ${i+1}</button>`).join('')}</div></article>`).join('');
 if(!rows.length){const ids=new Set(selected),mids=new Set();expandElectricalScope(new Set(selected),ids,mids);const links=project.links.filter(l=>l.type==='electrical'&&l.verified&&scopedLink(l)&&ids.has(l.from)&&ids.has(l.to));host.innerHTML=links.map(l=>`<article class="connection-card">${l.name?`<strong>${esc(l.name)}</strong>`:''}<div class="connection-chain"><button data-link-target="${esc(l.from)}">${esc(part(l.from)?.tag)}</button><span>↔</span><button data-link-target="${esc(l.to)}">${esc(part(l.to)?.tag)}</button></div>${l.note?`<p>${esc(l.note)}</p>`:''}</article>`).join('')||'';}
}
function validateStructure(p){
 const parts=new Map(p.components.map(c=>[c.id,c])),mids=new Set(p.modules.map(m=>m.id)),pids=new Set(p.photos.map(p=>p.id));
 for(const m of p.modules)if(m.boardIds!==undefined&&(!Array.isArray(m.boardIds)||m.boardIds.some(id=>parts.get(id)?.type!=='board')))throw Error('Module tham chiếu board không tồn tại hoặc sai loại.');
 for(const ph of p.photos)if(ph.componentIds!==undefined&&(!Array.isArray(ph.componentIds)||ph.componentIds.some(id=>!parts.has(id))))throw Error('Ảnh tham chiếu linh kiện không tồn tại.');
 if(p.connections!==undefined&&!Array.isArray(p.connections))throw Error('Danh sách đường nối không hợp lệ.');
 const seen=new Set();for(const r of p.connections||[]){
  if(!r.id||seen.has(r.id)||!mids.has(r.moduleId)||!parts.has(r.componentId)||parts.get(r.boardId)?.type!=='board')throw Error('Đường nối cần ID riêng, module, linh kiện và board hợp lệ.');seen.add(r.id);
  if(parts.get(r.componentId).moduleId!==r.moduleId&&!(p.modules.find(m=>m.id===r.moduleId)?.boardIds||[]).includes(r.componentId))throw Error('Linh kiện đầu đường nối phải thuộc module đang chọn.');
  for(const [key,type]of [['cableId','cable'],['connectorId','connector']])if(r[key]&&parts.get(r[key])?.type!==type)throw Error('Đường nối chọn sai loại dây / connector.');
  if(new Set(connectionParts(r)).size!==connectionParts(r).length)throw Error('Đường nối không được lặp lại cùng một linh kiện.');
  if(!Array.isArray(r.photoIds)||r.photoIds.some(id=>!pids.has(id)))throw Error('Ảnh đường dây không tồn tại.');
  for(const key of ['diagnosticVisible','verified'])if(typeof r[key]!=='boolean')throw Error('Đường nối cần trạng thái hiển thị / xác nhận hợp lệ.');
  for(const key of ['componentPort','boardPort','pins','signal','note'])if(r[key]!==undefined&&typeof r[key]!=='string')throw Error('Nội dung đường nối phải là văn bản.');
 }
}

function diagnosticView(){return !editorMode||page==='diagnose';}
function displayEnabled(key){return !diagnosticView()||project.diagnosticDisplay?.[key]!==false;}
function recordVisible(record){return !!record&&(!diagnosticView()||record.diagnosticVisible!==false);}
function componentVisible(id){const c=part(id);return recordVisible(c)&&recordVisible(mod(c.moduleId));}
function photoVisible(p){return recordVisible(p)&&recordVisible(mod(p.moduleId));}
function applyDiagnosticDisplay(){
 for(const [id,key] of Object.entries({decodedBytesPanel:'description',descriptionDetails:'description',componentPanel:'components',relatedLinks:'links',circuitPanel:'wiring',scopeHint:'scopeHint',viewStatus:'viewStatus',photoCaption:'photoCaption',imagePanel:'images'})){const el=$(id);if(el)el.hidden=!displayEnabled(key);}
 $('circuitPanel').hidden=!displayEnabled('wiring')||(diagnosticView()&&!focusedComponentId);
 $('relatedLinks').hidden=!displayEnabled('links')||!$('relatedLinks').children.length;
 document.querySelectorAll('.diagnostic-nav a[href="#componentPanel"]').forEach(a=>a.hidden=!displayEnabled('components'));
 const nav=document.querySelector('.diagnostic-nav');if(nav)nav.style.setProperty('--diagnostic-nav-count',String([...nav.querySelectorAll('a')].filter(a=>!a.hidden).length));
}
function manualRelevant(r){
 if(!recordVisible(r))return false;
 if(!diagnosticView())return true;
 if(!context?.complete)return false;
 const scope=relatedScope();return !!scope?.modules.has(moduleId)&&(!(r.moduleIds||[]).length||r.moduleIds.includes(moduleId))&&!(moduleId==='feed'&&context.variant[0]==='0'&&(r.variant||'').startsWith('Slot'))&&(!(r.componentIds||[]).length||r.componentIds.some(id=>scope.ids.has(id)&&componentVisible(id)));
}

const linkNames={electrical:'Nối điện / dây',drive:'Truyền động',feedback:'Phản hồi',transport:'Đường vận chuyển',related:'Liên quan'};
let page='diagnose',editTab='regions',moduleId='sru',photoId='upper-overview',selected=[],context=null,run=null;
let focusedComponentId='';
let camera={x:0,y:0,w:100,h:100},imageToken='',drawMode='pan',draftRegion=null,editingRegionId='',guideDraft=null,editingStepId='';
let photoEditingId='',componentEditingId='',linkEditingId='',moduleEditingId='',toastTimer,storage=null;
const mod=id=>project.modules.find(x=>x.id===id);
const part=id=>project.components.find(x=>x.id===id);
const photo=id=>project.photos.find(x=>x.id===id);
const options=(items,value,labelFn=x=>x.name)=>items.map(x=>`<option value="${esc(x.id)}" ${x.id===value?'selected':''}>${esc(labelFn(x))}</option>`).join('');
const input=(id,label,value='',extra='')=>`<label for="${id}">${esc(label)}</label><input id="${id}" value="${esc(value)}" ${extra}>`;
const textarea=(id,label,value='',rows=4)=>`<label for="${id}">${esc(label)}</label><textarea id="${id}" rows="${rows}">${esc(value)}</textarea>`;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function nameOf(id){const p=part(id);return p?`${p.tag}${displayEnabled('componentNames')&&p.name&&p.name!==p.tag?" · "+p.name:""} · ${mod(p.moduleId)?.name||p.moduleId}`:id;}
function moduleFromName(name){const n=String(name||'').trim().toLowerCase();return project.modules.find(m=>[m.name,m.id,...(m.aliases||[])].some(a=>a.toLowerCase()===n));}
function descriptionField(item,key){const line=(item?.description||[]).find(s=>String(s).toLowerCase().startsWith(key.toLowerCase()+':'));return line?String(line).slice(line.indexOf(':')+1).trim():'';}
function tags(text){return [...new Set((String(text||'').toUpperCase().match(/\b[A-Z][A-Z0-9_-]*\b/g)||[]).filter(t=>t.length>1))];}
function groupTags(item){return [{type:'connector',tags:tags(item?.connector||descriptionField(item,'Connector'))},{type:'sensor',tags:tags(item?.sensor||descriptionField(item,'Sensor'))},{type:'motor_solenoid',tags:tags(item?.actuator||descriptionField(item,'Motor/Solenoid'))}];}
function decodeDeviceVariant(byte14){
 const b=String(byte14||'').toUpperCase();if(b.length!==2)return 'Unknown';
 const i={'0':'Pocket Consumer Interface','1':'Drive-Up Consumer Interface*','2':'Slot Consumer Interface - Short*','3':'Slot Consumer Interface - Mid Short*','4':'Slot Consumer Interface - Mid Long*','5':'Slot Consumer Interface - Long*'};
 const c={'0':'2R+1D','1':'1R+1D+1S','2':'1D+2S','3':'3R+1D','4':'1D+3S','5':'4R+1D','6':'3R+1D+1S','7':'1D+4S','8':'5R+1D','9':'4R+1D+1S','A':'3R+1D+2S'};
 return(i[b[0]]||'Unknown Interface')+' / '+(c[b[1]]||'Unknown Configuration');
}
function lookupError(code){if(!/^[0-9A-F]{4}$/.test(code))return null;for(const k of [code,code.slice(0,3)+'*',code.slice(0,2)+'**',code[0]+'***'])if(tables.errors[k])return {item:tables.errors[k],matchedCode:k};return null;}
function lookupModuleByte(byte){
 // MData contains HEX bytes; module-table keys are decimal IDs, with optional leading zeros.
 const id=parseInt(byte,16),key=String(id);
 if(!Number.isFinite(id))return undefined;
 if(Object.prototype.hasOwnProperty.call(tables.modules,key))return tables.modules[key];
 const padded=Object.keys(tables.modules).find(k=>/^\d+$/.test(k.trim())&&Number(k)===id);
 return padded===undefined?undefined:tables.modules[padded];
}
function decodeMData(value){
 const hex=String(value).replace(/[^0-9a-f]/gi,'').toUpperCase().slice(0,36),bytes=hex.match(/.{2}/g)||[];
 const code23=bytes.length>=3?bytes[1]+bytes[2]:'',code=bytes.length>=5?bytes[3]+bytes[4]:'';
 const lookup=lookupError(code),entry=tables.commands[code23];let moduleName='Unknown';
 if(bytes.length>=10){const b4=bytes[3],b10=bytes[9];if(/^[8-E]/.test(b4)||(b4==='2F'&&/^<Cassette>/i.test(lookup?.item?.title||'')))moduleName=({'07':'Cassette 1','10':'Cassette 2','13':'Cassette 3','16':'Cassette 4','19':'Cassette 5'})[b10]||'Unknown';else{const m=lookupModuleByte(b10);moduleName=m?.command??m??'Unknown';}}
 const module=moduleFromName(moduleName);const sm=tables.statusMessages[bytes[11]];
 const num=i=>bytes[i]===undefined?'—':parseInt(bytes[i],16);
 const fields={'Nhiệt độ':bytes[5]?num(5)+' °C':'—','Độ ẩm':bytes[6]?num(6)+' %':'—','Mode':bytes[7]===undefined?'—':({'00':'I/O','01':'DIAG'})[bytes[7]]||'Unknown','Universal ID':num(8),'Module ID (Byte 10)':bytes[9]===undefined?'—':bytes[9]+' (HEX) / '+num(9)+' (DEC)','Module':bytes.length>=10?moduleName:'—','Message ID':num(10),'Status Message':sm?.command??sm??(bytes[11]?'Unknown':'—'),'Additional Byte':num(12),'Device Variant':bytes[13]?decodeDeviceVariant(bytes[13]):'—','Component Version':bytes.length>=18?bytes.slice(14,18).map(b=>parseInt(b,16)).join('.'):'—'};
 return {hex,bytes,complete:hex.length===36,code,code23,command:entry?.command??entry??(code23?'Unknown':'—'),moduleName,moduleId:module?.id||'',variant:bytes[13]||'',matchedCode:lookup?.matchedCode||'',item:lookup?.item||null,groups:groupTags(lookup?.item),fields};
}
function regionsFor(id){const rows=project.regions.filter(r=>r.photoId===id&&(!diagnosticView()||r.diagnosticVisible!==false));return !diagnosticView()?rows:rows.map(r=>({...r,componentIds:r.componentIds.filter(componentVisible),moduleIds:r.moduleIds.filter(id=>recordVisible(mod(id)))})).filter(r=>r.componentIds.length||r.moduleIds.length);}
function availablePhotos(id){return project.photos.filter(p=>photoVisible(p)&&(p.moduleId===id||(p.moduleIds||[]).includes(id)||(p.componentIds||[]).some(cid=>belongsToModule(part(cid),id))||(project.connections||[]).some(r=>r.moduleId===id&&(r.photoIds||[]).includes(p.id)&&connectionVisible(r))||regionsFor(p.id).some(r=>r.moduleIds.includes(id)||r.componentIds.some(c=>part(c)?.moduleId===id))));}
function mdataPhotoStage(p){
 if(['upper-overview','ncr2022-upper-map','ncr2022-lower-overview','ncr2022-lower-map'].includes(p.id)||p.viewLevel==='sru')return 0;
 if(p.id.startsWith('ncr2022-module-')||p.viewLevel==='module')return 1;
 if(['manual','wiring'].includes(p.kind)||/access|cleaning|system-block|board-locations/i.test(p.id))return 3;
 if(p.viewLevel==='component'||regionsFor(p.id).some(r=>r.componentIds.length)||/sensor|sensor map|sơ đồ vị trí|linh kiện/i.test(p.title||''))return 2;
 return 3;
}
function orderedMdataPhotos(id){
 const list=availablePhotos(id).filter(p=>!['wiring','manual'].includes(p.kind));
 return list.map((p,i)=>({p,i})).sort((a,b)=>mdataPhotoStage(a.p)-mdataPhotoStage(b.p)||(a.p.id==='upper-overview'?-1:b.p.id==='upper-overview'?1:0)||a.i-b.i).map(x=>x.p);
}
function stripPhotos(id){
 if(diagnosticView()&&focusedComponentId){const c=part(focusedComponentId),refs=new Set([...(c?.repair?.locationPhotos||[]),...(c?.repair?.accessPhotos||[]),...(c?.repair?.wirePhotos||[]),...(c?.repair?.boardPhotos||[]),...relevantConnections().flatMap(r=>[...(r.photoIds||[]),...project.regions.filter(g=>(g.connectionIds||[]).includes(r.id)).map(g=>g.photoId)])]);return explorationPhotos().filter(p=>p.id===photoId||refs.has(p.id)||(p.componentIds||[]).includes(focusedComponentId)||regionsFor(p.id).some(r=>r.componentIds.includes(focusedComponentId))).sort((a,b)=>Number(a.kind==='wiring')-Number(b.kind==='wiring'));}
 if(!context?.complete||page!=='diagnose')return availablePhotos(id).filter(p=>!['wiring','manual'].includes(p.kind)||p.id===photoId);
 const list=orderedMdataPhotos(id),current=photo(photoId);if(current&&['wiring','manual'].includes(current.kind)&&availablePhotos(id).some(p=>p.id===current.id))list.push(current);return list;
}
function stripPhotoTitle(p){return context?.complete&&page==='diagnose'?['SRU','Module','Linh kiện','Chi tiết'][mdataPhotoStage(p)]+' · '+p.title:(p.moduleId===moduleId?p.title:'Vị trí trên SRU');}
function activeIds(){return new Set(selected);}
function activeRegions(){return regionsFor(photoId).filter(r=>selected.length?r.componentIds.some(c=>selected.includes(c)):(moduleId!=='sru'&&r.moduleIds.includes(moduleId)));}
function bestPhoto(id,ids=[]){const list=availablePhotos(id);return list.slice().sort((a,b)=>scorePhoto(b,ids,id)-scorePhoto(a,ids,id))[0];}
function scorePhoto(p,ids,id){let score=p.moduleId===id?2:0;for(const c of ids){if((p.componentIds||[]).includes(c))score+=10;if(regionsFor(p.id).some(r=>r.componentIds.includes(c)))score+=10;if((part(c)?.repair?.locationPhotos||[]).includes(p.id))score+=8;}if(p.variant&&context?.variant&&p.variant!==context.variant)score-=100;return score;}
function setModule(id,ids=[],preferredPhoto=''){
 const scope=relatedScope();if(!scope.modules.has(id))return;ids=ids.filter(x=>scope.ids.has(x));
 if(!mod(id))return;moduleId=id;selected=ids.filter(x=>part(x));const list=availablePhotos(id);photoId=list.some(p=>p.id===preferredPhoto)?preferredPhoto:(bestPhoto(id,selected)?.id||'');imageToken='';draftRegion=null;editingRegionId='';renderWorkspace();
}
function componentShortName(id){const c=part(id);return c?.tag||c?.name||id;}
function componentPhoto(id){
 const c=part(id);if(!c)return null;
 const rank=p=>(regionsFor(p.id).some(r=>r.componentIds.includes(id))?50:0)+((p.componentIds||[]).includes(id)?30:0)+((c.repair?.locationPhotos||[]).includes(p.id)?20:0);
 return explorationPhotos().filter(p=>rank(p)>0).sort((a,b)=>Number(['wiring','manual'].includes(a.kind))-Number(['wiring','manual'].includes(b.kind))||rank(b)-rank(a))[0];
}
function focusParts(ids){
 const existing=ids.filter(explorationPartAllowed);if(!existing.length)return;
 focusedComponentId=existing.length===1?existing[0]:'';
 const ph=focusedComponentId?componentPhoto(focusedComponentId):null;
 setModule(belongsToModule(part(existing[0]),moduleId)?moduleId:part(existing[0]).moduleId,existing,ph?.id||'');
 if(ph&&photoId!==ph.id){photoId=ph.id;imageToken='';renderWorkspace();}
 if(focusedComponentId)$('circuitPanel').open=true;
 if(diagnosticView()&&displayEnabled('images'))$('viewerDock')?.scrollIntoView({block:'start',behavior:'smooth'});
}
function matchPattern(pattern,value){return new RegExp('^'+String(pattern).replace(/[^0-9A-F*]/g,'').replace(/\*/g,'[0-9A-F]')+'$').test(value);}

function mainModules(c){
 const raw=c?.item?.main||descriptionField(c?.item,'Main');if(!raw)return [];
 const direct=moduleFromName(raw);if(direct)return [direct.id];
 return [...new Set(String(raw).split(/\s+or\s+|[,;]+/i).map(s=>moduleFromName(s.trim())?.id).filter(Boolean))];
}
function casePartIds(c){
 if(!c?.item)return [];const mids=[...new Set([...mainModules(c),c.moduleId].filter(Boolean))],out=[];
 for(const g of c.groups)for(const tag of g.tags){
  const found=project.components.filter(p=>(p.tag===tag||(p.aliases||[]).includes(tag))),local=found.filter(p=>mids.includes(p.moduleId));
  const chosen=local.length?local:found.length===1?found:[];chosen.forEach(p=>out.push(p.id));
 }
 return [...new Set(out)];
}
function relatedScope(){
 if(!context?.complete)return {ids:new Set(),modules:new Set()};
 const roots=new Set(casePartIds(context).filter(componentVisible)),ids=new Set(roots),modules=new Set([...mainModules(context),context.moduleId].filter(Boolean));
 // One hop only: a shared PCB must not pull every attached connector into the error.
 const hasDevices=[...roots].some(id=>['sensor','motor','solenoid','motor_solenoid'].includes(part(id)?.type));for(const l of project.links)if(recordVisible(l)&&componentVisible(l.from)&&componentVisible(l.to)&&l.verified&&(roots.has(l.from)||roots.has(l.to))){for(const id of [l.from,l.to])if(l.type==='related'||roots.has(id)||!hasDevices||['board','connector','cable'].includes(part(id)?.type))ids.add(id);}
 expandElectricalScope(roots,ids,modules);
 for(const id of ids){const c=part(id);if(c)modules.add(c.moduleId);}
 return {ids:new Set([...ids].filter(componentVisible)),modules:new Set([...modules].filter(id=>recordVisible(mod(id))))};
}
function scopedModules(){const s=relatedScope();return project.modules.filter(m=>recordVisible(m)&&(!s||s.modules.has(m.id)));}
function scopedLink(l){const s=relatedScope();return recordVisible(l)&&componentVisible(l.from)&&componentVisible(l.to)&&(!s||(s.ids.has(l.from)&&s.ids.has(l.to)));}

function ensureContextParts(c){
 if(!c.item)return [];const primary=mainModules(c)[0]||c.moduleId;if(!primary)return [];
 for(const g of c.groups)for(const tag of g.tags){
  const found=project.components.filter(p=>(p.tag===tag||(p.aliases||[]).includes(tag))),mids=[...mainModules(c),c.moduleId];
  if(found.some(p=>mids.includes(p.moduleId))||found.length===1)continue;
  if(!found.length){const id=primary+'::'+tag;project.components.push({id,moduleId:primary,tag,name:tag,type:g.type,note:'Được nhắc trong lỗi '+c.code+'; vị trí vật lý chưa xác nhận.',source:c.item.source||'MData45'});}
 }
 return casePartIds(c);
}

function renderByteDescription(c){
 const f=c.fields;
 const lines=[
 ['🌡 Temp: '+f['Nhiệt độ'],'💧 Humidity: '+f['Độ ẩm']],
 ['Mode: '+f.Mode,'UID: '+f['Universal ID']],
 ['Module: '+f.Module,'MsgID: '+f['Message ID']],
 ['Status Msg: '+f['Status Message']],
 ['Additional Byte: '+f['Additional Byte']],
 ['Device Variant: '+f['Device Variant']],
 ['Component Version: '+f['Component Version']]
 ];
 $('descriptionResult').innerHTML=commandDescription(c)+'<div class="errorTitle">'+esc(c.item?.title||(c.code?'Unknown':'—'))+'</div>'+lines.map((row,i)=>'<div class="envInfo">'+row.map(esc).join(i===0?' &nbsp;&nbsp; ':' | ')+'</div>').join('')+'<div class="errorDesc">'+(c.item?.description||[]).map(t=>'<div>• '+esc(t)+'</div>').join('')+'</div>';
}
function diagnosticPhotoAllowed(id){
 if(!photoVisible(photo(id)))return false;
 const s=relatedScope();if(!s.modules.size)return false;
 return (project.manual2024?.entries||[]).some(r=>manualRelevant(r)&&r.photoIds.includes(id))||[...s.modules].some(mid=>availablePhotos(mid).some(p=>p.id===id))||[...s.ids].some(cid=>Object.entries(part(cid)?.repair||{}).some(([k,v])=>k.endsWith('Photos')&&v.includes(id)));
}

function commandDescription(c){
 if(!c.code23)return '';
 const command=String(c.command||'');
 const prefix=String.fromCharCode(parseInt(c.code23.slice(0,2),16),parseInt(c.code23.slice(2,4),16));
 const match=command.match(/^([A-Z0-9]{2})\s*[-–—]\s*(.+)$/s);
 const detail=command==='Unknown'?'Chưa có mô tả cho lệnh này':match&&match[1]===prefix?match[2]:command;
 return '<div class="mdata23-command" style="margin:0 0 14px;font-size:16px;font-weight:600;color:#baf2de;line-height:1.5;overflow-wrap:anywhere">'+esc(detail)+'</div>';
}
function renderDecode(){
 const c=decodeMData($('mdata').value),previous=context;context=c;
 $('byteCount').textContent=`${c.bytes.length}/18 byte`+(c.hex.length%2?' · byte cuối chưa đủ 2 ký tự':'')+(c.complete?' · đủ dữ liệu':'');
 renderByteDescription(c);
 const ids=c.complete?ensureContextParts(c):[];
 const changed=!previous||previous.complete!==c.complete||[previous.code,previous.moduleId,previous.variant,previous.code23].join('|')!==[c.code,c.moduleId,c.variant,c.code23].join('|');
 if(changed){focusedComponentId='';run=null;const target=mainModules(c)[0]||(ids.length?part(ids[0])?.moduleId:'')||c.moduleId||'sru';setModule(target,ids,c.complete&&page==='diagnose'?(orderedMdataPhotos(target)[0]?.id||''):'');}
 renderWorkspace();
}
function imageLevel(n){return Number.isFinite(n)?Math.max(25,Math.min(200,n)):100;}
function shapeMarkup(r,attrs=''){
 const p=photo(r.photoId);if(!p)return '';const x=r.x*p.width/100,y=r.y*p.height/100;
 if(r.type==='circle')return `<circle cx="${x}" cy="${y}" r="${r.r*p.width/100}" ${attrs}/>`;
 return `<rect x="${x-r.w*p.width/200}" y="${y-r.h*p.height/200}" width="${r.w*p.width/100}" height="${r.h*p.height/100}" ${attrs}/>`;
}
function shapeKey(r){return [r.type,...(r.type==='circle'?[r.x,r.y,r.r]:[r.x,r.y,r.w,r.h])].map(x=>typeof x==='number'?x.toFixed(3):x).join('|');}
function renderPhotoNavigation(){
 const list=stripPhotos(moduleId),index=list.findIndex(p=>p.id===photoId);
 $('previousPhoto').disabled=index<=0;
 $('nextPhoto').disabled=index<0||index>=list.length-1;
 $('photoPosition').textContent=`${index<0?0:index+1} / ${list.length}`;
}
function navigatePhoto(direction){
 const list=stripPhotos(moduleId),index=list.findIndex(p=>p.id===photoId),target=index+direction;
 if(index<0||target<0||target>=list.length)return;
 captureGuideForm();photoId=list[target].id;
 if(editorMode)photoEditingId=photoId;
 imageToken='';draftRegion=null;editingRegionId='';renderWorkspace();
}
function drawImage(){
 renderPhotoNavigation();
 const svg=$('guideSvg'),p=photo(photoId);$('noImage').hidden=!!p;svg.hidden=!p;$('imageError').hidden=true;
 if(!p){svg.innerHTML='';$('zoomOut').disabled=true;$('zoomIn').disabled=true;if($('zoomLevel'))$('zoomLevel').textContent='—';return;}
 const editing=page==='edit'&&editTab==='regions';const active=activeRegions();let shapes=editing?regionsFor(p.id):active;
 // Merge identical geometry while preserving every tag in the data.
 const unique=new Map();shapes.forEach(r=>{if(!unique.has(shapeKey(r)))unique.set(shapeKey(r),r);});shapes=[...unique.values()];
 let content=`<title>${esc(p.title)}</title><image id="sourceImage" style="filter:brightness(${imageLevel(p.brightness)}%) contrast(${imageLevel(p.contrast)}%)" href="${esc(p.src)}" x="0" y="0" width="${p.width}" height="${p.height}" preserveAspectRatio="xMidYMid meet"/>`;
 if(!editing&&active.length&&$('dimOther').checked){content+=`<defs><mask id="focusMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${p.width}" height="${p.height}"><rect x="0" y="0" width="${p.width}" height="${p.height}" fill="white"/>${active.map(r=>shapeMarkup(r,'fill="black"')).join('')}</mask></defs><rect width="${p.width}" height="${p.height}" fill="black" opacity=".43" mask="url(#focusMask)" pointer-events="none"/>`;}
 if(!editing&&moduleId==='sru'){const scope=relatedScope();shapes=regionsFor(p.id).filter(r=>!scope||r.moduleIds.some(id=>scope.modules.has(id))||r.componentIds.some(id=>scope.ids.has(id)));}
 shapes.forEach(r=>{const classes=editing?'editor-region'+(r.id===editingRegionId?' region-selected':''):'hotspot';content+=shapeMarkup(r,`class="${classes}" data-region="${esc(r.id)}" aria-label="${esc(r.name||r.note||'Vùng ảnh')}"`);});
 content+='<g id="draftLayer">'+draftMarkup()+'</g>';
 svg.innerHTML=content;svg.querySelector('image')?.addEventListener('error',()=>$('imageError').hidden=false);
 if(imageToken!==p.id){imageToken=p.id;camera={x:0,y:0,w:p.width,h:p.height};}
 applyCamera();
}
function applyCamera(){const p=photo(photoId);if(!p)return;const min=p.width/3,max=p.width/.75;camera.w=Math.min(max,Math.max(min,camera.w));camera.h=camera.w*p.height/p.width;if(camera.w>=p.width){camera.x=(p.width-camera.w)/2;camera.y=(p.height-camera.h)/2;}else{camera.x=Math.min(p.width,Math.max(-camera.w,camera.x));camera.y=Math.min(p.height,Math.max(-camera.h,camera.y));}$('guideSvg').setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.w} ${camera.h}`);$('zoomOut').disabled=camera.w>=max*(1-1e-9);$('zoomIn').disabled=camera.w<=min*(1+1e-9);if($('zoomLevel'))$('zoomLevel').textContent=Math.round(p.width/camera.w*100)+'%';}
function fit(){const p=photo(photoId);if(!p)return;camera={x:0,y:0,w:p.width,h:p.height};applyCamera();}
function zoom(factor,point){const p=photo(photoId);if(!p)return;const anchor=point||{x:camera.x+camera.w/2,y:camera.y+camera.h/2};const w=Math.min(p.width/.75,Math.max(p.width/3,camera.w*factor)),ratio=w/camera.w;camera={x:anchor.x-(anchor.x-camera.x)*ratio,y:anchor.y-(anchor.y-camera.y)*ratio,w,h:camera.h*ratio};applyCamera();}

function renderCircuits(){
 const q=$('circuitSearch').value.trim().toUpperCase(),all=false;
 const ids=new Set([...selected.flatMap(id=>part(id)?.repair?.wirePhotos||[]),...relevantConnections().flatMap(r=>[...(r.photoIds||[]),...project.regions.filter(g=>(g.connectionIds||[]).includes(r.id)).map(g=>g.photoId)])]);renderConnectionPaths();
 const list=project.photos.filter(p=>photoVisible(p)&&(p.kind==='wiring'||ids.has(p.id))&&(all||(selected.length?ids.has(p.id):(p.moduleIds||[]).includes(moduleId)))&&(!q||(p.title+' '+p.searchText).toUpperCase().includes(q)));
 const previous=$('circuitSelect').value;$('circuitSelect').innerHTML=list.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');if(list.some(p=>p.id===previous))$('circuitSelect').value=previous;
 $('openCircuit').disabled=!list.length;
}


let wireWalk=null,walkContext='';
function explorationPartAllowed(id){const scope=relatedScope();return componentVisible(id)&&(!scope||scope.ids.has(id));}
function explorationPhotos(){
 const scope=relatedScope();if(!scope)return project.photos.filter(photoVisible);
 const ids=new Set([...scope.modules].flatMap(mid=>availablePhotos(mid).map(p=>p.id)));
 for(const id of scope.ids)for(const [key,value]of Object.entries(part(id)?.repair||{}))if(key.endsWith('Photos'))value.forEach(pid=>ids.add(pid));
 for(const row of project.manual2024?.entries||[])if(manualRelevant(row))(row.photoIds||[]).forEach(id=>ids.add(id));
 return project.photos.filter(p=>photoVisible(p)&&ids.has(p.id));
}
function ensureExplorationUI(){
 if(!$('locationTrail')){const nav=document.createElement('nav');nav.id='locationTrail';nav.className='location-trail';nav.setAttribute('aria-label','Đường dẫn vị trí');$('componentPanel').prepend(nav);}
 if(!$('wireWalk')){const host=document.createElement('section');host.id='wireWalk';host.className='wire-walk';$('circuitPanel').querySelector('summary').after(host);}
}
function renderLocationTrail(){
 const overview=availablePhotos(moduleId).find(p=>mdataPhotoStage(p)===0),active=selected.filter(explorationPartAllowed);
 $('locationTrail').innerHTML=`<button data-location="sru" ${overview?'':'disabled'}>SRU</button><span aria-hidden="true">›</span><button data-location="module" ${mod(moduleId)?'':'disabled'}>${esc(mod(moduleId)?.name||'Chưa chọn module')}</button>${active.length?'<span aria-hidden="true">›</span>':''}${active.map(id=>`<button data-location-part="${esc(id)}" aria-current="location">${esc(part(id).tag)}</button>`).join('')}`;
}
function activeWalkRoute(){return wireWalk?.routeId?(project.connections||[]).find(r=>r.id===wireWalk.routeId&&r.verified&&connectionVisible(r)&&connectionParts(r).every(explorationPartAllowed)):null;}
function walkNextOptions(){
 if(!wireWalk)return [];const current=wireWalk.nodes[wireWalk.index],route=activeWalkRoute();
 if(route){const path=connectionParts(route),i=path.indexOf(current);return path[i+1]?[path[i+1]]:[];}
 if(part(current)?.type==='board')return [];
 const visited=new Set(wireWalk.nodes.slice(0,wireWalk.index+1));
 return [...new Set(project.links.filter(l=>l.type==='electrical'&&l.verified&&scopedLink(l)&&(l.from===current||l.to===current)).map(l=>l.from===current?l.to:l.from))].filter(id=>!visited.has(id)&&explorationPartAllowed(id));
}
function renderWireWalk(){
 const signature=context?.hex||'';if(signature!==walkContext){wireWalk=null;walkContext=signature;}
 if(wireWalk&&(!selected.includes(wireWalk.nodes[wireWalk.index])||!wireWalk.nodes.every(explorationPartAllowed)||(wireWalk.routeId&&!activeWalkRoute())))wireWalk=null;
 const choices=selected.filter(explorationPartAllowed);
 let html=`<h3>Theo dây từng đoạn</h3><div class="button-row">${choices.map(id=>`<button data-walk-start="${esc(id)}">Bắt đầu từ ${esc(part(id).tag)}</button>`).join('')}</div>`;
 if(!wireWalk){$('wireWalk').innerHTML=html;return;}
 const current=wireWalk.nodes[wireWalk.index],next=walkNextOptions(),route=activeWalkRoute(),previous=wireWalk.nodes[wireWalk.index-1];
 const link=project.links.find(l=>l.type==='electrical'&&l.verified&&scopedLink(l)&&((l.from===current&&l.to===previous)||(l.to===current&&l.from===previous)));
 html+=`<ol class="wire-steps">${wireWalk.nodes.map((id,i)=>`<li><button data-walk-step="${i}" ${i===wireWalk.index?'aria-current="step"':''}>${esc(part(id)?.tag||id)}</button></li>`).join('')}</ol><p class="walk-current">Đang xem: <strong>${esc(nameOf(current))}</strong></p><div class="button-row"><button id="walkPrevious" ${wireWalk.index?'':'disabled'}>← Đoạn trước</button>${next.map(id=>`<button data-walk-next="${esc(id)}">Tiếp tới ${esc(part(id).tag)} →</button>`).join('')}<button id="walkShowImage">Xem ảnh đoạn này</button><button id="walkEnd">Kết thúc</button></div>`;
 if(route)html+=`<div class="connection-meta">${[route.componentPort&&'Đầu linh kiện: '+route.componentPort,route.boardPort&&'Cổng board: '+route.boardPort,route.pins&&'Chân: '+route.pins,route.signal&&'Tín hiệu / nguồn: '+route.signal].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div>${route.note?`<p>${esc(route.note)}</p>`:''}`;
 else if(link?.note)html+=`<p>${esc(link.note)}</p>`;
 $('wireWalk').innerHTML=html;
}
function wireStepPhoto(id){
 const c=part(id),route=activeWalkRoute(),allowed=explorationPhotos();
 return allowed.slice().sort((a,b)=>{const score=p=>(regionsFor(p.id).some(r=>r.componentIds.includes(id))?30:0)+((p.componentIds||[]).includes(id)?25:0)+((c?.repair?.locationPhotos||[]).includes(p.id)?20:0)+((route?.photoIds||[]).includes(p.id)?10:0)+((c?.repair?.wirePhotos||[]).includes(p.id)?5:0);return score(b)-score(a);}).find(p=>regionsFor(p.id).some(r=>r.componentIds.includes(id))||(p.componentIds||[]).includes(id)||(c?.repair?.locationPhotos||[]).includes(p.id)||(route?.photoIds||[]).includes(p.id)||(c?.repair?.wirePhotos||[]).includes(p.id));
}
function showWalkStep(scroll=false){
 const id=wireWalk?.nodes[wireWalk.index];if(!id||!explorationPartAllowed(id))return;const c=part(id),mid=belongsToModule(c,moduleId)?moduleId:c.moduleId,ph=wireStepPhoto(id);
 focusedComponentId=id;setModule(mid,[id],ph?.id||'');if(ph){photoId=ph.id;imageToken='';renderWorkspace();}if(scroll)$('viewerDock').scrollIntoView({block:'start',behavior:'smooth'});
}
function startWireWalk(id,routeId=''){
 if(!explorationPartAllowed(id))return;wireWalk={nodes:[id],index:0,routeId};walkContext=context?.hex||'';showWalkStep();$('circuitPanel').open=true;$('wireWalk').scrollIntoView({block:'start',behavior:'smooth'});
}
function handleExplorationClick(b){
 if(b.dataset.location){focusedComponentId='';const list=availablePhotos(moduleId),ph=b.dataset.location==='sru'?list.find(p=>mdataPhotoStage(p)===0):list.find(p=>mdataPhotoStage(p)===1)||bestPhoto(moduleId);selected=[];if(ph){photoId=ph.id;imageToken='';}renderWorkspace();return true;}
 if(b.dataset.locationPart){focusParts([b.dataset.locationPart]);return true;}
 if(b.dataset.walkStart){startWireWalk(b.dataset.walkStart);return true;}
 if(b.dataset.walkRoute){const route=(project.connections||[]).find(r=>r.id===b.dataset.walkRoute&&r.verified&&connectionVisible(r)&&connectionParts(r).every(explorationPartAllowed));if(route)startWireWalk(route.componentId,route.id);return true;}
 if(b.dataset.walkStep!==undefined&&wireWalk){const index=Number(b.dataset.walkStep);if(Number.isInteger(index)&&index>=0&&index<wireWalk.nodes.length){wireWalk.index=index;showWalkStep();}return true;}
 if(b.dataset.walkNext&&wireWalk){const id=b.dataset.walkNext;if(walkNextOptions().includes(id)){wireWalk.nodes=wireWalk.nodes.slice(0,wireWalk.index+1);wireWalk.nodes.push(id);wireWalk.index++;showWalkStep();}return true;}
 if(b.id==='walkPrevious'){if(wireWalk?.index){wireWalk.index--;showWalkStep();}return true;}
 if(b.id==='walkShowImage'){showWalkStep(true);return true;}
 if(b.id==='walkEnd'){wireWalk=null;renderWireWalk();return true;}
 return false;
}
function renderAccessPanel(){
 let host=$('accessPanel');
 if(!host){host=document.createElement('section');host.id='accessPanel';host.className='access-panel';$('viewerDock').after(host);}
 const c=part(focusedComponentId),r=c?.repair||{};
 const fields=[['access','Tiếp cận linh kiện'],['wireAccess','Tiếp cận dây / connector'],['boardAccess','Tiếp cận board']].filter(([key])=>r[key]?.trim());
 host.hidden=!diagnosticView()||!focusedComponentId||!fields.length||!displayEnabled('images');
 if(host.hidden){host.replaceChildren();return;}
 const refs=[...new Set(r.accessPhotos||[])].map(photo).filter(p=>p&&photoVisible(p)&&diagnosticPhotoAllowed(p.id));
 host.innerHTML='<h3>Cách tiếp cận · '+esc(componentShortName(c.id))+'</h3>'+fields.map(([key,label])=>'<div class="access-step"><strong>'+label+'</strong><p>'+esc(r[key])+'</p></div>').join('')+(refs.length?'<div class="access-photo-actions">'+refs.map((p,i)=>'<button data-photo="'+esc(p.id)+'" aria-pressed="'+(p.id===photoId)+'">Ảnh tiếp cận '+(i+1)+'</button>').join('')+'</div>':'');
}
function renderExploration(){
 ensureExplorationUI();renderLocationTrail();renderWireWalk();renderAccessPanel();
 if(!$('selectedComponentTitle')){const row=document.createElement('div');row.id='selectedComponentTitle';row.className='selected-component-title';$('viewerDock').prepend(row);}
 const row=$('selectedComponentTitle');row.hidden=!focusedComponentId;
 row.innerHTML=focusedComponentId?`<strong>${esc(componentShortName(focusedComponentId))}</strong><button id="focusComponentRegion" ${activeRegions().length?'':'disabled'}>Vùng linh kiện</button>`:'';
 $('circuitPanel').querySelector('summary').textContent=focusedComponentId?'Dây nối '+componentShortName(focusedComponentId)+' với board':'Dây nối linh kiện với board';
}
function focusComponentRegion(){
 const p=photo(photoId),regions=activeRegions();if(!p||!regions.length)return;
 const boxes=regions.map(r=>{const w=(r.type==='circle'?r.r*2:r.w)*p.width/100,h=r.type==='circle'?w:r.h*p.height/100;return {x:r.x*p.width/100,y:r.y*p.height/100,w,h};});
 const left=Math.min(...boxes.map(b=>b.x-b.w/2)),right=Math.max(...boxes.map(b=>b.x+b.w/2)),top=Math.min(...boxes.map(b=>b.y-b.h/2)),bottom=Math.max(...boxes.map(b=>b.y+b.h/2));
 const w=Math.min(p.width,Math.max(p.width*.25,(right-left)*1.7,(bottom-top)*1.7*p.width/p.height)),h=w*p.height/p.width;
 camera={x:(left+right-w)/2,y:(top+bottom-h)/2,w,h};applyCamera();
}

function renderWorkspace(){
 selected=selected.filter(componentVisible);if(!selected.includes(focusedComponentId)||!explorationPartAllowed(focusedComponentId))focusedComponentId='';
 const scope=relatedScope(),shown=scopedModules();if(scope&&!scope.modules.has(moduleId)){moduleId=shown[0]?.id||'';selected=selected.filter(id=>scope.ids.has(id));photoId=bestPhoto(moduleId,selected)?.id||'';imageToken='';} $('moduleSelect').innerHTML=options(shown,moduleId);$('scopeHint').textContent=scope?`Theo MData45: ${shown.length} module · ${scope.ids.size} linh kiện liên quan. Main: ${context?.item?.main||'chưa xác định'}`:page==='edit'?'Biên soạn: hiện toàn bộ module và linh kiện.':'';
 if(!$('connectionPaths')){const host=document.createElement('div');host.id='connectionPaths';$('circuitPanel').insertBefore(host,$('circuitSearch').previousElementSibling);}renderCircuits();const list=stripPhotos(moduleId);$('photoStrip').innerHTML=list.map(p=>`<button class="photo-button" data-photo="${esc(p.id)}" aria-pressed="${p.id===photoId}"><img src="${esc(p.src)}" alt="" loading="lazy"><span>${esc(stripPhotoTitle(p))}<br><small>${esc(p.angle||'Chưa ghi góc nhìn')}${p.variant?' · '+esc(p.variant):''}</small></span></button>`).join('')||'<span class="muted">Chưa có ảnh cho module này.</span>';
 const p=photo(photoId);$('photoCaption').textContent=p?.title||'Chưa có ảnh';
 const visible=selected.filter(id=>regionsFor(photoId).some(r=>r.componentIds.includes(id))),missing=selected.filter(id=>!visible.includes(id));
 $('viewStatus').textContent=selected.length?`Đang chọn: ${selected.map(id=>part(id)?.tag||id).join(', ')}${missing.length?' · Chưa có vùng ở ảnh này: '+missing.map(id=>part(id)?.tag||id).join(', '):(activeRegions().some(r=>r.componentIds.length>1)?' · Viền đỏ chỉ vùng cụm có linh kiện':' · Viền đỏ chỉ vị trí đang xem')}`:moduleId==='sru'?'Chạm điểm trên ảnh hoặc chọn module để xem chi tiết.':'Chọn linh kiện để tìm vị trí trên ảnh.';
 $('editorDrawBar').hidden=!(page==='edit'&&editTab==='regions');drawImage();renderComponents();applyDiagnosticDisplay();renderExploration();if(page==='edit')renderEditor();
}
function renderComponents(){
 const q=$('componentFilter').value.trim().toLowerCase(),scope=relatedScope();const items=project.components.filter(p=>componentVisible(p.id)&&(!scope||scope.ids.has(p.id))&&(diagnosticView()?true:belongsToModule(p,moduleId))&&(!q||[p.tag,p.name,typeNames[p.type]].join(' ').toLowerCase().includes(q))).sort((a,b)=>a.tag.localeCompare(b.tag));
 $('componentList').innerHTML=items.map(p=>`<button class="component-pill" data-component="${esc(p.id)}" aria-pressed="${selected.includes(p.id)}">${esc(componentShortName(p.id))}</button>`).join('')||'<div class="muted">Không có linh kiện phù hợp với module và bộ lọc hiện tại.</div>';
 const links=project.links.filter(l=>scopedLink(l)&&(selected.includes(l.from)||selected.includes(l.to)));
 const targets=[...new Set([...links.flatMap(l=>[l.from,l.to]),...relevantConnections().flatMap(connectionParts)])].filter(id=>!selected.includes(id)&&explorationPartAllowed(id));
 $('relatedLinks').innerHTML=focusedComponentId?targets.map(id=>`<button class="linked-component-name" data-link-target="${esc(id)}">${esc(componentShortName(id))}</button>`).join(''):'';
 $('relatedLinks').hidden=!displayEnabled('links')||!$('relatedLinks').children.length;
}
function showPage(next){if(next!=='diagnose')return;if(next==='edit'&&!editorMode)return;page=next;$('workArea').hidden=next==='data';$('decoder').hidden=next!=='diagnose';$('editor').hidden=next!=='edit';$('workArea').className='work-area'+(next==='edit'?' editing':next==='atlas'?' atlas':'');document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.page===next)));draftRegion=null;editingRegionId='';drawMode='pan';if(next==='data')$('dataCounts').textContent=`${Object.keys(tables.errors).length} mã/quy tắc lỗi · ${project.modules.length} module · ${project.components.length} linh kiện · ${project.photos.length} ảnh · ${project.links.length} liên kết · ${project.guides.length} guide biên soạn. `;else renderWorkspace();}
function validateProject(p){
 if(!p||p.schemaVersion!==1)throw Error('Dữ liệu không đúng schemaVersion 1.');
 for(const k of ['modules','components','photos','regions','links','guides']){if(!Array.isArray(p[k]))throw Error('Thiếu danh sách '+k);const ids=new Set();for(const x of p[k]){if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id))throw Error('ID trống hoặc trùng trong '+k);ids.add(x.id);}}
 validateStructure(p);
 const mids=new Set(p.modules.map(x=>x.id)),cids=new Set(p.components.map(x=>x.id)),pids=new Set(p.photos.map(x=>x.id));
 for(const list of [p.modules,p.components,p.photos,p.links,p.manual2024?.entries||[]])for(const item of list){if(item.diagnosticVisible!==undefined&&typeof item.diagnosticVisible!=='boolean')throw Error('Hiển thị Diagnostic phải là bật/tắt.');}
 if(p.diagnosticDisplay&&Object.values(p.diagnosticDisplay).some(v=>typeof v!=='boolean'))throw Error('Cấu hình hiển thị không hợp lệ.');
 const manualIds=new Set();for(const row of p.manual2024?.entries||[]){if(!row.id||manualIds.has(row.id)||typeof row.title!=='string'||typeof row.body!=='string')throw Error('Mục manual cần ID riêng, tiêu đề và nội dung.');manualIds.add(row.id);for(const [key,valid] of [['moduleIds',mids],['photoIds',pids],['componentIds',cids]])if((row[key]!==undefined&&!Array.isArray(row[key]))||(row[key]||[]).some(id=>!valid.has(id)))throw Error('Manual tham chiếu '+key+' không tồn tại.');}
 p.components.forEach(c=>{if(c.aliases!==undefined&&(!Array.isArray(c.aliases)||c.aliases.some(x=>typeof x!=='string')))throw Error('Tag cũ phải là danh sách văn bản.');});

 if(!p.modules.length||!mids.has('sru'))throw Error('Cần module tổng thể với id sru.');
 p.modules.forEach(m=>{if(typeof m.name!=='string'||!Array.isArray(m.aliases))throw Error('Module cần tên và danh sách aliases.');});
 p.components.forEach(c=>{if(!mids.has(c.moduleId)||!c.tag||!typeNames[c.type])throw Error('Linh kiện có module/loại không hợp lệ: '+c.id);});
 p.components.forEach(c=>{if(c.repair){for(const [k,v] of Object.entries(c.repair)){if(k.endsWith('Photos')){if(!Array.isArray(v)||v.some(id=>!pids.has(id)))throw Error('Ảnh hồ sơ không tồn tại: '+c.tag);}else if(typeof v!=='string')throw Error('Nội dung hồ sơ phải là văn bản: '+c.tag);}}});
 p.photos.forEach(x=>{if(!mids.has(x.moduleId)||!Number.isFinite(x.width)||!Number.isFinite(x.height)||x.width<=0||x.height<=0)throw Error('Ảnh thiếu module hoặc kích thước: '+x.id);if(!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(x.src)&&!/^(?!.*(?:\.\.|:|\/\/))[\w ./()_-]+\.(png|jpg|jpeg|webp|gif)$/i.test(x.src))throw Error('Ảnh phải là file nhúng hoặc đường dẫn ảnh tương đối: '+x.id);});
 p.regions.forEach(r=>{for(const [key,rows] of [['linkIds',p.links],['connectionIds',p.connections||[]]])if(r[key]!==undefined&&(!Array.isArray(r[key])||r[key].some(id=>!rows.some(x=>x.id===id))))throw Error('Vùng ảnh tham chiếu liên kết không tồn tại.');if(!pids.has(r.photoId)||!['circle','rect'].includes(r.type)||!Array.isArray(r.componentIds)||!Array.isArray(r.moduleIds))throw Error('Vùng ảnh không hợp lệ: '+r.id);for(const k of (r.type==='circle'?['x','y','r']:['x','y','w','h']))if(!Number.isFinite(r[k])||r[k]<0||r[k]>100)throw Error('Tọa độ vùng phải từ 0 đến 100.');if((r.type==='circle'&&r.r<=0)||(r.type==='rect'&&(!r.w||!r.h)))throw Error('Vùng ảnh phải có kích thước lớn hơn 0.');if(r.componentIds.some(id=>!cids.has(id))||r.moduleIds.some(id=>!mids.has(id)))throw Error('Vùng tham chiếu linh kiện/module không tồn tại.');});
 p.links.forEach(l=>{if(!cids.has(l.from)||!cids.has(l.to)||l.from===l.to||!linkNames[l.type])throw Error('Liên kết có đầu nối hoặc loại không hợp lệ.');});
 p.guides.forEach(g=>{if(!/^[0-9A-F*]{4}$/.test(g.errorPattern)||!Array.isArray(g.steps)||!g.steps.length)throw Error('Guide cần mã lỗi 4 ký tự và ít nhất một bước.');if(g.moduleId&&!mids.has(g.moduleId))throw Error('Guide tham chiếu module không tồn tại.');const ids=new Set(g.steps.map(s=>s.id));if(ids.size!==g.steps.length||!ids.has(g.startId))throw Error('Guide có ID bước trùng hoặc thiếu bước bắt đầu.');for(const s of g.steps){if(!mids.has(s.moduleId)||!Array.isArray(s.componentIds)||s.componentIds.some(id=>!cids.has(id))||(s.photoId&&!pids.has(s.photoId)))throw Error('Bước guide tham chiếu ảnh/linh kiện/module không tồn tại.');for(const key of ['pass','fail','unknown'])if(!ids.has(s.outcomes?.[key])&&!['__finish__','__stop__'].includes(s.outcomes?.[key]))throw Error('Đích nhánh không tồn tại ở bước '+s.title);}});
 return true;
}
async function openStorage(){return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(Error('Trình duyệt không hỗ trợ lưu dữ liệu.'));const request=indexedDB.open('SRUVisualGuide_Editor',1);request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function saveLocal(){
 project.updatedAt=new Date().toISOString();$('saveState').textContent='Đang lưu trên máy…';
 try{storage=storage||await openStorage();await new Promise((resolve,reject)=>{const t=storage.transaction('snapshots','readwrite');t.objectStore('snapshots').put({project},project.documentId);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});$('saveState').textContent='Đã lưu trên máy';return true;}
 catch(e){$('saveState').textContent='Chưa lưu trên máy';toast('Chưa lưu được trên thiết bị. Bấm Lưu file Editor để giữ thay đổi.');return false;}
}
async function commit(change,message='Đã lưu thay đổi.'){if(!editorMode)return;const next=clone(project);try{change(next);validateProject(next);project=next;const stored=await saveLocal();renderWorkspace();if(message)toast(stored?message:'Đã áp dụng trong phiên. Bấm Tải HTML đã cập nhật để lưu thay đổi.');}catch(e){toast(e.message);}}
function download(name,text,type='application/json'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function safeJSON(v){return JSON.stringify(v).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function exportHTML(kind='diagnostic'){
 const snapshot=clone(project);snapshot.revision=(snapshot.revision||1)+1;snapshot.updatedAt=new Date().toISOString();
 const source=editorMode&&kind==='diagnostic'?window.SRU_DIAGNOSTIC_TEMPLATE:originalHTML;
 if(!source)throw Error('Thiếu js/diagnostic_template.js. Giữ đầy đủ thư mục js cạnh HTML.');
 const doc=new DOMParser().parseFromString(source,'text/html');removeLegacyReadouts(doc);arrangeWorkspace(doc);doc.getElementById('sruProject').textContent='{"external":true}';doc.getElementById('sruTables').textContent='{"external":true}';
 const entries=[];
 delete snapshot.wiringDocument;
 entries.push([kind==='editor'?'SRU_Editor.html':'index_SRU_Diagnostic_Translate_NewMData45_Byte14.html','<!doctype html>\n'+doc.documentElement.outerHTML]);
 entries.push(['data/sru_project.js','window.SRU_PROJECT_DATA = '+safeJSON(snapshot)+';\n']);
 entries.push(['CAP_NHAT.txt','Giai nen va chep de vao thu muc bo SRU day du dang dung.\nZIP nay cap nhat HTML va data/sru_project.js; khong phai bo chay doc lap.\nGiu nguyen css/, js/, images/ va cac file ma hoa trong data/.\nDiagnostic va Editor dung chung du lieu du an nay.\nNeu sua MData/MStatus, xuat bo data ma hoa rieng.\n']);
 download(kind==='editor'?'SRU_Editor_Update.zip':'SRU_Diagnostic_Update.zip',SRULookupCrypto.zip(entries),'application/zip');
 toast('Đã xuất ZIP cập nhật. Giải nén chép đè vào bộ SRU đầy đủ, giữ css/js/images. Nếu sửa MData/MStatus, xuất bộ data mã hóa riêng.');
}

function findGuide(c=context){
 if(!c?.code)return null;
 return project.guides.filter(g=>matchPattern(g.errorPattern,c.code)&&(!g.moduleId||g.moduleId===c.moduleId)&&(!g.variant||g.variant===c.variant)&&(!g.command||g.command===c.code23)).sort((a,b)=>specificity(b)-specificity(a))[0]||null;
}
function specificity(g){return g.errorPattern.replace(/\*/g,'').length+(g.moduleId?5:0)+(g.variant?10:0)+(g.command?5:0);}
function guideText(item){if(item?.guide)return item.guide;const d=item?.description||[],i=d.findIndex(t=>/^Guide:/i.test(t));return i<0?'':d.slice(i).join('\n').replace(/^Guide:\s*/i,'');}
function autoGuide(c=context){
 if(!c?.item||!c.moduleId)return null;
 const raw=guideText(c.item);if(!raw)return null;
 const checkMatch=raw.match(/(?:^|\n)Check:\s*\n([\s\S]*?)(?=\nGuide:|$)/i),repairMatch=raw.match(/(?:^|\n)Guide:\s*\n([\s\S]*)/i);
 const blocks=[];if(checkMatch?.[1].trim())blocks.push({title:'Kiểm tra theo tài liệu',instruction:checkMatch[1].trim()});if(repairMatch?.[1].trim())blocks.push({title:'Hướng xử lý trong tài liệu',instruction:repairMatch[1].trim()});if(!blocks.length)blocks.push({title:'Hướng dẫn trong bảng lỗi',instruction:raw});
 const ids=ensureContextParts(c);const steps=blocks.map((b,i)=>({id:'source-'+i,...b,expected:'',moduleId:c.moduleId,componentIds:ids,photoId:'',source:c.item.source||tables.source,outcomes:{pass:i<blocks.length-1?'source-'+(i+1):'__finish__',fail:i<blocks.length-1?'source-'+(i+1):'__finish__',unknown:i<blocks.length-1?'source-'+(i+1):'__finish__'}}));
 return {id:'auto-'+c.code,title:c.item.title,errorPattern:c.code,moduleId:c.moduleId,variant:'',command:'',source:c.item.source||tables.source,startId:steps[0].id,steps,automatic:true};
}
function repairText(value,empty){return value?`<div class="guide-instruction">${esc(value)}</div>`:`<p class="muted">${esc(empty)}</p>`;}
function refPhotos(ids){return (ids||[]).map(id=>photo(id)).filter(Boolean).map(p=>`<button class="reference-photo" data-reference-photo="${esc(p.id)}"><img src="${esc(p.src)}" alt="${esc(p.title)}" loading="lazy"><span>${esc(p.title)} · ${esc(p.angle||'Chưa ghi góc nhìn')}</span></button>`).join('');}
function caseReference(){
 if(!context?.complete||!context.code)return '';const g=findGuide(),steps=g?.steps||[];
 return `<details><summary>Tài liệu xử lý theo mã lỗi ${esc(context.code)}</summary><h4>${esc(context.item?.title||'Chưa có mô tả lỗi')}</h4><p class="muted">Nội dung áp dụng cho mã lỗi; cần đối chiếu với linh kiện và cấu hình thực tế.</p>${steps.map(s=>`<article class="repair-section"><h4>${esc(s.title)}</h4>${repairText(s.instruction,'')}<div class="reference-photos">${refPhotos(s.photoId?[s.photoId]:[])}</div><p class="muted">${esc(s.source||g.source||'')}</p></article>`).join('')}${rawGuideDisclosure()}</details>`;
}

function rawGuideDisclosure(){const txt=guideText(context?.item);return txt?`<details><summary>Hướng dẫn gốc trong bảng lỗi</summary><div class="guide-instruction">${esc(txt)}</div></details>`:'';}
function makeGuide(){
 const existing=findGuide();if(existing)guideDraft=clone(existing);else{
  guideDraft=autoGuide()||{id:uid('guide'),title:context?.item?.title||'Guide kiểm tra',errorPattern:context?.code||'****',moduleId:context?.moduleId||moduleId,variant:'',command:'',source:context?.item?.source||'',startId:'',steps:[]};
  guideDraft.id=uid('guide');delete guideDraft.automatic;if(!guideDraft.steps.length){const s=newStep(guideDraft.moduleId||moduleId);guideDraft.steps.push(s);guideDraft.startId=s.id;}
 }
 editingStepId=guideDraft.startId;editTab='guides';showPage('edit');$('editor').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function newStep(mid=moduleId){return {id:uid('step'),title:'Bước kiểm tra mới',instruction:'',expected:'',moduleId:mid,componentIds:selected.filter(id=>part(id)?.moduleId===mid),photoId:availablePhotos(mid).some(p=>p.id===photoId)?photoId:'',source:'',outcomes:{pass:'__finish__',fail:'__stop__',unknown:'__stop__'}};}
let regionTargetIds=[],regionModuleIds=[],regionScope='components';
let regionModuleFilter='';
function targetChecks(kind,ids,mid,scope='components'){
 const items=scope==='modules'?project.modules.filter(m=>m.id!=='sru'):project.components.filter(p=>p.moduleId===mid||ids.includes(p.id)).sort((a,b)=>a.tag.localeCompare(b.tag));
 return `<label for="${kind}Filter">${scope==='modules'?'Module được đánh dấu':'Gắn nhiều linh kiện vào vùng / bước'}</label><input id="${kind}Filter" type="search" data-target-filter="${kind}" placeholder="Lọc danh sách…"><div class="target-list" data-target-list="${kind}">${items.map(p=>`<label class="check" data-search="${esc((p.tag||p.name).toLowerCase())}"><input type="checkbox" data-target="${kind}" value="${esc(p.id)}" ${ids.includes(p.id)?'checked':''}><span>${esc(scope==='modules'?p.name:p.tag+' · '+(typeNames[p.type]||p.type))}</span></label>`).join('')||'<div class="muted">Chưa có linh kiện. Thêm ở thẻ Linh kiện.</div>'}</div>`;
}
function checkedTargets(kind){return [...document.querySelectorAll(`[data-target="${kind}"]:checked`)].map(n=>n.value);}
function renderEditor(){
 document.querySelectorAll('[data-editor]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.editor===editTab)));
 document.querySelectorAll('[data-draw]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.draw===drawMode)));
 const host=$('editorContent');
 if(editTab==='regions'){
  const r=draftRegion||project.regions.find(r=>r.id===editingRegionId);if(r){regionTargetIds=[...r.componentIds];regionModuleIds=[...r.moduleIds];}
  const p=photo(photoId);const mid=regionModuleFilter||moduleId;
  host.innerHTML=`<p>Chọn Circle/Rect trên ảnh rồi kéo để vẽ. Một vùng có thể dùng chung cho nhiều tag. Vùng đang chọn có viền cam. Kéo chấm cam để đổi kích thước; kéo trong vùng để di chuyển.</p><label>Vùng đã đánh dấu</label><select id="regionSelect"><option value="">Chọn vùng trên ảnh…</option>${regionsFor(photoId).map((v,i)=>`<option value="${esc(v.id)}" ${v.id===editingRegionId?'selected':''}>${i+1}. ${esc([...v.componentIds.map(id=>part(id)?.tag||id),...v.moduleIds.map(id=>mod(id)?.name||id)].join(', '))}</option>`).join('')}</select><div class="button-row"><button id="newRegion">Vùng mới</button><button id="copyRegion" ${r?'':'disabled'}>Nhân bản</button><button id="cancelRegion">Hủy sửa vùng</button><button id="deleteRegion" class="danger" ${editingRegionId?'':'disabled'}>Xóa vùng</button></div><label for="regionScope">Loại đích</label><select id="regionScope"><option value="components" ${regionScope==='components'?'selected':''}>Linh kiện</option><option value="modules" ${regionScope==='modules'?'selected':''}>Module trên ảnh tổng thể</option></select>${regionScope==='components'?`<label>Module chứa linh kiện</label><select id="regionModuleFilter">${options(project.modules,mid)}</select><div class="form-grid"><input id="quickTag" placeholder="Tag mới: PPAC, M01…"><select id="quickType">${Object.entries(typeNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><button id="quickAddTag">+ Tạo và gắn tag vào vùng</button>`:''}${targetChecks('region',regionScope==='modules'?regionModuleIds:regionTargetIds,mid,regionScope)}<div class="form-grid">${['x','y',...(r?.type==='rect'?['w','h']:['r'])].map(k=>`<label>${({x:'Tâm X (%)',y:'Tâm Y (%)',w:'Rộng (%)',h:'Cao (%)',r:'Bán kính (% chiều rộng ảnh)'})[k]}<input id="region-${k}" type="number" min="0" max="100" step="0.1" value="${r?Number(r[k]).toFixed(2):''}" ${r?'':'disabled'}></label>`).join('')}</div>${textarea('regionNote','Ghi chú / nguồn vị trí',r?.note||'',2)}<button id="saveRegion" class="primary full" ${r?'':'disabled'}>Lưu vùng</button><p>${r?'Loại: '+esc(r.type):'Chưa chọn hoặc vẽ vùng.'} Tọa độ bám theo ảnh khi zoom; chỉ chỉnh số khi cần căn chính xác.</p>`;
 }else if(editTab==='photos'){
  const items=project.photos.filter(p=>p.moduleId===moduleId);if(!items.some(p=>p.id===photoEditingId))photoEditingId=items[0]?.id||'';const p=photo(photoEditingId);
  host.innerHTML=`<label class="file-button full">+ Tải ảnh vào module<input id="photoUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden></label><p>Ảnh được nhúng vào HTML khi xuất. Mỗi góc nhìn dùng ảnh riêng.</p><label for="photoEditSelect">Ảnh cần sửa</label><select id="photoEditSelect"><option value="">Chọn ảnh…</option>${options(items,photoEditingId,x=>x.title)}</select>${input('photoTitle','Tên ảnh',p?.title||'')}${input('photoAngle','Hướng / góc nhìn',p?.angle||'','placeholder="Trước, sau, trái, mở nắp…"')}${input('photoState','Trạng thái cụm',p?.state||'')}${input('photoVariant','Phiên bản / cấu hình áp dụng',p?.variant||'','placeholder="Để trống nếu dùng chung"')}${textarea('photoSourceEdit','Nguồn / trang tài liệu',p?.source||'',2)}<div class="button-row"><button id="savePhoto" class="primary" ${p?'':'disabled'}>Lưu thông tin ảnh</button><button id="deletePhoto" class="danger" ${p?'':'disabled'}>Xóa ảnh</button></div>${p?`<hr><h3>Chỉnh ảnh</h3><label>Độ sáng (%)<input id="photoBrightness" type="range" min="25" max="200" value="${p.brightness||100}"></label><label>Tương phản (%)<input id="photoContrast" type="range" min="25" max="200" value="${p.contrast||100}"></label><div class="button-row"><button id="saveImageAdjust">Lưu chỉnh ảnh</button><button id="resetImageAdjust">Về ảnh gốc</button><button id="editHighlights" class="primary">Đánh dấu linh kiện</button></div><p>Chỉnh sáng/tương phản giữ nguyên ảnh gốc và vị trí vùng đánh dấu.</p>`:''}${p?'<label class="file-button full">Thay file ảnh / nhúng ảnh<input id="replacePhotoUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label>':''}`;
 }else if(editTab==='components'){
  const items=project.components.filter(p=>p.moduleId===moduleId).sort((a,b)=>a.tag.localeCompare(b.tag));const c=part(componentEditingId);
  host.innerHTML=`<label for="componentEditSelect">Sửa linh kiện</label><select id="componentEditSelect"><option value="">+ Linh kiện mới</option>${options(items,componentEditingId,p=>p.tag)}</select>${input('componentTag','Tag / mã linh kiện',c?.tag||'','placeholder="PPAC, ASENCN3, PPDM…"')}${input('componentName','Tên mô tả',c?.name||'')}<label for="componentType">Loại</label><select id="componentType">${Object.entries(typeNames).map(([k,v])=>`<option value="${k}" ${c?.type===k?'selected':''}>${v}</option>`).join('')}</select>${textarea('componentNote','Ghi chú',c?.note||'',3)}${input('componentSource','Nguồn / trang tài liệu / phiên bản áp dụng',c?.source||'')}${repairEditor(c)}<div class="button-row"><button id="saveComponent" class="primary">Lưu linh kiện</button><button id="deleteComponent" class="danger" ${c?'':'disabled'}>Xóa</button></div><p>Motor / Solenoid trong bảng lỗi được giữ là nhóm chung cho đến khi xác nhận loại thực tế.</p>`;
 }else if(editTab==='modules'){
  const m=mod(moduleEditingId);
  host.innerHTML=`<label for="moduleEditSelect">Module</label><select id="moduleEditSelect"><option value="">+ Module mới</option>${options(project.modules,moduleEditingId)}</select>${input('moduleNameEdit','Tên module',m?.name||'')}${input('moduleAliases','Tên khác, ngăn cách bằng dấu ;',(m?.aliases||[]).join('; '))}${input('moduleVariant','Phiên bản cụm',m?.variant||'')}${textarea('moduleNoteEdit','Ghi chú',m?.note||'',3)}<div class="button-row"><button id="saveModule" class="primary">Lưu module</button><button id="deleteModule" class="danger" ${m&&m.id!=='sru'?'':'disabled'}>Xóa</button></div>`;
 }else if(editTab==='links'){
  const l=project.links.find(x=>x.id===linkEditingId),from=l?.from||selected[0]||project.components.find(c=>c.moduleId===moduleId)?.id||'',to=l?.to||'';
  host.innerHTML=`<label for="linkEditSelect">Liên kết</label><select id="linkEditSelect"><option value="">+ Liên kết mới</option>${options(project.links,linkEditingId,l=>nameOf(l.from)+' ↔ '+nameOf(l.to))}</select><label for="linkFrom">Đầu 1</label><select id="linkFrom"><option value="">Chọn linh kiện…</option>${componentOptions(from)}</select><label for="linkTo">Đầu 2 · có thể ở module khác</label><select id="linkTo"><option value="">Chọn linh kiện…</option>${componentOptions(to)}</select><label for="linkType">Quan hệ</label><select id="linkType">${Object.entries(linkNames).map(([k,v])=>`<option value="${k}" ${l?.type===k?'selected':''}>${v}</option>`).join('')}</select>${input('linkSource','Nguồn / trang sơ đồ',l?.source||'')}${textarea('linkNote','Ghi chú dây, giắc, chân hoặc hướng liên kết',l?.note||'',3)}<label class="check"><input id="linkVerified" type="checkbox" ${l?.verified?'checked':''}>Đã xác nhận liên kết</label><div class="button-row"><button id="saveLink" class="primary">Lưu liên kết</button><button id="deleteLink" class="danger" ${l?'':'disabled'}>Xóa</button></div><p>Liên kết mới chỉ xuất hiện sau khi được khai báo. Cùng được nhắc trong lỗi không xác định hai linh kiện nối với nhau.</p>`;
 }else if(editTab==='guides')renderGuideEditor();
}
const repairFields={location:'Vị trí trong module',access:'Cách tiếp cận sensor / linh kiện',wiring:'Dây, connector và chân liên quan',wireAccess:'Cách tiếp cận dây / connector',board:'Board liên quan',boardAccess:'Cách tiếp cận board',software:'Các phương án xử lý phần mềm',hardware:'Các phương án xử lý phần cứng'};
const repairPhotoFields={locationPhotos:'Ảnh vị trí',accessPhotos:'Ảnh cách tiếp cận linh kiện',wirePhotos:'Ảnh dây / connector',boardPhotos:'Ảnh board và cách tiếp cận'};
function repairEditor(c){const r=c?.repair||{};return '<hr><h3>Hồ sơ xử lý linh kiện</h3><p>Ghi thao tác và phương án tham khảo. Mỗi dòng có thể là một thao tác; không cần tạo nhánh đánh giá kết quả.</p>'+Object.entries(repairFields).map(([k,label])=>textarea('repair-'+k,label,r[k]||'',k==='software'||k==='hardware'?5:3)).join('')+Object.entries(repairPhotoFields).map(([key,label])=>`<details><summary>${label}</summary><div class="target-list">${project.photos.map(p=>`<label class="check"><input type="checkbox" data-repair-photos="${key}" value="${esc(p.id)}" ${(r[key]||[]).includes(p.id)?'checked':''}>${esc(mod(p.moduleId)?.name||'')} · ${esc(p.title)}</label>`).join('')}</div></details>`).join('');}
function readRepairForm(){const r={};for(const k of Object.keys(repairFields))r[k]=$('repair-'+k).value.trim();for(const k of Object.keys(repairPhotoFields))r[k]=[...document.querySelectorAll(`[data-repair-photos="${k}"]:checked`)].map(e=>e.value);return r;}
function componentOptions(value){return project.modules.map(m=>{const cs=project.components.filter(c=>c.moduleId===m.id).sort((a,b)=>a.tag.localeCompare(b.tag));return cs.length?`<optgroup label="${esc(m.name)}">${options(cs,value,c=>c.tag+' · '+(c.name||''))}</optgroup>`:'';}).join('');}
function renderGuideEditor(){
 const host=$('editorContent');let html=`<label>Tài liệu theo mã lỗi</label><select id="guideEditSelect"><option value="">Chọn tài liệu…</option>${options(project.guides,guideDraft?.id||'',g=>g.errorPattern+' · '+g.title)}</select><button id="newGuide">+ Tài liệu từ lỗi đang xem</button><p>Hồ sơ riêng từng sensor / motor / connector được sửa trong thẻ Linh kiện. Mục này chứa hướng dẫn chung theo mã lỗi.</p>`;
 if(!guideDraft){host.innerHTML=html;return;}const g=guideDraft,s=g.steps.find(x=>x.id===editingStepId)||g.steps[0];editingStepId=s.id;
 html+=input('guideTitle','Tên tài liệu',g.title)+`<div class="form-grid">${input('guidePattern','Mã lỗi / wildcard',g.errorPattern,'maxlength="4"')}${input('guideVariant','Byte14 (tùy chọn)',g.variant||'')}${input('guideCommand','Command (tùy chọn)',g.command||'')}</div><label>Module áp dụng</label><select id="guideModule"><option value="">Tất cả</option>${options(project.modules,g.moduleId)}</select>${input('guideSource','Nguồn / phiên bản',g.source||'')}<hr><h3>Các mục hướng dẫn</h3><div class="step-list">${g.steps.map((x,i)=>`<button data-edit-step="${esc(x.id)}" aria-pressed="${x.id===editingStepId}">${i+1}</button>`).join('')}<button id="addStep">+ Thêm mục</button></div>${input('stepTitle','Tiêu đề mục',s.title)}${textarea('stepInstruction','Hướng dẫn / phương án xử lý',s.instruction,6)}<label>Module của ảnh</label><select id="stepModule">${options(project.modules,s.moduleId)}</select><label>Ảnh minh họa</label><select id="stepPhoto"><option value="">Không chọn ảnh</option>${options(availablePhotos(s.moduleId),s.photoId,p=>p.title)}</select>${targetChecks('step',s.componentIds,s.moduleId)}${input('stepSource','Nguồn của mục',s.source||'')}<div class="button-row"><button id="stepUp">↑</button><button id="stepDown">↓</button><button id="deleteStep">Xóa mục</button></div><hr><button id="saveGuide" class="primary">Lưu tài liệu</button><button id="deleteGuide">Xóa tài liệu</button>`;host.innerHTML=html;
}

function captureGuideForm(){
 if(!guideDraft||!$('guideTitle'))return;const g=guideDraft,s=g.steps.find(x=>x.id===editingStepId);g.title=$('guideTitle').value.trim();g.errorPattern=$('guidePattern').value.trim().toUpperCase();g.variant=$('guideVariant').value.trim().toUpperCase();g.command=$('guideCommand').value.trim().toUpperCase();g.moduleId=$('guideModule').value;g.source=$('guideSource').value.trim();g.startId=g.steps[0].id;
 if(s){s.title=$('stepTitle').value.trim();s.instruction=$('stepInstruction').value;s.moduleId=$('stepModule').value;s.photoId=$('stepPhoto').value;s.componentIds=checkedTargets('step');s.source=$('stepSource').value.trim();}
}
async function saveRegion(){
 const old=draftRegion||project.regions.find(r=>r.id===editingRegionId);if(!old)return;const r=clone(old);for(const k of (r.type==='circle'?['x','y','r']:['x','y','w','h']))r[k]=Number($('region-'+k).value);r.note=$('regionNote').value.trim();r.componentIds=regionScope==='components'?checkedTargets('region'):[];r.moduleIds=regionScope==='modules'?checkedTargets('region'):[];if(!r.componentIds.length&&!r.moduleIds.length)return toast('Chọn ít nhất một linh kiện hoặc module cho vùng này.');
 const same=project.regions.find(x=>x.photoId===r.photoId&&x.id!==r.id&&shapeKey(x)===shapeKey(r));
 await commit(p=>{p.regions=p.regions.filter(x=>x.id!==r.id);if(same){const target=p.regions.find(x=>x.id===same.id);target.componentIds=[...new Set([...target.componentIds,...r.componentIds])];target.moduleIds=[...new Set([...target.moduleIds,...r.moduleIds])];editingRegionId=target.id;}else{p.regions.push(r);editingRegionId=r.id;}draftRegion=null;},same?'Đã gộp tag vào vùng trùng vị trí.':'Đã lưu vùng ảnh.');
}
async function uploadPhotos(files){
 if(!files.length)return;toast('Đang đọc ảnh…');try{
 const photos=[];for(const file of files){if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('Chọn ảnh PNG, JPG, WebP hoặc GIF.');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});const dimensions=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve({width:im.naturalWidth,height:im.naturalHeight});im.onerror=()=>reject(Error('Không đọc được ảnh '+file.name));im.src=src;});photos.push({id:uid('photo'),moduleId,title:file.name.replace(/\.[^.]+$/,''),angle:'',state:'',variant:'',source:file.name,src,...dimensions});}
 await commit(p=>p.photos.push(...photos),'Đã thêm '+photos.length+' ảnh. Ghi góc nhìn và trạng thái cho từng ảnh.');photoId=photos[0].id;photoEditingId=photoId;imageToken='';renderWorkspace();
 }catch(e){toast(e.message);}
}
async function editorAction(id){
 // Editor operations preserve source IDs and validate references before saving.
 if(id==='editHighlights'){editTab='regions';drawMode='pan';showPage('edit');return;}
 if(id==='saveImageAdjust'||id==='resetImageAdjust'){const brightness=id==='resetImageAdjust'?100:Number($('photoBrightness').value),contrast=id==='resetImageAdjust'?100:Number($('photoContrast').value);return commit(p=>Object.assign(p.photos.find(x=>x.id===photoEditingId),{brightness,contrast}),'Đã lưu chỉnh ảnh.');}
 if(id==='cancelRegion'){draftRegion=null;editingRegionId='';drawMode='pan';renderEditor();drawImage();return;}
 if(id==='copyRegion'){const r=draftRegion||project.regions.find(r=>r.id===editingRegionId);if(!r)return;draftRegion={...clone(r),id:uid('region'),x:Math.min(95,r.x+3),y:Math.min(95,r.y+3)};editingRegionId='';drawMode='pan';renderEditor();drawImage();return;}
 if(id==='quickAddTag'){const tag=$('quickTag').value.trim().toUpperCase(),type=$('quickType').value,mid=regionModuleFilter||moduleId;if(!tag)return toast('Nhập tag mới.');let c=project.components.find(c=>c.moduleId===mid&&c.tag===tag);if(!c){c={id:uid('part'),moduleId:mid,tag,name:tag,type,note:'',source:''};await commit(p=>p.components.push(c),'Đã tạo linh kiện.');}regionTargetIds=[...new Set([...regionTargetIds,c.id])];if(draftRegion)draftRegion.componentIds=[...regionTargetIds];renderEditor();return;}
 if(id==='saveRegion')return saveRegion();
 if(id==='newRegion'){editingRegionId='';draftRegion=null;renderEditor();drawImage();return;}
 if(id==='deleteRegion'){if(!editingRegionId)return;if(!confirm('Xóa vùng highlight đang chọn?'))return;return commit(p=>{p.regions=p.regions.filter(r=>r.id!==editingRegionId);editingRegionId='';draftRegion=null;});}
 if(id==='savePhoto'){const values={title:$('photoTitle').value.trim(),angle:$('photoAngle').value.trim(),state:$('photoState').value.trim(),variant:$('photoVariant').value.trim(),source:$('photoSourceEdit').value.trim()};if(!values.title)return toast('Nhập tên ảnh.');return commit(p=>Object.assign(p.photos.find(x=>x.id===photoEditingId),values));}
 if(id==='deletePhoto'){if(!confirm('Xóa ảnh này và các vùng của ảnh? Các bước guide dùng ảnh sẽ chuyển sang tự chọn ảnh.'))return;const removeId=photoEditingId;return commit(p=>{p.photos=p.photos.filter(x=>x.id!==removeId);(p.manual2024?.entries||[]).forEach(r=>{r.photoIds=r.photoIds.filter(id=>id!==removeId);});p.regions=p.regions.filter(x=>x.photoId!==removeId);p.components.forEach(c=>{if(c.repair)for(const k of Object.keys(repairPhotoFields))c.repair[k]=(c.repair[k]||[]).filter(id=>id!==removeId);});p.guides.forEach(g=>g.steps.forEach(s=>{if(s.photoId===removeId)s.photoId='';}));photoEditingId='';photoId='';imageToken='';});}
 if(id==='saveComponent'){const tag=$('componentTag').value.trim().toUpperCase();if(!tag)return toast('Nhập tag linh kiện.');const values={tag,name:$('componentName').value.trim()||tag,type:$('componentType').value,note:$('componentNote').value.trim(),source:$('componentSource').value.trim(),repair:readRepairForm()};const same=project.components.find(c=>c.moduleId===moduleId&&c.tag===tag&&c.id!==componentEditingId);if(same)return toast('Tag này đã tồn tại trong module.');return commit(p=>{if(componentEditingId)Object.assign(p.components.find(c=>c.id===componentEditingId),values);else{const c={id:moduleId+'::'+tag,moduleId,...values};p.components.push(c);componentEditingId=c.id;}});}
 if(id==='deleteComponent'){const id=componentEditingId;if(project.regions.some(r=>r.componentIds.includes(id))||project.links.some(l=>l.from===id||l.to===id)||project.guides.some(g=>g.steps.some(s=>s.componentIds.includes(id))))return toast('Linh kiện đang dùng trong vùng ảnh, liên kết hoặc guide. Gỡ các tham chiếu đó trước khi xóa.');if(!confirm('Xóa linh kiện này?'))return;return commit(p=>{p.components=p.components.filter(c=>c.id!==id);selected=selected.filter(x=>x!==id);componentEditingId='';});}
 if(id==='saveModule'){const name=$('moduleNameEdit').value.trim();if(!name)return toast('Nhập tên module.');const values={name,aliases:$('moduleAliases').value.split(';').map(s=>s.trim()).filter(Boolean),variant:$('moduleVariant').value.trim(),note:$('moduleNoteEdit').value.trim()};return commit(p=>{if(moduleEditingId)Object.assign(p.modules.find(m=>m.id===moduleEditingId),values);else{const key=slug(name);if(p.modules.some(m=>m.id===key))throw Error('Module này đã tồn tại.');p.modules.push({id:key,...values});moduleEditingId=key;moduleId=key;photoId='';}});}
 if(id==='deleteModule'){const id=moduleEditingId;if(project.components.some(c=>c.moduleId===id)||project.photos.some(p=>p.moduleId===id)||project.regions.some(r=>r.moduleIds.includes(id))||project.guides.some(g=>g.moduleId===id||g.steps.some(s=>s.moduleId===id)))return toast('Module còn được dùng bởi ảnh, linh kiện hoặc guide.');if(!confirm('Xóa module này?'))return;return commit(p=>{p.modules=p.modules.filter(m=>m.id!==id);moduleEditingId='';moduleId='sru';photoId='upper-overview';});}
 if(id==='saveLink'){const values={from:$('linkFrom').value,to:$('linkTo').value,type:$('linkType').value,source:$('linkSource').value.trim(),note:$('linkNote').value.trim(),verified:$('linkVerified').checked};return commit(p=>{if(linkEditingId)Object.assign(p.links.find(l=>l.id===linkEditingId),values);else{const l={id:uid('link'),...values};p.links.push(l);linkEditingId=l.id;}});}
 if(id==='deleteLink'){if(!confirm('Xóa liên kết này?'))return;return commit(p=>{p.links=p.links.filter(l=>l.id!==linkEditingId);linkEditingId='';});}
 if(id==='newGuide')return makeGuide();
 if(['addStep','deleteStep','stepUp','stepDown','saveGuide'].includes(id))captureGuideForm();
 if(id==='addStep'){const s=newStep(guideDraft.moduleId||moduleId);guideDraft.steps.push(s);editingStepId=s.id;renderGuideEditor();return;}
 if(id==='deleteStep'){if(guideDraft.steps.length===1)return toast('Guide cần ít nhất một bước.');if(!confirm('Xóa mục hướng dẫn này?'))return;guideDraft.steps=guideDraft.steps.filter(s=>s.id!==editingStepId);guideDraft.steps.forEach(s=>Object.keys(s.outcomes).forEach(k=>{if(s.outcomes[k]===editingStepId)s.outcomes[k]='__stop__';}));if(guideDraft.startId===editingStepId)guideDraft.startId=guideDraft.steps[0].id;editingStepId=guideDraft.steps[0].id;renderGuideEditor();return;}
 if(id==='stepUp'||id==='stepDown'){const i=guideDraft.steps.findIndex(s=>s.id===editingStepId),j=i+(id==='stepUp'?-1:1);if(j>=0&&j<guideDraft.steps.length)[guideDraft.steps[i],guideDraft.steps[j]]=[guideDraft.steps[j],guideDraft.steps[i]];renderGuideEditor();return;}
 if(id==='saveGuide'){if(!guideDraft.title||guideDraft.steps.some(s=>!s.title||!s.instruction.trim()))return toast('Điền tên guide, tên bước và nội dung của mọi bước.');if(guideDraft.variant&&!/^[0-9A-F]{2}$/.test(guideDraft.variant))return toast('Byte14 phải có 2 ký tự HEX.');if(guideDraft.command&&!/^[0-9A-F]{4}$/.test(guideDraft.command))return toast('Command phải có 4 ký tự HEX.');return commit(p=>{p.guides=p.guides.filter(g=>g.id!==guideDraft.id);p.guides.push(clone(guideDraft));run=null;},'Đã lưu tài liệu hướng dẫn.');}
 if(id==='deleteGuide'){if(!guideDraft||!confirm('Xóa guide đã lưu này?'))return;return commit(p=>{p.guides=p.guides.filter(g=>g.id!==guideDraft.id);guideDraft=null;run=null;});}
}
async function replacePhotoFile(file){
 if(!photo(photoEditingId))throw Error('Chọn ảnh cần thay.');if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('Chọn file ảnh PNG/JPG/WebP/GIF.');
 const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
 const dimensions=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve({width:im.naturalWidth,height:im.naturalHeight});im.onerror=()=>reject(Error('Không đọc được file ảnh.'));im.src=src;});
 await commit(p=>Object.assign(p.photos.find(x=>x.id===photoEditingId),{src,...dimensions}),'Đã nhúng ảnh mới. Kiểm tra lại vùng nếu ảnh mới khác bố cục.');imageToken='';renderWorkspace();
}
function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');let inQuotes=false,commas=0,semis=0;for(let i=0;i<text.length;i++){if(text[i]==='"'){if(inQuotes&&text[i+1]==='"'){i++;continue;}inQuotes=!inQuotes;}else if(!inQuotes){if(text[i]===',')commas++;else if(text[i]===';')semis++;else if(/[\r\n]/.test(text[i]))break;}}
 const delimiter=semis>commas?';':',',rows=[];let row=[],field='';inQuotes=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(inQuotes){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else inQuotes=false;}else field+=c;}else if(c==='"')inQuotes=true;else if(c===delimiter){row.push(field);field='';}else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}else if(c!=='\r')field+=c;}
 if(inQuotes)throw Error('CSV có ô chưa đóng dấu ngoặc kép.');if(field||row.length){row.push(field);rows.push(row);}const clean=rows.filter(r=>r.some(x=>x.trim()));if(clean.length<2)throw Error('CSV không có dữ liệu.');const headers=clean[0].map(s=>s.trim());return clean.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
}
function normalizeCode(raw){let c=String(raw).trim().toUpperCase().replace(/\s+/g,'');const m=c.match(/^([0-9]+(?:\.[0-9]+)?)E\+([0-9]+)$/);if(m){const digits=m[1].replace('.','').replace(/0+$/,'')||'0',exp=parseInt(m[2],10)-(digits.length-1),needed=4-(digits.length+1);if(exp>=0&&needed>=1){const candidate=digits+'E'+String(exp).padStart(needed,'0');if(candidate.length===4)c=candidate;}}return c.padStart(4,'0');}
function errorsFromCSV(rows){const db={};for(const row of rows){const code=normalizeCode(row['Error code']||'');if(!row['Error code'])continue;if(!/^[0-9A-F]{1,4}\*{0,3}$/.test(code)||code.length!==4)throw Error('Mã lỗi không hợp lệ: '+row['Error code']);if(db[code])throw Error('Trùng mã sau chuẩn hóa: '+code);const description=[];for(const [f,p]of[['How to / when to detect error','How to detect'],['Error category','Category'],['Related FRU - Main','Main'],['Connector','Connector'],['Sensor','Sensor'],['Motor / Solenoid','Motor/Solenoid']])if(row[f]?.trim())description.push(p+': '+row[f].trim());const guide=(row.Guide||'').trim();guide.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach((s,i)=>description.push((i===0?'Guide: ':'')+s));db[code]={title:row['Error message']||'',description,guide,main:row['Related FRU - Main']||'',connector:row.Connector||'',sensor:row.Sensor||'',actuator:row['Motor / Solenoid']||'',source:'CSV nhập vào · Error code '+code};}if(!Object.keys(db).length)throw Error('Không tìm thấy cột Error code và dữ liệu hợp lệ.');return db;}
function validateTables(t){if(!t||typeof t!=='object')throw Error('Thiếu bảng tra cứu.');for(const k of ['errors','commands','statuses','modules','statusMessages'])if(!t[k]||typeof t[k]!=='object'||Array.isArray(t[k]))throw Error('Bảng tra cứu thiếu '+k);for(const [code,item]of Object.entries(t.errors))if(!/^[0-9A-F]{1,4}\*{0,3}$/.test(code)||code.length!==4||typeof item.title!=='string'||!Array.isArray(item.description)||item.description.some(s=>typeof s!=='string'))throw Error('Dòng dữ liệu lỗi không hợp lệ: '+code);return true;}
function parseLayoutLiteral(text){
 // Parse only data literals; never execute uploaded JavaScript.
 let s=text.replace(/^\uFEFF/,'').trim();s=s.replace(/^(?:(?:const|let|var)\s+SENSOR_LAYOUT|window\.SENSOR_LAYOUT)\s*=\s*/,'').replace(/;\s*$/,'');let i=0;
 function skip(){while(i<s.length){if(/\s/.test(s[i]))i++;else if(s.slice(i,i+2)==='//'){i=s.indexOf('\n',i);if(i<0){i=s.length;break;}}else if(s.slice(i,i+2)==='/*'){const e=s.indexOf('*/',i+2);if(e<0)throw Error('Chú thích chưa đóng.');i=e+2;}else break;}}
 function str(){const quote=s[i++];let out='';while(i<s.length){let c=s[i++];if(c===quote)return out;if(c==='\\'){c=s[i++];if(c==='u'){const h=s.slice(i,i+4);if(!/^[a-f0-9]{4}$/i.test(h))throw Error('Escape không hợp lệ.');out+=String.fromCharCode(parseInt(h,16));i+=4;}else out+=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'})[c]??c;}else out+=c;}throw Error('Chuỗi chưa đóng.');}
 function value(){skip();if(s[i]==='"'||s[i]==="'")return str();if(s[i]==='{'){i++;const o={};skip();while(s[i]!=='}'){skip();let key;if(s[i]==='"'||s[i]==="'")key=str();else{const m=s.slice(i).match(/^[A-Za-z_$][\w$]*/);if(!m)throw Error('Khóa không hợp lệ.');key=m[0];i+=key.length;}if(['__proto__','constructor','prototype'].includes(key))throw Error('Khóa không được hỗ trợ.');skip();if(s[i++]!==':')throw Error('Thiếu dấu hai chấm.');o[key]=value();skip();if(s[i]===','){i++;skip();}else if(s[i]!=='}')throw Error('Thiếu dấu phẩy.');}i++;return o;}if(s[i]==='['){i++;const a=[];skip();while(s[i]!==']'){a.push(value());skip();if(s[i]===','){i++;skip();}else if(s[i]!==']')throw Error('Thiếu dấu phẩy.');}i++;return a;}const number=s.slice(i).match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);if(number){i+=number[0].length;return Number(number[0]);}for(const [word,v]of[['true',true],['false',false],['null',null]])if(s.slice(i,i+word.length)===word){i+=word.length;return v;}throw Error('Chỉ nhận object/array dữ liệu, không nhận mã chạy.');}
 const result=value();skip();if(i!==s.length)throw Error('File có mã lệnh ngoài dữ liệu SENSOR_LAYOUT.');return result.SENSOR_LAYOUT||result;
}
async function importLayout(file){const layout=parseLayoutLiteral(await file.text());await commit(p=>{
 for(const [key,l]of Object.entries(layout)){if(!l||typeof l!=='object'||!l.sensors)continue;let m=p.modules.find(m=>m.id===key);if(!m){m={id:slug(key),name:key,aliases:[],variant:'',note:''};p.modules.push(m);}const relative=String(l.image||key+'.png');const src=relative.startsWith('images/')?relative:'images/'+relative;let ph=p.photos.find(x=>x.moduleId===m.id&&x.src===src);if(!ph){ph={id:uid('legacy'),moduleId:m.id,title:'Ảnh từ SENSOR_LAYOUT · '+relative,angle:'',state:'',variant:'',source:'SENSOR_LAYOUT · chọn lại file ảnh để nhúng',src,width:1000,height:1000};p.photos.push(ph);}
 for(const [tag,entry]of Object.entries(l.sensors)){const normalized=tag.toUpperCase(),cid=m.id+'::'+normalized;if(!p.components.some(c=>c.id===cid))p.components.push({id:cid,moduleId:m.id,tag:normalized,name:normalized,type:'sensor',source:'SENSOR_LAYOUT',note:''});for(const s of (Array.isArray(entry)?entry:[entry])){if(!s||!['circle','rect'].includes(s.type))continue;const r={id:uid('region'),photoId:ph.id,type:s.type,x:Number(s.x),y:Number(s.y),...(s.type==='circle'?{r:Number(s.r)}:{w:Number(s.w),h:Number(s.h)}),componentIds:[cid],moduleIds:[],note:'Nhập từ SENSOR_LAYOUT; kiểm tra lại kích thước ảnh và vùng.'};const existing=p.regions.find(x=>x.photoId===ph.id&&shapeKey(x)===shapeKey(r));if(existing)existing.componentIds=[...new Set([...existing.componentIds,cid])];else p.regions.push(r);}}
 }
 },'Đã nhập SENSOR_LAYOUT. Các ảnh dạng đường dẫn cần được chọn lại để nhúng và xác nhận kích thước.');}
function world(e,matrix){const p=$('guideSvg').createSVGPoint();p.x=e.clientX;p.y=e.clientY;const inverse=matrix||$('guideSvg').getScreenCTM()?.inverse();return inverse?p.matrixTransform(inverse):{x:0,y:0};}
function draftMarkup(){
 const r=draftRegion,p=photo(photoId);if(!r||!p)return '';
 const x=(r.x+(r.type==='circle'?r.r:r.w/2))*p.width/100,y=(r.y+(r.type==='circle'?0:r.h/2))*p.height/100;
 return shapeMarkup(r,'class="drawing" data-draft="true"')+`<circle data-resize="true" cx="${x}" cy="${y}" r="${camera.w*.012}" class="resize-handle"/>`;
}
function draftOnly(){const layer=$('draftLayer');if(layer)layer.innerHTML=draftMarkup();}
function resizedRegion(r,pt,p){const next=clone(r);if(r.type==='circle')next.r=Math.max(.1,Math.min(Math.hypot(pt.x-r.x*p.width/100,pt.y-r.y*p.height/100)/p.width*100,r.x,100-r.x,r.y*p.height/p.width,(100-r.y)*p.height/p.width));else {next.w=Math.max(.1,Math.min(Math.abs(pt.x/p.width*100-r.x)*2,2*Math.min(r.x,100-r.x)));next.h=Math.max(.1,Math.min(Math.abs(pt.y/p.height*100-r.y)*2,2*Math.min(r.y,100-r.y)));}return next;}

function regionClick(id){const r=project.regions.find(x=>x.id===id);if(!r)return;if(page==='edit'&&editTab==='regions'){editingRegionId=id;draftRegion=clone(r);regionTargetIds=[...r.componentIds];regionModuleIds=[...r.moduleIds];regionScope=r.moduleIds.length?'modules':'components';renderEditor();drawImage();}else if(r.moduleIds.length){const scope=relatedScope();const target=r.moduleIds.includes(moduleId)?moduleId:r.moduleIds.find(id=>!scope||scope.modules.has(id));if(target)setModule(target);}else{const same=regionsFor(photoId).filter(x=>shapeKey(x)===shapeKey(r));const scope=relatedScope();selected=[...new Set(same.flatMap(x=>x.componentIds))].filter(id=>part(id)?.moduleId===moduleId&&(!scope||scope.ids.has(id)));focusedComponentId=selected.length===1?selected[0]:'';renderWorkspace();}}
const pointers=new Map();let gesture=null;
function pointerDown(e){if(!photo(photoId)||e.button>0)return;const svg=$('guideSvg');svg.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){const a=[...pointers.values()],center={clientX:(a[0].x+a[1].x)/2,clientY:(a[0].y+a[1].y)/2};gesture={type:'pinch',camera:{...camera},distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1,anchor:world(center),matrix:svg.getScreenCTM().inverse(),moved:true};return;}
 const resize=!!e.target.closest('[data-resize]'),isDraft=!!e.target.closest('[data-draft]');const rId=e.target.closest('[data-region]')?.getAttribute('data-region')||((isDraft||resize)?editingRegionId:''),editing=page==='edit'&&editTab==='regions';
 if(editing&&rId&&!isDraft&&!resize&&drawMode==='pan'){regionClick(rId);}
 gesture={type:editing&&resize?'resize':editing&&drawMode!=='pan'?'draw':editing&&(rId||isDraft)?'move':'pan',start:world(e),client:{x:e.clientX,y:e.clientY},camera:{...camera},matrix:svg.getScreenCTM().inverse(),rId,original:draftRegion?clone(draftRegion):null,moved:false};
 if(gesture.type==='draw'){draftRegion=null;editingRegionId='';}
}
function pointerMove(e){if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=photo(photoId),g=gesture;if(!p)return;
 if(g.type==='pinch'&&pointers.size>=2){const a=[...pointers.values()],dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1,mid=world({clientX:(a[0].x+a[1].x)/2,clientY:(a[0].y+a[1].y)/2},g.matrix),ratio=Math.min(p.width/.75,Math.max(p.width/3,g.camera.w*g.distance/dist))/g.camera.w;camera={x:g.anchor.x-(mid.x-g.camera.x)*ratio,y:g.anchor.y-(mid.y-g.camera.y)*ratio,w:g.camera.w*ratio,h:g.camera.h*ratio};applyCamera();return;}
 if(pointers.size!==1||!g.start)return;const pt=world(e,g.matrix),dx=pt.x-g.start.x,dy=pt.y-g.start.y;g.moved=g.moved||Math.hypot(e.clientX-g.client.x,e.clientY-g.client.y)>5;
 if(g.type==='pan'){camera={...g.camera,x:g.camera.x-dx,y:g.camera.y-dy};applyCamera();}
 else if(g.type==='resize'&&g.original){draftRegion=resizedRegion(g.original,pt,p);draftOnly();}
 else if(g.type==='move'&&g.original){draftRegion={...g.original,x:Math.min(100,Math.max(0,g.original.x+dx/p.width*100)),y:Math.min(100,Math.max(0,g.original.y+dy/p.height*100))};draftOnly();}
 else if(g.type==='draw'){const a={x:Math.min(p.width,Math.max(0,g.start.x)),y:Math.min(p.height,Math.max(0,g.start.y))},b={x:Math.min(p.width,Math.max(0,pt.x)),y:Math.min(p.height,Math.max(0,pt.y))},cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;draftRegion={id:uid('region'),photoId,type:drawMode,x:cx/p.width*100,y:cy/p.height*100,componentIds:regionScope==='components'?[...regionTargetIds]:[],moduleIds:regionScope==='modules'?[...regionModuleIds]:[],note:''};if(drawMode==='circle')draftRegion.r=Math.min(Math.hypot(b.x-a.x,b.y-a.y)/2,cx,p.width-cx,cy,p.height-cy)/p.width*100;else{draftRegion.w=Math.abs(b.x-a.x)/p.width*100;draftRegion.h=Math.abs(b.y-a.y)/p.height*100;}draftOnly();}
}
function pointerEnd(e){if(!pointers.has(e.pointerId))return;const g=gesture;pointers.delete(e.pointerId);if(!g)return;if(g.type==='pinch'){gesture=null;pointers.clear();return;}if(e.type==='pointercancel'){draftRegion=g.original||null;gesture=null;drawImage();return;}
 if((g.type==='draw'||g.type==='move'||g.type==='resize')&&g.moved&&draftRegion){renderEditor();drawImage();}else if(!g.moved&&g.rId)regionClick(g.rId);gesture=null;}
async function handleClick(e){
 const b=e.target.closest('button');if(!b)return;
 try{
 if(b.id==='previousPhoto'||b.id==='nextPhoto'){navigatePhoto(b.id==='previousPhoto'?-1:1);return;}
 if(b.id==='focusComponentRegion'){focusComponentRegion();return;}
 if(handleExplorationClick(b))return;
 if(b.dataset.page){captureGuideForm();showPage(b.dataset.page);return;}
 if(b.dataset.editor){captureGuideForm();editTab=b.dataset.editor;drawMode='pan';draftRegion=null;editingRegionId='';renderWorkspace();return;}
 if(b.dataset.photo){if(!diagnosticPhotoAllowed(b.dataset.photo))return;captureGuideForm();photoId=b.dataset.photo;imageToken='';draftRegion=null;editingRegionId='';renderWorkspace();return;}
 if(b.dataset.component){captureGuideForm();focusParts([b.dataset.component]);return;}
 if(b.dataset.casePart){focusParts([b.dataset.casePart]);return;}
 if(b.dataset.linkTarget){focusParts([b.dataset.linkTarget]);return;}
 if(b.dataset.draw){drawMode=b.dataset.draw;document.querySelectorAll('[data-draw]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));return;}
 if(b.dataset.manualPhoto){if(!diagnosticPhotoAllowed(b.dataset.manualPhoto))return;const ph=photo(b.dataset.manualPhoto);if(ph){photoId=ph.id;imageToken='';renderWorkspace();$('viewerBox').scrollIntoView({block:'nearest',behavior:'smooth'});}return;}
 if(b.dataset.referencePhoto){if(!diagnosticPhotoAllowed(b.dataset.referencePhoto))return;const ph=photo(b.dataset.referencePhoto);if(ph){setModule(availablePhotos(moduleId).some(x=>x.id===ph.id)?moduleId:ph.moduleId,selected,ph.id);$('viewerBox').scrollIntoView({block:'nearest',behavior:'smooth'});}return;}
 if(b.dataset.editStep){captureGuideForm();editingStepId=b.dataset.editStep;renderGuideEditor();return;}
 const id=b.id;
 if(id==='openCircuit'){const ph=photo($('circuitSelect').value);if(ph){photoId=ph.id;imageToken='';renderWorkspace();}return;}

 if(id==='sample'){$('mdata').value='00-52-54-41-20-1E-64-01-0A-02-05-0A-0A-58-5C-07-00-0B';$('mstatus').value='02';renderStatus();renderDecode();toast('Đang xem MData ví dụ cho lỗi 4120.');}
 else if(id==='clearSelection'){focusedComponentId='';selected=[];renderWorkspace();}
 else if(id==='zoomIn')zoom(.75);else if(id==='zoomOut')zoom(1/.75);else if(id==='fitView')fit();
 else if(id==='fullView')openFullImage();
 else if(id==='closeFull')$('fullDialog').close();
 else if(id==='exportHTML')exportHTML('diagnostic');
 else if(id==='exportEditor')exportHTML('editor');
 else if(id==='exportProject')download('SRU_VisualGuide_Data.json',safeJSON({schemaVersion:1,project}));
 else if(id==='editHighlightsShortcut'){editTab='regions';showPage('edit');$('editor').scrollIntoView({block:'nearest',behavior:'smooth'});}
 else if(id==='editPhotoShortcut'){editTab='photos';photoEditingId=photoId;showPage('edit');$('editor').scrollIntoView({block:'nearest',behavior:'smooth'});}
 else if(['editGuideShortcut','makeGuide'].includes(id))makeGuide();
 else await editorAction(id);
 }catch(error){toast(error.message||'Không thực hiện được thao tác.');}
}
let diagnosticReady=false;
function refreshDiagnosticInput(){
 if(!diagnosticReady)return;
 try{
  const field=$('mdata'),hex=field.value.replace(/[^0-9a-f]/gi,'').toUpperCase().slice(0,36);
  field.value=(hex.match(/.{1,2}/g)||[]).join('-');
  renderStatus();renderDecode();
  $('appError').hidden=true;$('appError').textContent='';
 }catch(e){reportStartupError('Không hiển thị được chẩn đoán: '+(e.message||String(e)));}
}

function renderStatus(){let value=$('mstatus').value.replace(/[^0-9]/g,'').slice(0,2);$('mstatus').value=value;$('statusResult').textContent=value?(tables.statuses[value.padStart(2,'0')]||'Unknown'):'—';}
function handleEditorChange(e){const id=e.target.id;
 if(e.target.dataset.target==='region'){if(regionScope==='components')regionTargetIds=checkedTargets('region');else regionModuleIds=checkedTargets('region');if(draftRegion){draftRegion.componentIds=regionScope==='components'?[...regionTargetIds]:[];draftRegion.moduleIds=regionScope==='modules'?[...regionModuleIds]:[];}return;}
 if(id==='regionSelect'){if(e.target.value)regionClick(e.target.value);return;}
 if(id==='regionModuleFilter'){regionModuleFilter=e.target.value;renderEditor();return;}
 if(id==='regionScope'){regionScope=e.target.value;if(draftRegion){draftRegion.componentIds=[];draftRegion.moduleIds=[];}regionTargetIds=[];regionModuleIds=[];renderEditor();}
 else if(id==='photoEditSelect'){photoEditingId=e.target.value;if(photoEditingId){photoId=photoEditingId;imageToken='';}renderWorkspace();}
 else if(id==='componentEditSelect'){componentEditingId=e.target.value;renderEditor();}
 else if(id==='moduleEditSelect'){moduleEditingId=e.target.value;renderEditor();}
 else if(id==='linkEditSelect'){linkEditingId=e.target.value;renderEditor();}
 else if(id==='guideEditSelect'){const g=project.guides.find(g=>g.id===e.target.value);guideDraft=g?clone(g):null;editingStepId=g?.startId||'';renderGuideEditor();}
 else if(id==='stepModule'){const next=e.target.value;captureGuideForm();const s=guideDraft.steps.find(s=>s.id===editingStepId);s.moduleId=next;s.photoId='';s.componentIds=[];renderGuideEditor();}
}
async function fileChange(e){if(!editorMode)return;const files=[...(e.target.files||[])];if(!files.length)return;try{
 if(e.target.id==='importHTML'){const doc=new DOMParser().parseFromString(await files[0].text(),'text/html');const p=JSON.parse(doc.getElementById('sruProject')?.textContent||'null'),embedded=JSON.parse(doc.getElementById('sruTables')?.textContent||'null'),t=embedded?.errors?embedded:tables;validateProject(p);validateTables(t);if(!confirm('Mở dữ liệu từ HTML này để chỉnh sửa? Hãy xuất bản Editor hiện tại nếu cần giữ thay đổi.'))return;project=clone(p);tables=clone(t);run=null;moduleId='sru';photoId=bestPhoto(moduleId)?.id||'';imageToken='';draftRegion=null;await saveLocal();showPage('edit');toast('Đã mở dữ liệu HTML.');}
 else if(e.target.id==='photoUpload')await uploadPhotos(files);
 else if(e.target.id==='replacePhotoUpload')await replacePhotoFile(files[0]);
 else if(e.target.id==='importLayout')await importLayout(files[0]);
 else if(e.target.id==='importCSV'){const errors=errorsFromCSV(parseCSV(await files[0].text()));if(!confirm('Cập nhật bảng lỗi bằng '+Object.keys(errors).length+' dòng từ CSV này? Ảnh và guide đã biên soạn được giữ.'))return;tables={...tables,errors,source:files[0].name};renderDecode();await saveLocal();showPage('data');toast('Đã cập nhật bảng lỗi CSV.');}
 else if(e.target.id==='importProject'){const value=JSON.parse(await files[0].text()),incoming=value.project||value;validateProject(incoming);if(value.tables)validateTables(value.tables);if(!confirm('Thay dữ liệu ảnh và guide hiện tại bằng file JSON này? Hãy xuất dữ liệu hiện tại trước nếu cần giữ một bản.'))return;project=clone(incoming);project.documentId=project.documentId||uid('sru');if(value.tables)tables=clone(value.tables);run=null;moduleId=project.modules[0].id;photoId=bestPhoto(moduleId)?.id||'';selected=[];imageToken='';await saveLocal();showPage('data');toast('Đã nhập dữ liệu.');}
 }catch(error){toast('Không nhập được: '+error.message);}finally{e.target.value='';}}
document.addEventListener('click',handleClick);
for(const event of ['input','change']){$('mstatus').addEventListener(event,()=>{if(diagnosticReady)renderStatus();});$('mdata').addEventListener(event,refreshDiagnosticInput);}


$('circuitSearch').addEventListener('input',renderCircuits);
$('moduleSelect').addEventListener('change',e=>{captureGuideForm();setModule(e.target.value);});
$('componentFilter').addEventListener('input',renderComponents);
$('dimOther').addEventListener('change',drawImage);
$('editor').addEventListener('change',handleEditorChange);
document.addEventListener('change',e=>{if(e.target.type==='file')fileChange(e);});
document.addEventListener('input',e=>{if(['photoBrightness','photoContrast'].includes(e.target.id)){const im=$('sourceImage');if(im)im.style.filter=`brightness(${$('photoBrightness').value}%) contrast(${$('photoContrast').value}%)`;} if(e.target.dataset.targetFilter){const kind=e.target.dataset.targetFilter,q=e.target.value.toLowerCase();document.querySelectorAll(`[data-target-list="${kind}"] [data-search]`).forEach(el=>el.hidden=!el.dataset.search.includes(q));}if(e.target.id.startsWith('region-')&&draftRegion){const k=e.target.id.slice(7),v=Number(e.target.value);if(Number.isFinite(v)&&v>=0&&v<=100){draftRegion[k]=v;draftOnly();}}});
$('guideSvg').addEventListener('pointerdown',pointerDown);$('guideSvg').addEventListener('pointermove',pointerMove);$('guideSvg').addEventListener('pointerup',pointerEnd);$('guideSvg').addEventListener('pointercancel',pointerEnd);
$('guideSvg').addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-.4,Math.min(.4,e.deltaY*.002))),world(e));},{passive:false});
function syncFullViewport(){
 const dialog=$('fullDialog'),v=window.visualViewport;
 if(!dialog.open)return;
 dialog.style.setProperty('--full-height',(v?v.height:window.innerHeight)+'px');
 dialog.style.setProperty('--full-width',(v?v.width:window.innerWidth)+'px');
 dialog.style.setProperty('--full-top',(v?v.offsetTop:0)+'px');
 dialog.style.setProperty('--full-left',(v?v.offsetLeft:0)+'px');
}
function openFullImage(){
 const dialog=$('fullDialog');if(dialog.open)return;
 $('fullHolder').appendChild($('viewerBox'));dialog.showModal();
 document.body.classList.add('image-full-open');syncFullViewport();
 $('fullHolder').scrollTop=0;$('closeFull').focus({preventScroll:true});
}
$('fullDialog').addEventListener('close',()=>{
 $('viewerDock').appendChild($('viewerBox'));document.body.classList.remove('image-full-open');
 $('fullView').focus({preventScroll:true});
});
window.addEventListener('resize',syncFullViewport);
window.visualViewport?.addEventListener('resize',syncFullViewport);
window.visualViewport?.addEventListener('scroll',syncFullViewport);
// Pure functions are exposed for offline regression checks and future integration.
window.SRUVisualGuide={resizedRegion,decodeMData,decodeDeviceVariant,normalizeCode,parseCSV,errorsFromCSV,validateProject,validateTables,parseLayoutLiteral,shapeKey};
async function boot(){
 try{validateProject(project);validateTables(tables);}catch(e){reportStartupError('Lỗi dữ liệu: '+e.message);return;}
 if(editorMode)showPage('edit');else renderWorkspace();
 diagnosticReady=true;
 if($('mdata').value.trim()||$('mstatus').value.trim())refreshDiagnosticInput();else $('byteCount').textContent='0/18 byte';
 if(!editorMode)return;
 try{storage=await openStorage();const saved=await new Promise((resolve,reject)=>{const r=storage.transaction('snapshots','readonly').objectStore('snapshots').get(project.documentId);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(saved?.tables){await new Promise((resolve,reject)=>{const t=storage.transaction('snapshots','readwrite');t.objectStore('snapshots').put({project:saved.project},project.documentId);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}if(saved&&saved.project.updatedAt>project.updatedAt){validateProject(saved.project);project=saved.project;moduleId=mod(moduleId)?moduleId:project.modules[0].id;photoId=availablePhotos(moduleId).some(p=>p.id===photoId)?photoId:bestPhoto(moduleId)?.id||'';imageToken='';renderWorkspace();$('saveState').textContent='Đã khôi phục bản lưu trên máy';}}
 catch(e){$('saveState').textContent='Bấm Lưu file Editor để giữ thay đổi';}
}
boot();
})();

