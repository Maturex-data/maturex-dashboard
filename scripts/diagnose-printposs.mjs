import { createHash } from "node:crypto";
const token = process.env.PRINTPOSS_API_TOKEN?.trim();
if (!token) throw new Error("PRINTPOSS_API_TOKEN missing");
console.log(JSON.stringify({tokenFingerprint: createHash("sha256").update(token).digest("hex").slice(0,16),node:process.version}));
for (const [label, headers] of [
  ["adapter", {Authorization:`Bearer ${token}`,Accept:"application/json"}],
  ["identified-client", {Authorization:`Bearer ${token}`,Accept:"application/json","User-Agent":"Maturex-COGS-Sync/1.0"}],
]) {
 const r = await fetch("https://api.printposs.com/api/v1/seller/orders?include=items%2Ccosts&page=1&per_page=100", {headers,signal:AbortSignal.timeout(20000)});
 const body = await r.text();let payload;try{payload=JSON.parse(body);}catch{}
 console.log(JSON.stringify({label,status:r.status,contentType:r.headers.get("content-type"),server:r.headers.get("server"),cfRay:r.headers.get("cf-ray"),cfMitigated:r.headers.get("cf-mitigated"),wwwAuthenticate:r.headers.get("www-authenticate"),json:!!payload,success:payload?.success,rows:Array.isArray(payload?.data)?payload.data.length:undefined,title:body.match(/<title[^>]*>(.*?)<\/title>/i)?.[1],cloudflare:/cloudflare/i.test(body),challenge:/just a moment|challenge-platform|cf-chl-|captcha/i.test(body),accessDenied:/access denied|blocked|forbidden/i.test(body),bodyLength:body.length}));
}

let total=0;
for(let page=1;page<=100;page++) {
 const r=await fetch(`https://api.printposs.com/api/v1/seller/orders?include=items%2Ccosts&page=${page}&per_page=100`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json","User-Agent":"Maturex-COGS-Sync/1.0"},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(`Page ${page}: HTTP ${r.status}`);
 const p=await r.json();if(p.success===false||!Array.isArray(p.data))throw Error(`Page ${page}: invalid response`);
 total+=p.data.length;console.log(JSON.stringify({page,status:r.status,rows:p.data.length}));
 if(page>=(p.meta?.last_page||1)){console.log(JSON.stringify({fullPagination:true,pages:page,rows:total}));break;}
}
