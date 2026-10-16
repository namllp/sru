/* SRU Device.log picker. All processing stays in this browser session. */
window.SRUDeviceLogPanel=(()=>{
'use strict';
function mount({host,selectionHost,getStatus,apply}){
 if(!host||host.querySelector('#sruLogPanel'))return;
 const core=window.SRUDeviceLogCore;
 const style=document.createElement('style');style.textContent=`
 #sruLogPanel{width:100%;box-sizing:border-box;clear:both;margin:0 0 22px;border:1px solid #304854;border-radius:18px;background:#101f2b;min-width:0}
 #sruLogPanel .section-title{margin-bottom:14px}
 #sruLogPanel .sru-log-body{min-width:0}
 #sruLogPanel .sru-log-actions,#sruLogPanel .sru-log-pages{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 #sruLogPanel button{min-height:42px;touch-action:manipulation}
 #sruLogPanel .sru-log-pick{background:#194753;border-color:#3d737b;color:#e7fbf4;padding:10px 22px}
 #sruLogPanel .sru-log-note,#sruLogPanel .sru-log-state{font-size:12px;color:#adc0cc;line-height:1.6;margin:10px 0;overflow-wrap:anywhere}
 #sruLogPanel progress{width:100%;height:7px;accent-color:#71cdb4}
 #sruLogPanel input[type=search]{width:100%;min-width:0;font-size:14px;box-sizing:border-box;margin:5px 0 10px}
 #sruLogPanel .sru-log-filters{display:grid;grid-template-columns:minmax(180px,1fr) minmax(0,2fr);gap:14px;align-items:end}
 #sruLogPanel .sru-log-filters>div{min-width:0}
 #sruLogPanel .sru-log-filters label{font-size:12px;margin-top:0}
 #sruLogPanel select{width:100%;min-width:0;margin:5px 0 10px;box-sizing:border-box;font-size:14px}
 #sruLogPanel .sru-log-rows{display:grid;gap:8px;max-height:410px;overflow:auto;overscroll-behavior:contain;padding:2px}
 #sruLogPanel .sru-log-row{display:block;width:100%;min-width:0;box-sizing:border-box;text-align:left;white-space:normal;padding:8px 10px;background:#132b38;border:1px solid #344f5d;border-radius:10px;font:inherit;color:#dae8ed;overflow-wrap:anywhere}
 #sruLogPanel button.sru-log-row:not(:disabled){border-left:3px solid #61baa8}
 #sruLogPanel button.sru-log-row:not(:disabled):hover{border-color:#79d0b7;background:#193841}
 #sruLogPanel button.sru-log-row:focus-visible{outline:2px solid #a1ebdc;outline-offset:-3px}
 #sruLogPanel .sru-log-readonly{background:#111f2b;border-color:#2e404e}
 #sruLogPanel .sru-log-row[aria-pressed=true]{background:#1b4247;border-color:#79d0b7;box-shadow:inset 3px 0 #79d0b7}
 #sruLogPanel .sru-log-row:disabled{opacity:1;cursor:not-allowed}
 #sruLogPanel .sru-log-top{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#adc3ce;flex-wrap:wrap}
 #sruLogPanel .sru-log-device{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:7px;flex-wrap:wrap;font-size:13px}
 #sruLogPanel .sru-log-service{color:#e3f4fa;font-weight:650}
 #sruLogPanel .sru-log-badge{font-size:11px;color:#b1c1cb;border:1px solid #38515e;border-radius:6px;padding:2px 7px;white-space:nowrap}
 #sruLogPanel button:not(:disabled) .sru-log-badge{color:#a7e5d5;border-color:#3d736a}
 #sruLogPanel .sru-log-status{display:block;font-size:14px;line-height:1.5;margin:6px 0;font-weight:600}
 #sruLogPanel code{display:block;font:11px/1.6 ui-monospace,Consolas,monospace;overflow-wrap:anywhere;white-space:normal;color:#abc7d4}
 #sruLogPanel .sru-log-reason{display:block;font-size:12px;color:#f4bc93;margin-top:5px}
 #sruLogPanel .sru-log-pages{justify-content:space-between;margin-top:10px;font-size:12px}
 #sruLogPanel .sru-log-rows{display:block;overflow:auto}
 #sruLogPanel .sru-log-row,#sruLogPanel .sru-log-columns{display:grid;grid-template-columns:140px minmax(130px,.9fr) minmax(180px,1.2fr) minmax(230px,1.8fr);gap:10px;align-items:start;min-width:740px;width:100%;box-sizing:border-box}
 #sruLogPanel .sru-log-row{margin:6px 0 0;border-left:3px solid transparent}
 #sruLogPanel .sru-log-columns{position:sticky;top:0;z-index:1;padding:8px 10px;border-left:3px solid transparent;background:#172d3b;color:#b4ccd8;font-size:12px;font-weight:650;border-radius:8px}
 #sruLogPanel .sru-log-top,#sruLogPanel .sru-log-device{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0;margin:0}
 #sruLogPanel .sru-log-status{margin:0;font-size:14px;line-height:1.5;min-width:0}
 #sruLogPanel .sru-log-status-name{display:block;font-size:12px;font-weight:400;color:#c7d8e2;margin-top:4px}
 #sruLogPanel .sru-log-data{min-width:0;display:block}
 #sruLogPanel .sru-log-data code{font-size:12px;line-height:1.7}
 #sruLogSelection{font-size:12px;line-height:1.6;color:#a0d9c9;overflow-wrap:anywhere;margin:0 0 12px}
 #sruLogPanel [hidden],#sruLogSelection[hidden]{display:none!important}
 @media(max-width:600px){#sruLogPanel input[type=search],#sruLogPanel select{font-size:16px}#sruLogPanel .sru-log-filters{grid-template-columns:minmax(0,1fr);gap:0}#sruLogPanel .sru-log-rows{max-height:370px}#sruLogPanel .sru-log-pick{flex:1}#sruLogPanel .sru-log-row{padding:8px 10px}}
 `;document.head.appendChild(style);
 const panel=document.createElement('section');panel.id='sruLogPanel';panel.className='panel';panel.setAttribute('aria-labelledby','sruLogTitle');
 panel.innerHTML=`<div class="section-title"><h2 id="sruLogTitle">Device log · Nhật ký thiết bị</h2></div><div class="sru-log-body">
 <div class="sru-log-actions"><button type="button" class="sru-log-pick" data-log="choose">Mở file log</button><button type="button" data-log="cancel" hidden>Dừng</button><button type="button" data-log="clear" hidden>Bỏ log</button></div>
 <input data-log="file" type="file" accept=".log,.txt,application/octet-stream,text/plain" hidden>
 <p class="sru-log-note">Mặc định hiển thị MStatus / MData của tất cả thiết bị. Dùng bộ lọc “Thiết bị khác SRU” để xem riêng các thiết bị còn lại. Chọn dòng SRU để điền MStatus / MData xuống phần giải mã; các thiết bị khác chỉ xem.</p>
 <p data-log="state" class="sru-log-state" role="status" aria-live="polite">Chưa chọn file.</p><progress data-log="progress" max="1" value="0" hidden aria-label="Tiến độ đọc log"></progress>
 <div data-log="results" hidden><div class="sru-log-filters"><div><label for="sruLogDevice">Thiết bị / service</label><select id="sruLogDevice"><option value="">Tất cả thiết bị</option></select></div><div><label for="sruLogSearch">Tìm trong log</label><input id="sruLogSearch" type="search" placeholder="Thiết bị, thời gian, MStatus, MData…" autocomplete="off"></div></div><div class="sru-log-rows" data-log="rows" aria-label="Các bản ghi Device log"></div>
 <div class="sru-log-pages"><button type="button" data-log="prev" aria-label="Trang log trước">←</button><span data-log="page"></span><button type="button" data-log="next" aria-label="Trang log sau">→</button></div></div></div>`;
 if(host.id==='deviceLogHost')host.replaceChildren(panel);else host.prepend(panel);
 const provenance=document.createElement('p');provenance.id='sruLogSelection';provenance.hidden=true;
 const selectionTitle=selectionHost?.querySelector('.section-title');if(selectionTitle)selectionTitle.after(provenance);else panel.append(provenance);
 const el=key=>panel.querySelector('[data-log="'+key+'"]'),search=panel.querySelector('#sruLogSearch'),deviceFilter=panel.querySelector('#sruLogDevice');
 let records=[],filtered=[],page=0,chosen=null,filename='',controller=null,generation=0,timer;
 const pageSize=20;
 const text=(tag,value,className)=>{const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n;};
 function state(message){el('state').textContent=message;}
 function statusName(row){return core.isSRU(row)?getStatus(row.mstatus_dec):(window.SRUDeviceStatuses?.statusName(row)||'');}
 function deviceOptions(){
  const counts=new Map();records.forEach(r=>counts.set(r.service,(counts.get(r.service)||0)+1));
  const all=text('option','Tất cả thiết bị'+(records.length?' ('+records.length+')':''));all.value='';deviceFilter.replaceChildren(all);
  const otherCount=records.filter(r=>!core.isSRU(r)).length;if(otherCount){const other=text('option','Thiết bị khác SRU ('+otherCount+')');other.value='@other';deviceFilter.append(other);}
  for(const [service,count] of [...counts].sort((a,b)=>a[0].localeCompare(b[0]))){const option=text('option',(service||'Không có service')+' ('+count+')');option.value=JSON.stringify(service);deviceFilter.append(option);}
 }
 function render(){
  const pages=Math.ceil(filtered.length/pageSize);page=Math.max(0,Math.min(page,Math.max(0,pages-1)));
  el('rows').replaceChildren();
  const columns=text('div','','sru-log-columns');for(const label of ['Ngày giờ','Tên thiết bị','MStatus','MData'])columns.append(text('span',label));columns.setAttribute('aria-hidden','true');el('rows').append(columns);
  for(const row of filtered.slice(page*pageSize,(page+1)*pageSize)){
   const sru=core.isSRU(row),button=document.createElement(sru?'button':'article');button.className='sru-log-row'+(sru?'':' sru-log-readonly');
   let reason='';if(sru){try{core.selection(row);}catch(e){reason=e.message;}button.type='button';button.disabled=!!reason;button.setAttribute('aria-pressed',String(chosen===row));button.setAttribute('aria-label','Điền MStatus '+row.mstatus_dec+' và MData của bản ghi SRU số '+row.sequence);button.title=reason||'Bấm để điền vào SRU Diagnostic';}
   const top=document.createElement('span');top.className='sru-log-top';top.append(text('span',row.time));button.append(top);
   const device=document.createElement('span');device.className='sru-log-device';device.append(text('span',row.service||'Không có service','sru-log-service'),text('span',!sru?'Chỉ xem':reason?'Không thể điền':chosen===row?'Đang chọn':'Điền vào SRU','sru-log-badge'));button.append(device);
   const name=statusName(row),status=text('span','MStatus '+row.mstatus_dec,'sru-log-status');status.append(text('span',name||'Chưa có mô tả','sru-log-status-name'));button.append(status);
   const data=text('span','','sru-log-data');data.append(text('code',row.mdata_hex||(sru&&!reason?'Không có · chọn dòng sẽ xóa MData cũ':'Không có')));if(reason)data.append(text('span',reason,'sru-log-reason'));button.append(data);
   if(sru&&!reason)button.addEventListener('click',()=>{
    try{core.selection(row);apply(row);chosen=row;provenance.textContent=filename+' · '+row.time+' · #'+row.sequence+' · SRU';provenance.hidden=false;render();document.getElementById('mstatus').scrollIntoView({block:'nearest'});}
    catch(e){state(e.message);}
   });el('rows').appendChild(button);
  }
  if(!filtered.length)el('rows').appendChild(text('p','Không có bản ghi phù hợp.','sru-log-note'));
  el('page').textContent=filtered.length+' dòng · '+(pages?page+1:0)+' / '+pages;
  el('prev').disabled=page===0;el('next').disabled=page>=pages-1;
 }
 function filter(){const q=search.value.trim().toUpperCase(),hex=q.replace(/[-\s]/g,''),service=deviceFilter.value;filtered=records.filter(r=>(!service||(service==='@other'?!core.isSRU(r):JSON.stringify(r.service)===service))&&(!q||[r.time,String(r.sequence),r.service,r.device,r.mstatus_dec,statusName(r),r.mdata_hex].some(v=>String(v??'').toUpperCase().includes(q))||(hex&&r.mdata_hex.replace(/ /g,'').includes(hex))));page=0;render();el('rows').scrollTop=0;}
 function busy(value){el('choose').disabled=value;el('file').disabled=value;el('cancel').hidden=!value;el('progress').hidden=!value;el('clear').hidden=value||!filename;}
 function stop(){generation++;controller?.abort();controller=null;busy(false);}
 async function load(file){
  if(!file)return;
  stop();clearTimeout(timer);const token=generation,active=new AbortController();controller=active;filename=file.name;records=[];filtered=[];page=0;chosen=null;provenance.hidden=true;search.value='';deviceOptions();el('results').hidden=true;
  if(file.size>64*1024*1024){state('File vượt quá 64 MB. Hãy chọn một file Device.log nhỏ hơn.');busy(false);return;}
  busy(true);el('progress').value=0;state('Đang đọc '+filename+'…');
  try{
   const buffer=await file.arrayBuffer();if(token!==generation)return;
   const rows=await core.extractLog(buffer,{signal:active.signal,progress:(count,p)=>{if(token===generation){el('progress').value=p;state('Đang đọc '+filename+' · '+count.toLocaleString('vi-VN')+' bản ghi…');}},yieldTask:()=>new Promise(resolve=>setTimeout(resolve,0))});
   if(token!==generation)return;
   records=rows.sort((a,b)=>b.time.localeCompare(a.time)||b.sequence-a.sequence);filtered=records;
   const sru=records.filter(core.isSRU),valid=sru.filter(r=>{try{core.selection(r);return true;}catch{return false;}}).length;
   state(filename+' · '+records.length+' bản ghi · '+sru.length+' SRU ('+valid+' dòng có thể chọn) · '+(records.length-sru.length)+' bản ghi thiết bị khác (chỉ xem).');deviceOptions();
   el('results').hidden=false;render();
  }catch(e){if(token===generation)state('Không đọc được log: '+e.message);}
  finally{if(token===generation){controller=null;busy(false);el('file').value='';}}
 }
 el('choose').addEventListener('click',()=>el('file').click());el('file').addEventListener('change',()=>load(el('file').files[0]));
 el('cancel').addEventListener('click',()=>{stop();state('Đã dừng đọc log. Các ô nhập được giữ nguyên.');el('file').value='';});
 el('clear').addEventListener('click',()=>{stop();clearTimeout(timer);records=[];filtered=[];filename='';chosen=null;provenance.hidden=true;el('file').value='';search.value='';deviceOptions();el('results').hidden=true;el('clear').hidden=true;state('Đã bỏ log. Các ô nhập được giữ nguyên.');});
 search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(filter,150);});
 deviceFilter.addEventListener('change',()=>{clearTimeout(timer);filter();});
 el('prev').addEventListener('click',()=>{page--;render();el('rows').scrollTop=0;});el('next').addEventListener('click',()=>{page++;render();el('rows').scrollTop=0;});
 const manual=()=>{chosen=null;provenance.hidden=true;if(records.length)render();};
 for(const id of ['mdata','mstatus'])document.getElementById(id).addEventListener('input',manual);
 document.getElementById('sample')?.addEventListener('click',manual);
}
return {mount};
})();
