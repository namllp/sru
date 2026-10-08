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
let page='diagnose',editTab='modules',moduleId='sru',photoId='upper-overview',selected=[],context=null,run=null;
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
 if(!mod(id))return;if(page==='edit'&&(!ids.length||id!==moduleId)){editContextComponentId='';componentEditingId='';manualEditingId='';connectionEditingId='';photoEditingId='';linkEditingId='';regionModuleFilter=id;}moduleEditingId=id;moduleId=id;selected=ids.filter(x=>part(x));const list=availablePhotos(id);photoId=list.some(p=>p.id===preferredPhoto)?preferredPhoto:(bestPhoto(id,selected)?.id||'');imageToken='';draftRegion=null;editingRegionId='';renderWorkspace();
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
 if(page==='edit'||!$('onlyRelated')?.checked||!context?.hex)return null;
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
 $('descriptionResult').innerHTML=commandDescription(c)+'<dl>'+Object.entries(c.fields).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')+'</dl>'+((c.item?.description||[]).map(t=>`<div>${esc(t)}</div>`).join('')||'<p>Chưa có mô tả.</p>');
 if(c.code23&&$('descriptionDetails'))$('descriptionDetails').open=true;
 const ids=ensureContextParts(c);
 const changed=!previous||[previous.code,previous.moduleId,previous.variant,previous.code23].join('|')!==[c.code,c.moduleId,c.variant,c.code23].join('|');
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
 const q=$('circuitSearch').value.trim().toUpperCase(),all=$('circuitAll').checked;
 const ids=new Set([...selected.flatMap(id=>part(id)?.repair?.wirePhotos||[]),...relevantConnections().flatMap(r=>[...(r.photoIds||[]),...project.regions.filter(g=>(g.connectionIds||[]).includes(r.id)).map(g=>g.photoId)])]);renderConnectionPaths();
 const list=project.photos.filter(p=>photoVisible(p)&&(p.kind==='wiring'||ids.has(p.id))&&(all||(!context?.hex&&moduleId==='sru')||(selected.length?ids.has(p.id):(p.moduleIds||[]).includes(moduleId)))&&(!q||(p.title+' '+p.searchText).toUpperCase().includes(q)));
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
 const scope=relatedScope(),shown=scopedModules();if(scope&&!scope.modules.has(moduleId)){moduleId=shown[0]?.id||'';selected=selected.filter(id=>scope.ids.has(id));photoId=bestPhoto(moduleId,selected)?.id||'';imageToken='';} $('moduleSelect').innerHTML=options(shown,moduleId);$('scopeHint').textContent=scope?`Theo MData45: ${shown.length} module · ${scope.ids.size} linh kiện liên quan. Main: ${context.item?.main||'chưa xác định'}`:page==='edit'?'Biên soạn: hiện toàn bộ module và linh kiện.':'';$('moduleNote').textContent=mod(moduleId)?.note||'';
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
function showPage(next){if(next==='edit'&&!editorMode)return;page=next;$('dataPage').hidden=next!=='data';$('workArea').hidden=next==='data';$('decoder').hidden=next!=='diagnose';$('editor').hidden=next!=='edit';$('workArea').className='work-area'+(next==='edit'?' editing':next==='atlas'?' atlas':'');document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.page===next)));draftRegion=null;editingRegionId='';drawMode='pan';if(next==='data')$('dataCounts').textContent=`${Object.keys(tables.errors).length} mã/quy tắc lỗi · ${project.modules.length} module · ${project.components.length} linh kiện · ${project.photos.length} ảnh · ${project.links.length} liên kết · ${project.guides.length} guide biên soạn. `;else renderWorkspace();}
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
let imageRootHandle=null;
function imageBytes(src){const m=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(src||'');if(!m)throw Error('Dữ liệu ảnh không hợp lệ.');return {bytes:Uint8Array.from(atob(m[2].replace(/\s/g,'')),c=>c.charCodeAt(0)),extension:m[1]==='jpeg'?'jpg':m[1]};}
async function imageAssetPath(asset){
 const digest=await SRULookupCrypto.sha256(asset.bytes);
 return 'images/photo_'+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')+'.'+asset.extension;
}
function imageFolderMessage(){return imageRootHandle?'Đã chọn '+imageRootHandle.name+' · ảnh mới sẽ chép vào images/. Hãy xuất ZIP để lưu thông tin ảnh và highlight.':'Chưa chọn thư mục. Ảnh mới sẽ được tách thành file trong images/ khi xuất ZIP.';}
async function chooseImageRoot(){
 if(!window.showDirectoryPicker){toast('Trình duyệt này chưa hỗ trợ chọn thư mục để ghi trực tiếp. Xuất ZIP rồi giải nén để chép ảnh vào images/.');return;}
 try{
  const root=await window.showDirectoryPicker({id:'sru-project-images',mode:'readwrite'});
  try{const data=await root.getDirectoryHandle('data');await data.getFileHandle('sru_project.js');await data.getFileHandle('lookup_crypto.js');}catch{throw Error('Chọn thư mục gốc của bộ SRU, nơi có HTML và thư mục data.');}
  await root.getDirectoryHandle('images',{create:true});imageRootHandle=root;
  if($('imageFolderStatus'))$('imageFolderStatus').textContent=imageFolderMessage();toast('Đã chọn thư mục. Các ảnh thêm tiếp theo sẽ được chép vào images/.');
 }catch(e){if(e.name!=='AbortError')toast(e.message||'Không chọn được thư mục. Bạn vẫn có thể xuất ảnh qua ZIP.');}
}
async function copyAddedImage(ph){
 const asset=imageBytes(ph.src);ph.assetPath=await imageAssetPath(asset);
 if(!imageRootHandle)return false;
 let writer;
 try{
  const folder=await imageRootHandle.getDirectoryHandle('images',{create:true});
  const filename=ph.assetPath.slice(7);let existing;
  try{existing=await folder.getFileHandle(filename);}catch(e){if(e.name!=='NotFoundError')throw e;}
  if(existing){
   const bytes=new Uint8Array(await (await existing.getFile()).arrayBuffer());
   if(bytes.length===asset.bytes.length&&bytes.every((b,i)=>b===asset.bytes[i]))return true;
   throw Error('Tên ảnh đã tồn tại với nội dung khác.');
  }
  const handle=await folder.getFileHandle(filename,{create:true});writer=await handle.createWritable();await writer.write(asset.bytes);await writer.close();return true;
 }catch(e){try{await writer?.abort();}catch{}return false;}
}
async function externalizeSnapshotImages(snapshot,entries){
 const emitted=new Set();
 for(const ph of snapshot.photos){
  if(!ph.src.startsWith('data:'))continue;
  const asset=imageBytes(ph.src),path=await imageAssetPath(asset);
  if(!emitted.has(path)){entries.push([path,asset.bytes]);emitted.add(path);}
  ph.src=path;delete ph.assetPath;
 }
}

