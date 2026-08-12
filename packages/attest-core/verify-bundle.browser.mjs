// packages/attest-core/verify-bundle.browser.mjs
// SINGLE SOURCE of the browser (WebCrypto) verifier — the zero-dependency ESM twin of
// the Node verifyBundle in ./session.js. Every browser surface (verify.html build, the
// worked-example demo, the design mockups) imports BROWSER_VERIFY_JS from here and inlines
// it, so there is ONE canonicalization + rebind implementation to keep in step with Node.
// A cross-implementation golden test (test/verifier-cross-impl.test.js) pins them equal.
export const BROWSER_VERIFY_JS = String.raw`
function canonicalize(v){if(v===null||typeof v!=="object")return JSON.stringify(v);
  if(Array.isArray(v))return "["+v.map(canonicalize).join(",")+"]";
  return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonicalize(v[k])).join(",")+"}";}
const cbytes=v=>new TextEncoder().encode(canonicalize(v));
async function sha256Hex(b){const d=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");}
const seedHash=h=>sha256Hex(cbytes({...h,session_ended_at_utc:null}));
const signedShape=e=>{const{payload_ref,payload,...r}=e;return r;};
const hexToBytes=h=>{const o=new Uint8Array(h.length/2);for(let i=0;i<o.length;i++)o[i]=parseInt(h.substr(i*2,2),16);return o;};
const b64u=s=>{const p=s.replace(/-/g,"+").replace(/_/g,"/")+"==".slice(0,(4-s.length%4)%4);const b=atob(p);const o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;};
function pemToSpki(pem){const c=pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\\\\s+/g,"");const b=atob(c);const o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o.buffer;}
async function verifyBundle(bundle,pem){
  if(!bundle||typeof bundle!=="object")return{ok:false,reason:"bundle_missing"};
  if(bundle.bundle_version!==1)return{ok:false,reason:"unsupported_version"};
  if(!Array.isArray(bundle.events))return{ok:false,reason:"events_not_array"};
  if(!Array.isArray(bundle.signatures)||!bundle.signatures.length)return{ok:false,reason:"signatures_missing"};
  let prev=await seedHash(bundle.header),hashes=[],present=0;
  for(let i=0;i<bundle.events.length;i++){const ev=bundle.events[i];
    if(ev.seq!==i)return{ok:false,reason:"seq_gap",seq:i};
    if(ev.prev_hash!==prev)return{ok:false,reason:"prev_hash_mismatch",seq:i};
    if(ev.payload!==undefined&&ev.payload!==null){const rh=await sha256Hex(cbytes(ev.payload));if(rh!==ev.payload_hash)return{ok:false,reason:"payload_hash_mismatch",seq:i};present++;}
    const own=await sha256Hex(cbytes(signedShape(ev)));hashes.push(own);prev=own;}
  const concat=new Uint8Array(hashes.length*32);hashes.forEach((h,i)=>concat.set(hexToBytes(h),i*32));
  const root=await sha256Hex(concat);
  if(root!==bundle.batch_root)return{ok:false,reason:"batch_root_mismatch"};
  const sig=bundle.signatures[0];
  if(sig.algorithm!=="ed25519")return{ok:false,reason:"unsupported_algorithm"};
  if(!pem)return{ok:false,reason:"public_key_missing"};
  let key;try{key=await crypto.subtle.importKey("spki",pemToSpki(pem),{name:"Ed25519"},false,["verify"]);}catch(e){return{ok:false,reason:"public_key_import_failed"};}
  let ok;try{ok=await crypto.subtle.verify({name:"Ed25519"},key,b64u(sig.signature),hexToBytes(root));}catch(e){return{ok:false,reason:"signature_malformed"};}
  if(!ok)return{ok:false,reason:"signature_verification_failed"};
  return {ok:true,keyId:sig.key_id,batchRoot:root,sourceResolution:(present>0&&present===bundle.events.length?"VERIFIED":"NOT_PRESENT")};
}`;

