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
