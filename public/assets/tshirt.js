
(function(){
  var SIZES=["S","M","L","XL","XXL","XXXL"];
  var $=function(id){return document.getElementById(id)};
  var data={price:0,gpay:"",upi:"",orders:[],sizePrices:{}},loaded=false;
  var admin=false,editing=-1,busy=false,pending=null;

  function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
  function inr(v){return "₹"+Math.round(v||0).toLocaleString("en-IN")}
  function n(v){v=Number(v);return isFinite(v)&&v>0?Math.floor(v):0}
  function pieces(o){return SIZES.reduce(function(t,s){return t+n(o[s])},0)}
  function status(due,rec){if(due>0&&rec>=due)return["Paid","paid"];if(rec>0)return["Part paid","part"];return["Pending","pending"]}
  function flash(node,text,err){node.textContent=text;node.className="msg"+(err?" err":"")}
  function clone(x){return JSON.parse(JSON.stringify(x))}
  function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function sizeTotals(){var t={};SIZES.forEach(function(s){t[s]=0});data.orders.forEach(function(o){SIZES.forEach(function(s){t[s]+=n(o[s])})});return t}

  function buildSizeInputs(){
    var box=$("sizeInputs");box.textContent="";
    SIZES.forEach(function(s){
      var l=el("label","f sz");l.htmlFor="fSz"+s;l.appendChild(el("span","label",s));
      var i=el("input");i.id="fSz"+s;i.type="number";i.min="0";i.step="1";i.inputMode="numeric";i.placeholder="0";
      i.addEventListener("input",updateFormDue);l.appendChild(i);box.appendChild(l);
    });
  }
  function priceOf(s){return n(data.sizePrices&&data.sizePrices[s])||n(data.price)}
  function dueOf(o){return SIZES.reduce(function(t,s){return t+n(o[s])*priceOf(s)},0)}
  function useData(d){data=d;if(!Array.isArray(data.orders))data.orders=[];if(!data.sizePrices)data.sizePrices={};if(Array.isArray(data.sizes)&&data.sizes.length)SIZES=data.sizes;buildSizeInputs()}
  buildSizeInputs();

  function render(){
    var price=n(data.price),t=sizeTotals(),tot=0,due=0,rec=0,paid=0;
    var tags=$("tags");tags.textContent="";
    SIZES.forEach(function(s){tot+=t[s];var d=el("div","tag"+(t[s]?"":" zero"));d.appendChild(el("span",null,s));d.appendChild(el("b",null,String(t[s])));tags.appendChild(d)});
    var td=el("div","tag total");td.appendChild(el("span",null,"TOTAL"));td.appendChild(el("b",null,String(tot)));tags.appendChild(td);

    var rows=$("rows");rows.textContent="";
    if(!data.orders.length){var r1=el("tr");var c1=el("td","empty wide",!loaded?"Loading orders…":admin?"No orders yet. Use Add order, or upload a list in the Admin section.":"No orders have been entered yet.");c1.colSpan=9;r1.appendChild(c1);rows.appendChild(r1)}
    data.orders.forEach(function(o,i){
      var p=pieces(o),d=dueOf(o),r=n(o.received),st=status(d,r);
      due+=d;rec+=r;if(st[1]==="paid")paid++;
      var tr=el("tr");
      function cell(cls,label,text){var c=el("td",cls,text);if(label)c.dataset.l=label;tr.appendChild(c);return c}
      cell("num","No.",String(i+1));
      var nm=cell("name","Name",o.name||"(no name)");if(o.note)nm.appendChild(el("span","note",o.note));
      var sc=cell("wide","Sizes");var ch=el("div","chips");
      SIZES.forEach(function(s){if(n(o[s]))ch.appendChild(el("span","chip",s+" × "+n(o[s])))});
      if(!ch.childNodes.length)ch.appendChild(el("span","note","none"));sc.appendChild(ch);
      cell("r num","Pieces",String(p));cell("r num","Due",inr(d));cell("r num","Received",inr(r));cell("r num","Balance",inr(d-r));
      var s=cell("","Status");s.appendChild(el("span","pill "+st[1],st[0]));
      var a=cell("r","");
      if(admin){var b=el("button","small","Edit");b.type="button";b.addEventListener("click",function(){openForm(i)});a.appendChild(b)}
      rows.appendChild(tr);
    });
    var foot=$("foot");foot.textContent="";
    if(data.orders.length){
      var f=el("tr");
      [["","",""],["name","","Total"],["wide","",""],["r num","Pieces",String(tot)],["r num","Due",inr(due)],["r num","Received",inr(rec)],["r num","Balance",inr(due-rec)],["","",""],["","",""]].forEach(function(x){var c=el("td",x[0],x[2]);if(x[1])c.dataset.l=x[1];f.appendChild(c)});
      foot.appendChild(f);
    }
    $("sDue").textContent=inr(due);$("sRec").textContent=inr(rec);$("sBal").textContent=inr(due-rec);$("sPaid").textContent=paid+" of "+data.orders.length;
    var extra=SIZES.filter(function(s){return priceOf(s)!==price}).map(function(s){return s+" "+inr(priceOf(s))}).join(", ");
    $("priceLine").textContent=(price?inr(price)+" per T-shirt"+(extra?" ("+extra+")":"")+". ":"")+"Who ordered which size, and who has paid.";
    $("paySec").hidden=!(data.upi||data.gpay);$("gpay").textContent=data.gpay||"–";$("upi").textContent=data.upi||"–";
    $("addBtn").hidden=!admin;$("copySizes").hidden=!admin;$("adminSec").hidden=!admin;
  }

  /* ---- server calls ---- */
  var MAP={data:"orders",save:"orders"};
  function api(action,body){return GB.api(MAP[action],body)}
  function fillAdmin(){$("aPrice").value=n(data.price)||"";$("aGpay").value=data.gpay||"";$("aUpi").value=data.upi||"";$("aSizes").value=SIZES.join(", ");
    $("aSizePrices").value=SIZES.filter(function(s){return data.sizePrices[s]}).map(function(s){return s+"="+data.sizePrices[s]}).join(", ")}
  function save(next,doneMsg,msgNode){
    if(busy)return;busy=true;flash(msgNode,"Saving…");
    api("save",next).then(function(j){
      useData(j.data||next);busy=false;pending=null;closeForm();render();fillAdmin();
      $("upApply").hidden=true;$("upPreview").hidden=true;$("upText").value="";$("upFile").value="";
      flash(msgNode,"");flash($("pageMsg"),doneMsg);
    },function(e){
      busy=false;
      if(e.status===401||e.status===403){GB.setAdmin(false);flash($("pageMsg"),"Your admin session has ended. Log in again to make changes.",true)}
      else flash(msgNode,"Could not save. Check your connection and try again.",true);
    });
  }

  /* ---- copy ---- */
  function copy(text,btn){
    var fail=function(){flash($("pageMsg"),"Copy was blocked here. Select the text and copy it by hand.",true)};
    try{navigator.clipboard.writeText(text).then(function(){var o=btn.textContent;btn.textContent="Copied";setTimeout(function(){btn.textContent=o},1600)},fail)}catch(e){fail()}
  }
  $("copySizes").addEventListener("click",function(){
    var t=sizeTotals(),tot=0,lines=["GB T-Shirt order"];
    SIZES.forEach(function(s){tot+=t[s];lines.push(s+" - "+t[s])});lines.push("Total - "+tot);copy(lines.join("\n"),this);
  });
  $("copyUpi").addEventListener("click",function(){copy($("upi").textContent,this)});

  /* ---- add / edit one order ---- */
  function formPieces(){return SIZES.reduce(function(t,s){return t+n($("fSz"+s).value)},0)}
  function formDue(){return SIZES.reduce(function(t,s){return t+n($("fSz"+s).value)*priceOf(s)},0)}
  function updateFormDue(){$("fDue").textContent=inr(formDue())}
  var confirmDelete=false;
  function openForm(i){
    editing=i;confirmDelete=false;var o=i>=0?data.orders[i]:null;
    $("formTitle").textContent=o?"Edit order":"Add order";
    $("fName").value=o?o.name||"":"";$("fNote").value=o?o.note||"":"";
    SIZES.forEach(function(s){$("fSz"+s).value=o&&n(o[s])?n(o[s]):""});
    $("fRec").value=o&&n(o.received)?n(o.received):"";$("fDate").value=o&&o.paidOn?o.paidOn:"";
    $("fDelete").hidden=!o;$("fDelete").textContent="Delete order";flash($("fMsg"),"");
    updateFormDue();$("orderForm").hidden=false;$("fName").focus();$("orderForm").scrollIntoView({block:"nearest"});
  }
  function closeForm(){$("orderForm").hidden=true;editing=-1}
  $("addBtn").addEventListener("click",function(){openForm(-1)});
  $("fCancel").addEventListener("click",closeForm);
  $("fFull").addEventListener("click",function(){$("fRec").value=formDue();if(!$("fDate").value)$("fDate").value=today()});
  $("orderForm").addEventListener("submit",function(ev){
    ev.preventDefault();
    var name=$("fName").value.trim();
    if(!name){flash($("fMsg"),"Enter a name.",true);$("fName").focus();return}
    if(!formPieces()){flash($("fMsg"),"Enter at least one piece against a size.",true);return}
    var o={name:name,note:$("fNote").value.trim(),received:n($("fRec").value),paidOn:$("fDate").value||""};
    SIZES.forEach(function(s){o[s]=n($("fSz"+s).value)});
    var next=clone(data);if(editing>=0)next.orders[editing]=o;else next.orders.push(o);
    save(next,editing>=0?"Order updated.":"Order added.",$("fMsg"));
  });
  $("fDelete").addEventListener("click",function(){
    if(editing<0)return;
    if(!confirmDelete){confirmDelete=true;this.textContent="Confirm delete";return}
    var next=clone(data);next.orders.splice(editing,1);save(next,"Order deleted.",$("fMsg"));
  });

  /* ---- upload: CSV with a header row, or one person per line ---- */
  function parseCSV(text,delim){
    var rows=[],row=[],cur="",q=false;
    for(var i=0;i<text.length;i++){var c=text[i];
      if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
      else if(c==='"')q=true;else if(c===delim){row.push(cur);cur=""}
      else if(c==="\n"){row.push(cur);rows.push(row);row=[];cur=""}else if(c!=="\r")cur+=c}
    row.push(cur);rows.push(row);return rows;
  }
  function isoDate(v){v=String(v||"").trim();var m;
    if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
    if((m=v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)))return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
    return ""}
  function parseUpload(text){
    text=String(text||"").replace(/[\u200B-\u200F\u2060\uFEFF]/g,"");
    var lines=text.split(/\r?\n/).filter(function(l){return l.trim()});
    if(!lines.length)return{people:[],skipped:[]};
    var first=lines[0],delim=first.indexOf("\t")>=0?"\t":((first.split(";").length>first.split(",").length)?";":",");
    var head=parseCSV(first,delim)[0].map(function(h){return h.trim().toLowerCase()});
    var people=[],skipped=[];
    if(head.indexOf("name")>=0){
      var col={};head.forEach(function(h,i){
        if(h==="name")col.name=i;else if(SIZES.indexOf(h.toUpperCase())>=0)col[h.toUpperCase()]=i;
        else if(h.indexOf("received")>=0)col.received=i;else if(h.indexOf("paid on")>=0||h==="date"||h==="payment date")col.paidOn=i;
        else if(h==="note"||h==="notes")col.note=i});
      parseCSV(text,delim).slice(1).forEach(function(r){
        var name=(r[col.name]||"").trim();if(!name||/^total$/i.test(name))return;
        var p={name:name};SIZES.forEach(function(s){p[s]=col[s]==null?0:n(String(r[col[s]]||"").replace(/[^\d.]/g,""))});
        if(col.received!=null&&String(r[col.received]||"").trim()!=="")p.received=n(String(r[col.received]).replace(/[^\d.]/g,""));
        if(col.paidOn!=null){var d=isoDate(r[col.paidOn]);if(d)p.paidOn=d}
        if(col.note!=null)p.note=(r[col.note]||"").trim();
        if(pieces(p))people.push(p);else skipped.push(name+" (no sizes)");
      });
    }else{
      var ALIAS={};["2XL","3XL","4XL"].forEach(function(a,i){var t="XX"+"X".repeat(i)+"L";if(SIZES.indexOf(t)>=0&&SIZES.indexOf(a)<0)ALIAS[a]=t});
      var toks=SIZES.concat(Object.keys(ALIAS)).sort(function(a,b){return b.length-a.length});
      var re=new RegExp("\\b("+toks.join("|")+")\\s*[-:;=x×]?\\s*(\\d+)","gi");
      lines.forEach(function(line){
        var l=line.replace(/^\s*\d+\s*[).:\-]\s*/,""),m,firstAt=-1,p={};SIZES.forEach(function(s){p[s]=0});
        re.lastIndex=0;while((m=re.exec(l))){if(firstAt<0)firstAt=m.index;var z=m[1].toUpperCase();p[ALIAS[z]||z]+=n(m[2])}
        var name=(firstAt<0?l:l.slice(0,firstAt)).replace(/[\s\-:–,]+$/,"").trim();
        if(!name||firstAt<0||!pieces(p)){skipped.push(line.trim());return}
        p.name=name;people.push(p);
      });
    }
    return{people:people,skipped:skipped};
  }
  function key(s){return String(s||"").toLowerCase().replace(/\s+/g,"")}
  function base(s){return key(String(s||"").replace(/\(.*?\)/g,""))}
  function mergeUpload(people,replace){
    var next=clone(data),added=[],updated=[],seen=[];
    people.forEach(function(p){
      var k=key(p.name),idx=-1;
      next.orders.forEach(function(o,i){if(idx<0&&key(o.name)===k)idx=i});
      if(idx<0&&k===base(p.name)){var hits=[];next.orders.forEach(function(o,i){if(base(o.name)===k)hits.push(i)});if(hits.length===1)idx=hits[0]}
      if(idx>=0){var o=next.orders[idx];SIZES.forEach(function(s){o[s]=p[s]});
        if(p.received!=null)o.received=p.received;if(p.paidOn)o.paidOn=p.paidOn;if(p.note!=null&&p.note!=="")o.note=p.note;
        updated.push(o.name);seen.push(idx)}
      else{var o2={name:p.name,note:p.note||"",received:p.received||0,paidOn:p.paidOn||""};SIZES.forEach(function(s){o2[s]=p[s]});
        next.orders.push(o2);added.push(p.name);seen.push(next.orders.length-1)}
    });
    var removed=[];
    if(replace){next.orders=next.orders.filter(function(o,i){if(seen.indexOf(i)>=0)return true;removed.push(o.name);return false})}
    return{next:next,added:added,updated:updated,removed:removed};
  }
  function showCheck(text){
    var res=parseUpload(text),ul=$("upPreview");ul.textContent="";pending=null;$("upApply").hidden=true;
    if(!res.people.length){ul.hidden=true;flash($("upMsg"),"No names with sizes were found. Use one person per line, for example: Sunny - M-1, S-1",true);return}
    var m=mergeUpload(res.people,$("upReplace").checked);pending=m;
    res.people.forEach(function(p){var parts=[];SIZES.forEach(function(s){if(p[s])parts.push(s+" × "+p[s])});
      ul.appendChild(el("li",null,p.name+": "+parts.join(", ")+(p.received!=null?" · received "+inr(p.received):"")))});
    res.skipped.forEach(function(s){ul.appendChild(el("li","note","Skipped, could not read: "+s))});
    ul.hidden=false;$("upApply").hidden=false;
    flash($("upMsg"),m.added.length+" new, "+m.updated.length+" updated"+(m.removed.length?", "+m.removed.length+" removed":"")+(res.skipped.length?", "+res.skipped.length+" skipped":"")+". Check the list, then save.");
  }
  $("upCheck").addEventListener("click",function(){
    var f=$("upFile").files&&$("upFile").files[0],txt=$("upText").value;
    if(f){var r=new FileReader();r.onload=function(){showCheck(String(r.result))};r.onerror=function(){flash($("upMsg"),"Could not read that file.",true)};r.readAsText(f)}
    else if(txt.trim())showCheck(txt);
    else flash($("upMsg"),"Choose a file or paste a list first.",true);
  });
  $("upApply").addEventListener("click",function(){if(pending)save(pending.next,"List updated from upload.",$("upMsg"))});

  /* ---- price and payment details ---- */
  $("aSave").addEventListener("click",function(){
    var next=clone(data);next.price=n($("aPrice").value);next.gpay=$("aGpay").value.trim();next.upi=$("aUpi").value.trim();
    var sizes=$("aSizes").value.split(/[,\s]+/).map(function(x){return x.toUpperCase().replace(/[^A-Z0-9]/g,"")}).filter(function(x,i,a){return x&&a.indexOf(x)===i});
    if(!sizes.length){flash($("aMsg"),"Enter at least one size.",true);return}
    var gone=SIZES.filter(function(z){return sizes.indexOf(z)<0&&data.orders.some(function(o){return n(o[z])})});
    if(gone.length){flash($("aMsg"),"Pieces are ordered in "+gone.join(", ")+". Change those orders first, then remove the size.",true);return}
    next.sizes=sizes;next.sizePrices={};
    $("aSizePrices").value.split(/[,;\n]+/).forEach(function(part){var m=/^\s*([A-Za-z0-9]+)\s*[=:\-]\s*(\d+)\s*$/.exec(part);if(m&&sizes.indexOf(m[1].toUpperCase())>=0)next.sizePrices[m[1].toUpperCase()]=n(m[2])});
    save(next,"Price and payment details saved.",$("aMsg"));
  });

  /* ---- report download: the server only sends it to a logged-in admin ---- */
  $("dlBtn").addEventListener("click",function(){if(admin)window.location.href="/api/report"});

  render();
  api("data").then(function(j){useData(j);loaded=true;render();fillAdmin()},
    function(){loaded=true;render();flash($("pageMsg"),"Could not load the order list. Reload the page to try again.",true)});
  GB.onAdmin(function(a){admin=a;if(!a)closeForm();render();if(a)fillAdmin()});
})();