async function exportHTML(kind='diagnostic'){
 const snapshot=clone(project);snapshot.revision=(snapshot.revision||1)+1;snapshot.updatedAt=new Date().toISOString();
 const source=editorMode&&kind==='diagnostic'?window.SRU_DIAGNOSTIC_TEMPLATE:originalHTML;
 if(!source)throw Error('Thiếu js/diagnostic_template.js. Giữ đầy đủ thư mục js cạnh HTML.');
 const doc=new DOMParser().parseFromString(source,'text/html');removeLegacyReadouts(doc);arrangeWorkspace(doc);doc.getElementById('sruProject').textContent='{"external":true}';doc.getElementById('sruTables').textContent='{"external":true}';
 const entries=[];
 await externalizeSnapshotImages(snapshot,entries);
 delete snapshot.wiringDocument;
 entries.push([kind==='editor'?'SRU_Editor.html':'index_SRU_Diagnostic_Translate_NewMData45_Byte14.html','<!doctype html>\n'+doc.documentElement.outerHTML]);
 entries.push(['data/sru_project.js','window.SRU_PROJECT_DATA = '+safeJSON(snapshot)+';\n']);
 entries.push(['CAP_NHAT.txt','Giai nen va chep de vao thu muc bo SRU day du dang dung.\nZIP nay cap nhat HTML, data/sru_project.js va cac anh moi trong images/; khong phai bo chay doc lap.\nGiu nguyen css/, js/, images/ va cac file ma hoa trong data/.\nDiagnostic va Editor dung chung du lieu du an nay.\nNeu sua MData/MStatus, xuat bo data ma hoa rieng.\n']);
 download(kind==='editor'?'SRU_Editor_Update.zip':'SRU_Diagnostic_Update.zip',SRULookupCrypto.zip(entries),'application/zip');
 toast('Đã xuất ZIP gồm dữ liệu và ảnh mới trong images/. Giải nén vào bộ SRU đầy đủ, giữ css/js/data/images. Nếu sửa MData/MStatus, xuất bộ data mã hóa riêng.');
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
 if(!context?.code)return '';const g=findGuide(),steps=g?.steps||[];
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
const editorSectionNames={modules:'Module',components:'Linh kiện',photos:'Ảnh',regions:'Vùng ảnh',connections:'Dây → board',boards:'Board trong SRU',links:'Liên kết',manual:'Manual'};
function editorSectionName(key){const name=project.editorSectionNames?.[key];return name&&!(key==='boards'&&name==='Board dùng chung')?name:editorSectionNames[key];}
const regionKinds={components:'Tất cả linh kiện',board:'Board / bo mạch',cable:'Dây / cáp',connector:'Connector / giắc cắm',sensor:'Sensor',motor:'Motor',solenoid:'Solenoid',motor_solenoid:'Motor / Solenoid',belt:'Dây curoa',timing:'Timing cơ khí',timing_response:'Timing phản hồi',mechanism:'Cơ cấu',other:'Khác',modules:'Module'};
function regionSelectionMarkup(){
 const items=[...regionTargetIds.map(id=>({id,kind:'component',text:part(id)?.tag||id})),...regionModuleIds.map(id=>({id,kind:'module',text:mod(id)?.name||id}))];
 return `<label>Đã gắn vào vùng · ${items.length}</label><div class="region-selected-targets">${items.map(x=>`<button type="button" data-remove-region-target="${esc(x.id)}" data-region-kind="${x.kind}" aria-label="Bỏ ${esc(x.text)} khỏi vùng">${esc(x.text)} <span aria-hidden="true">×</span></button>`).join('')||'<span class="muted">Chưa chọn đối tượng.</span>'}</div>`;
}
function regionTargetPicker(mid){
 const modules=regionScope==='modules';
 const items=modules?project.modules.filter(m=>m.id!=='sru'):project.components.filter(c=>(c.type==='board'||mid==='*'||belongsToModule(c,mid))&&(regionScope==='components'||c.type===regionScope)).sort((a,b)=>a.tag.localeCompare(b.tag));
 const ids=modules?regionModuleIds:regionTargetIds;
 return `<label for="regionFilter">Chọn ${modules?'module':'đối tượng'} được đánh dấu</label><input id="regionFilter" type="search" data-target-filter="region" placeholder="Tìm tên, mã hoặc module…"><div class="target-list" data-target-list="region">${items.map(c=>{const label=modules?c.name:[c.tag,c.name&&c.name!==c.tag?c.name:'',c.type==='board'?'':(typeNames[c.type]||c.type),mod(c.moduleId)?.name].filter(Boolean).join(' · ');return `<label class="check" data-search="${esc(label.toLowerCase())}"><input type="checkbox" data-target="region" data-region-kind="${modules?'module':'component'}" value="${esc(c.id)}" ${ids.includes(c.id)?'checked':''}><span>${esc(label)}</span></label>`;}).join('')||'<span class="muted">Không có đối tượng thuộc loại và module đã chọn.</span>'}</div><div id="regionSelection">${regionSelectionMarkup()}</div>`;
}
function regionRelationsEditor(r){
 const mid=regionModuleFilter||moduleId,links=project.links.filter(l=>mid==='*'||[l.from,l.to].some(id=>belongsToModule(part(id),mid))||(r?.linkIds||[]).includes(l.id)),connections=(project.connections||[]).filter(c=>mid==='*'||c.moduleId===mid||(r?.connectionIds||[]).includes(c.id));
 return itemPicker('regionLinks','Liên kết trong vùng',links,r?.linkIds||[],l=>l.name||[part(l.from)?.tag,part(l.to)?.tag].join(' ↔ '))+itemPicker('regionConnections','Đường dây → board trong vùng',connections,r?.connectionIds||[],c=>c.name||connectionParts(c).map(id=>part(id)?.tag||id).join(' → '))+'<p>Chọn liên kết hoặc đường dây sẽ gắn các linh kiện ở hai đầu và trên đường nối vào vùng khi lưu.</p>';
}
function openPhotoRegions(id=photoId){
 const p=photo(id);if(!p)return toast('Chọn ảnh của module trước.');
 photoId=id;photoEditingId=id;editContextComponentId='';selected=[];focusedComponentId='';editTab='regions';drawMode='pan';draftRegion=null;editingRegionId='';regionTargetIds=[];regionModuleIds=[];regionModuleFilter=p.moduleId;regionScope='components';imageToken='';showPage('edit');$('viewerBox').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function syncRegionDraft(){
 const old=draftRegion||project.regions.find(r=>r.id===editingRegionId);if(!old)return;
 const r=clone(old);for(const key of (r.type==='circle'?['x','y','r']:['x','y','w','h'])){const el=$('region-'+key);if(el&&el.value!==''&&Number.isFinite(Number(el.value)))r[key]=Number(el.value);}
 if($('regionNote'))r.note=$('regionNote').value;if($('regionName'))r.name=$('regionName').value;
 r.componentIds=[...regionTargetIds];r.moduleIds=[...regionModuleIds];r.linkIds=checkedTargets('regionLinks');r.connectionIds=checkedTargets('regionConnections');draftRegion=r;
}

function targetChecks(kind,ids,mid,scope='components'){
 const items=scope==='modules'?project.modules.filter(m=>m.id!=='sru'):project.components.filter(p=>p.moduleId===mid||ids.includes(p.id)).sort((a,b)=>a.tag.localeCompare(b.tag));
 return `<label for="${kind}Filter">${scope==='modules'?'Module được đánh dấu':'Gắn nhiều linh kiện vào vùng / bước'}</label><input id="${kind}Filter" type="search" data-target-filter="${kind}" placeholder="Lọc danh sách…"><div class="target-list" data-target-list="${kind}">${items.map(p=>`<label class="check" data-search="${esc((p.tag||p.name).toLowerCase())}"><input type="checkbox" data-target="${kind}" value="${esc(p.id)}" ${ids.includes(p.id)?'checked':''}><span>${esc(scope==='modules'?p.name:p.tag+' · '+(typeNames[p.type]||p.type))}</span></label>`).join('')||'<div class="muted">Chưa có linh kiện. Thêm ở thẻ Linh kiện.</div>'}</div>`;
}
function checkedTargets(kind){return [...document.querySelectorAll(`[data-target="${kind}"]:checked`)].map(n=>n.value);}
let manualEditingId='';
function visibleControl(id,record,label='Hiện trên Diagnostic'){return `<label class="check publish-check"><input id="${id}" type="checkbox" ${record?.diagnosticVisible!==false?'checked':''}>${esc(label)}</label>`;}
function itemPicker(kind,label,items,ids,labelFn){return `<details class="selection-picker"><summary>${esc(label)} · ${ids.length} đã chọn</summary><input type="search" data-target-filter="${kind}" placeholder="Lọc theo tên, tag hoặc module…"><div class="target-list" data-target-list="${kind}">${items.map(x=>{const text=labelFn(x);return `<label class="check" data-search="${esc(text.toLowerCase())}"><input type="checkbox" data-target="${kind}" value="${esc(x.id)}" ${ids.includes(x.id)?'checked':''}><span>${esc(text)}</span></label>`;}).join('')}</div></details>`;}
function componentLabel(c){return `${c.tag} · ${c.name||c.tag} · ${mod(c.moduleId)?.name||c.moduleId}`;}
function componentRelationsEditor(c){const ids=c?project.links.filter(l=>l.diagnosticVisible!==false&&(l.from===c.id||l.to===c.id)).map(l=>l.from===c.id?l.to:l.from):[];return itemPicker('componentRelated','Linh kiện liên kết',project.components.filter(x=>x.id!==c?.id),[...new Set(ids)],componentLabel)+'<p>Chọn các mục liên quan. Liên kết mới có loại “Liên quan”; chỉnh quan hệ dây/điện/truyền động tại thẻ Liên kết. Bỏ chọn sẽ ẩn liên kết đó trên Diagnostic.</p>';}
function syncComponentRelations(p,id,targets){
 const wanted=new Set(targets.filter(x=>x!==id)),existing=new Set();
 for(const l of p.links)if(l.from===id||l.to===id){const other=l.from===id?l.to:l.from;existing.add(other);l.diagnosticVisible=wanted.has(other);}
 for(const other of wanted)if(!existing.has(other))p.links.push({id:uid('link'),from:id,to:other,type:'related',verified:true,diagnosticVisible:true,source:'Biên soạn',note:''});
}
function renderManualEditor(){
 const manual=project.manual2024||{entries:[]},c=editorPart(),entries=(manual.entries||[]).filter(r=>(!(r.moduleIds||[]).length||r.moduleIds.includes(moduleId))&&(!c||(r.componentIds||[]).includes(c.id)));if(!entries.some(r=>r.id===manualEditingId))manualEditingId='';const r=entries.find(x=>x.id===manualEditingId);
 $('editorContent').innerHTML=`<h3>Biên soạn manual</h3><label for="manualEditSelect">Mục tài liệu</label><select id="manualEditSelect"><option value="">+ Mục mới</option>${options(entries,manualEditingId,x=>(x.diagnosticVisible===false?'[Ẩn] ':'')+x.title)}</select>${input('manualTitle','Tiêu đề',r?.title||'')}${textarea('manualBody','Nội dung hướng dẫn',r?.body||'',9)}${input('manualVariant','Cấu hình áp dụng',r?.variant||'')}${input('manualStatus','MStatus / mã được nhắc',r?.status||'')}${visibleControl('manualVisible',r)}${itemPicker('manualModules','Module áp dụng',project.modules,r?.moduleIds||[moduleId],x=>x.name)}${itemPicker('manualComponents','Linh kiện liên quan',project.components.filter(x=>belongsToModule(x,moduleId)||(r?.componentIds||[]).includes(x.id)),r?.componentIds||(c?[c.id]:[]),componentLabel)}${itemPicker('manualPhotos','Ảnh minh họa',project.photos,r?.photoIds||[],x=>x.title+' · '+(mod(x.moduleId)?.name||x.moduleId))}<div class="button-row"><button id="saveManual" class="primary">Lưu manual</button><button id="deleteManual" class="danger" ${r?'':'disabled'}>Xóa mục</button></div><p>Manual được lưu trong dữ liệu để tiếp tục biên soạn. Giao diện Diagnostic hiện không có mục Manual.</p>`;
}
function renderDisplayEditor(){
 $('editorContent').innerHTML=`<h3>Nội dung trên Diagnostic</h3><p>Bật/tắt từng phần khi xuất bản. Bộ lọc theo MData vẫn được áp dụng.</p><div class="display-settings">${Object.entries(displayFields).map(([key,label])=>`<label class="check"><input type="checkbox" data-display-field="${key}" ${project.diagnosticDisplay?.[key]!==false?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div><h3>Tên các thẻ biên soạn</h3><p>Đổi nhãn hiển thị; mã dữ liệu và liên kết được giữ nguyên. Để trống để dùng tên mặc định.</p>${Object.entries(editorSectionNames).map(([key,label])=>input('sectionName-'+key,label,editorSectionName(key),'maxlength=80')).join('')}${input('manualCollectionTitle','Tên phần manual',project.manual2024?.title||'Manual / hướng dẫn')}<button id="saveDiagnosticDisplay" class="primary full">Lưu hiển thị</button><p>Muốn ẩn một mục cụ thể, dùng “Hiện trên Diagnostic” tại Manual, Linh kiện, Liên kết, Module hoặc Ảnh. Các mục ẩn vẫn có trong Editor để sửa và bật lại.</p>`;
}
async function extendedEditorAction(id){
 if(id==='saveManual'){
  const title=$('manualTitle').value.trim();if(!title)throw Error('Nhập tiêu đề manual.');
  const values={title,body:$('manualBody').value.trim(),variant:$('manualVariant').value.trim(),status:$('manualStatus').value.trim(),source:project.manual2024?.entries?.find(r=>r.id===manualEditingId)?.source||'',moduleIds:checkedTargets('manualModules'),componentIds:checkedTargets('manualComponents'),photoIds:checkedTargets('manualPhotos'),diagnosticVisible:$('manualVisible').checked};
  await commit(p=>{p.manual2024=p.manual2024||{entries:[]};const old=p.manual2024.entries.find(x=>x.id===manualEditingId);if(old)Object.assign(old,values);else{manualEditingId=uid('manual');p.manual2024.entries.push({id:manualEditingId,pages:[],category:'custom',...values});}},'Đã lưu manual. Xuất ZIP để cập nhật Diagnostic.');return true;
 }
 if(id==='deleteManual'){if(!manualEditingId)return true;if(!confirm('Xóa mục manual này?'))return true;await commit(p=>{p.manual2024.entries=p.manual2024.entries.filter(x=>x.id!==manualEditingId);manualEditingId='';},'Đã xóa mục manual.');return true;}
 if(id==='saveDiagnosticDisplay'){
  const settings=Object.fromEntries([...document.querySelectorAll('[data-display-field]')].map(x=>[x.dataset.displayField,x.checked])),title=$('manualCollectionTitle').value.trim();
  const sectionNames=Object.fromEntries(Object.entries(editorSectionNames).map(([key,label])=>[key,$('sectionName-'+key).value.trim()||label]));
  await commit(p=>{p.editorSectionNames=sectionNames;p.diagnosticDisplay=settings;p.manual2024=p.manual2024||{entries:[]};p.manual2024.title=title||'Tài liệu manual · sensor & linh kiện';},'Đã lưu lựa chọn hiển thị. Xuất ZIP để cập nhật Diagnostic.');return true;
 }
 return false;
}

let editContextComponentId='',connectionEditingId='';
function editorPart(){const c=part(editContextComponentId);return belongsToModule(c,moduleId)?c:null;}
function editorPhotos(){const c=editorPart();return availablePhotos(moduleId).filter(p=>!c||(p.componentIds||[]).includes(c.id)||regionsFor(p.id).some(r=>r.componentIds.includes(c.id))||Object.entries(c.repair||{}).some(([k,v])=>k.endsWith('Photos')&&v.includes(p.id)));}
function renderEditorContext(){
 let host=$('editorContext');if(!host){host=document.createElement('div');host.id='editorContext';host.className='editor-context';$('editor').insertBefore(host,$('editor').querySelector('.editor-tabs'));}
 const c=editorPart();host.innerHTML=`<span class="context-eyebrow">ĐANG BIÊN SOẠN</span><strong>${esc(mod(moduleId)?.name||'Chọn module')}</strong>${c?`<span class="context-component">${esc(c.tag)} · ${esc(c.name)}</span><button id="editModuleScope" class="quiet">← Nội dung cấp module</button>`:'<span class="muted">Chọn linh kiện để sửa ảnh, đường dây và manual riêng.</span>'}`;
}
function chooseEditorPart(id,tab='components'){
 const c=part(id);if(!c)return;editContextComponentId=id;componentEditingId=id;editTab=tab;manualEditingId='';connectionEditingId='';photoEditingId='';regionTargetIds=[id];regionModuleIds=[];regionScope='components';regionModuleFilter=belongsToModule(c,moduleId)?moduleId:c.moduleId;
 if(!belongsToModule(c,moduleId))moduleId=c.moduleId;selected=[id];photoId=bestPhoto(moduleId,[id])?.id||'';imageToken='';draftRegion=null;editingRegionId='';renderWorkspace();
}
function renderConnectionsEditor(){
 const c=editorPart(),rows=(project.connections||[]).filter(r=>r.moduleId===moduleId&&(!c||connectionParts(r).includes(c.id)));
 if(connectionEditingId&&!rows.some(r=>r.id===connectionEditingId))connectionEditingId='';const r=rows.find(r=>r.id===connectionEditingId);
 const picker=(id,label,items,value,empty)=>`<label for="${id}">${label}</label><select id="${id}"><option value="">${empty}</option>${options(items,value,componentLabel)}</select>`;
 $('editorContent').innerHTML=`<h3>${c?'Dây nối của '+esc(c.tag):'Dây nối trong module'}</h3><label for="connectionEditSelect">Đường nối</label><select id="connectionEditSelect"><option value="">+ Đường nối mới</option>${options(rows,connectionEditingId,r=>r.name||[part(r.componentId)?.tag,part(r.cableId)?.tag,part(r.connectorId)?.tag,part(r.boardId)?.tag].filter(Boolean).join(' → '))}</select>${input('connectionName','Tên đường dây → board',r?.name||'')}${picker('connectionComponent','Linh kiện / board đầu đường nối',project.components.filter(x=>belongsToModule(x,moduleId)),r?.componentId||c?.id,'Chọn linh kiện…')}${input('connectionPort','Đầu nối phía linh kiện',r?.componentPort||'','placeholder="Mã giắc / đầu dây"')}${picker('connectionCable','Dây / bó dây',project.components.filter(x=>x.type==='cable'),r?.cableId,'Chưa khai báo / nối trực tiếp')}${picker('connectionConnector','Connector trung gian',project.components.filter(x=>x.type==='connector'),r?.connectorId,'Không có / chưa khai báo')}${picker('connectionBoard','Board nhận kết nối · dùng chung giữa các module',project.components.filter(x=>x.type==='board'),r?.boardId,'Chọn board…')}${input('connectionBoardPort','Cổng trên board',r?.boardPort||'','placeholder="CN…, ASENCN3…"')}${input('connectionPins','Chân / pin',r?.pins||'','placeholder="1, 2, 3 hoặc 1→2…"')}${input('connectionSignal','Tín hiệu / nguồn',r?.signal||'')}${textarea('connectionNote','Đường đi dây / cách tiếp cận',r?.note||'',4)}${itemPicker('connectionPhotos','Ảnh và sơ đồ đường dây',project.photos,r?.photoIds||[],p=>p.title)}<label class="check"><input id="connectionVerified" type="checkbox" ${r?.verified?'checked':''}>Đã xác nhận đúng kết nối</label>${visibleControl('connectionVisible',r)}<div class="button-row"><button id="saveConnection" class="primary">Lưu đường nối</button><button id="deleteConnection" class="danger" ${r?'':'disabled'}>Xóa</button></div><p>Tạo dây, connector hoặc board trong mục Linh kiện nếu chưa có. Mỗi đường nối có thể dùng lại cùng board. Dây curoa dùng quan hệ Truyền động trong mục Liên kết.</p>`;
}
function renderBoardsEditor(){
 const boards=project.components.filter(c=>c.type==='board'),ids=moduleBoards(moduleId);
 $('editorContent').innerHTML=`<h3>Board trong SRU</h3>${itemPicker('moduleBoards','Board dùng cho module đang chọn',boards,mod(moduleId)?.boardIds||[],componentLabel)}<button id="saveModuleBoards" class="primary full">Lưu board của module</button><h3>Đổi tên board</h3><p>Sửa tên trực tiếp bên dưới rồi bấm Lưu tên board. Tên mới áp dụng ở tất cả module dùng chung board đó; mã board và kết nối được giữ nguyên.</p><div class="board-cards">${[...boards].sort((a,b)=>Number(ids.includes(b.id)||b.moduleId===moduleId)-Number(ids.includes(a.id)||a.moduleId===moduleId)||a.tag.localeCompare(b.tag)).map((c,i)=>`<article class="connection-card"><strong>${esc(c.tag)}</strong><p>${esc(mod(c.moduleId)?.name||'')}${ids.includes(c.id)||c.moduleId===moduleId?' · Đang dùng trong module này':''}</p><label for="boardName-${i}">Tên board</label><input id="boardName-${i}" data-board-name="${esc(c.id)}" value="${esc(c.name||c.tag)}" maxlength="200"><button data-edit-board="${esc(c.id)}">Sửa chi tiết / ảnh / manual</button></article>`).join('')||'<p>Chưa có board.</p>'}</div><button id="saveBoardNames" class="primary full" ${boards.length?'':'disabled'}>Lưu tên board</button><button id="newBoard">+ Tạo board mới</button>`;
}
async function structureEditorAction(id){
 if(id==='saveBoardNames'){
  const fields=[...document.querySelectorAll('[data-board-name]')],empty=fields.find(el=>!el.value.trim());if(empty){empty.focus();return toast('Nhập tên board trước khi lưu.');}
  const names=new Map(fields.map(el=>[el.dataset.boardName,el.value.trim()])),chosen=checkedTargets('moduleBoards');
  await commit(p=>{p.components.forEach(c=>{if(c.type==='board'&&names.has(c.id))c.name=names.get(c.id);});},'Đã lưu tên board dùng chung. Xuất ZIP để cập nhật Diagnostic.');
  document.querySelectorAll('[data-target="moduleBoards"]').forEach(el=>{el.checked=chosen.includes(el.value);});return;
 }

 if(id==='saveModuleBoards'){const ids=checkedTargets('moduleBoards');return commit(p=>{p.modules.find(m=>m.id===moduleId).boardIds=ids;},'Đã lưu board dùng chung của module.');}
 if(id==='saveConnection'){
  const values={name:$('connectionName').value.trim(),moduleId,componentId:$('connectionComponent').value,cableId:$('connectionCable').value,connectorId:$('connectionConnector').value,boardId:$('connectionBoard').value,componentPort:$('connectionPort').value.trim(),boardPort:$('connectionBoardPort').value.trim(),pins:$('connectionPins').value.trim(),signal:$('connectionSignal').value.trim(),note:$('connectionNote').value.trim(),photoIds:checkedTargets('connectionPhotos'),verified:$('connectionVerified').checked,diagnosticVisible:$('connectionVisible').checked};
  return commit(p=>{p.connections=p.connections||[];const old=p.connections.find(r=>r.id===connectionEditingId);if(old)Object.assign(old,values);else{const r={id:uid('connection'),...values};p.connections.push(r);connectionEditingId=r.id;}},'Đã lưu đường nối đến board.');
 }
 if(id==='deleteConnection'){if(!confirm('Xóa đường nối này?'))return;return commit(p=>{p.regions.forEach(r=>{r.connectionIds=(r.connectionIds||[]).filter(x=>x!==connectionEditingId);});p.connections=p.connections.filter(r=>r.id!==connectionEditingId);connectionEditingId='';});}
}

function renderEditor(){
 renderEditorContext();
 document.querySelectorAll('[data-editor]').forEach(b=>{const key=b.dataset.editor;if(editorSectionNames[key])b.textContent=editorSectionName(key);b.setAttribute('aria-pressed',String(key===editTab));});
 if(editTab==='connections'){renderConnectionsEditor();return;}
 if(editTab==='boards'){renderBoardsEditor();return;}
 document.querySelectorAll('[data-editor]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.editor===editTab)));
 document.querySelectorAll('[data-draw]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.draw===drawMode)));
 const host=$('editorContent');
 if(editTab==='manual'){renderManualEditor();return;}
 if(editTab==='display'){renderDisplayEditor();return;}
 if(editTab==='regions'){
  const r=draftRegion||project.regions.find(r=>r.id===editingRegionId);if(r){regionTargetIds=[...r.componentIds];regionModuleIds=[...r.moduleIds];}
  const p=photo(photoId);const mid=regionModuleFilter||moduleId;
  host.innerHTML=`<h3>Vùng ảnh · ${esc(p?.title||'Chưa chọn ảnh')}</h3><p>Chọn Circle/Rect trên ảnh rồi kéo để vẽ. Một vùng có thể dùng chung cho nhiều tag. Vùng đang chọn có viền cam. Kéo chấm cam để đổi kích thước; kéo trong vùng để di chuyển.</p><label>Vùng đã đánh dấu</label><select id="regionSelect"><option value="">Chọn vùng trên ảnh…</option>${regionsFor(photoId).map((v,i)=>`<option value="${esc(v.id)}" ${v.id===editingRegionId?'selected':''}>${i+1}. ${esc(v.name||[...v.componentIds.map(id=>part(id)?.tag||id),...v.moduleIds.map(id=>mod(id)?.name||id)].join(', '))}</option>`).join('')}</select><div class="button-row"><button id="newRegion">Vùng mới</button><button id="copyRegion" ${r?'':'disabled'}>Nhân bản</button><button id="cancelRegion">Hủy sửa vùng</button><button id="deleteRegion" class="danger" ${editingRegionId?'':'disabled'}>Xóa vùng</button></div><label for="regionScope">Loại đối tượng</label><select id="regionScope">${Object.entries(regionKinds).map(([key,label])=>`<option value="${key}" ${regionScope===key?'selected':''}>${esc(label)}</option>`).join('')}</select>${regionScope!=='modules'?`<label>Module chứa đối tượng / board dùng chung</label><select id="regionModuleFilter"><option value="*" ${mid==='*'?'selected':''}>Tất cả module</option>${options(project.modules,mid)}</select><div class="form-grid"><input id="quickTag" placeholder="Tag mới: PPAC, M01…"><select id="quickType">${Object.entries(typeNames).map(([k,v])=>`<option value="${k}" ${regionScope===k?'selected':''}>${v}</option>`).join('')}</select></div><button id="quickAddTag" ${mid==='*'?'disabled':''}>+ Tạo và gắn tag vào vùng</button>`:''}${regionTargetPicker(mid)}${regionRelationsEditor(r)}<div class="form-grid">${['x','y',...(r?.type==='rect'?['w','h']:['r'])].map(k=>`<label>${({x:'Tâm X (%)',y:'Tâm Y (%)',w:'Rộng (%)',h:'Cao (%)',r:'Bán kính (% chiều rộng ảnh)'})[k]}<input id="region-${k}" type="number" min="0" max="100" step="0.1" value="${r?Number(r[k]).toFixed(2):''}" ${r?'':'disabled'}></label>`).join('')}</div>${input('regionName','Tên vùng ảnh',r?.name||'')}${textarea('regionNote','Ghi chú vị trí',r?.note||'',2)}<button id="saveRegion" class="primary full" ${r?'':'disabled'}>Lưu vùng</button><p>${r?'Loại: '+esc(r.type):'Chưa chọn hoặc vẽ vùng.'} Tọa độ bám theo ảnh khi zoom; chỉ chỉnh số khi cần căn chính xác.</p>`;
 }else if(editTab==='photos'){
  const items=editorPhotos();if(!items.some(p=>p.id===photoEditingId))photoEditingId=items[0]?.id||'';const p=photo(photoEditingId);
  host.innerHTML=`<div class="button-row"><button id="chooseImageRoot">Chọn thư mục bộ SRU</button></div><p id="imageFolderStatus">${esc(imageFolderMessage())}</p><label class="file-button full">+ Tải ảnh vào module<input id="photoUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden></label><p>Khi xuất ZIP, ảnh mới nằm trong images/; dữ liệu dự án chỉ giữ đường dẫn. Bản làm việc giữ ảnh tạm để xem và khôi phục.</p><label for="photoEditSelect">Ảnh cần sửa</label><select id="photoEditSelect"><option value="">Chọn ảnh…</option>${options(items,photoEditingId,x=>x.title)}</select>${input('photoTitle','Tên ảnh',p?.title||'')}${input('photoAngle','Hướng / góc nhìn',p?.angle||'','placeholder="Trước, sau, trái, mở nắp…"')}${input('photoState','Trạng thái cụm',p?.state||'')}${input('photoVariant','Phiên bản / cấu hình áp dụng',p?.variant||'','placeholder="Để trống nếu dùng chung"')}<label for="photoKind">Loại ảnh</label><select id="photoKind">${[['','Vị trí / module'],['component','Linh kiện'],['wiring','Sơ đồ dây'],['manual','Hướng dẫn tiếp cận']].map(([k,v])=>`<option value="${k}" ${p?.kind===k?'selected':''}>${v}</option>`).join('')}</select>${itemPicker('photoComponents','Linh kiện trong ảnh',project.components.filter(c=>belongsToModule(c,moduleId)),p?.componentIds||[],componentLabel)}${visibleControl('photoVisible',p)}<div class="button-row"><button id="savePhoto" class="primary" ${p?'':'disabled'}>Lưu thông tin ảnh</button><button id="deletePhoto" class="danger" ${p?'':'disabled'}>Xóa ảnh</button></div>${p?`<hr><h3>Chỉnh ảnh</h3><label>Độ sáng (%)<input id="photoBrightness" type="range" min="25" max="200" value="${p.brightness||100}"></label><label>Tương phản (%)<input id="photoContrast" type="range" min="25" max="200" value="${p.contrast||100}"></label><div class="button-row"><button id="saveImageAdjust">Lưu chỉnh ảnh</button><button id="resetImageAdjust">Về ảnh gốc</button><button id="editHighlights" class="primary">Thêm / sửa vùng ảnh</button></div><p>Chỉnh sáng/tương phản giữ nguyên ảnh gốc và vị trí vùng đánh dấu.</p>`:''}${p?'<label class="file-button full">Thay file ảnh<input id="replacePhotoUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label>':''}`;
 }else if(editTab==='components'){
  const items=project.components.filter(p=>belongsToModule(p,moduleId)).sort((a,b)=>a.tag.localeCompare(b.tag));if(componentEditingId&&!items.some(c=>c.id===componentEditingId))componentEditingId='';const c=part(componentEditingId);
  host.innerHTML=`<label for="componentEditSelect">Sửa linh kiện</label><select id="componentEditSelect"><option value="">+ Linh kiện mới</option>${options(items,componentEditingId,p=>p.tag+' · '+(p.name||'')+(p.diagnosticVisible===false?' [Ẩn]':''))}</select>${input('componentTag','Tag / mã linh kiện',c?.tag||'','placeholder="PPAC, ASENCN3, PPDM…"')}${input('componentName','Tên mô tả',c?.name||'')}<label for="componentType">Loại</label><select id="componentType">${Object.entries(typeNames).map(([k,v])=>`<option value="${k}" ${c?.type===k?'selected':''}>${v}</option>`).join('')}</select>${textarea('componentNote','Ghi chú',c?.note||'',3)}${visibleControl('componentVisible',c)}${componentRelationsEditor(c)}${repairEditor(c)}<div class="button-row"><button id="saveComponent" class="primary">Lưu linh kiện</button><button id="deleteComponent" class="danger" ${c?'':'disabled'}>Xóa</button></div><p>Motor / Solenoid trong bảng lỗi được giữ là nhóm chung cho đến khi xác nhận loại thực tế.</p>`;
 }else if(editTab==='modules'){
  const m=mod(moduleEditingId);
  host.innerHTML=`<label for="moduleEditSelect">Module</label><select id="moduleEditSelect"><option value="">+ Module mới</option>${options(project.modules,moduleEditingId)}</select>${input('moduleNameEdit','Tên module',m?.name||'')}${input('moduleAliases','Tên khác, ngăn cách bằng dấu ;',(m?.aliases||[]).join('; '))}${input('moduleVariant','Phiên bản cụm',m?.variant||'')}${textarea('moduleNoteEdit','Ghi chú',m?.note||'',3)}${visibleControl('moduleVisible',m)}<div class="button-row"><button id="saveModule" class="primary">Lưu module</button><button id="deleteModule" class="danger" ${m&&m.id!=='sru'?'':'disabled'}>Xóa</button></div>`;
 }else if(editTab==='links'){
  const l=project.links.find(x=>x.id===linkEditingId),from=l?.from||selected[0]||project.components.find(c=>c.moduleId===moduleId)?.id||'',to=l?.to||'';
  host.innerHTML=`<label for="linkEditSelect">Liên kết</label><select id="linkEditSelect"><option value="">+ Liên kết mới</option>${options(project.links.filter(l=>editorPart()?[l.from,l.to].includes(editorPart().id):[l.from,l.to].some(id=>belongsToModule(part(id),moduleId))),linkEditingId,l=>l.name||nameOf(l.from)+' ↔ '+nameOf(l.to))}</select>${input('linkName','Tên liên kết',l?.name||'')}<label for="linkFrom">Đầu 1</label><select id="linkFrom"><option value="">Chọn linh kiện…</option>${componentOptions(from)}</select><label for="linkTo">Đầu 2 · có thể ở module khác</label><select id="linkTo"><option value="">Chọn linh kiện…</option>${componentOptions(to)}</select><label for="linkType">Quan hệ</label><select id="linkType">${Object.entries(linkNames).map(([k,v])=>`<option value="${k}" ${l?.type===k?'selected':''}>${v}</option>`).join('')}</select>${textarea('linkNote','Ghi chú dây, giắc, chân hoặc hướng liên kết',l?.note||'',3)}<label class="check"><input id="linkVerified" type="checkbox" ${l?.verified?'checked':''}>Đã xác nhận liên kết</label>${visibleControl('linkVisible',l)}<div class="button-row"><button id="saveLink" class="primary">Lưu liên kết</button><button id="deleteLink" class="danger" ${l?'':'disabled'}>Xóa</button></div><p>Liên kết mới chỉ xuất hiện sau khi được khai báo. Cùng được nhắc trong lỗi không xác định hai linh kiện nối với nhau.</p>`;
 }else if(editTab==='guides')renderGuideEditor();
}
const repairFields={location:'Vị trí trong module',access:'Cách tiếp cận sensor / linh kiện',wiring:'Dây, connector và chân liên quan',wireAccess:'Cách tiếp cận dây / connector',board:'Board liên quan',boardAccess:'Cách tiếp cận board',software:'Các phương án xử lý phần mềm',hardware:'Các phương án xử lý phần cứng'};
const repairPhotoFields={locationPhotos:'Ảnh vị trí',accessPhotos:'Ảnh cách tiếp cận linh kiện',wirePhotos:'Ảnh dây / connector',boardPhotos:'Ảnh board và cách tiếp cận'};
function repairEditor(c){const r=c?.repair||{};return '<hr><h3>Manual của linh kiện</h3><p>Ghi thao tác và phương án tham khảo. Mỗi dòng có thể là một thao tác; không cần tạo nhánh đánh giá kết quả.</p>'+Object.entries(repairFields).map(([k,label])=>textarea('repair-'+k,label,r[k]||'',k==='software'||k==='hardware'?5:3)).join('')+Object.entries(repairPhotoFields).map(([key,label])=>`<details><summary>${label}</summary><div class="target-list">${project.photos.map(p=>`<label class="check"><input type="checkbox" data-repair-photos="${key}" value="${esc(p.id)}" ${(r[key]||[]).includes(p.id)?'checked':''}>${esc(mod(p.moduleId)?.name||'')} · ${esc(p.title)}</label>`).join('')}</div></details>`).join('');}
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
 const old=draftRegion||project.regions.find(r=>r.id===editingRegionId);if(!old)return;const r=clone(old);for(const k of (r.type==='circle'?['x','y','r']:['x','y','w','h']))r[k]=Number($('region-'+k).value);r.linkIds=checkedTargets('regionLinks');r.connectionIds=checkedTargets('regionConnections');r.name=$('regionName').value.trim();r.note=$('regionNote').value.trim();r.componentIds=[...regionTargetIds];r.moduleIds=[...regionModuleIds];r.componentIds=[...new Set([...r.componentIds,...project.links.filter(l=>r.linkIds.includes(l.id)).flatMap(l=>[l.from,l.to]),...(project.connections||[]).filter(c=>r.connectionIds.includes(c.id)).flatMap(connectionParts)])];if(!r.componentIds.length&&!r.moduleIds.length)return toast('Chọn ít nhất một linh kiện hoặc module cho vùng này.');
 const same=project.regions.find(x=>x.photoId===r.photoId&&x.id!==r.id&&shapeKey(x)===shapeKey(r));
 await commit(p=>{p.regions=p.regions.filter(x=>x.id!==r.id);if(same){const target=p.regions.find(x=>x.id===same.id);target.componentIds=[...new Set([...target.componentIds,...r.componentIds])];target.moduleIds=[...new Set([...target.moduleIds,...r.moduleIds])];target.linkIds=[...new Set([...(target.linkIds||[]),...r.linkIds])];target.connectionIds=[...new Set([...(target.connectionIds||[]),...r.connectionIds])];if(r.name)target.name=r.name;if(r.note)target.note=r.note;editingRegionId=target.id;}else{p.regions.push(r);editingRegionId=r.id;}draftRegion=null;},same?'Đã gộp tag vào vùng trùng vị trí.':'Đã lưu vùng ảnh.');
}
async function uploadPhotos(files){
 if(!files.length)return;toast('Đang đọc ảnh…');try{
 const photos=[];let copied=0;const targetModuleId=moduleId;for(const file of files){if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('Chọn ảnh PNG, JPG, WebP hoặc GIF.');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});const dimensions=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve({width:im.naturalWidth,height:im.naturalHeight});im.onerror=()=>reject(Error('Không đọc được ảnh '+file.name));im.src=src;});const ph={id:uid('photo'),moduleId:targetModuleId,componentIds:editorPart()?[editorPart().id]:[],title:file.name.replace(/\.[^.]+$/,''),angle:'',state:'',variant:'',source:file.name,src,...dimensions};if(await copyAddedImage(ph))copied++;photos.push(ph);}
 await commit(p=>p.photos.push(...photos),'Đã thêm '+photos.length+' ảnh. Ghi góc nhìn và trạng thái cho từng ảnh.');photoId=photos[0].id;photoEditingId=photoId;imageToken='';renderWorkspace();toast(imageRootHandle?(copied===photos.length?'Đã chép '+copied+' ảnh vào images/. Xuất ZIP để lưu dữ liệu dự án.':'Đã thêm ảnh; chỉ chép được '+copied+'/'+photos.length+' ảnh trực tiếp. Xuất ZIP để lấy đầy đủ ảnh.'):'Đã thêm '+photos.length+' ảnh. Xuất ZIP để nhận ảnh rời trong images/.');
 }catch(e){toast(e.message);}
}
async function editorAction(id){
 // Editor operations preserve source IDs and validate references before saving.
 if(id==='editHighlights'){openPhotoRegions(photoEditingId||photoId);return;}
 if(id==='saveImageAdjust'||id==='resetImageAdjust'){const brightness=id==='resetImageAdjust'?100:Number($('photoBrightness').value),contrast=id==='resetImageAdjust'?100:Number($('photoContrast').value);return commit(p=>Object.assign(p.photos.find(x=>x.id===photoEditingId),{brightness,contrast}),'Đã lưu chỉnh ảnh.');}
 if(id==='cancelRegion'){regionTargetIds=[];regionModuleIds=[];draftRegion=null;editingRegionId='';drawMode='pan';renderEditor();drawImage();return;}
 if(id==='copyRegion'){const r=draftRegion||project.regions.find(r=>r.id===editingRegionId);if(!r)return;draftRegion={...clone(r),id:uid('region'),x:Math.min(95,r.x+3),y:Math.min(95,r.y+3)};editingRegionId='';drawMode='pan';renderEditor();drawImage();return;}
 if(id==='quickAddTag'){syncRegionDraft();const tag=$('quickTag').value.trim().toUpperCase(),type=$('quickType').value,mid=regionModuleFilter||moduleId;if(!mod(mid))return toast('Chọn module chứa đối tượng mới.');if(!tag)return toast('Nhập tag mới.');let c=project.components.find(c=>c.moduleId===mid&&c.tag===tag);if(!c){c={id:uid('part'),moduleId:mid,tag,name:tag,type,note:'',source:''};await commit(p=>p.components.push(c),'Đã tạo linh kiện.');}regionTargetIds=[...new Set([...regionTargetIds,c.id])];if(regionScope!=='components'&&regionScope!==c.type)regionScope=c.type;syncRegionDraft();renderEditor();return;}
 if(id==='saveRegion')return saveRegion();
 if(id==='newRegion'){editingRegionId='';draftRegion=null;renderEditor();drawImage();return;}
 if(id==='deleteRegion'){if(!editingRegionId)return;if(!confirm('Xóa vùng highlight đang chọn?'))return;return commit(p=>{p.regions=p.regions.filter(r=>r.id!==editingRegionId);editingRegionId='';draftRegion=null;});}
 if(id==='savePhoto'){const values={title:$('photoTitle').value.trim(),angle:$('photoAngle').value.trim(),state:$('photoState').value.trim(),variant:$('photoVariant').value.trim(),source:photo(photoEditingId)?.source||'',kind:$('photoKind').value,componentIds:checkedTargets('photoComponents'),diagnosticVisible:$('photoVisible').checked};if(!values.title)return toast('Nhập tên ảnh.');return commit(p=>Object.assign(p.photos.find(x=>x.id===photoEditingId),values));}
 if(id==='deletePhoto'){if(!confirm('Xóa ảnh này và các vùng của ảnh? Các bước guide dùng ảnh sẽ chuyển sang tự chọn ảnh.'))return;const removeId=photoEditingId;return commit(p=>{p.photos=p.photos.filter(x=>x.id!==removeId);(p.connections||[]).forEach(r=>{r.photoIds=r.photoIds.filter(id=>id!==removeId);});(p.manual2024?.entries||[]).forEach(r=>{r.photoIds=r.photoIds.filter(id=>id!==removeId);});p.regions=p.regions.filter(x=>x.photoId!==removeId);p.components.forEach(c=>{if(c.repair)for(const k of Object.keys(repairPhotoFields))c.repair[k]=(c.repair[k]||[]).filter(id=>id!==removeId);});p.guides.forEach(g=>g.steps.forEach(s=>{if(s.photoId===removeId)s.photoId='';}));photoEditingId='';photoId='';imageToken='';});}
 if(id==='saveComponent'){
  const tag=$('componentTag').value.trim().toUpperCase();if(!tag)return toast('Nhập tag linh kiện.');
  const old=part(componentEditingId),mid=old?.moduleId||moduleId,targets=checkedTargets('componentRelated');
  const aliases=[...new Set([...(old?.aliases||[]),...(old&&old.tag!==tag?[old.tag]:[])])].filter(x=>x!==tag);
  const values={tag,aliases,name:$('componentName').value.trim()||tag,type:$('componentType').value,note:$('componentNote').value.trim(),source:old?.source||'',repair:readRepairForm(),diagnosticVisible:$('componentVisible').checked};
  if(project.components.some(c=>c.moduleId===mid&&c.id!==componentEditingId&&[c.tag,...(c.aliases||[])].some(t=>[tag,...aliases].includes(t))))return toast('Tag này đã tồn tại trong module.');
  return commit(p=>{let c=p.components.find(x=>x.id===componentEditingId);if(c)Object.assign(c,values);else{c={id:uid('part'),moduleId:mid,...values};p.components.push(c);componentEditingId=c.id;}editContextComponentId=c.id;syncComponentRelations(p,c.id,targets);});
 }
 if(id==='deleteComponent'){const id=componentEditingId;if((project.connections||[]).some(r=>connectionParts(r).includes(id))||project.modules.some(m=>(m.boardIds||[]).includes(id))||project.photos.some(p=>(p.componentIds||[]).includes(id))||(project.manual2024?.entries||[]).some(r=>(r.componentIds||[]).includes(id))||project.regions.some(r=>r.componentIds.includes(id))||project.links.some(l=>l.from===id||l.to===id)||project.guides.some(g=>g.steps.some(s=>s.componentIds.includes(id))))return toast('Linh kiện đang dùng trong vùng ảnh, liên kết hoặc guide. Gỡ các tham chiếu đó trước khi xóa.');if(!confirm('Xóa linh kiện này?'))return;return commit(p=>{p.components=p.components.filter(c=>c.id!==id);selected=selected.filter(x=>x!==id);componentEditingId='';});}
 if(id==='saveModule'){const name=$('moduleNameEdit').value.trim();if(!name)return toast('Nhập tên module.');const values={name,aliases:$('moduleAliases').value.split(';').map(s=>s.trim()).filter(Boolean),variant:$('moduleVariant').value.trim(),note:$('moduleNoteEdit').value.trim(),diagnosticVisible:$('moduleVisible').checked};return commit(p=>{if(moduleEditingId){const m=p.modules.find(m=>m.id===moduleEditingId);values.aliases=[...new Set([...values.aliases,...(m.aliases||[]),...(m.name!==name?[m.name]:[])])].filter(x=>x!==name);Object.assign(m,values);}else{const key=slug(name);if(p.modules.some(m=>m.id===key))throw Error('Module này đã tồn tại.');p.modules.push({id:key,...values});moduleEditingId=key;moduleId=key;photoId='';}});}
 if(id==='deleteModule'){const id=moduleEditingId;if((project.connections||[]).some(r=>r.moduleId===id)||(project.manual2024?.entries||[]).some(r=>r.moduleIds.includes(id))||project.components.some(c=>c.moduleId===id)||project.photos.some(p=>p.moduleId===id)||project.regions.some(r=>r.moduleIds.includes(id))||project.guides.some(g=>g.moduleId===id||g.steps.some(s=>s.moduleId===id)))return toast('Module còn được dùng bởi ảnh, linh kiện hoặc guide.');if(!confirm('Xóa module này?'))return;return commit(p=>{p.modules=p.modules.filter(m=>m.id!==id);moduleEditingId='';moduleId='sru';photoId='upper-overview';});}
 if(id==='saveLink'){const values={name:$('linkName').value.trim(),from:$('linkFrom').value,to:$('linkTo').value,type:$('linkType').value,source:project.links.find(l=>l.id===linkEditingId)?.source||'',note:$('linkNote').value.trim(),verified:$('linkVerified').checked,diagnosticVisible:$('linkVisible').checked};return commit(p=>{if(linkEditingId)Object.assign(p.links.find(l=>l.id===linkEditingId),values);else{const l={id:uid('link'),...values};p.links.push(l);linkEditingId=l.id;}});}
 if(id==='deleteLink'){if(!confirm('Xóa liên kết này?'))return;return commit(p=>{p.regions.forEach(r=>{r.linkIds=(r.linkIds||[]).filter(x=>x!==linkEditingId);});p.links=p.links.filter(l=>l.id!==linkEditingId);linkEditingId='';});}
 if(id==='newGuide')return makeGuide();
 if(['addStep','deleteStep','stepUp','stepDown','saveGuide'].includes(id))captureGuideForm();
 if(id==='addStep'){const s=newStep(guideDraft.moduleId||moduleId);guideDraft.steps.push(s);editingStepId=s.id;renderGuideEditor();return;}
 if(id==='deleteStep'){if(guideDraft.steps.length===1)return toast('Guide cần ít nhất một bước.');if(!confirm('Xóa mục hướng dẫn này?'))return;guideDraft.steps=guideDraft.steps.filter(s=>s.id!==editingStepId);guideDraft.steps.forEach(s=>Object.keys(s.outcomes).forEach(k=>{if(s.outcomes[k]===editingStepId)s.outcomes[k]='__stop__';}));if(guideDraft.startId===editingStepId)guideDraft.startId=guideDraft.steps[0].id;editingStepId=guideDraft.steps[0].id;renderGuideEditor();return;}
 if(id==='stepUp'||id==='stepDown'){const i=guideDraft.steps.findIndex(s=>s.id===editingStepId),j=i+(id==='stepUp'?-1:1);if(j>=0&&j<guideDraft.steps.length)[guideDraft.steps[i],guideDraft.steps[j]]=[guideDraft.steps[j],guideDraft.steps[i]];renderGuideEditor();return;}
 if(id==='saveGuide'){if(!guideDraft.title||guideDraft.steps.some(s=>!s.title||!s.instruction.trim()))return toast('Điền tên guide, tên bước và nội dung của mọi bước.');if(guideDraft.variant&&!/^[0-9A-F]{2}$/.test(guideDraft.variant))return toast('Byte14 phải có 2 ký tự HEX.');if(guideDraft.command&&!/^[0-9A-F]{4}$/.test(guideDraft.command))return toast('Command phải có 4 ký tự HEX.');return commit(p=>{p.guides=p.guides.filter(g=>g.id!==guideDraft.id);p.guides.push(clone(guideDraft));run=null;},'Đã lưu tài liệu hướng dẫn.');}
 if(id==='deleteGuide'){if(!guideDraft||!confirm('Xóa guide đã lưu này?'))return;return commit(p=>{p.guides=p.guides.filter(g=>g.id!==guideDraft.id);guideDraft=null;run=null;});}
}
async function replacePhotoFile(file){
 const replacementId=photoEditingId;
 if(!photo(replacementId))throw Error('Chọn ảnh cần thay.');if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('Chọn file ảnh PNG/JPG/WebP/GIF.');
 const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
 const dimensions=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve({width:im.naturalWidth,height:im.naturalHeight});im.onerror=()=>reject(Error('Không đọc được file ảnh.'));im.src=src;});
 const replacement={src,...dimensions};const copied=await copyAddedImage(replacement);await commit(p=>Object.assign(p.photos.find(x=>x.id===replacementId),replacement),(copied?'Đã chép ảnh thay thế vào images/. ':'Ảnh thay thế sẽ nằm trong images/ khi xuất ZIP. ')+'Kiểm tra lại vùng highlight và xuất ZIP để lưu.');imageToken='';renderWorkspace();
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
 const touchHandle=window.matchMedia?.('(pointer:coarse)').matches?`<circle data-resize="true" cx="${x}" cy="${y}" r="${camera.w*22/Math.max(200,$('guideSvg').clientWidth||400)}" fill="transparent" pointer-events="all"/>`:'';
 return shapeMarkup(r,'class="drawing" data-draft="true"')+touchHandle+`<circle data-resize="true" cx="${x}" cy="${y}" r="${camera.w*.012}" class="resize-handle"/>`;
}
function draftOnly(){const layer=$('draftLayer');if(layer)layer.innerHTML=draftMarkup();}
function resizedRegion(r,pt,p){const next=clone(r);if(r.type==='circle')next.r=Math.max(.1,Math.min(Math.hypot(pt.x-r.x*p.width/100,pt.y-r.y*p.height/100)/p.width*100,r.x,100-r.x,r.y*p.height/p.width,(100-r.y)*p.height/p.width));else {next.w=Math.max(.1,Math.min(Math.abs(pt.x/p.width*100-r.x)*2,2*Math.min(r.x,100-r.x)));next.h=Math.max(.1,Math.min(Math.abs(pt.y/p.height*100-r.y)*2,2*Math.min(r.y,100-r.y)));}return next;}

