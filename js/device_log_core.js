
window.SRUDeviceLogCore = (()=>{
"use strict";
const IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
const FP = [40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25];
const E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1];
const P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
const PC1 = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
const PC2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
const SBOX = [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13, 15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9, 10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12, 7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14, 2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3, 12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13, 4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12, 13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11];
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
function perm32(value, table) {
  let result = 0;
  for (let i=0; i<table.length; i++) result = (result << 1) | ((value >>> (32-table[i])) & 1);
  return result >>> 0;
}
const SP = Array.from({length:8},(_,box)=>Uint32Array.from({length:64},(_,x)=>{
  const row=((x&32)>>>4)|(x&1), col=(x>>>1)&15;
  return perm32(SBOX[box*64+row*16+col] << (28-box*4),P);
}));
function keySchedule(key) {
  let c=0,d=0;
  for (let i=0;i<56;i++) {
    const p=PC1[i]-1, bit=(key[p>>>3] >>> (7-(p&7)))&1;
    if (i<28) c=(c<<1)|bit; else d=(d<<1)|bit;
  }
  const keys=new Uint8Array(128);
  for(let round=0;round<16;round++) {
    const s=SHIFTS[round];
    c=((c<<s)|(c>>>(28-s)))&0xfffffff;
    d=((d<<s)|(d>>>(28-s)))&0xfffffff;
    for(let box=0;box<8;box++) {
      let v=0;
      for(let j=0;j<6;j++) {
        const p=PC2[box*6+j];
        v=(v<<1)|((p<=28 ? c>>>(28-p) : d>>>(56-p))&1);
      }
      keys[round*8+box]=v;
    }
  }
  return keys;
}
function desDecrypt(data,key) {
  if(data.length%8) throw new Error('Payload không chia hết cho 8 byte.');
  const keys=keySchedule(key), output=new Uint8Array(data.length);
  for(let offset=0;offset<data.length;offset+=8) {
    let left=0,right=0;
    for(let i=0;i<64;i++) {
      const p=IP[i]-1, bit=(data[offset+(p>>>3)] >>> (7-(p&7)))&1;
      if(i<32) left=(left<<1)|bit; else right=(right<<1)|bit;
    }
    for(let round=15;round>=0;round--) {
      let f=0;
      for(let box=0;box<8;box++) {
        let x=0;
        for(let j=0;j<6;j++) x=(x<<1)|((right>>>(32-E[box*6+j]))&1);
        f^=SP[box][x^keys[round*8+box]];
      }
      const oldRight=right; right=left^f; left=oldRight;
    }
    for(let i=0;i<64;i++) {
      const p=FP[i];
      const bit=(p<=32 ? right>>>(32-p) : left>>>(64-p))&1;
      output[offset+(i>>>3)]|=bit<<(7-(i&7));
    }
  }
  return output;
}
const u32=(a,o)=>{
  if(o<0 || o+4>a.length) throw new Error('Trường DWORD nằm ngoài file.');
  return (a[o]|(a[o+1]<<8)|(a[o+2]<<16)|(a[o+3]<<24))>>>0;
};
const unpackNumber=v=>(v&0x80000000)?0:(v&0x10000000)?v&255:(v&0x20000000)?v&65535:v&0x0fffffff;
const hex=a=>Array.from(a,x=>x.toString(16).padStart(2,'0').toUpperCase()).join(' ');
const pad=n=>String(n).padStart(2,'0');
function cleanTime(a) {
  if(a.length!==16) throw new Error('Timestamp không đủ 16 byte.');
  const t=Uint8Array.from(a); t[1]&=15;
  for(const i of [3,7,9,11,13]) t[i]=0;
  return t;
}
function deriveKey(fileTime,r) {
  const f=cleanTime(fileTime), t=cleanTime(r.subarray(8,24));
  const k=Uint8Array.from([0xa9,0x5c,0xbb,0xd0,0x8a,0xf1,0xcd,0x1b]);
  if(r[4]&1) {
    k[0]|=f[6];const n=r[4]%8;k[1]=((k[1]>>>n)|(k[1]<<(8-n)))&255;
    k[2]&=(~t[6])&255;k[3]^=f[2];k[4]=t[12];k[5]^=(~t[14])&255;k[6]=f[14];k[7]^=f[12];
  } else {
    k[0]=t[14];k[1]^=f[1];k[2]=(~r[5])&255;k[3]^=t[10];k[4]=f[14];k[5]=r[4];k[6]|=t[8];k[7]&=(~f[8])&255;
  }
  return k;
}
function deriveKey0900(fileTime,r) {
  const f=cleanTime(fileTime),t=cleanTime(r.subarray(8,24));
  const k=Uint8Array.from([0xae,0x18,0xf5,0xd3,0x29,0x6b,0xce,0x3a]);
  const rol=(v,n)=>{n%=8;return ((v<<n)|(v>>>(8-n)))&255;};
  const ror=(v,n)=>rol(v,8-n%8);
  if(r[4]&1) {
    k[4]&=f[10];k[3]|=f[12];k[7]^=f[8];k[6]|=t[6];k[3]^=r[5];
    k[0]=ror(k[0],t[10]);k[5]|=r[6];k[2]=rol(k[2],t[12]);
    k[4]^=t[10];k[7]^=r[7];k[1]|=r[4];
  } else {
    k[7]^=t[12];k[1]&=r[5];k[0]^=r[4];k[5]=rol(k[5],t[6]);
    k[2]^=r[6];k[5]^=f[2];k[2]|=f[6];k[4]=ror(k[4],t[8]);
    k[3]|=r[7];k[6]|=t[14]|f[0];
  }
  return k;
}
function eventTime(r,encrypted=true) {
  const a=encrypted?cleanTime(r.subarray(8,24)):r.subarray(8,24), v=Array.from({length:8},(_,i)=>a[i*2]|(a[i*2+1]<<8));
  const [y,m,w,d,h,mi,s,ms]=v;
  const date=new Date(Date.UTC(y,m-1,d,h,mi,s,ms));
  if(y<100 || y>4095 || ms>999 || w>6 || date.getUTCFullYear()!==y || date.getUTCMonth()!==m-1 || date.getUTCDate()!==d || date.getUTCHours()!==h || date.getUTCMinutes()!==mi || date.getUTCSeconds()!==s || date.getUTCDay()!==w) throw new Error('Timestamp không hợp lệ.');
  return `${String(y).padStart(4,'0')}-${pad(m)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(s)}.${String(ms).padStart(3,'0')}`;
}
function asciiZ(a) {
  if(!a.length || a[a.length-1]!==0) throw new Error('Tên thiết bị/service thiếu byte kết thúc.');
  let text='';
  for(let i=0;i<a.length-1;i++) {
    if(a[i]<32 || a[i]>126) throw new Error('Tên thiết bị/service có ký tự không hợp lệ.');
    text+=String.fromCharCode(a[i]);
  }
  return text;
}
function decodeRecord(fileTime,r,offset,version) {
  let d;
  if(version) {
    if(r.length<41 || (r.length-33)%8) throw new Error('Độ dài bản ghi mã hóa không hợp lệ.');
    const padding=r[r.length-1];
    if(padding>7) throw new Error('Số byte padding không hợp lệ.');
    const key=version===0x0900?deriveKey0900(fileTime,r):deriveKey(fileTime,r);
    const plain=desDecrypt(r.subarray(32,r.length-1),key);
    d=plain.subarray(0,plain.length-padding);
  } else d=r.subarray(32);
  if(d.length<28) throw new Error('Payload sau giải mã quá ngắn.');
  const [kind,tcode,sl,ml,rl,dl,nl]=Array.from({length:7},(_,i)=>u32(d,i*4));
  if(kind!==5) throw new Error(`Loại event ${kind} chưa được hỗ trợ (cần device event 5).`);
  if(ml<2 || dl<1 || nl<1 || 28+sl+ml+rl+dl+nl>d.length) throw new Error('Độ dài các trường sau giải mã không hợp lệ.');
  let pos=28;const fields=[];
  for(const size of [sl,ml,rl,dl,nl]) {fields.push(d.subarray(pos,pos+size));pos+=size;}
  const [sd,m,rc,device,service]=fields;
  return {sequence:u32(r,4),time:eventTime(r,!!version),service:asciiZ(service),device:asciiZ(device),
    mstatus_dec:pad(m[1]),mstatus_hex:hex(m.subarray(1,2)),mdata_length:m.length-2,mdata_hex:hex(m.subarray(2)),
    tcode,sdata_hex:hex(sd),rcdata_hex:hex(rc),manufacturer_prefix_hex:hex(m.subarray(0,1)),offset,
    record_length:r.length,payload_tail_hex:hex(d.subarray(pos))};
}
async function extractLog(input,options={}) {
  const a=input instanceof Uint8Array ? input : new Uint8Array(input);
  if(a.length<36) throw new Error('File quá ngắn: cần header ít nhất 36 byte.');
  const encrypted=[0,0,36,36,0].every((x,i)=>u32(a,i*4)===x);
  const version=encrypted?((a[24]|a[25]<<8)&0xff00):0;
  if(encrypted && version!==0x0200 && version!==0x0900) throw new Error(`Định dạng mã hóa 0x${version.toString(16).padStart(4,'0')} chưa được hỗ trợ.`);
  const base=encrypted?36:0,headerSize=base+36,unpack=encrypted?unpackNumber:v=>v;
  if(a.length<headerSize || (!encrypted && u32(a,12)!==36)) throw new Error('Không nhận diện được header Device.log. Hãy chọn log nhị phân gốc (.log hoặc .txt), không chọn bản xuất văn bản hoặc ZIP.');
  const fileTime=a.subarray(base+20,base+36);
  if(encrypted && cleanTime(fileTime).some((x,i)=>x!==cleanTime(a.subarray(20,36))[i])) throw new Error('Hai timestamp trong header không khớp.');
  const first=unpack(u32(a,base)),last=unpack(u32(a,base+4));
  if(!first&&!last) return [];
  if(!first||!last) throw new Error('Con trỏ đầu/cuối file không nhất quán.');
  let offset=first,previous=0,consumed=0;
  const rows=[],seen=new Set(),intervals=[];
  while(offset) {
    if(options.signal?.aborted) throw new Error('Đã dừng giải mã.');
    if(seen.has(offset)) throw new Error(`Chuỗi con trỏ bị lặp tại offset ${offset}.`);
    seen.add(offset);
    if(offset<headerSize||offset+32>a.length) throw new Error(`Con trỏ nằm ngoài file: ${offset}.`);
    const size=unpack(u32(a,offset));
    if(size<60||offset+size>a.length) throw new Error(`Độ dài bản ghi không hợp lệ tại offset ${offset}.`);
    const r=a.subarray(offset,offset+size);
    if(unpack(u32(r,28))!==previous) throw new Error(`Con trỏ bản ghi trước bị sai tại offset ${offset}.`);
    let row;
    try {row=decodeRecord(fileTime,r,offset,version);} catch(e) {throw new Error(`Offset ${offset}: ${e.message}`);}
    if(rows.length&&row.sequence<=rows[rows.length-1].sequence) throw new Error('Sequence không tăng: file hỏng hoặc kiểu quay vòng sequence chưa hỗ trợ.');
    rows.push(row);intervals.push([offset,offset+size]);consumed+=size;
    const next=unpack(u32(r,24));
    if(offset===last) {
      if(next) throw new Error('Bản ghi cuối vẫn có con trỏ next.');
      break;
    }
    previous=offset;offset=next;
    if(rows.length%128===0) {
      options.progress?.(rows.length,Math.min(0.99,consumed/a.length));
      if(options.yieldTask) await options.yieldTask();
    }
  }
  if(!rows.length||rows[rows.length-1].offset!==last) throw new Error('Chuỗi bản ghi chưa tới vị trí cuối được khai báo.');
  if(rows[rows.length-1].sequence!==u32(a,base+16)) throw new Error('Sequence cuối không khớp header.');
  intervals.sort((a,b)=>a[0]-b[0]);
  if(intervals.some((v,i)=>i>0&&intervals[i-1][1]>v[0])) throw new Error('Các bản ghi đang hoạt động bị chồng lấn.');
  options.progress?.(rows.length,1);
  return rows;
}

// Device identity must come from the decoded service field, never filenames or MData length.
function isSRU(row){return row?.service === 'SRU_RECYCLER';}
function selection(row){
 if(!isSRU(row))throw new Error('Chỉ được chọn bản ghi SRU_RECYCLER.');
 const status=String(row.mstatus_dec??'');
 if(!/^\d{1,2}$/.test(status)||Number(status)>99)throw new Error('MStatus ngoài phạm vi 00–99; không tự điền.');
 const raw=String(row.mdata_hex??'').trim();
 if(row.mdata_length===0&&!raw)return {mstatus:status.padStart(2,'0'),mdata:''};
 if(row.mdata_length!==18||!/^([0-9a-f]{2}\s+){17}[0-9a-f]{2}$/i.test(raw))throw new Error('MData cần đúng 18 byte; không tự điền bản ghi này.');
 return {mstatus:status.padStart(2,'0'),mdata:raw.toUpperCase().split(/\s+/).join('-')};
}
return {extractLog,isSRU,selection};
})();