// The RICHER 6-field-matrix verifier (record_integrity / signature / hash_chain /
// profile / source_resolution / external_anchor). Single source for verify.html —
// injected there by scripts/build-verify-html.mjs. Do not hand-copy this algorithm.
export const BROWSER_VERIFY_MATRIX_JS = String.raw`// ── real evidence verifier (mirror of verify/verify-bundle.mjs) ──
function canonicalize(v){if(v===null||typeof v!=="object")return JSON.stringify(v);
  if(Array.isArray(v))return "["+v.map(canonicalize).join(",")+"]";
  return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonicalize(v[k])).join(",")+"}";}
const cbytes=v=>new TextEncoder().encode(canonicalize(v));
async function sha256Hex(b){const d=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");}
const seedHash=h=>sha256Hex(cbytes({...h,session_ended_at_utc:null}));
const signedShape=e=>{const{payload_ref,payload,...r}=e;return r;};
const hexToBytes=h=>{const o=new Uint8Array(h.length/2);for(let i=0;i<o.length;i++)o[i]=parseInt(h.substr(i*2,2),16);return o;};
const b64u=s=>{const p=s.replace(/-/g,"+").replace(/_/g,"/")+"==".slice(0,(4-s.length%4)%4);const b=atob(p);const o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;};
function pemToSpki(pem){const c=pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g,"");const b=atob(c);const o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o.buffer;}

async function verifyBundle(bundle,pem){
  const M={record_integrity:"NOT_CHECKED",hash_chain:"NOT_CHECKED",signature:"NOT_CHECKED",profile:"NOT_CHECKED",source_resolution:"NOT_PRESENT",external_anchor:"NOT_PRESENT"};
  const F=(seq,reason)=>({ok:false,matrix:M,failedSeq:(typeof seq==="number"?seq:null),reason});
  if(!bundle||typeof bundle!=="object"){M.record_integrity="MALFORMED";return F(null,"bundle_missing");}
  if(bundle.bundle_version!==1){M.profile="UNSUPPORTED";return F(null,"bundle_unsupported_version");}
  M.profile="VERIFIED";
  if(!Array.isArray(bundle.events))return F(null,"events_not_array");
  if(!Array.isArray(bundle.signatures)||!bundle.signatures.length)return F(null,"signatures_missing");
  let prev=await seedHash(bundle.header),hashes=[],present=0;
  for(let i=0;i<bundle.events.length;i++){const ev=bundle.events[i];
    if(ev.seq!==i){M.hash_chain="FAILED";return F(i,"seq_gap");}
    if(ev.prev_hash!==prev){M.hash_chain="FAILED";return F(i,"prev_hash_mismatch");}
    // Rebind inline plaintext to its signed payload_hash — catches a plaintext edit
    // (e.g. verdict BLOCK→APPROVE) that leaves the chain + signature intact.
    if(ev.payload!==undefined&&ev.payload!==null){const rh=await sha256Hex(cbytes(ev.payload));if(rh!==ev.payload_hash){M.source_resolution="FAILED";return F(i,"payload_hash_mismatch");}present++;}
    const own=await sha256Hex(cbytes(signedShape(ev)));hashes.push(own);prev=own;}
  const concat=new Uint8Array(hashes.length*32);hashes.forEach((h,i)=>concat.set(hexToBytes(h),i*32));
  const root=await sha256Hex(concat);
  if(root!==bundle.batch_root){M.hash_chain="FAILED";return F(null,"batch_root_mismatch");}
  M.hash_chain="VERIFIED";M.record_integrity="VERIFIED";
  const sig=bundle.signatures[0];
  if(sig.algorithm!=="ed25519"){M.signature="UNSUPPORTED";return F(null,"signatures_unsupported_algorithm");}
  if(!pem){M.signature="NOT_CHECKED";return F(null,"public_key_missing");}
  let key;try{key=await crypto.subtle.importKey("spki",pemToSpki(pem),{name:"Ed25519"},false,["verify"]);}catch(e){M.signature="MALFORMED";return F(null,"public_key_import_failed");}
  let ok;try{ok=await crypto.subtle.verify({name:"Ed25519"},key,b64u(sig.signature),hexToBytes(root));}
  catch(e){M.signature="MALFORMED";return F(null,"signature_malformed");}  // garbage base64 → clean FAILED, not an uncaught atob error
  if(!ok){M.signature="FAILED";return F(null,"signature_verification_failed");}
  M.signature="VERIFIED";
  // source_resolution VERIFIED only when every event's plaintext was present AND rebound
  // to its hash; otherwise leave NOT_PRESENT (never over-claim what we can't see).
  if(present>0&&present===bundle.events.length)M.source_resolution="VERIFIED";
  if(Array.isArray(bundle.external_anchors)&&bundle.external_anchors.length)M.external_anchor="NOT_CHECKED";
  return {ok:true,matrix:M,batchRoot:root,sessionId:bundle.header.session_id,keyId:sig.key_id,algorithm:sig.algorithm};
}`;
