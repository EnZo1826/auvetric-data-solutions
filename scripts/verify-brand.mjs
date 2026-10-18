import assert from 'node:assert/strict';
import fs from 'node:fs';
import { agency } from '../src/data/agency.ts';
import { founders } from '../src/data/founders.ts';
assert.equal(agency.name,'Auvetric Data Solutions','Confirmed agency name must replace the working brand');
assert.equal(agency.shortName,'Auvetric');
assert.equal(agency.futureDomain,'auvetric.com','Record future domain without switching current hosting');
assert.equal(agency.legalName,null,'Brand confirmation is not legal registration confirmation');
assert.equal(founders.find(f=>f.id==='alex').links.find(l=>l.href==='https://github.com/AL3XNA')?.label,'GitHub — AL3XNA');
const css=fs.readFileSync('src/app/globals.css','utf8');
assert.match(css,/--color-eng:\s*#0069f5/i);
assert.match(css,/--color-data:\s*#00d4ea/i);
assert.match(css,/--color-danger:\s*#f16b77/i,'Faults remain visually distinct from the blue brand');
assert.ok(fs.existsSync('public/brand/auvetric-mark.png'));
assert.ok(fs.existsSync('public/brand/auvetric-logo-original.png'));
for(const p of ['src/components/layout/SiteHeader.tsx','src/components/layout/SiteFooter.tsx','src/app/opengraph-image.tsx']){
 const s=fs.readFileSync(p,'utf8');assert.ok(!/NEXUS|INTELLIGENCE/.test(s),`Old visible brand in ${p}`);
}
assert.ok(!fs.existsSync('public/CNAME'),'Do not switch GitHub Pages to the future domain yet');
const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
assert.ok(workflow.includes('NEXT_PUBLIC_BASE_PATH: /auvetric-data-solutions'),'Pages base path must match renamed repository');
assert.ok(workflow.includes('https://enzo1826.github.io/auvetric-data-solutions'),'Canonical URL must match renamed repository');
assert.equal(JSON.parse(fs.readFileSync('package.json','utf8')).name,'auvetric-data-solutions');
for(const p of ['next.config.ts','scripts/build-pages.mjs','scripts/verify-pages.mjs','.github/workflows/pages.yml','package.json']){
 assert.ok(!fs.readFileSync(p,'utf8').includes('nexus-intelligence'),`Old repository name remains in ${p}`);
}
console.log('Auvetric branding: name, palette, error semantics, logo assets, Alex link and deferred domain passed.');
