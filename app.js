"use strict";
var BASE_IMG = "assets/label-bg.png";

/* ======================================================================
   ПОЛЯ: стандартные + свои (общие для всех типов наклеек и библиотеки)
   ====================================================================== */
var STDF=[
 {k:'roaster',label:'Обжарщик',    d:{x:46.9,b:51.3,w:47.8,fs:4.2,a:'left'}},
 {k:'country',label:'Страна',      d:{x:35.2,b:43.4,w:59.5,fs:4.2,a:'left'}},
 {k:'name',   label:'Название',    d:{x:42.2,b:35.5,w:52.5,fs:4.2,a:'left'}},
 {k:'process',label:'Обработка',   d:{x:46.9,b:27.6,w:47.8,fs:4.2,a:'left'}},
 {k:'q',      label:'Q (балл)',    d:{x:14.0,b:19.7,w:29.4,fs:4.2,a:'left'}},
 {k:'m',      label:'m (вес)',     d:{x:56.0,b:19.7,w:38.6,fs:4.2,a:'left'}},
 {k:'roast',  label:'Дата обжарки',d:{x:58.5,b:11.7,w:36.2,fs:4.0,a:'left'},date:1},
 {k:'pack',   label:'Дата упаковки',d:{x:60.9,b:3.8,w:33.8,fs:4.0,a:'left'},date:1,today:1}
];
var CUSTOM=[], FIELDS=STDF.slice();
function rebuildFields(){ FIELDS=STDF.concat(CUSTOM); }
function fieldDef(k){ for(var i=0;i<FIELDS.length;i++) if(FIELDS[i].k===k) return FIELDS[i]; return null; }
function allKeys(){ return FIELDS.map(function(f){ return f.k; }); }
function defPos(f){ return Object.assign({x:8,b:5,w:84,fs:4.2,a:'left'},(f&&f.d)||{}); }
var DEF_W=874, DEF_H=1118;

/* ---------- тип наклейки ---------- */
function defSettings(){
  var f={}; STDF.forEach(function(x){ f[x.k]=Object.assign(defPos(x),{on:1}); });
  return {v:3,font:"Georgia,serif",color:'#3b2416',weight:600,italic:0,dateFmt:'dd.mm.yyyy',guides:0,
    fields:f, page:{orient:'landscape',cols:4,rows:2,lw:68,gx:3,gy:4,mx:8,my:8,cut:0},
    bg:null,bgW:DEF_W,bgH:DEF_H};
}
function newId(){ return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function normType(o){
  o=(o&&typeof o==='object')?o:{};
  var d=defSettings(), t=Object.assign({},d,o);
  t.page=Object.assign({},d.page,o.page||{});
  if(!o.fields){ t.fields=d.fields; }
  else {
    t.fields={};
    Object.keys(o.fields).forEach(function(k){
      var src=o.fields[k]||{};
      t.fields[k]=Object.assign(defPos(fieldDef(k)),src);
      if(!('on' in src)) t.fields[k].on=1;   // старые настройки: всё печатается
    });
  }
  if(!o.v || o.v<3){ STDF.forEach(function(f){ if(!t.fields[f.k]) t.fields[f.k]=Object.assign(defPos(f),{on:1}); }); }
  if(!o.v || o.v<2){ t.font=d.font; t.weight=d.weight; }
  t.v=3;
  if(!t.id) t.id=newId();
  if(!t.name) t.name='Основная';
  if(!t.bgW||!t.bgH){ t.bgW=DEF_W; t.bgH=DEF_H; }
  return t;
}
function aspect(){ return (S.bgH||DEF_H)/(S.bgW||DEF_W); }
function isOn(k){ return !!(S.fields[k]&&S.fields[k].on); }
function getF(k){ if(!S.fields[k]) S.fields[k]=Object.assign(defPos(fieldDef(k)),{on:0}); return S.fields[k]; }

var TYPES=[], CUR='', SHEETS={}, S=null, LIB=[], SHEET=[], editIdx=-1, DELETED={}, editLotId='';
function typeById(id){ for(var i=0;i<TYPES.length;i++) if(TYPES[i].id===id) return TYPES[i]; return null; }

/* ---------- storage ---------- */
function ls(k,v){
  try{ if(v===undefined){ var r=localStorage.getItem(k); return r?JSON.parse(r):null; } localStorage.setItem(k,JSON.stringify(v)); }
  catch(e){ if(v!==undefined) toast('Не удалось сохранить в браузер'); return null; }
}
function saveAll(){
  if(CUR) SHEETS[CUR]=SHEET;
  ls('sk_types',TYPES); ls('sk_curtype',CUR); ls('sk_sheets',SHEETS);
  ls('sk_custom_fields',CUSTOM); ls('sk_lib',LIB); ls('sk_deleted',DELETED);
  if(typeof libChanged==='function') libChanged();
}
function loadAll(){
  var cf=ls('sk_custom_fields'); CUSTOM=Array.isArray(cf)?cf:[]; rebuildFields();
  var l=ls('sk_lib'); LIB=Array.isArray(l)?l:[];
  var dl=ls('sk_deleted'); DELETED=(dl&&typeof dl==='object')?dl:{};
  LIB.forEach(ensureLotMeta);
  var ts=ls('sk_types');
  if(Array.isArray(ts)&&ts.length){
    TYPES=ts.map(normType);
    var sh=ls('sk_sheets'); SHEETS=(sh&&typeof sh==='object')?sh:{};
  } else {
    // миграция со старой версии: настройки → тип «Основная», лист → его лист
    var t=normType(ls('sk_settings')); t.name='Основная';
    TYPES=[t]; SHEETS={};
    var osh=ls('sk_sheet'); SHEETS[t.id]=Array.isArray(osh)?osh:[];
  }
  var added=seedPresets();
  var c=ls('sk_curtype'); useType(typeById(c)?c:TYPES[0].id);
  if(!Array.isArray(ts)||!ts.length||added) saveAll();
}

/* ---------- готовые шаблоны (assets/templates, рисуются tools/templates.py) ---------- */
var PRESETS=window.PRESETS||[];
function presetById(pid){ for(var i=0;i<PRESETS.length;i++) if(PRESETS[i].pid===pid) return PRESETS[i]; return null; }
function presetType(p,id){
  var t=normType(JSON.parse(JSON.stringify({v:3,font:p.font,color:p.color,weight:p.weight,italic:p.italic||0,
    fields:p.fields,page:p.page,name:p.name})));
  t.id=id||('p_'+p.pid); t.pid=p.pid; t.presetBg=p.bg; t.bg=null; t.bgW=p.bgW; t.bgH=p.bgH;
  return t;
}
function defBg(t){ return (t&&t.presetBg)||BASE_IMG; }
function defDims(t){ var p=t&&t.pid&&presetById(t.pid); return p?{w:p.bgW,h:p.bgH}:{w:DEF_W,h:DEF_H}; }
// новые шаблоны добавляются один раз; удалённые пользователем не возвращаются сами
function seedPresets(force){
  var seen=ls('sk_presets')||[], n=0;
  PRESETS.forEach(function(p){
    if(!force && seen.indexOf(p.pid)>=0) return;
    if(TYPES.some(function(t){ return t.pid===p.pid; })) return;
    var t=presetType(p); TYPES.push(t); SHEETS[t.id]=[]; n++;
    if(seen.indexOf(p.pid)<0) seen.push(p.pid);
  });
  ls('sk_presets',seen);
  return n;
}
function useType(id){
  CUR=id; S=typeById(id);
  if(!Array.isArray(SHEETS[id])) SHEETS[id]=[];
  SHEET=SHEETS[id];
}

/* ---------- фон (IndexedDB — картинки большие для localStorage) ---------- */
var IDB=null;
function idbOpen(){
  if(IDB) return Promise.resolve(IDB);
  return new Promise(function(res,rej){
    try{
      var r=indexedDB.open('sk_db',1);
      r.onupgradeneeded=function(){ r.result.createObjectStore('kv'); };
      r.onsuccess=function(){ IDB=r.result; res(IDB); };
      r.onerror=function(){ rej(r.error); };
    }catch(e){ rej(e); }
  });
}
function idbReq(mode,fn){
  return idbOpen().then(function(db){ return new Promise(function(res,rej){
    var tx=db.transaction('kv',mode), rq=fn(tx.objectStore('kv'));
    tx.oncomplete=function(){ res(rq&&rq.result); };
    tx.onerror=function(){ rej(tx.error); };
  }); });
}
function idbGet(k){ return idbReq('readonly',function(s){ return s.get(k); }); }
function idbSet(k,v){ return idbReq('readwrite',function(s){ return s.put(v,k); }); }
function idbDel(k){ return idbReq('readwrite',function(s){ return s.delete(k); }); }

var curBg=BASE_IMG, baseImgEl=new Image(), bgToken=0;
baseImgEl.src=BASE_IMG;
function loadBg(){
  var my=++bgToken, t=S;
  var p=t.bg ? idbGet(t.bg).catch(function(){ return null; }) : Promise.resolve(null);
  return p.then(function(data){
    if(my!==bgToken) return;
    if(t.bg && !data){ toast('Фон типа не найден — показан стандартный'); var dd=defDims(t); t.bgW=dd.w; t.bgH=dd.h; t.bg=null; saveAll(); }
    return applyBg(data||defBg(t));
  });
}
function applyBg(src){
  curBg=src;
  return new Promise(function(res){
    var im=new Image(); im.onload=im.onerror=function(){ res(); }; im.src=src; baseImgEl=im;
  }).then(function(){ renderSheet(); renderPreview(); bgInfo(); });
}
function bgInfo(){
  var e=$('bgInfo'); if(!e) return;
  e.textContent=(S.bg?'Свой фон':'Стандартный фон')+' · '+S.bgW+'×'+S.bgH+' px';
}
function dataUrlToBlob(u){
  var m=/^data:([^;,]+)(;base64)?,(.*)$/.exec(u); if(!m) return null;
  var bin=m[2]?atob(m[3]):decodeURIComponent(m[3]), arr=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:m[1]});
}
function slug(s){ return String(s).trim().replace(/[^\wа-яё-]+/gi,'_')||'tip'; }
function downloadBg(){
  var p=/^data:/.test(curBg)?Promise.resolve(dataUrlToBlob(curBg)):fetch(curBg).then(function(r){ return r.blob(); });
  p.then(function(b){
    if(!b){ toast('Не получилось'); return; }
    var ext=(b.type.split('/')[1]||'png').replace('jpeg','jpg');
    dlBlob(b,'fon-'+slug(S.name)+'.'+ext);
  }).catch(function(){ toast('Не получилось'); });
}
function pickImage(cb){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=function(){ var f=inp.files[0]; if(!f) return; var fr=new FileReader();
    fr.onload=function(){ cb(String(fr.result)); }; fr.readAsDataURL(f); };
  inp.click();
}
function uploadBg(){
  pickImage(function(data){
    var im=new Image();
    im.onload=function(){
      var t=S, key='bg_'+t.id;
      idbSet(key,data).then(function(){
        t.bg=key; t.bgW=im.naturalWidth; t.bgH=im.naturalHeight; saveAll();
        applyBg(data); pageInfo();
        toast('Фон загружен: '+t.bgW+'×'+t.bgH);
      }).catch(function(){ toast('Не удалось сохранить фон'); });
    };
    im.onerror=function(){ toast('Это не картинка'); };
    im.src=data;
  });
}
function resetBg(){
  if(!S.bg){ toast('И так стандартный'); return; }
  if(!confirm('Вернуть стандартный фон для «'+S.name+'»?')) return;
  var dd=defDims(S); idbDel(S.bg).catch(function(){}); S.bg=null; S.bgW=dd.w; S.bgH=dd.h; saveAll();
  applyBg(defBg(S)); pageInfo(); toast('Стандартный фон');
}

