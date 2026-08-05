// packages/attest-core/seal-bundle.browser.mjs
// SINGLE SOURCE of the browser (WebCrypto) SEALER — the client-side twin of session.js's
// createSession/appendEvent/sealSession. Lets a page produce a REAL signed, hash-chained
// evidence bundle entirely in the browser (no server, no PII leaving the machine — Shadow's
// local-first thesis), byte-compatible with the Node verifyBundle. Every event embeds its
// plaintext (embedPayloads) so the sealed record is self-contained + rebindable.
//
// A cross-implementation test (test/seal-cross-impl.test.js) seals with this module (run under
// Node's WebCrypto) and verifies the result with the Node verifyBundle — pinning byte-parity.
export const BROWSER_SEAL_JS = String.raw`
function canonicalize(v){if(v===null||typeof v!=="object")return JSON.stringify(v);
  if(Array.isArray(v))return "["+v.map(canonicalize).join(",")+"]";
  return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonicalize(v[k])).join(",")+"}";}
const cbytes=v=>new TextEncoder().encode(canonicalize(v));
async function sha256Hex(b){const d=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");}
const seedHash=h=>sha256Hex(cbytes({...h,session_ended_at_utc:null}));
const signedShape=e=>{const{payload_ref,payload,...r}=e;return r;};
const hexToBytes=h=>{const o=new Uint8Array(h.length/2);for(let i=0;i<o.length;i++)o[i]=parseInt(h.substr(i*2,2),16);return o;};
function b64u(bytes){let s=btoa(String.fromCharCode(...new Uint8Array(bytes)));return s.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function pemFromSpki(der){const b=btoa(String.fromCharCode(...new Uint8Array(der)));const lines=b.match(/.{1,64}/g).join("\n");return "-----BEGIN PUBLIC KEY-----\n"+lines+"\n-----END PUBLIC KEY-----\n";}

// events: [{ event_type, actor, payload, ts_utc? }]. Builds the header, chains + embeds every
// event, appends session_end, signs the batch root with a freshly-generated Ed25519 key.
// Returns { bundle, publicKeyPem }.
async function sealBundle({ agent, models=[], environmentFingerprint, keyId="browser-demo", sessionId, startedAtUtc, endedAtUtc, events }){
  const nowIso = startedAtUtc || new Date().toISOString();
  const header = {
    session_id: sessionId || [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,"0")).join(""),
    session_started_at_utc: nowIso,
    session_ended_at_utc: null,
    agent: { name: agent.name, version: agent.version, identity_ref: agent.identity_ref ?? null },
    models: models.map(m=>({ model_id:m.model_id, provider:m.provider??null, sampling_params_hash:m.sampling_params_hash??null })),
    environment_fingerprint: { os: environmentFingerprint.os, node_version: environmentFingerprint.node_version, hostname_hash: environmentFingerprint.hostname_hash ?? null },
    schema_versions: { bundle: 1, attest_core: "2.0.0" },
  };
  let prev = await seedHash(header);
  const built = [];
  const all = events.slice();
  const ended = endedAtUtc || nowIso;
  all.push({ event_type:"session_end", actor:"system", payload:{ event_count: events.length, session_duration_ms: Date.parse(ended)-Date.parse(nowIso) }, ts_utc: ended });
  for(let i=0;i<all.length;i++){
    const ev = all[i];
    const payload = ev.payload ?? {};
    const payloadHash = await sha256Hex(cbytes(payload));
    const rec = { seq:i, ts_utc: ev.ts_utc || nowIso, event_type: ev.event_type, actor: ev.actor,
      payload_hash: payloadHash, payload_ref: "sha256:"+payloadHash, prev_hash: prev, extensions:{}, payload };
    const own = await sha256Hex(cbytes(signedShape(rec)));
    prev = own;
    built.push(rec);
  }
  header.session_ended_at_utc = ended;
  const eventHashes = [];
  for(const e of built) eventHashes.push(await sha256Hex(cbytes(signedShape(e))));
  const concat = new Uint8Array(eventHashes.length*32);
  eventHashes.forEach((h,i)=>concat.set(hexToBytes(h), i*32));
  const batchRoot = await sha256Hex(concat);
  const kp = await crypto.subtle.generateKey({name:"Ed25519"}, true, ["sign","verify"]);
  const sig = await crypto.subtle.sign({name:"Ed25519"}, kp.privateKey, hexToBytes(batchRoot));
  const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
  const bundle = { bundle_version:1, spec_version:"shadow-evidence/v1", header, events: built, batch_root: batchRoot,
    signatures:[{ algorithm:"ed25519", key_id: keyId, signature: b64u(sig), signed_at_utc: new Date().toISOString() }] };
  return { bundle, publicKeyPem: pemFromSpki(spki) };
}
`;