function regionClick(id){const r=project.regions.find(x=>x.id===id);if(!r)return;if(page==='edit'&&editTab==='regions'){editingRegionId=id;draftRegion=clone(r);regionTargetIds=[...r.componentIds];regionModuleIds=[...r.moduleIds];regionScope=r.componentIds.length?'components':'modules';renderEditor();drawImage();}else if(r.moduleIds.length){const scope=relatedScope();const target=r.moduleIds.includes(moduleId)?moduleId:r.moduleIds.find(id=>!scope||scope.modules.has(id));if(target)setModule(target);}else{const same=regionsFor(photoId).filter(x=>shapeKey(x)===shapeKey(r));const scope=relatedScope();selected=[...new Set(same.flatMap(x=>x.componentIds))].filter(id=>part(id)?.moduleId===moduleId&&(!scope||scope.ids.has(id)));focusedComponentId=selected.length===1?selected[0]:'';renderWorkspace();}}
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
 else if(g.type==='draw'){const a={x:Math.min(p.width,Math.max(0,g.start.x)),y:Math.min(p.height,Math.max(0,g.start.y))},b={x:Math.min(p.width,Math.max(0,pt.x)),y:Math.min(p.height,Math.max(0,pt.y))},cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;draftRegion={id:uid('region'),photoId,type:drawMode,x:cx/p.width*100,y:cy/p.height*100,componentIds:[...regionTargetIds],moduleIds:[...regionModuleIds],linkIds:checkedTargets('regionLinks'),connectionIds:checkedTargets('regionConnections'),name:$('regionName')?.value||'',note:$('regionNote')?.value||''};if(drawMode==='circle')draftRegion.r=Math.min(Math.hypot(b.x-a.x,b.y-a.y)/2,cx,p.width-cx,cy,p.height-cy)/p.width*100;else{draftRegion.w=Math.abs(b.x-a.x)/p.width*100;draftRegion.h=Math.abs(b.y-a.y)/p.height*100;}draftOnly();}
}
function pointerEnd(e){if(!pointers.has(e.pointerId))return;const g=gesture;pointers.delete(e.pointerId);if(!g)return;if(g.type==='pinch'){gesture=null;pointers.clear();return;}if(e.type==='pointercancel'){draftRegion=g.original||null;gesture=null;drawImage();return;}
 if((g.type==='draw'||g.type==='move'||g.type==='resize')&&g.moved&&draftRegion){renderEditor();drawImage();}else if(!g.moved&&g.rId)regionClick(g.rId);gesture=null;}