/* ---------- utils ---------- */
function $(id){ return document.getElementById(id); }
function el(t,c){ var e=document.createElement(t); if(c) e.className=c; return e; }
function toast(m){ var t=$('toast'); if(!t) return; t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('on');},1900); }
function pad(n){ return n<10?'0'+n:''+n; }
function today(){
  var d=new Date(), y=d.getFullYear(), m=pad(d.getMonth()+1), dd=pad(d.getDate());
  if(S.dateFmt==='dd.mm.yy') return dd+'.'+m+'.'+String(y).slice(2);
  if(S.dateFmt==='yyyy-mm-dd') return y+'-'+m+'-'+dd;
  return dd+'.'+m+'.'+y;
}
function fontCss(){ return S.font==='system' ? '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif' : S.font; }
function titleOf(it){ return (it.name||it.roaster||it.country||'без названия'); }
function subOf(it){ return [it.roaster,it.country,it.process].filter(Boolean).join(' · '); }
function blank(){ var o={}; FIELDS.forEach(function(f){o[f.k]='';}); return o; }
function copy(it){ var o={}; FIELDS.forEach(function(f){o[f.k]=it[f.k]||'';}); return o; }
function isEmpty(it){ return FIELDS.every(function(f){ return !String(it[f.k]||'').trim(); }); }

/* ---------- маска даты: точки подставляются сами ---------- */
function dateGroups(){
  if(S.dateFmt==='yyyy-mm-dd') return {g:[4,2,2],s:'-'};
  if(S.dateFmt==='dd.mm.yy') return {g:[2,2,2],s:'.'};
  return {g:[2,2,4],s:'.'};
}
function maskDate(inp,e){
  var v=inp.value;
  if(/[A-Za-zА-Яа-яЁё]/.test(v)) return;           // свободный текст не трогаем
  var del=!!(e&&e.inputType&&e.inputType.indexOf('delete')===0);
  var caret=(inp.selectionStart==null)?v.length:inp.selectionStart, atEnd=caret>=v.length;
  var G=dateGroups(), total=G.g.reduce(function(a,b){return a+b;},0);
  var segs=v.split(/\D+/);
  if(!del && segs.length>1){                       // «1.5.» → «01.05.»
    for(var s=0;s<segs.length-1 && s<G.g.length-1;s++){
      if(segs[s].length && segs[s].length<G.g[s]){ while(segs[s].length<G.g[s]) segs[s]='0'+segs[s]; }
    }
  }
  var d=segs.join('').slice(0,total);
  var out='',pos=0;
  for(var i=0;i<G.g.length;i++){
    var part=d.substr(pos,G.g[i]); if(!part) break;
    if(i) out+=G.s; out+=part; pos+=part.length;
    if(part.length<G.g[i]) break;
  }
  if(!del && atEnd){
    var cum=0;
    for(var j=0;j<G.g.length-1;j++){ cum+=G.g[j]; if(d.length===cum){ out+=G.s; break; } }
  }
  if(out===v) return;
  inp.value=out;
  var p=out.length;
  if(!atEnd){
    var digitsBefore=v.slice(0,caret).replace(/\D/g,'').length, c=0; p=0;
    while(p<out.length && c<digitsBefore){ if(/\d/.test(out[p])) c++; p++; }
  }
  try{ inp.setSelectionRange(p,p); }catch(_){}
}

/* ---------- form ---------- */
function buildForm(){
  var w=$('form'); w.innerHTML='';
  FIELDS.forEach(function(f,fi){
    var on=isOn(f.k);
    var d=el('div','fwrap'+(on?'':' off')); d.style.marginBottom='6px';
    var l=el('label','fl'); l.textContent=f.label+(on?'':' — не печатается на «'+S.name+'»'); d.appendChild(l);
    var r=el('div','row');
    var i=el('input'); i.id='in_'+f.k; i.autocomplete='off'; i.placeholder=f.label;
    if(f.date){ i.inputMode='numeric'; i.placeholder=f.label+' ('+(S.dateFmt==='yyyy-mm-dd'?'гггг-мм-дд':(S.dateFmt==='dd.mm.yy'?'дд.мм.гг':'дд.мм.гггг'))+')'; }
    r.appendChild(i);
    if(f.today){
      var b=el('button','sm'); b.type='button'; b.textContent='сегодня'; b.title='Поставить сегодняшнюю дату';
      b.onclick=function(){ i.value=today(); renderPreview(); };
      r.appendChild(b);
    }
    d.appendChild(r);
    var sg=null;
    if(AC_KEYS[f.k]){ sg=el('div','sugg'); d.appendChild(sg); }
    w.appendChild(d);
    i.addEventListener('keydown',function(e){
      if(e.key==='Tab'||e.key==='Enter'){ var s2=inp_sugg(i); if(s2) s2.classList.remove('on'); }
      if(e.key!=='Enter') return;
      e.preventDefault();
      if(e.ctrlKey||e.metaKey||e.shiftKey){ $('btnAdd').click(); return; }
      var nxt=$('in_'+(FIELDS[fi+1]||{}).k);
      if(nxt){ nxt.focus(); nxt.select(); }
      else { $('btnAdd').click(); var first=$('in_'+FIELDS[0].k); if(first){ first.focus(); first.select(); } }
    });
    i.addEventListener('input',function(e){ if(f.date) maskDate(i,e); if(sg) autoComplete(i,f.k,sg,e); renderPreview(); });
    if(sg){
      i.addEventListener('blur',function(){ sg.classList.remove('on'); });
      i.addEventListener('focus',function(){ showSugg(i,f.k,sg,i.value.slice(0,i.selectionStart==null?i.value.length:i.selectionStart)); });
    }
  });
}

/* ---------- подсказки: обжарщик, страна, обработка ---------- */
var AC_KEYS={roaster:1,country:1,process:1};
function acValues(k){
  var cnt={}, show={};
  LIB.concat(SHEET).forEach(function(it){
    var v=String(it[k]||'').trim(); if(!v) return;
    var key=v.toLowerCase(); cnt[key]=(cnt[key]||0)+1; if(!show[key]) show[key]=v;
  });
  return Object.keys(cnt).sort(function(a,b){ return (cnt[b]-cnt[a]) || show[a].localeCompare(show[b],'ru'); })
    .map(function(key){ return show[key]; });
}
function acMatches(k,typed){
  var t=typed.trim().toLowerCase(); if(!t) return [];
  return acValues(k).filter(function(v){ return v.toLowerCase().indexOf(t)===0 && v.toLowerCase()!==t; });
}
function autoComplete(inp,k,sg,e){
  var v=inp.value, del=!!(e&&e.inputType&&e.inputType.indexOf('delete')===0);
  var atEnd=inp.selectionStart==null || inp.selectionStart>=v.length;
  var m=acMatches(k,v);
  if(!del && atEnd && m.length){
    // дописываем первое совпадение, хвост выделен — Enter/Tab оставляют его, ввод продолжения заменяет
    inp.value=m[0];
    try{ inp.setSelectionRange(v.length,inp.value.length); }catch(_){}
  }
  showSugg(inp,k,sg,v);
}
function showSugg(inp,k,sg,typed){
  var m=acMatches(k,typed).slice(0,6);
  sg.innerHTML='';
  if(!m.length || document.activeElement!==inp){ sg.classList.remove('on'); return; }
  m.forEach(function(v){
    var b=el('button'); b.type='button'; b.textContent=v;
    b.onmousedown=function(e){ e.preventDefault(); };
    b.onclick=function(){ inp.value=v; sg.classList.remove('on'); try{ inp.setSelectionRange(v.length,v.length); }catch(_){} renderPreview(); };
    sg.appendChild(b);
  });
  sg.classList.add('on');
}
function inp_sugg(i){ var n=i.parentNode&&i.parentNode.nextSibling; return (n&&n.classList&&n.classList.contains('sugg'))?n:null; }
function rebuildForm(){ var v=formGet(); buildForm(); formSet(v); }
function formGet(){ var o={}; FIELDS.forEach(function(f){ var e=$('in_'+f.k); o[f.k]=e?(e.value||'').trim():''; }); return o; }
function formSet(it){ FIELDS.forEach(function(f){ var e=$('in_'+f.k); if(e) e.value=it[f.k]||''; }); renderPreview(); }

/* ---------- label rendering ---------- */
function labelNode(item,wCss,hCss){
  var d=el('div','label');
  d.style.width=wCss; d.style.height=hCss;
  d.style.setProperty('--lh',hCss);
  d.style.fontFamily=fontCss();
  d.style.color=S.color;
  d.style.fontWeight=S.weight;
  d.style.fontStyle=S.italic==1?'italic':'normal';
  var bg=el('img','bg'); bg.src=curBg; bg.alt=''; d.appendChild(bg);
  FIELDS.forEach(function(f){
    if(!isOn(f.k)) return;                          // поля нет в этом типе — не пишем
    var c=S.fields[f.k], v=String(item[f.k]||'').trim();
    var box=el('div','fbox'); box.dataset.k=f.k;
    box.style.left=c.x+'%'; box.style.bottom=c.b+'%'; box.style.width=c.w+'%';
    box.style.fontSize='calc(var(--lh) * '+(c.fs/100)+')';
    box.dataset.fs=c.fs;
    box.style.justifyContent = c.a==='center'?'center':(c.a==='right'?'flex-end':'flex-start');
    var sp=el('span','ftext'); sp.textContent=v;
    sp.style.transformOrigin=(c.a==='center'?'center':(c.a==='right'?'right':'left'))+' bottom';
    box.appendChild(sp); d.appendChild(box);
  });
  return d;
}
var STEP=0.94, MAXSTEP=12;
function fit(root){
  var boxes=root.querySelectorAll('.fbox');
  for(var i=0;i<boxes.length;i++){
    var box=boxes[i], sp=box.firstChild;
    if(!sp || !sp.textContent) continue;
    var base=parseFloat(box.dataset.fs);
    if(!base) continue;
    sp.style.transform='none';
    box.style.fontSize='calc(var(--lh) * '+(base/100)+')';
    var bw=box.getBoundingClientRect().width, sw=sp.getBoundingClientRect().width;
    if(!bw || !sw) continue;
    if(sw<=bw+0.3){ continue; }
    var k=Math.ceil(Math.log(bw/sw)/Math.log(STEP));
    if(k<1) k=1; if(k>MAXSTEP) k=MAXSTEP;
    box.style.fontSize='calc(var(--lh) * '+(base*Math.pow(STEP,k)/100)+')';
    var sw2=sp.getBoundingClientRect().width;
    if(sw2>bw+0.3) sp.style.transform='scale('+(bw/sw2)+')';
  }
}

