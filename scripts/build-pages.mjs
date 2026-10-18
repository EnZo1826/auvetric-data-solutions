// Isolated static build for GitHub Pages. The normal source and server API are never moved/deleted.
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root=process.cwd(), stage=path.join(root,'.pages-build');
await rm(stage,{recursive:true,force:true});
await mkdir(stage,{recursive:true});
for(const f of ['src','public','package.json','tsconfig.json','next.config.ts','postcss.config.mjs','eslint.config.mjs']) {
  await cp(path.join(root,f),path.join(stage,f),{recursive:true,filter:(source)=>{
    const rel=path.relative(root,source).replaceAll('\\','/');
    // Server-only parts (API, CRM, middleware) can't exist in a static export.
    return !['src/app/api','src/app/crm','src/crm','src/middleware.ts'].some((x)=>rel===x||rel.startsWith(x+'/'));
  }});
}
const base=process.env.NEXT_PUBLIC_BASE_PATH || '/auvetric-data-solutions';
const env={...process.env,NEXUS_PAGES_BUILD:'true',NEXT_PUBLIC_STATIC_SITE:'true',NEXT_PUBLIC_BASE_PATH:base,
  NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL || `https://enzo1826.github.io${base}`,
  NEXT_PUBLIC_ALLOW_INDEXING:'false'};
const r=spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build',stage],{env,stdio:'inherit'});
if(r.status!==0) process.exit(r.status||1);
const out=path.join(root,'out');
await rm(out,{recursive:true,force:true});
await cp(path.join(stage,'out'),out,{recursive:true});
await writeFile(path.join(out,'.nojekyll'),'');
console.log(`GitHub Pages export ready: ${out} (base path ${base})`);
