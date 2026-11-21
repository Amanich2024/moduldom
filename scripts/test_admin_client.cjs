// Verify publication requests without using a real credential or changing GitHub.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const fixture=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const nodes=new Map(),calls=[];
function node(){return {innerHTML:'',textContent:'',className:'',disabled:false,value:'',classList:{toggle(){}},showModal(){},close(){}};}
const context=vm.createContext({console,TextEncoder,TextDecoder,Uint8Array,URL,Blob,Date,Math,JSON,Number,String,Array,Object,RegExp,Promise,Error,Set,
 document:{querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return[];}},
 localStorage:{getItem(){return null;},setItem(){},removeItem(){}},window:{addEventListener(){}},confirm(){return true;},
 btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),setTimeout:fn=>fn(),
 fetch:async(url,opts={})=>{calls.push({url,opts});let result;
 if(url.startsWith('../'))result=fixture;
 else if(url.includes('/git/ref/heads/'))result={object:{sha:'base'}};
 else if(url.includes('/git/commits/base'))result={tree:{sha:'old-tree'}};
 else if(url.endsWith('/git/blobs'))result={sha:'new-blob'};
 else if(url.endsWith('/git/trees'))result={sha:'new-tree'};
 else if(url.endsWith('/git/commits'))result={sha:'new-commit'};
 else if(url.endsWith('/git/refs/heads/main'))result={object:{sha:'new-commit'}};
 else if(url.includes('/actions/runs?'))result={workflow_runs:[{name:'Publish studio',status:'completed',conclusion:'success'}]};
 else throw Error('Unexpected request '+url);
 return {ok:true,status:200,json:async()=>structuredClone(result)};
 }});
vm.runInContext(fs.readFileSync('admin/admin.js','utf8'),context);
(async()=>{
 await new Promise(r=>setImmediate(r));
 assert.equal(vm.runInContext('validate().length',context),0);
 vm.runInContext("data.projects[0].warm=-10",context);
 assert(vm.runInContext('validate().length',context)>0);
 vm.runInContext('data=clone(original);pending={".github/workflows/pwn.yml":"bad"}',context);
 assert(vm.runInContext('validate().length',context)>0);
 vm.runInContext('pending={};data.projects[0].name="Client publication regression";dirty=true;token="fake-test-only";baseSha="base";',context);
 await vm.runInContext('publish()',context);
 const tree=calls.find(x=>x.url.endsWith('/git/trees'));
 assert.equal(JSON.parse(tree.opts.body).tree[0].path,'data/catalog.json');
 const commit=calls.find(x=>x.url.endsWith('/git/commits'));
 assert.deepEqual(JSON.parse(commit.opts.body).parents,['base']);
 const update=calls.find(x=>x.url.endsWith('/git/refs/heads/main'));
 assert.equal(JSON.parse(update.opts.body).force,false);
 assert.equal(vm.runInContext('dirty',context),false);
 assert(nodes.get('#notice').textContent.includes('успешно опубликован'));
 console.log('PASS validation, unsafe backup rejection, atomic commit, non-force publication and successful build status');
})().catch(e=>{console.error(e);process.exit(1);});