async function handleClick(e){
 const b=e.target.closest('button');if(!b)return;
 try{
 if(b.dataset.removeRegionTarget){const id=b.dataset.removeRegionTarget;if(b.dataset.regionKind==='module')regionModuleIds=regionModuleIds.filter(x=>x!==id);else regionTargetIds=regionTargetIds.filter(x=>x!==id);syncRegionDraft();renderEditor();return;}
 if(b.id==='previousPhoto'||b.id==='nextPhoto'){navigatePhoto(b.id==='previousPhoto'?-1:1);return;}
 if(b.id==='focusComponentRegion'){focusComponentRegion();return;}
 if(handleExplorationClick(b))return;
 if(b.dataset.mobileAction){
  const action=b.dataset.mobileAction;
  if(action==='lookup'){showLookupManager();return;}
  if(action==='exports'){$('editorExports').scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(action==='form'&&page!=='edit'){captureGuideForm();showPage('edit');}
  if(action==='image'&&page==='data'){captureGuideForm();showPage('edit');}
  $(action==='form'?'editor':'viewerDock').scrollIntoView({block:'start',behavior:'smooth'});return;
 }
 if(b.dataset.page){captureGuideForm();showPage(b.dataset.page);return;}
 if(b.dataset.editor){captureGuideForm();editTab=b.dataset.editor;if(editTab==='modules'){moduleEditingId=moduleId;editContextComponentId='';selected=[];}if(editTab==='regions'&&editorPart()){regionTargetIds=[editorPart().id];regionModuleIds=[];regionScope='components';regionModuleFilter=moduleId;}drawMode='pan';draftRegion=null;editingRegionId='';renderWorkspace();return;}
 if(b.dataset.photo){captureGuideForm();photoId=b.dataset.photo;photoEditingId=photoId;imageToken='';draftRegion=null;editingRegionId='';renderWorkspace();return;}
 if(b.dataset.component){captureGuideForm();if(page==='edit')chooseEditorPart(b.dataset.component);else focusParts([b.dataset.component]);return;}
 if(b.dataset.editBoard){chooseEditorPart(b.dataset.editBoard);return;}
 if(b.dataset.casePart){focusParts([b.dataset.casePart]);return;}
 if(b.dataset.linkTarget){if(page==='edit')chooseEditorPart(b.dataset.linkTarget);else focusParts([b.dataset.linkTarget]);return;}
 if(b.dataset.draw){drawMode=b.dataset.draw;document.querySelectorAll('[data-draw]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));return;}
 if(b.dataset.editManual){const row=project.manual2024?.entries?.find(r=>r.id===b.dataset.editManual);if(row?.moduleIds?.length&&!row.moduleIds.includes(moduleId)){moduleId=row.moduleIds[0];moduleEditingId=moduleId;}editContextComponentId=row?.componentIds?.[0]||'';manualEditingId=b.dataset.editManual;editTab='manual';showPage('edit');$('editor').scrollIntoView({block:'nearest',behavior:'smooth'});return;}
 if(b.dataset.manualPhoto){const ph=photo(b.dataset.manualPhoto);if(ph){photoId=ph.id;imageToken='';renderWorkspace();$('viewerBox').scrollIntoView({block:'nearest',behavior:'smooth'});}return;}
 if(b.dataset.referencePhoto){const ph=photo(b.dataset.referencePhoto);if(ph){setModule(availablePhotos(moduleId).some(x=>x.id===ph.id)?moduleId:ph.moduleId,selected,ph.id);$('viewerBox').scrollIntoView({block:'nearest',behavior:'smooth'});}return;}
 if(b.dataset.editStep){captureGuideForm();editingStepId=b.dataset.editStep;renderGuideEditor();return;}
 const id=b.id;
 if(['saveBoardNames','saveModuleBoards','saveConnection','deleteConnection'].includes(id)){await structureEditorAction(id);return;}
 if(id==='editModuleScope'){editContextComponentId='';componentEditingId='';manualEditingId='';connectionEditingId='';selected=[];moduleEditingId=moduleId;editTab='modules';renderWorkspace();return;}
 if(id==='newBoard'){editContextComponentId='';componentEditingId='';editTab='components';renderWorkspace();$('componentType').value='board';return;}
 if(['saveManual','deleteManual','saveDiagnosticDisplay'].includes(id)){await extendedEditorAction(id);return;}
 if(id==='chooseImageRoot'){await chooseImageRoot();return;}
 if(id==='manageLookups'){showLookupManager();return;}
 if(['lookupNew','lookupSave','lookupRevert','lookupDelete'].includes(id)){lookupAction(id);return;}
 if(id==='encryptLookupBundle'){await encryptLookupFiles();return;}
 if(id==='exportMData'){await encryptLookupFiles('mdata');return;}
 if(id==='exportMStatus'){await encryptLookupFiles('mstatus');return;}

 if(id==='openCircuit'){const ph=photo($('circuitSelect').value);if(ph){photoId=ph.id;imageToken='';renderWorkspace();}return;}

 if(id==='sample'){$('mdata').value='00-52-54-41-20-1E-64-01-0A-02-05-0A-0A-58-5C-07-00-0B';$('mstatus').value='02';renderStatus();renderDecode();toast('Đang xem MData ví dụ cho lỗi 4120.');}
 else if(id==='clearSelection'){focusedComponentId='';selected=[];if(page==='edit'){editContextComponentId='';componentEditingId='';manualEditingId='';connectionEditingId='';}renderWorkspace();}
 else if(id==='zoomIn')zoom(.75);else if(id==='zoomOut')zoom(1/.75);else if(id==='fitView')fit();
 else if(id==='fullView')openFullImage();
 else if(id==='closeFull')$('fullDialog').close();
 else if(id==='exportHTML'||id==='exportEditor'){try{await exportHTML(id==='exportEditor'?'editor':'diagnostic');}catch(e){toast('Không xuất được ZIP: '+e.message);}}
 else if(id==='exportProject')download('SRU_VisualGuide_Data.json',safeJSON({schemaVersion:1,project}));
 else if(id==='editHighlightsShortcut'||id==='editCurrentPhotoRegions'){openPhotoRegions();}
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
 if(e.target.dataset.target==='region'){const isModule=e.target.dataset.regionKind==='module',ids=new Set(isModule?regionModuleIds:regionTargetIds);if(e.target.checked)ids.add(e.target.value);else ids.delete(e.target.value);if(isModule)regionModuleIds=[...ids];else regionTargetIds=[...ids];syncRegionDraft();$('regionSelection').innerHTML=regionSelectionMarkup();return;}
 if(['regionLinks','regionConnections'].includes(e.target.dataset.target)){syncRegionDraft();return;}
 if(id==='regionSelect'){if(e.target.value)regionClick(e.target.value);return;}
 if(id==='regionModuleFilter'){syncRegionDraft();regionModuleFilter=e.target.value;renderEditor();return;}
 if(id==='regionScope'){syncRegionDraft();regionScope=e.target.value;renderEditor();}
 else if(id==='photoEditSelect'){photoEditingId=e.target.value;draftRegion=null;editingRegionId='';if(photoEditingId){photoId=photoEditingId;imageToken='';}renderWorkspace();}
 else if(id==='manualEditSelect'){manualEditingId=e.target.value;renderEditor();}
 else if(id==='componentEditSelect'){componentEditingId=e.target.value;if(componentEditingId)chooseEditorPart(componentEditingId);else{editContextComponentId='';renderEditor();}}
 else if(id==='connectionEditSelect'){connectionEditingId=e.target.value;renderEditor();}
 else if(id==='moduleEditSelect'){moduleEditingId=e.target.value;if(moduleEditingId)setModule(moduleEditingId);else renderEditor();}
 else if(id==='linkEditSelect'){linkEditingId=e.target.value;renderEditor();}
 else if(id==='guideEditSelect'){const g=project.guides.find(g=>g.id===e.target.value);guideDraft=g?clone(g):null;editingStepId=g?.startId||'';renderGuideEditor();}
 else if(id==='stepModule'){const next=e.target.value;captureGuideForm();const s=guideDraft.steps.find(s=>s.id===editingStepId);s.moduleId=next;s.photoId='';s.componentIds=[];renderGuideEditor();}
}

let lookupReady=false,lookupTable='errors',lookupCode=null,lookupDraftDirty=false,lookupUnsaved=false;
const lookupFields=[['how','How to detect'],['category','Category'],['main','Main'],['connector','Connector'],['sensor','Sensor'],['actuator','Motor/Solenoid']];
function lookupMessage(message){$('lookupRowStatus').textContent=message;}
function lookupLabel(item){return typeof item==='string'?item:(item?.title??item?.command??'');}
function lookupList(){
 const q=$('lookupSearch').value.trim().toLowerCase(),entries=Object.entries(tables[lookupTable]).filter(([k,v])=>(k+' '+JSON.stringify(v)).toLowerCase().includes(q)).sort(([a],[b])=>a.localeCompare(b));
 $('lookupRows').innerHTML=entries.map(([k,v])=>`<option value="${esc(k)}">${esc(k+' · '+lookupLabel(v).slice(0,110))}</option>`).join('');
 $('lookupRows').value=lookupCode??'';$('lookupCount').textContent=entries.length+' / '+Object.keys(tables[lookupTable]).length+' mã';
}
function lookupLoad(code){
 lookupCode=code;lookupDraftDirty=false;const item=code===null?null:tables[lookupTable][code],isError=lookupTable==='errors';
 $('lookupCode').value=code??'';$('lookupTitleField').hidden=!isError;$('lookupTitle').value=item?.title||'';
 $('lookupText').value=isError?(item?.description||[]).join('\n'):lookupLabel(item);
 $('lookupTextLabel').textContent=isError?'Mô tả và hướng dẫn xử lý (mỗi mục một dòng)':'Nội dung hiển thị';
 $('lookupEditHint').textContent=isError?'Các dòng Main:, Connector:, Sensor:, Motor/Solenoid: xác định linh kiện liên kết. How to detect:, Category: và Guide: chứa nội dung chẩn đoán. Nội dung sau dòng Guide: thuộc hướng dẫn xử lý.':lookupTable==='statuses'?'MStatus dùng mã thập phân 00–99.':lookupTable==='modules'?'Module ID dùng số thập phân (ví dụ 4 = Bill Validation devices).':'Mã lệnh gồm 4 ký tự hex; Status Message gồm 2 ký tự hex.';
 $('lookupDelete').disabled=code===null;$('lookupRows').value=code??'';lookupMessage(code===null?'Nhập mã và nội dung mới.':'Đang sửa mã '+code+'.');
}
function resetLookupEditor(type=lookupTable){lookupReady=true;lookupTable=type;$('lookupTable').value=type;$('lookupSearch').value='';lookupCode=null;lookupList();lookupLoad(Object.keys(tables[type]).sort()[0]??null);}
function lookupDiscard(){return !lookupDraftDirty||confirm('Dòng đang sửa chưa lưu. Bỏ nội dung đang nhập?');}
function lookupAction(action){
 try{
 if(action==='lookupNew'){if(lookupDiscard())lookupLoad(null);return;}
 if(action==='lookupRevert'){lookupLoad(lookupCode);return;}
 if(action==='lookupDelete'){
  if(lookupCode===null)return;if(!confirm('Xóa mã '+lookupCode+' khỏi bảng '+lookupTable+'?'))return;
  const next={...tables,[lookupTable]:{...tables[lookupTable]}};delete next[lookupTable][lookupCode];validateTables(next);tables=next;lookupUnsaved=true;lookupList();lookupLoad(null);renderStatus();renderDecode();$('lookupManagerStatus').textContent='Đã xóa mã trong phiên. Xuất bộ data để giữ thay đổi.';return;
 }
 let code=$('lookupCode').value.trim().toUpperCase();
 if(lookupTable==='errors'&&(!/^[0-9A-F]{1,4}\*{0,3}$/.test(code)||code.length!==4))throw Error('Mã lỗi cần 4 ký tự hex, có thể dùng * ở cuối (ví dụ 05**).');
 if(lookupTable==='statuses'){if(!/^\d{1,2}$/.test(code))throw Error('MStatus cần mã 00–99.');code=code.padStart(2,'0');}
 if(lookupTable==='modules'){if(!/^\d{1,3}$/.test(code)||Number(code)>255)throw Error('Module ID cần số thập phân 0–255.');code=String(Number(code));}
 if(lookupTable==='commands'&&!/^[0-9A-F]{4}$/.test(code))throw Error('Mã lệnh cần 4 ký tự hex.');
 if(lookupTable==='statusMessages'&&!/^[0-9A-F]{2}$/.test(code))throw Error('Status Message cần 2 ký tự hex.');
 if(code!==lookupCode&&Object.hasOwn(tables[lookupTable],code))throw Error('Mã '+code+' đã tồn tại. Chọn mã đó để chỉnh sửa.');
 const old=lookupCode===null?null:tables[lookupTable][lookupCode],text=$('lookupText').value;let item;
 if(lookupTable==='errors'){
  const title=$('lookupTitle').value.trim();if(!title)throw Error('Nhập tên lỗi.');
  const description=text?text.replace(/\r\n/g,'\n').split('\n'):[];item={...(old||{}),title,description};
  // Only resynchronize structured metadata when description changes. Preserve unknown fields.
  if(!old||JSON.stringify(description)!==JSON.stringify(old.description)){
   for(const [field,label]of lookupFields){const prefix=label.toLowerCase()+':',line=description.find(s=>s.toLowerCase().startsWith(prefix)),prior=(old?.description||[]).some(s=>s.toLowerCase().startsWith(prefix));if(line!==undefined||prior||!old)item[field]=line===undefined?'':line.slice(line.indexOf(':')+1).trim();}
   const gi=description.findIndex(s=>/^Guide:/i.test(s));if(gi>=0)item.guide=[description[gi].replace(/^Guide:\s*/i,''),...description.slice(gi+1)].join('\n');else if(!old||(old.description||[]).some(s=>/^Guide:/i.test(s)))item.guide='';
  }
 }else{if(!text.trim())throw Error('Nhập nội dung hiển thị.');item=lookupTable==='statuses'?text:{...(typeof old==='object'?old:{}),command:text};}
 const map={...tables[lookupTable]};if(lookupCode!==null&&code!==lookupCode)delete map[lookupCode];map[code]=item;
 const next={...tables,[lookupTable]:map};validateTables(next);tables=next;lookupUnsaved=true;lookupCode=code;lookupList();lookupLoad(code);renderStatus();renderDecode();lookupMessage('Đã lưu mã '+code+' vào bảng trong phiên.');$('lookupManagerStatus').textContent='Có thay đổi chưa xuất. Bấm Mã hóa & tải bộ data (ZIP) để lưu file.';
 }catch(e){lookupMessage(e.message);}
}
document.addEventListener('input',e=>{
 if(e.target.id==='lookupSearch')lookupList();
 if(['lookupCode','lookupTitle','lookupText'].includes(e.target.id)){lookupDraftDirty=true;lookupMessage('Dòng đang sửa chưa lưu.');}
});
document.addEventListener('change',e=>{
 if(e.target.id==='lookupTable'){if(lookupDiscard())resetLookupEditor(e.target.value);else e.target.value=lookupTable;}
 if(e.target.id==='lookupRows'){if(lookupDiscard()){lookupLoad(e.target.value);if(window.matchMedia?.('(max-width:850px)').matches)$('lookupDraft').scrollIntoView({block:'start',behavior:'smooth'});}else e.target.value=lookupCode??'';}
});
window.addEventListener('beforeunload',e=>{if(lookupDraftDirty||lookupUnsaved){e.preventDefault();e.returnValue='';}});

function showLookupManager(){if(!editorMode)return;if(!lookupReady)resetLookupEditor('errors');$('lookupManager').open=true;$('lookupManager').scrollIntoView({block:'start',behavior:'smooth'});}
function lookupPayload(kind){if(kind==='mstatus')return {schemaVersion:1,statuses:tables.statuses};const {statuses,...md}=tables;return md;}
function parseLookupLiteral(text){
 let s=text.replace(/^\uFEFF/,'').trim();
 while(s.startsWith('//')||s.startsWith('/*')){if(s.startsWith('//')){const n=s.indexOf('\n');if(n<0)throw Error('File không có dữ liệu.');s=s.slice(n+1).trim();}else{const n=s.indexOf('*/');if(n<0)throw Error('Chú thích chưa đóng.');s=s.slice(n+2).trim();}}
 s=s.replace(/^(?:(?:const|let|var)\s+|window\.)?[A-Za-z_$][\w$]*\s*=\s*/,'').replace(/;\s*$/,'');
 try{return JSON.parse(s);}catch{try{return parseLayoutLiteral(s);}catch{throw Error('Chỉ nhận JSON hoặc JS gán một object dữ liệu. Không chạy mã JavaScript trong file nhập.');}}
}
async function importLookupFile(file,kind){
 if((lookupDraftDirty||lookupUnsaved)&&!confirm('Nhập file sẽ thay bảng hiện tại. Tiếp tục và bỏ các thay đổi chưa xuất của bảng đó?'))return;
 if(file.size>32*1024*1024)throw Error('File vượt quá 32 MB.');let value;
 if(/\.csv$/i.test(file.name)){
  const rows=parseCSV(await file.text());
  if(kind==='mdata')value={errors:errorsFromCSV(rows)};
  else{const head=Object.keys(rows[0]||{}),ci=head.find(s=>['code','mstatus','status code','mã'].includes(s.trim().toLowerCase())),di=head.find(s=>['description','status','message','mô tả'].includes(s.trim().toLowerCase()));if(!ci||!di||ci===di)throw Error('CSV MStatus cần cột Code và Description.');const statuses={};for(const row of rows){if(Object.values(row).every(s=>!s.trim()))continue;const code=String(row[ci]||'').trim();if(!/^\d{1,2}$/.test(code))throw Error('Mã MStatus CSV không hợp lệ.');const id=code.padStart(2,'0');if(Object.hasOwn(statuses,id))throw Error('MStatus CSV có mã trùng: '+id);statuses[id]=String(row[di]||'').trim();}value={statuses};}
 }else value=parseLookupLiteral(await file.text());
 if(SRULookupCrypto.isEncrypted(value)){value=await SRULookupCrypto.decrypt(value,kind);}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('File cần chứa bảng dữ liệu.');
 let next;
 if(kind==='mdata'){
  const md=value.errors?value:{errors:value},errors={};
  for(const [code,item]of Object.entries(md.errors)){if(!item||typeof item!=='object'||Array.isArray(item))throw Error('MData cần object cho từng mã lỗi.');errors[code.toUpperCase()]={...item,title:item.title||item.command||'',description:Array.isArray(item.description)?item.description:String(item.description||'').split(/\r?\n/)};}
  next={...tables,...md,errors,statuses:tables.statuses};
 }else{
  const statuses={};for(const [code,item]of Object.entries(value.statuses||value)){if(!/^\d{1,2}$/.test(code))throw Error('MStatus cần mã số 00–99.');const text=typeof item==='string'?item:(item?.command??item?.description);if(typeof text!=='string')throw Error('Mô tả MStatus phải là văn bản.');statuses[code.padStart(2,'0')]=text;}if(!Object.keys(statuses).length)throw Error('Bảng MStatus trống.');next={...tables,statuses};
 }
 validateTables(next);tables=next;lookupUnsaved=true;renderStatus();renderDecode();resetLookupEditor(kind==='mdata'?'errors':'statuses');
 $('lookupManagerStatus').textContent=`Đã nhập ${file.name}: ${Object.keys(kind==='mdata'?tables.errors:tables.statuses).length} mã. Bấm mã hóa để xuất file mới.`;
}
async function encryptLookupFiles(kind='both'){
 showLookupManager();const status=$('lookupManagerStatus'),button=$('encryptLookupBundle');
 if(lookupDraftDirty){status.textContent='Bấm Lưu dòng hoặc Hoàn tác dòng trước khi xuất.';return;}
 button.disabled=true;status.textContent='Đang mã hóa…';
 try{validateTables(tables);const kinds=kind==='both'?['mdata','mstatus']:[kind];const entries=[];
  for(const k of kinds){const encrypted=await SRULookupCrypto.encrypt(lookupPayload(k),k);entries.push(['data/'+k+'.js',SRULookupCrypto.js(encrypted,k)]);}
  if(kind==='both')download('SRU_Encrypted_Data.zip',SRULookupCrypto.zip(entries),'application/zip');else download(kind+'.js',entries[0][1],'text/javascript;charset=utf-8');
  if(kind==='both')lookupUnsaved=false;status.textContent='Đã xuất dữ liệu mã hóa. Thay file trong thư mục data; Diagnostic tự đọc, không cần mật khẩu.';
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
}

async function fileChange(e){if(!editorMode)return;const files=[...(e.target.files||[])];if(!files.length)return;try{
 if(['lookupImportMData','lookupImportMStatus'].includes(e.target.id)){try{await importLookupFile(files[0],e.target.id==='lookupImportMData'?'mdata':'mstatus');}catch(error){$('lookupManagerStatus').textContent=error.message;}finally{e.target.value='';}return;}
 if(e.target.id==='importHTML'){const doc=new DOMParser().parseFromString(await files[0].text(),'text/html');const p=JSON.parse(doc.getElementById('sruProject')?.textContent||'null'),embedded=JSON.parse(doc.getElementById('sruTables')?.textContent||'null'),t=embedded?.errors?embedded:tables;if(p?.external||!p)throw Error('HTML này dùng dữ liệu rời. Chọn Nhập dự án JS/JSON rồi mở file data/sru_project.js của bộ đó.');validateProject(p);validateTables(t);if(!confirm('Mở dữ liệu từ HTML này để chỉnh sửa? Hãy xuất bản Editor hiện tại nếu cần giữ thay đổi.'))return;project=clone(p);tables=clone(t);run=null;moduleId='sru';photoId=bestPhoto(moduleId)?.id||'';imageToken='';draftRegion=null;await saveLocal();showPage('edit');toast('Đã mở dữ liệu HTML.');}
 else if(e.target.id==='photoUpload')await uploadPhotos(files);
 else if(e.target.id==='replacePhotoUpload')await replacePhotoFile(files[0]);
 else if(e.target.id==='importLayout')await importLayout(files[0]);
 else if(e.target.id==='importCSV'){const errors=errorsFromCSV(parseCSV(await files[0].text()));if(!confirm('Cập nhật bảng lỗi bằng '+Object.keys(errors).length+' dòng từ CSV này? Ảnh và guide đã biên soạn được giữ.'))return;tables={...tables,errors,source:files[0].name};renderDecode();await saveLocal();showPage('data');toast('Đã cập nhật bảng lỗi CSV.');}
 else if(e.target.id==='importProject'){const value=parseLookupLiteral(await files[0].text()),incoming=value.project||value;validateProject(incoming);if(value.tables)validateTables(value.tables);if(!confirm('Thay dữ liệu ảnh và guide hiện tại bằng file JSON này? Hãy xuất dữ liệu hiện tại trước nếu cần giữ một bản.'))return;project=clone(incoming);project.documentId=project.documentId||uid('sru');if(value.tables)tables=clone(value.tables);run=null;moduleId=project.modules[0].id;photoId=bestPhoto(moduleId)?.id||'';selected=[];imageToken='';await saveLocal();showPage('data');toast('Đã nhập dữ liệu.');}
 }catch(error){toast('Không nhập được: '+error.message);}finally{e.target.value='';}}
function syncEditorMobile(){const narrow=window.matchMedia?.('(max-width:850px)').matches;const picker=$('lookupRows');if(picker)picker.size=narrow?1:10;}
syncEditorMobile();window.addEventListener('resize',syncEditorMobile);
document.addEventListener('focusin',e=>{if(e.target.matches('textarea,input:not([type=checkbox]):not([type=button]):not([type=file]):not([type=range]),select'))document.body.classList.add('mobile-text-entry');});
document.addEventListener('focusout',()=>{setTimeout(()=>{const el=document.activeElement;if(!el?.matches('textarea,input:not([type=checkbox]):not([type=button]):not([type=file]):not([type=range]),select'))document.body.classList.remove('mobile-text-entry');},0);});
document.addEventListener('click',handleClick);
for(const event of ['input','change']){$('mstatus').addEventListener(event,()=>{if(diagnosticReady)renderStatus();});$('mdata').addEventListener(event,refreshDiagnosticInput);}
$('onlyRelated').addEventListener('change',()=>{renderWorkspace();});

$('circuitSearch').addEventListener('input',renderCircuits);$('circuitAll').addEventListener('change',renderCircuits);
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
 if(editorMode){moduleEditingId=moduleId;showPage('edit');}else renderWorkspace();
 diagnosticReady=true;
 if($('mdata').value.trim()||$('mstatus').value.trim())refreshDiagnosticInput();else $('byteCount').textContent='0/18 byte';
 if(!editorMode){$('saveState').textContent='Dữ liệu trong HTML';return;}
 try{storage=await openStorage();const saved=await new Promise((resolve,reject)=>{const r=storage.transaction('snapshots','readonly').objectStore('snapshots').get(project.documentId);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(saved?.tables){await new Promise((resolve,reject)=>{const t=storage.transaction('snapshots','readwrite');t.objectStore('snapshots').put({project:saved.project},project.documentId);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}if(saved&&saved.project.updatedAt>project.updatedAt){validateProject(saved.project);project=saved.project;moduleId=mod(moduleId)?moduleId:project.modules[0].id;photoId=availablePhotos(moduleId).some(p=>p.id===photoId)?photoId:bestPhoto(moduleId)?.id||'';imageToken='';renderWorkspace();$('saveState').textContent='Đã khôi phục bản lưu trên máy';}}
 catch(e){$('saveState').textContent='Bấm Lưu file Editor để giữ thay đổi';}
}
boot();
})();