/* ---------- sheet ---------- */
function pageDims(){
  var p=S.page, w=(p.orient==='portrait')?210:297, h=(p.orient==='portrait')?297:210;
  var lw=+p.lw, lh=lw*aspect();
  return {w:w,h:h,lw:lw,lh:lh};
}
function perPage(){ return Math.max(1,(+S.page.cols||1)*(+S.page.rows||1)); }
function renderSheet(){
  var pages=$('pages'); pages.innerHTML='';
  var D=pageDims(), pp=perPage(), p=S.page;
  var n=Math.max(1,Math.ceil(SHEET.length/pp));
  for(var pi=0;pi<n;pi++){
    var pg=el('div','page');
    pg.style.width=D.w+'mm'; pg.style.height=(D.h-0.2)+'mm'; pg.style.overflow='hidden';
    pg.style.padding=p.my+'mm '+p.mx+'mm';
    pg.style.gridTemplateColumns='repeat('+p.cols+', '+D.lw+'mm)';
    pg.style.gap=p.gy+'mm '+p.gx+'mm';
    if(+p.cut) pg.classList.add('cut');
    if(+S.guides) pg.classList.add('guides');
    for(var i=0;i<pp;i++){
      var idx=pi*pp+i;
      var slot=el('div','slot');
      slot.style.width=D.lw+'mm'; slot.style.height=D.lh+'mm';
      if(idx<SHEET.length){
        slot.appendChild(labelNode(SHEET[idx],D.lw+'mm',D.lh+'mm'));
        var num=el('div','slotnum'); num.textContent=(idx+1); slot.appendChild(num);
        var tools=el('div','tools');
        tools.appendChild(mkBtn('⧉','Дублировать',dupAt,idx));
        tools.appendChild(mkBtn('✎','В форму',editAt,idx));
        tools.appendChild(mkBtn('✕','Удалить',delAt,idx));
        slot.appendChild(tools);
      } else {
        slot.className='slot ph'; slot.textContent='пусто';
      }
      pg.appendChild(slot);
    }
    pages.appendChild(pg);
  }
  $('counter').textContent=SHEET.length+' накл. · '+n+' стр.';
  var nc=$('navCount'); if(nc) nc.textContent=SHEET.length?SHEET.length:'';
  scaleSheet();
  fit(pages);
  renderSheetList();
}
function mkBtn(t,title,fn,idx){ var b=el('button'); b.textContent=t; b.title=title; b.onclick=function(e){ e.stopPropagation(); fn(idx); }; return b; }
function scaleSheet(){
  var wrap=$('sheetWrap'), sc=$('sheetScale'), pages=$('pages');
  var D=pageDims(), px=D.w*96/25.4;
  var k=Math.min(1, (wrap.clientWidth||px)/px);
  sc.style.transform='scale('+k+')';
  wrap.style.height=(pages.scrollHeight*k)+'px';
}
function renderSheetList(){
  var ul=$('sheetList'); ul.innerHTML='';
  if(!SHEET.length){ var li0=el('li'); li0.innerHTML='<span class="t s">Лист «'+esc(S.name)+'» пуст — заполни форму и жми «На лист».</span>'; ul.appendChild(li0); return; }
  SHEET.forEach(function(it,i){
    var li=el('li');
    var t=el('div','t'); t.innerHTML='<b>'+(i+1)+'.</b> '+esc(titleOf(it))+'<div class="s">'+esc(subOf(it))+'</div>';
    li.appendChild(t);
    li.appendChild(mkBtn('⧉','Дублировать',dupAt,i));
    li.appendChild(mkBtn('✎','В форму',editAt,i));
    li.appendChild(mkBtn('✕','Удалить',delAt,i));
    ul.appendChild(li);
  });
}
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function dupAt(i){ SHEET.splice(i+1,0,copy(SHEET[i])); saveAll(); renderSheet(); }
function delAt(i){ SHEET.splice(i,1); saveAll(); renderSheet(); }
function editAt(i){ formSet(SHEET[i]); editIdx=i; editLotId=''; resetAddBtn(); $('btnAdd').textContent='✔ Сохранить в №'+(i+1); setView('make'); toast('Правим наклейку №'+(i+1)); }

