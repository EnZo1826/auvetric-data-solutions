// Real HTTP integration test against Next's production endpoint and an explicitly local test receiver.
// No email is sent. This checks provider acceptance/rejection semantics, not mail delivery.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
let accept=true, received=[];
const receiver=http.createServer(async(req,res)=>{let text='';for await(const c of req)text+=c;received.push(JSON.parse(text));res.writeHead(accept?202:503);res.end();});
await new Promise(r=>receiver.listen(0,'127.0.0.1',r));
const webhookPort=receiver.address().port;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3078'],{
  env:{...process.env,CONTACT_PROVIDER:'webhook',CONTACT_WEBHOOK_URL:`http://127.0.0.1:${webhookPort}`,TURNSTILE_SECRET_KEY:''},stdio:['ignore','pipe','pipe']
});
let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const url='http://localhost:3078/api/contact';
function fields(overrides={}){return {...{intent:'project',name:'Integration Test',organisation:'Synthetic Test Only',email:'test@example.com',interest:'Not sure yet',description:'Local HTTP test of enquiry acceptance; no mail is sent.',consent:'on',started:String(Date.now()-10000)},...overrides};}
async function send(values){const f=new FormData();for(const [k,v] of Object.entries(values)) f.set(k,v);const r=await fetch(url,{method:'POST',body:f});return {status:r.status,body:await r.json()};}
try{
  let ready=false;
  for(let i=0;i<60;i++){try{await fetch('http://localhost:3078/');ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
  assert.ok(ready,output);
  let r=await send(fields()); assert.equal(r.status,200);assert.equal(r.body.ok,true);assert.equal(received.length,1);assert.equal(received[0].enquiry.email,'test@example.com');
  accept=false;r=await send(fields());assert.equal(r.status,502);assert.notEqual(r.body.ok,true);
  r=await send(fields({email:'not-email'}));assert.equal(r.status,422);assert.ok(r.body.fieldErrors.email);
  r=await send(fields({website:'bot.example'}));assert.equal(r.status,400);
  r=await send(fields({started:String(Date.now())}));assert.equal(r.status,400);
  r=await send(fields());assert.equal(r.status,429);
  console.log('Contact integration: local receiver acceptance 200; rejection 502; validation 422; honeypot/timing 400; rate limit 429 passed. No external mail sent.');
}finally{server.kill();receiver.close();}
