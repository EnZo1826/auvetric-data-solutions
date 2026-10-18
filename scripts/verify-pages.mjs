import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const base=process.env.NEXT_PUBLIC_BASE_PATH || '/nexus-intelligence';
assert.ok(fs.existsSync('out/index.html'), 'GitHub Pages build must produce a static home page');
const paths=['','contact','lab','solutions','industries','work','about','approach','insights','privacy','terms','solutions/engineering-development','work/master-data-reconciliation'];
for(const p of paths){const file=path.join('out',p,'index.html');assert.ok(fs.existsSync(file),`Static deep link missing: ${p}`);}
const contact=fs.readFileSync('out/contact/index.html','utf8');
assert.ok(contact.includes('Enquiries are not available on this static preview'), 'Pages contact must honestly show static-host limitation');
assert.ok(!/<form[ >]/.test(contact),'Pages must not render a form whose server endpoint does not exist');
assert.ok(!fs.existsSync('out/api/contact'),'Pages build must not pretend to expose contact backend');
for(const p of paths){const html=fs.readFileSync(path.join('out',p,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)){
    assert.ok(m[1].startsWith(base+'/')||m[1]===base,`Unprefixed path on ${p}: ${m[1]}`);
  }
}
assert.ok(fs.existsSync('out/.nojekyll'));
console.log('Pages: static/deep routes, base-path assets/links, no broken enquiry form or API, and .nojekyll passed.');