/* ---------- база лотов (общая для всех типов, синхронизируется с GitHub) ---------- */
function nowIso(){ return new Date().toISOString(); }
function lotId(){ return 'l'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function ensureLotMeta(it){
  if(!it.id) it.id=lotId();
  if(!it.added) it.added=it.updated||nowIso();
  if(!it.updated) it.updated=it.added;
  return it;
}
function lotById(id){ for(var i=0;i<LIB.length;i++) if(LIB[i].id===id) return LIB[i]; return null; }
function lotKey(it){ return ['roaster','name','country','process'].map(function(k){ return String(it[k]||'').trim().toLowerCase(); }).join('|'); }
function removeLot(it){
  var i=LIB.indexOf(it); if(i<0) return;
  LIB.splice(i,1); DELETED[it.id]=nowIso();
}

// из базы — дата упаковки всегда сегодняшняя
function fromLib(it){ var o=copy(it); o.pack=today(); return o; }
var LIB_ROASTER='', LOT_Q='', LOT_SORT='added', LOT_GROUP='roaster', COLLAPSED={};
function cmpRu(a,b){ return String(a).localeCompare(String(b),'ru',{sensitivity:'base',numeric:true}); }
function parseD(s){
  s=String(s||'').trim(); var m;
  if((m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return new Date(+m[1],+m[2]-1,+m[3]).getTime();
  if((m=/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/.exec(s))){
    var y=+m[3]; if(y<100) y+=2000;
    return new Date(y,+m[2]-1,+m[1]).getTime();
  }
  return NaN;
}
function parseQ(s){ var m=/(\d{2})(?:\s*[.,]\s*(\d+))?/.exec(String(s||'')); return m?parseFloat(m[1]+'.'+(m[2]||'0')):NaN; }
var MONTHS=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
function daysSince(t){ if(isNaN(t)) return NaN; var d=new Date(); d.setHours(0,0,0,0); return Math.round((d.getTime()-t)/864e5); }
function freshTag(it){
  var d=daysSince(parseD(it.roast)); if(isNaN(d)) return '';
  var cls=d<7?'f1':(d<=35?'f2':(d<=70?'f3':'f4'));
  var txt=d<0?'через '+(-d)+' дн.':(d===0?'сегодня':d+' дн.');
  var tip=d<7?'отдыхает':(d<=35?'в самом соку':(d<=70?'стоит поторопиться':'давно обжарен'));
  return ' <i class="fresh '+cls+'" title="'+tip+'">· '+txt+'</i>';
}
function fieldLabel(k){ var f=fieldDef(k); return f?f.label:k; }

function filteredLots(){
  var q=LOT_Q.trim().toLowerCase();
  return LIB.filter(function(it){
    if(LIB_ROASTER && String(it.roaster||'').trim().toLowerCase()!==LIB_ROASTER) return false;
    if(!q) return true;
    return allKeys().some(function(k){ return String(it[k]||'').toLowerCase().indexOf(q)>=0; });
  });
}
function sortLots(list){
  var by={
    added:function(a,b){ return String(b.added).localeCompare(String(a.added)); },
    roast_desc:function(a,b){ return (parseD(b.roast)||0)-(parseD(a.roast)||0); },
    roast_asc:function(a,b){ return (parseD(a.roast)||9e15)-(parseD(b.roast)||9e15); },
    pack_desc:function(a,b){ return (parseD(b.pack)||0)-(parseD(a.pack)||0); },
    name:function(a,b){ return cmpRu(titleOf(a),titleOf(b)); },
    q:function(a,b){ return (parseQ(b.q)||0)-(parseQ(a.q)||0); }
  }[LOT_SORT]||function(){ return 0; };
  return list.slice().sort(function(a,b){ return by(a,b)||cmpRu(titleOf(a),titleOf(b)); });
}
function groupLots(list){
  if(LOT_GROUP==='none') return [{key:'',title:'',items:list}];
  var map={}, order=[];
  list.forEach(function(it){
    var key,title,ord;
    if(LOT_GROUP==='roaster'){ title=String(it.roaster||'').trim()||'Без обжарщика'; key=title.toLowerCase(); ord=key; }
    else if(LOT_GROUP==='country'){ title=String(it.country||'').trim()||'Страна не указана'; key=title.toLowerCase(); ord=key; }
    else { var t=parseD(it.roast);
      if(isNaN(t)){ key='~'; title='Дата обжарки не указана'; ord='0'; }
      else { var d=new Date(t); key=d.getFullYear()+'-'+pad(d.getMonth()+1); title=MONTHS[d.getMonth()]+' '+d.getFullYear(); ord=key; } }
    if(!map[key]){ map[key]={key:key,title:title,ord:ord,items:[]}; order.push(map[key]); }
    map[key].items.push(it);
  });
  return order.sort(function(a,b){
    if(LOT_GROUP==='month') return b.ord.localeCompare(a.ord);
    return (b.items.length-a.items.length)||cmpRu(a.title,b.title);
  });
}

function renderRoasters(){
  var bar=$('libRoasters'); if(!bar) return;
  var map={}, cnt={};
  LIB.forEach(function(it){ var r=String(it.roaster||'').trim(); if(!r) return; var k=r.toLowerCase(); if(!map[k]) map[k]=r; cnt[k]=(cnt[k]||0)+1; });
  var keys=Object.keys(map).sort(function(a,b){ return (cnt[b]-cnt[a])||cmpRu(map[a],map[b]); });
  if(LIB_ROASTER && !map[LIB_ROASTER]) LIB_ROASTER='';
  bar.innerHTML='';
  if(!keys.length){ bar.style.display='none'; return; }
  bar.style.display='';
  function chip(txt,n,key){
    var b=el('button','chip'+(LIB_ROASTER===key?' on':'')); b.type='button';
    b.innerHTML=esc(txt)+'<em>'+n+'</em>';
    b.onclick=function(){ LIB_ROASTER=(LIB_ROASTER===key&&key)?'':key; renderLib(); };
    bar.appendChild(b);
  }
  chip('Все',LIB.length,'');
  keys.forEach(function(k){ chip(map[k],cnt[k],k); });
}
function lotStats(){
  var r={}; LIB.forEach(function(it){ var x=String(it.roaster||'').trim().toLowerCase(); if(x) r[x]=1; });
  var nr=Object.keys(r).length, n=LIB.length;
  function pl(n,a,b,c){ var m=n%10,h=n%100; return n+' '+((m===1&&h!==11)?a:((m>=2&&m<=4&&(h<12||h>14))?b:c)); }
  $('lotStats').textContent=n?pl(n,'лот','лота','лотов')+' · '+pl(nr,'обжарщик','обжарщика','обжарщиков'):'Пока пусто';
}
function lotCard(it){
  var a=el('article','lot');
  var qn=parseQ(it.q), qs=String(it.q||'').trim();
  var meta=[it.country,it.process,it.m].map(function(x){ return String(x||'').trim(); }).filter(function(x){ return x && x!=='-' && x!=='_'; });
  var extra=CUSTOM.map(function(f){ var v=String(it[f.k]||'').trim(); return v?esc(f.label)+': '+esc(v):''; }).filter(Boolean);
  var dates='';
  if(it.roast) dates+='<span title="Дата обжарки">🔥 '+esc(it.roast)+freshTag(it)+'</span>';
  if(it.pack) dates+='<span title="Дата упаковки (в базе)">📦 '+esc(it.pack)+'</span>';
  a.innerHTML=
    '<div class="top"><span class="rst">'+esc(it.roaster||'—')+'</span>'+
      ((qs&&qs!=='-')?'<span class="q'+(qn>=87?' hi':'')+'" title="Q-балл">Q '+esc(qs)+'</span>':'')+'</div>'+
    '<h4 title="Открыть в конструкторе">'+esc(it.name||it.country||'без названия')+'</h4>'+
    (meta.length?'<div class="meta">'+esc(meta.join(' · '))+'</div>':'')+
    (extra.length?'<div class="meta">'+extra.join(' · ')+'</div>':'')+
    (dates?'<div class="dates">'+dates+'</div>':'');
  var acts=el('div','acts');
  var b1=el('button','primary'); b1.textContent='＋ На лист';
  b1.onclick=function(){ addItem(fromLib(it), +($('lotQty').value)||1); };
  var b2=el('button'); b2.textContent='✎'; b2.title='Открыть / изменить';
  b2.onclick=function(){ openLot(it); };
  var b3=el('button','danger'); b3.textContent='✕'; b3.title='Удалить из базы';
  b3.onclick=function(){
    var nm=titleOf(it);
    if(!confirm('Удалить лот «'+nm+'» из базы?\n'+subOf(it))) return;
    deleteLots([it]).then(function(ok){ if(ok) toast('Удалено: '+nm); });
  };
  acts.appendChild(b1); acts.appendChild(b2); acts.appendChild(b3); a.appendChild(acts);
  a.querySelector('h4').onclick=function(){ openLot(it); };
  return a;
}
function openLot(it){
  formSet(fromLib(it)); editIdx=-1; editLotId=it.id; resetAddBtn();
  setView('make'); toast('Лот в форме — можно печатать или править');
}
function renderLib(){
  renderRoasters(); lotStats();
  var host=$('lotsList'); if(!host) return; host.innerHTML='';
  if(!LIB.length){ host.innerHTML='<div class="empty"><b>☕</b>База пуста. Жми «＋ Новый лот» или импортируй CSV.</div>'; return; }
  var list=sortLots(filteredLots());
  if(!list.length){ host.innerHTML='<div class="empty"><b>🔍</b>Ничего не нашлось</div>'; return; }
  groupLots(list).forEach(function(g){
    var grid=el('div','grid');
    g.items.forEach(function(it){ grid.appendChild(lotCard(it)); });
    if(!g.title){ host.appendChild(grid); return; }
    var d=el('details','group'); var ck=LOT_GROUP+':'+g.key;
    d.open=!COLLAPSED[ck];
    var sm=el('summary'); sm.innerHTML='<h3>'+esc(g.title)+'</h3><span class="cnt">'+g.items.length+'</span><span class="chev">▾</span>';
    d.appendChild(sm); d.appendChild(grid);
    d.addEventListener('toggle',function(){ if(d.open) delete COLLAPSED[ck]; else COLLAPSED[ck]=1; ls('sk_collapsed',COLLAPSED); });
    host.appendChild(d);
  });
}
function initLots(){
  var pr=ls('sk_lotprefs')||{};
  LOT_SORT=pr.sort||'added'; LOT_GROUP=pr.group||'roaster'; COLLAPSED=ls('sk_collapsed')||{};
  $('lotSort').value=LOT_SORT; $('lotGroup').value=LOT_GROUP;
  function savePr(){ ls('sk_lotprefs',{sort:LOT_SORT,group:LOT_GROUP}); }
  $('lotSort').onchange=function(){ LOT_SORT=this.value; savePr(); renderLib(); };
  $('lotGroup').onchange=function(){ LOT_GROUP=this.value; savePr(); renderLib(); };
  var tm; $('lotSearch').oninput=function(){ var v=this.value; clearTimeout(tm); tm=setTimeout(function(){ LOT_Q=v; renderLib(); },120); };
  function step(id,d){ var i=$(id); i.value=Math.max(1,Math.min(200,(+i.value||1)+d)); }
  $('qMinus').onclick=function(){ step('lotQty',-1); }; $('qPlus').onclick=function(){ step('lotQty',1); };
  $('fMinus').onclick=function(){ step('qty',-1); };    $('fPlus').onclick=function(){ step('qty',1); };
  $('btnNewLot').onclick=function(){ formSet(blank()); editIdx=-1; editLotId=''; resetAddBtn(); setView('make'); var f=$('in_'+FIELDS[0].k); if(f) f.focus(); };
}

/* ---------- экраны ---------- */
function setView(v){
  if(['lots','make','sheet'].indexOf(v)<0) v='lots';
  document.body.dataset.view=v;
  document.querySelectorAll('[data-go]').forEach(function(b){
    var on=b.dataset.go===v || (v==='sheet' && b.dataset.go==='make' && b.closest('.toptabs'));
    b.classList.toggle('on',!!on);
  });
  if(location.hash!=='#'+v) history.replaceState(null,'','#'+v);
  if(v!=='lots'){ requestAnimationFrame(function(){ scaleSheet(); fit($('pages')); renderPreview(); }); }
  window.scrollTo(0,0);
}

/* ---------- actions ---------- */
function resetAddBtn(){
  $('btnAdd').textContent='＋ На лист';
  var lot=editLotId&&lotById(editLotId), t=$('formTitle');
  $('btnSave').textContent=lot?'💾 Обновить лот':'💾 В базу';
  t.textContent=editIdx>=0?'Правим наклейку №'+(editIdx+1):(lot?'Лот: '+titleOf(lot):'Новая наклейка');
  t.classList.toggle('editing',editIdx>=0||!!lot);
}
function addItem(it,n){
  n=Math.max(1,Math.min(200,n||1));
  for(var i=0;i<n;i++) SHEET.push(copy(it));
  saveAll(); renderSheet(); toast('На лист добавлено: '+n+' · всего '+SHEET.length);
}
function initActions(){
  $('btnAdd').onclick=function(){
    var it=formGet();
    if(isEmpty(it)){ toast('Заполни хотя бы одно поле'); return; }
    if(editIdx>=0 && editIdx<SHEET.length){ SHEET[editIdx]=it; editIdx=-1; resetAddBtn(); saveAll(); renderSheet(); toast('Обновлено'); if(innerWidth<1100) setView('sheet'); return; }
    addItem(it, +($('qty').value)||1);
  };
  $('btnSave').onclick=function(){
    var it=formGet();   // все поля, включая те, что этот тип не печатает (пустые — тоже)
    if(isEmpty(it)){ toast('Пустая карточка'); return; }
    var same=-1, cur=editLotId&&lotById(editLotId);
    if(cur) same=LIB.indexOf(cur);
    else LIB.forEach(function(x,i){ if(same<0&&titleOf(x)===titleOf(it)&&x.roaster===it.roaster) same=i; });
    if(same>=0){ LIB[same]=Object.assign({},LIB[same],it,{updated:nowIso()}); editLotId=LIB[same].id; }
    else { var n=ensureLotMeta(Object.assign({},it,{added:nowIso()})); LIB.unshift(n); editLotId=n.id; }
    saveAll(); renderLib(); resetAddBtn(); toast(same>=0?'Лот обновлён в базе':'Новый лот в базе');
  };
  $('btnClearForm').onclick=function(){ formSet(blank()); editIdx=-1; editLotId=''; resetAddBtn(); };
  $('btnFill').onclick=function(){
    if(!SHEET.length){ toast('Сначала добавь наклейку'); return; }
    var pp=perPage(), rest=(pp - (SHEET.length % pp)) % pp;
    if(!rest){ toast('Страница уже заполнена'); return; }
    var last=SHEET[SHEET.length-1];
    for(var i=0;i<rest;i++) SHEET.push(copy(last));
    saveAll(); renderSheet(); toast('Добавлено: '+rest);
  };
  $('btnSheetClear').onclick=function(){ if(confirm('Очистить лист «'+S.name+'»?')){ SHEET=[]; editIdx=-1; resetAddBtn(); saveAll(); renderSheet(); } };
  $('btnLibClear').onclick=function(){
    if(!LIB.length){ toast('Библиотека пуста'); return; }
    if(!confirm('Удалить ВСЮ базу ('+LIB.length+' шт.)?'+(syncMode()!=='local'?'\nОна удалится для всех устройств.':''))) return;
    if(!confirm('Последнее предупреждение: восстановить будет нельзя (разве что из истории GitHub). Удалить всё?')) return;
    deleteLots(LIB.slice(),true).then(function(ok){ if(ok) toast('База очищена'); });
  };
  $('btnPrint').onclick=function(){ setView('sheet'); setTimeout(function(){ window.print(); },60); };
  $('btnPdf').onclick=savePdf;
  $('btnPng').onclick=savePng;
  $('typeBadge').onclick=openModal;
  $('btnSheetCsv').onclick=function(){ dlCsv(groupCsv(SHEET),'nakleyki-list.csv'); };
  $('btnLibCsv').onclick=function(){ dlCsv(groupCsv(LIB,true),'nakleyki-baza.csv'); };
  $('btnSheetImp').onclick=function(){ pickFile('csv',function(txt){ var rows=parseCsv(txt),n=0;
      rows.forEach(function(r){ var q=Math.max(1,parseInt(r.qty||r['кол-во']||1,10)||1); for(var i=0;i<q;i++){ SHEET.push(rowToItem(r)); n++; } });
      saveAll(); renderSheet(); toast('Импортировано: '+n); }); };
  $('btnLibImp').onclick=function(){ pickFile('csv',function(txt){ var rows=parseCsv(txt),n=0;
      var keys={}; LIB.forEach(function(x){ keys[lotKey(x)]=1; }); var skip=0;
      rows.forEach(function(r){ var it=rowToItem(r); if(isEmpty(it)) return;
        if(keys[lotKey(it)]){ skip++; return; } keys[lotKey(it)]=1;
        LIB.unshift(ensureLotMeta(Object.assign(it,{added:nowIso()}))); n++; });
      saveAll(); renderLib(); toast('В базу: '+n+(skip?' (дубли пропущены: '+skip+')':'')); }); };
  window.addEventListener('resize',function(){ scaleSheet(); fit($('pages')); });
}

/* ---------- CSV (старые файлы читаются как раньше) ---------- */
var CSVH=['roaster','country','name','process','q','m','roast','pack'];
function groupCsv(arr,noQty){
  var keys=allKeys(), out=[],map={};
  arr.forEach(function(it){
    var key=keys.map(function(k){return it[k]||'';}).join('\u0001');
    if(map[key]!==undefined && !noQty){ out[map[key]].qty++; }
    else { map[key]=out.length; var o=copy(it); o.qty=1; out.push(o); }
  });
  return out;
}
function csvCell(v){ v=String(v==null?'':v); return /[",;\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function dlCsv(rows,name){
  var head=allKeys().concat(['qty']);
  var ru={qty:'Кол-во'}; FIELDS.forEach(function(f){ ru[f.k]=f.label; });
  ru.q='Q'; ru.m='m';
  var lines=[head.map(function(h){return csvCell(h+' ('+ru[h]+')');}).join(',')];
  rows.forEach(function(r){ lines.push(head.map(function(h){ return csvCell(r[h]||(h==='qty'?1:'')); }).join(',')); });
  var blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  dlBlob(blob,name);
}
function splitCsvLine(line,sep){
  var out=[],cur='',q=false;
  for(var i=0;i<line.length;i++){
    var c=line[i];
    if(q){ if(c==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else { if(c==='"') q=true; else if(c===sep){ out.push(cur); cur=''; } else cur+=c; }
  }
  out.push(cur); return out;
}
function parseCsv(txt){
  txt=txt.replace(/^﻿/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  var lines=txt.split('\n').filter(function(l){ return l.trim().length; });
  if(!lines.length) return [];
  var sep=(lines[0].split(';').length>lines[0].split(',').length)?';':',';
  var head=splitCsvLine(lines[0],sep).map(function(h){ return h.trim().toLowerCase(); });
  var keys=head.map(function(h){
    if(h.indexOf('qty')===0||h.indexOf('кол')===0) return 'qty';
    for(var c=0;c<CUSTOM.length;c++){
      var cf=CUSTOM[c];
      if(h.indexOf(cf.k.toLowerCase())===0 || h===String(cf.label).toLowerCase()) return cf.k;
    }
    for(var i=0;i<CSVH.length;i++){ if(h.indexOf(CSVH[i])===0) return CSVH[i]; }
    if(h.indexOf('обжарщик')>=0) return 'roaster';
    if(h.indexOf('стран')>=0) return 'country';
    if(h.indexOf('назв')>=0) return 'name';
    if(h.indexOf('обработ')>=0) return 'process';
    if(h.indexOf('обжарки')>=0) return 'roast';
    if(h.indexOf('упаков')>=0) return 'pack';
    return h;
  });
  var rows=[];
  for(var i=1;i<lines.length;i++){
    var c=splitCsvLine(lines[i],sep), o={};
    for(var j=0;j<keys.length;j++) o[keys[j]]=(c[j]||'').trim();
    rows.push(o);
  }
  return rows;
}
function rowToItem(r){ var o=blank(); allKeys().forEach(function(k){ o[k]=r[k]||''; }); return o; }
function pickFile(kind,cb){
  var inp=$('filePick'); inp.value='';
  inp.onchange=function(){ var f=inp.files[0]; if(!f) return; var fr=new FileReader();
    fr.onload=function(){ try{ cb(String(fr.result)); }catch(e){ toast('Ошибка файла'); } };
    fr.readAsText(f,'utf-8'); };
  inp.click();
}

/* ---------- экспорт в файл (PNG/PDF) ---------- */
function fontForCanvas(size){
  var fam=(S.font==='system')?'Arial, sans-serif':S.font;
  return (S.italic==1?'italic ':'')+S.weight+' '+size+'px '+fam;
}
function drawFields(ctx,item,x,y,w,h){
  FIELDS.forEach(function(f){
    if(!isOn(f.k)) return;
    var c=S.fields[f.k], v=String(item[f.k]||'').trim();
    if(!v) return;
    var size=h*c.fs/100, bx=x+w*c.x/100, bw=w*c.w/100, bb=y+h-h*c.b/100;
    ctx.font=fontForCanvas(size);
    var tw=ctx.measureText(v).width, st=0;
    while(tw>bw && st<12){ st++; size*=STEP; ctx.font=fontForCanvas(size); tw=ctx.measureText(v).width; }
    var m=ctx.measureText(v), A=m.fontBoundingBoxAscent, Dn=m.fontBoundingBoxDescent;
    var baseY=(A&&Dn)?(bb-size/2+(A-Dn)/2):(bb-0.2*size);
    var tx=(c.a==='center')?(bx+bw/2):((c.a==='right')?(bx+bw):bx);
    ctx.textAlign=(c.a==='center')?'center':((c.a==='right')?'right':'left');
    ctx.textBaseline='alphabetic';
    ctx.fillStyle=S.color;
    var sx=(tw>bw&&tw>0)?bw/tw:1;
    ctx.save(); ctx.translate(tx,baseY); ctx.scale(sx,1); ctx.fillText(v,0,0); ctx.restore();
  });
}
function pageCanvas(pi,dpi){
  var D=pageDims(), p=S.page, k=dpi/25.4, pp=perPage();
  var cv=document.createElement('canvas');
  cv.width=Math.round(D.w*k); cv.height=Math.round(D.h*k);
  var ctx=cv.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,cv.width,cv.height);
  for(var i=0;i<pp;i++){
    var idx=pi*pp+i; if(idx>=SHEET.length) break;
    var col=i%p.cols, row=Math.floor(i/p.cols);
    var x=(p.mx+col*(D.lw+p.gx))*k, y=(p.my+row*(D.lh+p.gy))*k, w=D.lw*k, h=D.lh*k;
    try{ ctx.drawImage(baseImgEl,x,y,w,h); }catch(e){}
    drawFields(ctx,SHEET[idx],x,y,w,h);
  }
  return cv;
}
function readyToDraw(){
  var p1=(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve();
  var im=baseImgEl;
  var p2=im.complete?Promise.resolve():new Promise(function(r){ im.onload=r; im.onerror=r; });
  return Promise.all([p1,p2]);
}
function nPages(){ return Math.max(1,Math.ceil(SHEET.length/perPage())); }
function dlBlob(blob,name){
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000);
}
function savePng(){
  if(!SHEET.length){ toast('Лист пуст'); return; }
  toast('Готовлю PNG…');
  readyToDraw().then(function(){
    var n=nPages();
    for(var i=0;i<n;i++){
      (function(i){
        pageCanvas(i,300).toBlob(function(b){ if(b) dlBlob(b,'nakleyki-'+slug(S.name)+'-'+(i+1)+'.png'); },'image/png');
      })(i);
    }
    toast('Скачано страниц: '+n);
  });
}
function loadJsPdf(){
  if(window.jspdf&&window.jspdf.jsPDF) return Promise.resolve();
  return new Promise(function(res,rej){
    var sc=document.createElement('script');
    sc.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    sc.onload=res; sc.onerror=rej; document.head.appendChild(sc);
  });
}
function savePdf(){
  if(!SHEET.length){ toast('Лист пуст'); return; }
  toast('Готовлю PDF…');
  readyToDraw().then(loadJsPdf).then(function(){
    var D=pageDims(), n=nPages();
    var pdf=new window.jspdf.jsPDF({orientation:(S.page.orient==='portrait'?'p':'l'),unit:'mm',format:'a4',compress:true});
    for(var i=0;i<n;i++){
      if(i) pdf.addPage('a4',(S.page.orient==='portrait'?'p':'l'));
      var cv=pageCanvas(i,300);
      pdf.addImage(cv.toDataURL('image/jpeg',0.94),'JPEG',0,0,D.w,D.h);
    }
    pdf.save('nakleyki-'+slug(S.name)+'.pdf');
    toast('PDF готов: '+n+' стр.');
  }).catch(function(){ toast('PDF не загрузился — сохраняю PNG'); savePng(); });
}

/* ---------- типы наклеек ---------- */
function renderTypeSel(){
  var sel=$('typeSel'); sel.innerHTML='';
  TYPES.forEach(function(t){ var o=document.createElement('option'); o.value=t.id; o.textContent=t.name; sel.appendChild(o); });
  sel.value=CUR;
  $('typeBadge').textContent='🏷 '+S.name;
  renderTplStrip();
}
function tplThumb(t,img){
  if(t.bg){ idbGet(t.bg).then(function(d){ img.src=d||defBg(t); }).catch(function(){ img.src=defBg(t); }); }
  else img.src=defBg(t);
}
function renderTplStrip(){
  var host=$('tplStrip');
  if(host){
    host.innerHTML='';
    TYPES.forEach(function(t){
      var b=el('button','tpl'+(t.id===CUR?' on':'')); b.type='button'; b.title=t.name;
      var im=el('img'); im.alt=''; im.loading='lazy'; tplThumb(t,im);
      if(t.bgW>t.bgH*1.2) b.classList.add('wide');
      var sp=el('span'); sp.textContent=t.name;
      b.appendChild(im); b.appendChild(sp);
      b.onclick=function(){ switchType(t.id); };
      host.appendChild(b);
    });
    var add=el('button','tpl add'); add.type='button'; add.innerHTML='<i>＋</i><span>Свой</span>'; add.title='Новый тип наклейки';
    add.onclick=function(){ createType(); };
    host.appendChild(add);
    var on=host.querySelector('.on'); if(on&&on.scrollIntoView) on.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  var ls2=$('lotTpl');
  if(ls2){ ls2.innerHTML=''; TYPES.forEach(function(t){ var o=document.createElement('option'); o.value=t.id; o.textContent=t.name; ls2.appendChild(o); }); ls2.value=CUR; }
}
function refreshAfterSwitch(){
  editIdx=-1; resetAddBtn();
  applyPageStyle(); rebuildForm(); renderTypeSel(); syncSettingsUi();
  renderSheet(); loadBg();
}
function switchType(id){
  if(id===CUR || !typeById(id)) return;
  saveAll(); useType(id); saveAll();
  refreshAfterSwitch(); toast('Тип: '+S.name);
}
function createType(){
  var name=prompt('Название нового типа наклеек:',''); if(!name||!name.trim()) return; name=name.trim();
  var base=confirm('Взять за основу «'+S.name+'» (раскладку, шрифт, фон)?\n\nОК — скопировать\nОтмена — начать со стандартной');
  var t=normType(base?JSON.parse(JSON.stringify(S)):null);
  t.id=newId(); t.name=name;
  var p=Promise.resolve();
  if(base && S.bg){
    var from=S.bg; t.bg='bg_'+t.id;
    p=idbGet(from).then(function(d){ if(d) return idbSet(t.bg,d); t.bg=null; t.bgW=DEF_W; t.bgH=DEF_H; })
      .catch(function(){ t.bg=null; t.bgW=DEF_W; t.bgH=DEF_H; });
  } else if(!base){ t.bg=null; t.bgW=DEF_W; t.bgH=DEF_H; t.presetBg=null; t.pid=null; }
  if(base) t.pid=null;  // копия — своя, «вернуть шаблоны» её не трогает
  p.then(function(){ TYPES.push(t); SHEETS[t.id]=[]; switchType(t.id); });
}
function renameType(){
  var name=prompt('Новое название для «'+S.name+'»:',S.name); if(!name||!name.trim()) return;
  S.name=name.trim(); saveAll(); renderTypeSel(); rebuildForm(); renderSheetList();
}
function deleteType(){
  if(TYPES.length<2){ toast('Это единственный тип — удалить нельзя'); return; }
  if(!confirm('Удалить тип «'+S.name+'» вместе с его листом?\nБиблиотека останется.')) return;
  var id=CUR, bg=S.bg;
  TYPES=TYPES.filter(function(t){ return t.id!==id; });
  delete SHEETS[id];
  if(bg) idbDel(bg).catch(function(){});
  useType(TYPES[0].id); saveAll(); refreshAfterSwitch(); toast('Тип удалён');
}

/* ---------- свои поля ---------- */
function addField(){
  var label=prompt('Название нового поля (например: Вкус, Регион, Сорт):',''); if(!label||!label.trim()) return; label=label.trim();
  var isDate=confirm('Это поле — дата?\n\nОК — да (точки подставляются сами)\nОтмена — обычный текст');
  var k='c_'+Date.now().toString(36);
  var f={k:k,label:label,custom:1,date:isDate?1:0,today:isDate?1:0};
  CUSTOM.push(f); rebuildFields();
  S.fields[k]=Object.assign(defPos(f),{on:1});
  LIB.forEach(function(it){ if(!(k in it)) it[k]=''; });   // в базе появляется пустое поле
  curField=k; saveAll(); rebuildForm(); syncSettingsUi(); renderPreview(); renderSheet();
  toast('Поле «'+label+'» добавлено');
}
function delField(){
  var f=fieldDef(curField);
  if(!f||!f.custom){ toast('Стандартное поле не удаляется — сними галочку «печатать»'); return; }
  if(!confirm('Удалить поле «'+f.label+'» из всех типов?\nЗначения этого поля в библиотеке пропадут.')) return;
  CUSTOM=CUSTOM.filter(function(x){ return x.k!==f.k; }); rebuildFields();
  TYPES.forEach(function(t){ delete t.fields[f.k]; });
  LIB.forEach(function(it){ delete it[f.k]; });
  curField=FIELDS[0].k; saveAll(); rebuildForm(); syncSettingsUi(); renderPreview(); renderSheet();
}

/* ---------- settings ---------- */
var curField=STDF[0].k;
function openModal(){ $('modal').classList.add('open'); document.body.style.overflow='hidden'; renderTypeSel(); syncSettingsUi(); syncUiFill(); bgInfo(); renderPreview(); }
function closeModal(){ $('modal').classList.remove('open'); document.body.style.overflow=''; saveAll(); rebuildForm(); renderSheet(); renderLib(); }
function syncSettingsUi(){
  if(!fieldDef(curField)) curField=FIELDS[0].k;
  var sel=$('selField'); sel.innerHTML='';
  FIELDS.forEach(function(f){ var o=document.createElement('option'); o.value=f.k; o.textContent=f.label+(isOn(f.k)?'':' (не печатается)'); sel.appendChild(o); });
  sel.value=curField;
  var c=getF(curField);
  $('fOn').checked=!!c.on;
  $('btnFieldDel').style.display=(fieldDef(curField)||{}).custom?'':'none';
  $('fX').value=c.x; $('fB').value=c.b; $('fW').value=c.w; $('fS').value=c.fs; $('fA').value=c.a;
  $('setFont').value=S.font; $('setColor').value=S.color; $('setWeight').value=String(S.weight); $('setItalic').value=String(S.italic);
  var p=S.page;
  $('pOrient').value=p.orient; $('pLw').value=p.lw; $('pCols').value=p.cols; $('pRows').value=p.rows;
  $('pGx').value=p.gx; $('pGy').value=p.gy; $('pMx').value=p.mx; $('pMy').value=p.my; $('pCut').value=String(p.cut);
  $('setDate').value=S.dateFmt; $('setGuides').value=String(S.guides);
  pageInfo(); bgInfo();
}
function pageInfo(){
  var D=pageDims(), p=S.page;
  var needW=p.cols*D.lw+(p.cols-1)*p.gx+2*p.mx;
  var needH=p.rows*D.lh+(p.rows-1)*p.gy+2*p.my;
  var ok=(needW<=D.w+0.5)&&(needH<=D.h+0.5);
  $('pageInfo').innerHTML='Наклейка: <b>'+D.lw.toFixed(1)+' × '+D.lh.toFixed(1)+' мм</b>. Нужно места: '+needW.toFixed(1)+' × '+needH.toFixed(1)+' мм, лист '+D.w+' × '+D.h+' мм. '+
    (ok?'<span style="color:var(--ok)">✔ помещается, '+(p.cols*p.rows)+' шт./стр.</span>':'<span style="color:var(--danger)">✖ НЕ помещается — уменьши ширину/кол-во</span>');
}
function renderFormPreview(it){
  var host=$('formPreview'); if(!host||!S||!host.offsetParent) return;
  var w=host.clientWidth||200, h=w*aspect();
  host.style.height=h+'px'; host.innerHTML='';
  var lab=labelNode(it,w+'px',h+'px');
  if(+S.guides) lab.classList.add('guides');
  host.appendChild(lab); fit(lab);
}
function renderPreview(){
  var it=formGet(), any=!isEmpty(it);
  renderFormPreview(it);
  var host=$('prevLabel'); if(!host||!S||!host.offsetParent) return;
  var demo={roaster:'Tasty Coffee',country:'Эфиопия',name:'Гуджи Уракэ',process:'Натуральная',q:'86,5',m:'250 г',roast:today(),pack:today()};
  CUSTOM.forEach(function(f){ demo[f.k]=f.date?today():f.label; });
  var data=any?it:demo;
  var w=host.clientWidth||330, h=w*aspect();
  host.style.height=h+'px';
  host.innerHTML='';
  var lab=labelNode(data,'100%',h+'px');
  lab.style.position='absolute'; lab.style.left=0; lab.style.top=0; lab.style.width='100%';
  host.style.position='relative';
  host.appendChild(lab);
  lab.querySelectorAll('.fbox').forEach(function(b){
    b.style.pointerEvents='auto';
    if(b.dataset.k===curField) b.classList.add('sel');
    b.addEventListener('pointerdown',startDrag);
    b.addEventListener('click',function(e){ e.stopPropagation(); curField=b.dataset.k; syncSettingsUi(); renderPreview(); });
  });
  fit(lab);
}
var drag=null;
function startDrag(e){
  var box=e.currentTarget, k=box.dataset.k;
  curField=k; syncSettingsUi();
  var host=$('prevLabel').getBoundingClientRect();
  drag={k:k,box:box,x0:e.clientX,y0:e.clientY,sx:S.fields[k].x,sb:S.fields[k].b,w:host.width,h:host.height};
  box.setPointerCapture(e.pointerId);
  box.style.cursor='grabbing';
  e.preventDefault();
  window.addEventListener('pointermove',moveDrag);
  window.addEventListener('pointerup',endDrag);
}
function moveDrag(e){
  if(!drag) return;
  var dx=(e.clientX-drag.x0)/drag.w*100, dy=(e.clientY-drag.y0)/drag.h*100;
  var c=S.fields[drag.k];
  c.x=clamp(round1(drag.sx+dx),0,99); c.b=clamp(round1(drag.sb-dy),0,99);
  drag.box.style.left=c.x+'%'; drag.box.style.bottom=c.b+'%';
  $('fX').value=c.x; $('fB').value=c.b;
}
function endDrag(){
  if(drag){ drag.box.style.cursor='grab'; drag=null; saveAll(); }
  window.removeEventListener('pointermove',moveDrag);
  window.removeEventListener('pointerup',endDrag);
}
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function round1(v){ return Math.round(v*10)/10; }

function exportSettings(){
  var o={kind:'sk_all',v:3,types:TYPES,custom:CUSTOM,cur:CUR};
  dlBlob(new Blob([JSON.stringify(o,null,2)],{type:'application/json'}),'nakleyki-settings.json');
}
function importSettings(txt){
  var o=JSON.parse(txt);
  if(o && Array.isArray(o.types)){                // новый формат: все типы
    (o.custom||[]).forEach(function(f){ if(f&&f.k&&!fieldDef(f.k)) CUSTOM.push(f); });
    rebuildFields();
    o.types.forEach(function(raw){
      var t=normType(raw), ex=typeById(t.id);
      if(ex){ t.bg=ex.bg; t.bgW=ex.bgW; t.bgH=ex.bgH; t.presetBg=ex.presetBg; t.pid=ex.pid; TYPES[TYPES.indexOf(ex)]=t; }
      else { t.bg=null; t.bgW=raw.bgW||DEF_W; t.bgH=raw.bgH||DEF_H; if(raw.bg){ t.bgW=DEF_W; t.bgH=DEF_H; } TYPES.push(t); }
    });
    useType(typeById(CUR)?CUR:TYPES[0].id);
  } else {                                           // старый формат — в текущий тип
    var n=normType(o);
    n.id=S.id; n.name=S.name; n.bg=S.bg; n.bgW=S.bgW; n.bgH=S.bgH; n.presetBg=S.presetBg; n.pid=S.pid;
    TYPES[TYPES.indexOf(S)]=n; useType(n.id);
  }
  saveAll(); refreshAfterSwitch(); renderPreview(); toast('Настройки загружены');
}

function initSettings(){
  $('btnSettings').onclick=openModal; $('navSettings').onclick=openModal;
  $('btnDone').onclick=closeModal;
  $('modal').addEventListener('click',function(e){ if(e.target===$('modal')) closeModal(); });
  $('typeSel').onchange=function(){ switchType(this.value); };
  $('btnTypeNew').onclick=createType;
  $('btnTypeRen').onclick=renameType;
  $('btnTypeDel').onclick=deleteType;
  $('btnBgDl').onclick=downloadBg;
  $('btnBgUp').onclick=uploadBg;
  $('btnBgReset').onclick=resetBg;
  $('btnFieldAdd').onclick=addField;
  $('btnFieldDel').onclick=delField;
  $('fOn').onchange=function(){ getF(curField).on=this.checked?1:0; saveAll(); syncSettingsUi(); renderPreview(); };
  document.querySelectorAll('.tabs button').forEach(function(b){
    b.onclick=function(){
      document.querySelectorAll('.tabs button').forEach(function(x){x.classList.remove('on');});
      b.classList.add('on');
      ['pos','page','sync','misc'].forEach(function(t){ $('tab-'+t).style.display=(t===b.dataset.tab)?(t==='pos'?'flex':'block'):'none'; });
      if(b.dataset.tab==='pos') renderPreview();
    };
  });
  $('selField').onchange=function(){ curField=this.value; syncSettingsUi(); renderPreview(); };
  ['fX','fB','fW','fS'].forEach(function(id){
    $(id).oninput=function(){
      var c=getF(curField), v=parseFloat(this.value);
      if(isNaN(v)) return;
      if(id==='fX') c.x=v; if(id==='fB') c.b=v; if(id==='fW') c.w=v; if(id==='fS') c.fs=v;
      saveAll(); renderPreview();
    };
  });
  $('fA').onchange=function(){ getF(curField).a=this.value; saveAll(); renderPreview(); };
  $('btnResetField').onclick=function(){
    var on=getF(curField).on;
    S.fields[curField]=Object.assign(defPos(fieldDef(curField)),{on:on});
    saveAll(); syncSettingsUi(); renderPreview();
  };
  $('setFont').onchange=function(){ S.font=this.value; saveAll(); renderPreview(); };
  $('setColor').oninput=function(){ S.color=this.value; saveAll(); renderPreview(); };
  $('setWeight').onchange=function(){ S.weight=+this.value; saveAll(); renderPreview(); };
  $('setItalic').onchange=function(){ S.italic=+this.value; saveAll(); renderPreview(); };
  $('setDate').onchange=function(){ S.dateFmt=this.value; saveAll(); rebuildForm(); renderPreview(); };
  $('setGuides').onchange=function(){ S.guides=+this.value; saveAll(); renderSheet(); };
  ['pOrient','pLw','pCols','pRows','pGx','pGy','pMx','pMy','pCut'].forEach(function(id){
    $(id).oninput=$(id).onchange=function(){
      var p=S.page, v=this.value;
      if(id==='pOrient') p.orient=v;
      else if(id==='pCut') p.cut=+v;
      else { var n=parseFloat(v); if(isNaN(n)) return;
        if(id==='pLw') p.lw=n; if(id==='pCols') p.cols=Math.max(1,Math.round(n)); if(id==='pRows') p.rows=Math.max(1,Math.round(n));
        if(id==='pGx') p.gx=n; if(id==='pGy') p.gy=n; if(id==='pMx') p.mx=n; if(id==='pMy') p.my=n; }
      applyPageStyle(); pageInfo(); saveAll(); renderSheet();
    };
  });
  $('btnAutoFit').onclick=function(){
    var D=pageDims(), p=S.page;
    var cols=Math.max(1,Math.floor((D.w-2*p.mx+p.gx)/(D.lw+p.gx)));
    var rows=Math.max(1,Math.floor((D.h-2*p.my+p.gy)/(D.lh+p.gy)));
    p.cols=cols; p.rows=rows; saveAll(); syncSettingsUi(); renderSheet(); toast(cols+'×'+rows+' = '+(cols*rows)+' шт./стр.');
  };
  $('btnExpSet').onclick=exportSettings;
  $('btnPresets').onclick=function(){ var n=seedPresets(true); saveAll(); renderTypeSel(); toast(n?'Вернул шаблонов: '+n:'Все шаблоны на месте'); };
  $('lotTpl').onchange=function(){ switchType(this.value); };
  $('btnImpSet').onclick=function(){ pickFile('json',function(txt){
    try{ importSettings(txt); }catch(e){ toast('Файл не читается'); } }); };
  $('btnResetAll').onclick=function(){
    if(!confirm('Сбросить настройки типа «'+S.name+'» к заводским? Фон и лист останутся.')) return;
    var pr=S.pid&&presetById(S.pid);
    var n=pr?presetType(pr,S.id):normType(null); n.id=S.id; n.name=S.name; n.bg=S.bg;
    if(S.bg||!pr){ n.bgW=S.bgW; n.bgH=S.bgH; }
    CUSTOM.forEach(function(f){ if(S.fields[f.k]) n.fields[f.k]=S.fields[f.k]; });
    TYPES[TYPES.indexOf(S)]=n; useType(n.id); saveAll(); refreshAfterSwitch(); renderPreview();
  };
  document.addEventListener('keydown',function(e){
    if(!$('modal').classList.contains('open')) return;
    if(e.key==='Escape'){ closeModal(); return; }
    if(document.activeElement && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
    var step=e.shiftKey?1:0.2, c=getF(curField), hit=true;
    if(e.key==='ArrowLeft') c.x=round1(c.x-step);
    else if(e.key==='ArrowRight') c.x=round1(c.x+step);
    else if(e.key==='ArrowUp') c.b=round1(c.b+step);
    else if(e.key==='ArrowDown') c.b=round1(c.b-step);
    else hit=false;
    if(hit){ e.preventDefault(); saveAll(); syncSettingsUi(); renderPreview(); }
  });
}
function applyPageStyle(){ $('pageStyle').textContent='@page{size:A4 '+(S.page.orient==='portrait'?'portrait':'landscape')+';margin:0}'; }

/* ======================================================================
   СИНХРОНИЗАЦИЯ БАЗЫ С GITHUB (data/lots.json в репозитории)
   ====================================================================== */
var SYNC={owner:'',repo:'',branch:'gh-pages',path:'data/lots.json',token:'',api:''};
var SYNCED={};      // id → updated, что уже лежит на сервере (режим api)
var DEL_PASS='';    // пароль на удаление — только в памяти, до закрытия вкладки
var syncState={busy:false,again:false,timer:null,lastHash:'',lastAt:0};
function guessRepo(){
  var h=location.hostname, m=/^([^.]+)\.github\.io$/i.exec(h);
  if(!m) return {};
  var seg=location.pathname.split('/').filter(Boolean)[0];
  return {owner:m[1],repo:(seg&&!/\.html?$/.test(seg))?seg:m[1]+'.github.io'};
}
function syncLoad(cfg){
  var g=guessRepo(), saved=ls('sk_sync')||{};
  SYNC.owner=saved.owner||(cfg&&cfg.owner)||g.owner||'';
  SYNC.repo=saved.repo||(cfg&&cfg.repo)||g.repo||'';
  SYNC.branch=saved.branch||(cfg&&cfg.branch)||'gh-pages';
  SYNC.path=saved.path||'data/lots.json';
  SYNC.token=saved.token||'';
  SYNC.api=String(saved.api||(cfg&&cfg.api)||'').trim().replace(/\/+$/,'');
  SYNCED=ls('sk_synced')||{};
}
function syncMode(){ return SYNC.api?'api':(SYNC.token&&SYNC.owner&&SYNC.repo?'gh':'local'); }

/* ---------- режим api: общий сервер синхронизации (worker/sync-worker.js) ---------- */
function pendingLots(){ return LIB.filter(function(x){ return SYNCED[x.id]!==x.updated; }); }
function api(body){
  return fetch(SYNC.api+'/lots'+(body?'':'?t='+Date.now()),{method:body?'POST':'GET',cache:'no-store',
      headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){
      if(!r.ok) { var e=new Error(j.error||('Сервер: '+r.status)); e.status=r.status; throw e; }
      return j; }); });
}
function adoptServerDoc(doc){
  // лоты, которых сервер не принял (удалены паролем) — убираются через doc.deleted
  mergeDoc(doc);
  SYNCED={}; (doc.lots||[]).forEach(function(x){ SYNCED[x.id]=x.updated; }); ls('sk_synced',SYNCED);
}
function apiSync(manual){
  if(!navigator.onLine){ setPill('err','офлайн'); return Promise.resolve(); }
  if(syncState.busy){ syncState.again=true; return Promise.resolve(); }
  syncState.busy=true; setPill('busy','синхронизация…');
  var pend=[];
  // при первом запуске сначала берём свежую базу, потом досылаем только своё
  var first=syncState.lastAt?Promise.resolve():api(null).then(adoptServerDoc);
  return first.then(function(){
    pend=pendingLots();
    return pend.length?api({lots:pend,custom:CUSTOM}):(syncState.lastAt?api(null):null);
  }).then(function(doc){
    if(doc) adoptServerDoc(doc); syncState.lastAt=Date.now();
    var t=new Date(); setPill('ok','синхр. '+pad(t.getHours())+':'+pad(t.getMinutes()));
    if(manual) toast(pend.length?'Отправлено лотов: '+pend.length:'База актуальна');
  }).catch(function(e){
    setPill('err','ошибка синхр.'); var i=$('syncInfo'); if(i) i.textContent='Ошибка: '+e.message;
    if(manual) toast(e.message);
  }).then(function(){
    syncState.busy=false;
    if(syncState.again){ syncState.again=false; scheduleSync(800); }
  });
}
function askDelPass(){
  if(DEL_PASS) return DEL_PASS;
  var p=prompt('Удаление из общей базы — введи пароль:','');
  return p?p.trim():'';
}
// удалить лоты: в общей базе — только с паролем (проверяет сервер)
function deleteLots(list,all){
  if(syncMode()!=='api'){
    list.forEach(removeLot); saveAll(); renderLib();
    return Promise.resolve(true);
  }
  if(!navigator.onLine){ toast('Удалять можно только с интернетом'); return Promise.resolve(false); }
  var pass=askDelPass(); if(!pass) return Promise.resolve(false);
  setPill('busy','удаляю…');
  var body=all?{deleteAll:true,password:pass}:{delete:list.map(function(x){ return x.id; }),password:pass};
  return api(body).then(function(doc){
    DEL_PASS=pass; adoptServerDoc(doc); renderLib();
    var t=new Date(); setPill('ok','синхр. '+pad(t.getHours())+':'+pad(t.getMinutes()));
    return true;
  }).catch(function(e){
    if(e.status===403) DEL_PASS='';
    setPill(e.status===403?'ok':'err',e.status===403?'пароль неверный':'ошибка синхр.');
    toast(e.status===403?'Неверный пароль — лот не удалён':e.message);
    return false;
  });
}
function syncSave(){ ls('sk_sync',SYNC); }
function setPill(state,text){
  var p=$('syncPill'); if(!p) return;
  p.className='syncpill '+(state||''); p.querySelector('span').textContent=text;
  var i=$('syncInfo'); if(i) i.textContent=text;
}
function libDoc(){
  var pruneBefore=Date.now()-180*864e5, del={};
  Object.keys(DELETED).forEach(function(id){ if(new Date(DELETED[id]).getTime()>pruneBefore) del[id]=DELETED[id]; });
  DELETED=del;
  var lots=LIB.slice().sort(function(a,b){ return String(b.added).localeCompare(String(a.added)); });
  return {version:1,updated:nowIso(),custom:CUSTOM,lots:lots,deleted:del};
}
function libHash(){ return JSON.stringify([LIB.map(function(x){ return x.id+x.updated; }).sort(),Object.keys(DELETED).sort(),CUSTOM.map(function(f){ return f.k; })]); }

// слить чужую версию базы в локальную: новее updated — побеждает, удалённые — удаляются
function mergeDoc(doc){
  if(!doc||!Array.isArray(doc.lots)) return false;
  var before=libHash();
  (doc.custom||[]).forEach(function(f){ if(f&&f.k&&!fieldDef(f.k)){ CUSTOM.push(f); TYPES.forEach(function(t){ if(!t.fields[f.k]) t.fields[f.k]=Object.assign(defPos(f),{on:0}); }); } });
  rebuildFields();
  var rdel=doc.deleted||{};
  Object.keys(rdel).forEach(function(id){ if(!DELETED[id]||DELETED[id]<rdel[id]) DELETED[id]=rdel[id]; });
  var remoteIds={}; doc.lots.forEach(function(x){ if(x&&x.id) remoteIds[x.id]=1; });
  doc.lots.forEach(function(r){
    if(!r||!r.id) return;
    if(DELETED[r.id] && DELETED[r.id]>=(r.updated||'')) return;
    var loc=lotById(r.id);
    if(!loc){                                   // тот же лот, заведённый локально без id из базы
      var k=lotKey(r);
      for(var i=0;i<LIB.length;i++) if(!remoteIds[LIB[i].id] && lotKey(LIB[i])===k){ loc=LIB[i]; loc.id=r.id; break; }
    }
    if(!loc) LIB.push(Object.assign({},r));
    else if((r.updated||'')>(loc.updated||'')){ LIB[LIB.indexOf(loc)]=Object.assign({},r); }
  });
  LIB=LIB.filter(function(x){ return !(DELETED[x.id] && DELETED[x.id]>=(x.updated||'')); });
  var changed=before!==libHash();
  if(changed){ syncState.quiet=true; saveAll(); syncState.quiet=false; rebuildForm(); renderLib(); }
  return changed;
}

function b64enc(str){
  var bytes=new TextEncoder().encode(str), bin='';
  for(var i=0;i<bytes.length;i+=0x8000) bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
  return btoa(bin);
}
function b64dec(b64){
  var bin=atob(String(b64).replace(/\s/g,'')), arr=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(arr);
}
function ghUrl(){ return 'https://api.github.com/repos/'+encodeURIComponent(SYNC.owner)+'/'+encodeURIComponent(SYNC.repo)+'/contents/'+SYNC.path.split('/').map(encodeURIComponent).join('/'); }
function gh(method,body){
  var url=ghUrl()+(method==='GET'?'?ref='+encodeURIComponent(SYNC.branch)+'&t='+Date.now():'');
  return fetch(url,{method:method,cache:'no-store',headers:{
      'Accept':'application/vnd.github+json','Authorization':'Bearer '+SYNC.token,'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return {status:r.status,ok:r.ok,json:j}; }); });
}
function syncNow(manual){
  if(syncMode()==='api') return apiSync(manual);
  if(!SYNC.token||!SYNC.owner||!SYNC.repo){
    setPill('', 'локально'); if(manual) toast('Укажи репозиторий и токен в Настройках → Синхронизация');
    return Promise.resolve();
  }
  if(!navigator.onLine){ setPill('err','офлайн'); return Promise.resolve(); }
  if(syncState.busy){ syncState.again=true; return Promise.resolve(); }
  syncState.busy=true; setPill('busy','синхронизация…');
  var tries=0;
  function round(){
    tries++;
    return gh('GET').then(function(r){
      var sha=null, remoteHash='';
      if(r.status===401||r.status===403) throw new Error('Токен не подходит (нет доступа к Contents)');
      if(r.ok){ sha=r.json.sha; var doc=JSON.parse(b64dec(r.json.content||'')||'{}'); mergeDoc(doc);
        remoteHash=JSON.stringify([(doc.lots||[]).map(function(x){ return x.id+x.updated; }).sort(),Object.keys(doc.deleted||{}).sort(),(doc.custom||[]).map(function(f){ return f.k; })]);
      } else if(r.status!==404) throw new Error('GitHub: '+(r.json.message||r.status));
      // чтобы сравнение было честным — чистим старые «удалённые» до хэша
      var outDoc=libDoc();
      if(remoteHash===libHash()) return 'same';
      return gh('PUT',{message:'База лотов: '+LIB.length+' шт. (с '+deviceName()+')',content:b64enc(JSON.stringify(outDoc,null,1)),sha:sha||undefined,branch:SYNC.branch})
        .then(function(w){
          if(w.ok) return 'pushed';
          if((w.status===409||w.status===422) && tries<3) return round();
          if(w.status===404) throw new Error('Нет ветки «'+SYNC.branch+'» или репозитория');
          throw new Error('GitHub: '+(w.json.message||w.status));
        });
    });
  }
  return round().then(function(res){
    syncState.lastHash=libHash(); syncState.lastAt=Date.now();
    var t=new Date(), hm=pad(t.getHours())+':'+pad(t.getMinutes());
    setPill('ok','синхр. '+hm);
    if(manual) toast(res==='pushed'?'База отправлена на GitHub':'База актуальна');
  }).catch(function(e){
    setPill('err','ошибка синхр.'); var i=$('syncInfo'); if(i) i.textContent='Ошибка: '+e.message;
    if(manual) toast(e.message);
  }).then(function(){
    syncState.busy=false;
    if(syncState.again){ syncState.again=false; scheduleSync(800); }
  });
}
function scheduleSync(ms){ clearTimeout(syncState.timer); syncState.timer=setTimeout(function(){ syncNow(false); },ms||2500); }
function libChanged(){
  if(syncState.quiet) return;
  if(syncMode()==='api'){ if(pendingLots().length){ setPill('busy','ждёт отправки'); scheduleSync(1500); } return; }
  if(!SYNC.token) return;
  if(libHash()!==syncState.lastHash){ setPill('busy','ждёт отправки'); scheduleSync(); }
}
function deviceName(){ var u=navigator.userAgent; return /iPhone|iPad/.test(u)?'iPhone':(/Android/.test(u)?'Android':(/Mac/.test(u)?'Mac':(/Windows/.test(u)?'Windows':'браузера'))); }
function syncUiFill(){
  $('syOwner').value=SYNC.owner; $('syRepo').value=SYNC.repo; $('syBranch').value=SYNC.branch; $('syPath').value=SYNC.path;
  $('syToken').value=SYNC.token; $('syncPathShow').textContent=SYNC.path; $('syApi').value=SYNC.api;
  $('syncMode').textContent={api:'общий сервер: добавлять может любой, удалять — по паролю',gh:'личный токен GitHub (режим владельца)',local:'только этот браузер'}[syncMode()];
}
function initSync(){
  $('btnSyncNow').onclick=function(){
    SYNC.owner=$('syOwner').value.trim(); SYNC.repo=$('syRepo').value.trim(); SYNC.branch=$('syBranch').value.trim()||'main';
    SYNC.path=$('syPath').value.trim()||'data/lots.json'; SYNC.token=$('syToken').value.trim();
    SYNC.api=$('syApi').value.trim().replace(/\/+$/,'');
    syncSave(); syncUiFill(); syncNow(true);
  };
  $('btnSyncForget').onclick=function(){ SYNC.token=''; syncSave(); syncUiFill(); setPill('','локально'); toast('Токен удалён из этого браузера'); };
  $('syncPill').onclick=function(){
    if(syncMode()==='local'){ openModal(); document.querySelector('.tabs button[data-tab="sync"]').click(); return; }
    syncNow(true);
  };
  window.addEventListener('online',function(){ scheduleSync(300); });
  document.addEventListener('visibilitychange',function(){ if(!document.hidden && Date.now()-syncState.lastAt>60000) scheduleSync(300); });
}
// публичная копия базы с сайта (без токена — только чтение)
function loadPublicDb(){
  return fetch('data/lots.json?t='+Date.now(),{cache:'no-store'})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(doc){ if(doc) mergeDoc(doc); })
    .catch(function(){});
}
function loadSiteConfig(){
  function get(u){ return fetch(u+'?t='+Date.now(),{cache:'no-store'}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
  return Promise.all([get('data/config.json'),get('data/site.json')]).then(function(a){ return Object.assign({},a[0]||{},a[1]||{}); });
}

/* ---------- PWA ---------- */
var installEvt=null;
function initPwa(){
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault(); installEvt=e;
    ['btnInstall','btnInstall2'].forEach(function(id){ $(id).style.display=''; });
  });
  function doInstall(){ if(!installEvt) return; installEvt.prompt(); installEvt.userChoice.finally(function(){ installEvt=null; ['btnInstall','btnInstall2'].forEach(function(id){ $(id).style.display='none'; }); }); }
  $('btnInstall').onclick=doInstall; $('btnInstall2').onclick=doInstall;
}
function applyTheme(t){ if(t) document.documentElement.dataset.theme=t; else delete document.documentElement.dataset.theme; }

/* ---------- init ---------- */
function init(){
  loadAll();
  buildForm();
  initActions();
  initSettings();
  initLots();
  initSync();
  initPwa();
  var th=ls('sk_theme')||''; applyTheme(th); $('setTheme').value=th;
  $('setTheme').onchange=function(){ ls('sk_theme',this.value); applyTheme(this.value); };
  document.querySelectorAll('[data-go]').forEach(function(b){ b.addEventListener('click',function(e){ e.preventDefault(); setView(b.dataset.go); }); });
  window.addEventListener('hashchange',function(){ setView(location.hash.slice(1)); });
  window.addEventListener('beforeprint',function(){ document.body.classList.add('printing'); scaleSheet(); fit($('pages')); });
  window.addEventListener('afterprint',function(){ document.body.classList.remove('printing'); });
  applyPageStyle();
  renderTypeSel();
  resetAddBtn();
  setView(location.hash.slice(1)||'lots');
  renderLib();
  renderSheet();
  renderPreview();
  loadBg();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ fit($('pages')); renderPreview(); });
  loadSiteConfig().then(function(cfg){
    syncLoad(cfg);
    return loadPublicDb();
  }).then(function(){
    syncState.lastHash=SYNC.token?'':libHash();
    if(syncMode()!=='local') syncNow(false); else setPill('','локально');
  });
}
init();
