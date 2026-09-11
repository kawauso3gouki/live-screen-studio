// Logic-level checks with a minimal DOM/canvas stand-in; not a browser layout test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const elements={};
function element(tag='div'){return {tagName:tag.toUpperCase(),type:'',value:'',checked:false,children:[],style:{},classList:{add(){},remove(){}},addEventListener(event,fn){this['on'+event]=fn},setAttribute(){},append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},click(){},maxLength:-1}}
for(const match of html.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const [,tag,attrs,id]=match,el=element(tag);for(const key of ['type','value','min','max','maxlength']){const a=attrs.match(new RegExp(`\\b${key}="([^"]*)"`));if(a)el[key==='maxlength'?'maxLength':key]=a[1]}el.checked=/\bchecked\b/.test(attrs);elements[id]=el}
elements.ratio.value='portrait';elements.ratio.options=[{value:'portrait'},{value:'landscape'}];elements.fit.value='cover';elements.fit.options=[{value:'cover'},{value:'contain'}];
const drawn=[];const context=new Proxy({measureText:t=>({width:Array.from(t).length*7}),createLinearGradient:()=>({addColorStop(){}}),fillText:(...args)=>drawn.push(args)}, {get:(o,k)=>k in o?o[k]:()=>{}});
elements.canvas.getContext=()=>context;elements.canvas.toBlob=fn=>fn(new Blob(['png']));
const downloads=[];
class MockImage{set src(value){this.width=1600;this.height=900;queueMicrotask(()=>value.includes('broken')?this.onerror():this.onload())}}
const sandbox={document:{getElementById:id=>elements[id],createElement:element},Image:MockImage,Blob,URL:{createObjectURL:b=>{downloads.push(b);return 'blob:test'},revokeObjectURL(){}},setTimeout:()=>0,clearTimeout(){},console};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),sandbox);
async function main(){
 assert.equal(elements.canvas.width,1080);assert.equal(elements.canvas.height,1920);assert.equal(elements.comments.children.length,4);assert(drawn.some(d=>d[0]==='24,800'));
 elements.ratio.value='landscape';elements.ratio.oninput();assert.equal(elements.canvas.width,1920);assert.equal(elements.canvas.height,1080);
 for(let i=0;i<6;i++)elements.addComment.onclick();assert.equal(elements.comments.children.length,8);assert.equal(elements.addComment.disabled,true);
 elements.comments.children[0].children[1].onclick();assert.equal(elements.comments.children.length,7);
 elements.comments.children[0].children[0].value='テスト';elements.comments.children[0].children[0].oninput();
 elements.saveSettings.onclick();const saved=JSON.parse(await downloads.at(-1).text());assert.equal(saved.comments[0].name,'テスト');assert.equal(saved.settings.ratio,'landscape');
 saved.settings.ratio='portrait';saved.settings.likes='987654';saved.background='data:image/png;base64,test';
 await elements.loadSettings.onchange({target:{files:[{size:100,text:async()=>JSON.stringify(saved)}],value:'test'}});
 assert.equal(elements.canvas.width,1080);assert(drawn.some(d=>d[0]==='987,654'));assert.equal(elements.imageInfo.textContent,'設定から復元 · 1600 × 900');
 const before=elements.name.value;
 await elements.loadSettings.onchange({target:{files:[{size:100,text:async()=>JSON.stringify({version:1,settings:{name:'should not apply'},comments:[null]})}],value:'test'}});
 assert.equal(elements.name.value,before);assert.match(elements.toast.textContent,/読み込み失敗/);
 elements.export.onclick();assert.equal(downloads.at(-1).size,3);
 elements.removeImage.onclick();assert.equal(elements.imageInfo.textContent,'サンプル背景を表示中');
 console.log('PASS: portrait/landscape render, counts, comment cap/edit/delete, settings save/restore with image, invalid import atomicity, PNG export callback, background reset.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
