/* SRU Device.log picker. All processing stays in this browser session. */
window.SRUDeviceLogPanel=(()=>{
'use strict';
function mount({host,getStatus,apply}){
 if(!host||host.querySelector('#sruLogPanel'))return;
 const core=window.SRUDeviceLogCore;
 const style=document.createElement('style');style.textContent=`
 #sruLogPanel{margin:8px 0 20px;border:1px solid #304854;border-radius:12px;background:#101f2b;min-width:0}
 #sruLogPanel summary{cursor:pointer;padding:13px 14px;color:#baf2de;font-weight:650;line-height:1.5;overflow-wrap:anywhere}
 #sruLogPanel .sru-log-body{padding:0 12px 14px;min-width:0}
 #sruLogPanel .sru-log-actions,#sruLogPanel .sru-log-pages{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 #sruLogPanel button{min-height:42px;touch-action:manipulation}
 #sruLogPanel .sru-log-pick{flex:1;background:#194753;border-color:#3d737b;color:#e7fbf4}
 #sruLogPanel .sru-log-note,#sruLogPanel .sru-log-state{font-size:12px;color:#adc0cc;line-height:1.6;margin:10px 0;overflow-wrap:anywhere}
 #sruLogPanel progress{width:100%;height:7px;accent-color:#71cdb4}
 #sruLogPanel input[type=search]{width:100%;min-width:0;font-size:14px;box-sizing:border-box;margin:5px 0 10px}
 #sruLogPanel .sru-log-rows{display:grid;gap:7px;max-height:360px;overflow:auto;overscroll-behavior:contain}
 #sruLogPanel .sru-log-row{display:block;width:100%;min-width:0;text-align:left;white-space:normal;padding:11px;background:#132b38;border:1px solid #344f5d;border-radius:9px;font:inherit;color:#dae8ed;overflow-wrap:anywhere}
 #sruLogPanel .sru-log-row[aria-pressed=true]{background:#1b4247;border-color:#79d0b7;box-shadow:inset 3px 0 #79d0b7}
 #sruLogPanel .sru-log-row:disabled{opacity:.6;cursor:not-allowed}
 #sruLogPanel .sru-log-top{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#adc3ce}
 #sruLogPanel .sru-log-status{display:block;font-size:14px;line-height:1.5;margin:6px 0;font-weight:600}
 #sruLogPanel code{display:block;font:11px/1.6 ui-monospace,Consolas,monospace;overflow-wrap:anywhere;white-space:normal;color:#abc7d4}
 #sruLogPanel .sru-log-reason{display:block;font-size:12px;color:#f4bc93;margin-top:5px}
 #sruLogPanel .sru-log-pages{justify-content:space-between;margin-top:10px;font-size:12px}
 #sruLogSelection{font-size:12px;line-height:1.6;color:#a0d9c9;overflow-wrap:anywhere;margin:0 0 12px}
 #sruLogPanel [hidden],#sruLogSelection[hidden]{display:none!important}
 @media(max-width:600px){#sruLogPanel input[type=search]{font-size:16px}#sruLogPanel .sru-log-rows{max-height:330px}}
 `;document.head.appendChild(style);
 const panel=document.createElement('details');panel.id='sruLogPanel';
 panel.innerHTML=`<summary>Đọc Device log · SRU</summary><div class="sru-log-body">
 <div class="sru-log-actions"><button type="button" class="sru-log-pick" data-log="choose">Mở file log</button><button type="button" data-log="cancel" hidden>Dừng</button><button type="button" data-log="clear" hidden>Bỏ log</button></div>
 <input data-log="file" type="file" accept=".log,.txt,application/octet-stream,text/plain" hidden>
 <p class="sru-log-note">Mở Device.log, rồi bấm MStatus hoặc MData của dòng SRU để điền vào Diagnostic. Bạn vẫn có thể nhập mã trực tiếp.</p>
 <p data-log="state" class="sru-log-state" role="status" aria-live="polite">Chưa chọn file.</p><progress data-log="progress" max="1" value="0" hidden aria-label="Tiến độ đọc log"></progress>
 <div data-log="results" hidden><label for="sruLogSearch">Tìm trong log SRU</label><input id="sruLogSearch" type="search" placeholder="Thời gian, MStatus, MData…" autocomplete="off"><div class="sru-log-rows" data-log="rows"></div>
 <div class="sru-log-pages"><button type="button" data-log="prev" aria-label="Trang log trước">←</button><span data-log="page"></span><button type="button" data-log="next" aria-label="Trang log sau">→</button></div></div></div>`;
 host.querySelector('.section-title').after(panel);
 const provenance=document.createElement('p');provenance.id='sruLogSelection';provenance.hidden=true;panel.after(provenance);
 const el=key=>panel.querySelector('[data-log="'+key+'"]'),search=panel.querySelector('#sruLogSearch');
 let records=[],filtered=[],page=0,chosen=null,filename='',controller=null,generation=0,timer;
 const pageSize=20;
 const text=(tag,value,className)=>{const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n;};
 function state(message){el('state').textContent=message;}
 function render(){
  const pages=Math.ceil(filtered.length/pageSize);page=Math.max(0,Math.min(page,Math.max(0,pages-1)));
  el('rows').replaceChildren();
  for(const row of filtered.slice(page*pageSize,(page+1)*pageSize)){
   const button=document.createElement('button');button.type='button';button.className='sru-log-row';button.setAttribute('aria-pressed',String(chosen===row));button.setAttribute('aria-label','Điền MStatus '+row.mstatus_dec+' và MData của bản ghi SRU số '+row.sequence);button.title='Bấm mã để điền vào SRU Diagnostic';
   const top=document.createElement('span');top.className='sru-log-top';top.append(text('span',row.time),text('span','#'+row.sequence));button.append(top);
   button.append(text('span','MStatus '+row.mstatus_dec+' · '+getStatus(row.mstatus_dec),'sru-log-status'),text('code',row.mdata_hex||'Không có MData · chọn dòng sẽ xóa MData cũ'));
   try{core.selection(row);}catch(e){button.disabled=true;button.append(text('span',e.message,'sru-log-reason'));}
   button.addEventListener('click',()=>{
    try{core.selection(row);apply(row);chosen=row;provenance.textContent=filename+' · '+row.time+' · #'+row.sequence+' · SRU';provenance.hidden=false;render();panel.open=false;document.getElementById('mstatus').scrollIntoView({block:'nearest'});}
    catch(e){state(e.message);}
   });el('rows').appendChild(button);
  }
  if(!filtered.length)el('rows').appendChild(text('p','Không có bản ghi SRU phù hợp.','sru-log-note'));
  el('page').textContent=filtered.length+' dòng · '+(pages?page+1:0)+' / '+pages;
  el('prev').disabled=page===0;el('next').disabled=page>=pages-1;
 }
 function filter(){const q=search.value.trim().toUpperCase(),hex=q.replace(/[-\s]/g,'');filtered=records.filter(r=>!q||[r.time,String(r.sequence),r.mstatus_dec,getStatus(r.mstatus_dec),r.mdata_hex].some(v=>v.toUpperCase().includes(q))||(hex&&r.mdata_hex.replace(/ /g,'').includes(hex)));page=0;render();}
 function busy(value){el('choose').disabled=value;el('file').disabled=value;el('cancel').hidden=!value;el('progress').hidden=!value;el('clear').hidden=value||!filename;}
 function stop(){generation++;controller?.abort();controller=null;busy(false);}
 async function load(file){
  if(!file)return;
  stop();const token=generation,active=new AbortController();controller=active;filename=file.name;records=[];filtered=[];page=0;chosen=null;search.value='';el('results').hidden=true;
  if(file.size>64*1024*1024){state('File vượt quá 64 MB. Hãy chọn một file Device.log nhỏ hơn.');busy(false);return;}
  busy(true);el('progress').value=0;state('Đang đọc '+filename+'…');
  try{
   const buffer=await file.arrayBuffer();if(token!==generation)return;
   const rows=await core.extractLog(buffer,{signal:active.signal,progress:(count,p)=>{if(token===generation){el('progress').value=p;state('Đang đọc '+filename+' · '+count.toLocaleString('vi-VN')+' bản ghi…');}},yieldTask:()=>new Promise(resolve=>setTimeout(resolve,0))});
   if(token!==generation)return;
   records=rows.filter(core.isSRU).sort((a,b)=>b.time.localeCompare(a.time)||b.sequence-a.sequence);filtered=records;
   const valid=records.filter(r=>{try{core.selection(r);return true;}catch{return false;}}).length;
   state(filename+' · Bấm mã để điền vào Diagnostic · '+records.length+' bản ghi SRU · '+valid+' dòng có thể chọn · bỏ qua '+(rows.length-records.length)+' bản ghi thiết bị khác.');
   el('results').hidden=false;render();
  }catch(e){if(token===generation)state('Không đọc được log: '+e.message);}
  finally{if(token===generation){controller=null;busy(false);el('file').value='';}}
 }
 el('choose').addEventListener('click',()=>el('file').click());el('file').addEventListener('change',()=>load(el('file').files[0]));
 el('cancel').addEventListener('click',()=>{stop();state('Đã dừng đọc log. Các ô nhập được giữ nguyên.');el('file').value='';});
 el('clear').addEventListener('click',()=>{stop();records=[];filtered=[];filename='';chosen=null;el('file').value='';search.value='';el('results').hidden=true;el('clear').hidden=true;state('Đã bỏ log. Các ô nhập được giữ nguyên.');});
 search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(filter,150);});
 el('prev').addEventListener('click',()=>{page--;render();el('rows').scrollTop=0;});el('next').addEventListener('click',()=>{page++;render();el('rows').scrollTop=0;});
 const manual=()=>{chosen=null;provenance.hidden=true;if(records.length)render();};
 for(const id of ['mdata','mstatus'])document.getElementById(id).addEventListener('input',manual);
 document.getElementById('sample')?.addEventListener('click',manual);
}
return {mount};
})();
