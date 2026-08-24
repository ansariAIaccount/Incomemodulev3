#!/usr/bin/env node
/**
 * probe-mcp.js — talk to the Investran MCP gateway the way it expects.
 *
 * Finding so far: every path on investranweb-livedev-us returns 405/406,
 * never 404. Uniform 405/406 across nonsense paths means a catch-all
 * handler, not ten real routes. Combined with 405-on-GET for /api/mcp,
 * this is a JSON-RPC / MCP endpoint:
 *
 *   - requires POST (hence 405 on GET)
 *   - requires Accept: application/json, text/event-stream (hence 406)
 *
 * If this handshake succeeds we get the full tool list, which tells us
 * whether the DIU operations (dataimport_create_job etc.) are callable
 * through this gateway. If they are, the Node proxy can post JEs via
 * JSON-RPC instead of hunting for a REST API that may not be exposed.
 *
 * Usage:  node probe-mcp.js
 */

require('dotenv').config();

const URL_MCP = process.env.INVESTRAN_MCP_URL
  || 'https://investranweb-livedev-us.fiscloudservices.com/api/mcp';
const TOKEN = (process.env.INVESTRAN_BEARER_TOKEN || '').trim();

function claims(){
  try {
    const p = TOKEN.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(Buffer.from(p + '='.repeat((4 - p.length % 4) % 4), 'base64').toString('utf8'));
  } catch(_){ return {}; }
}
const C = claims();

// MCP over HTTP wants BOTH json and event-stream in Accept.
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream',
  'Authorization': 'Bearer ' + TOKEN,
  'X-Investran-Database':    C.Database    || '',
  'X-Investran-Server':      C.Server      || '',
  'X-Investran-AccessToken': C.accessToken || ''
};

async function rpc(method, params, id){
  const body = { jsonrpc: '2.0', id: id || 1, method };
  if(params) body.params = params;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(URL_MCP, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } finally { clearTimeout(t); }
  const txt = await res.text();
  return { status: res.status, ct: res.headers.get('content-type') || '', txt };
}

// MCP may reply as SSE ("data: {...}") rather than plain JSON.
function parseMaybeSSE(txt){
  const trimmed = txt.trim();
  if(trimmed.startsWith('{')){
    try { return JSON.parse(trimmed); } catch(_){ return null; }
  }
  const line = trimmed.split('\n').find(l => l.startsWith('data:'));
  if(line){
    try { return JSON.parse(line.slice(5).trim()); } catch(_){ return null; }
  }
  return null;
}

(async () => {
  console.log('\n  Investran MCP gateway probe');
  console.log('  url    :', URL_MCP);
  console.log('  tenant :', C.Database || '(none)');
  console.log('  ' + '─'.repeat(72) + '\n');

  // 1 · initialize — the MCP handshake
  console.log('  → initialize');
  try {
    const r = await rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'pcs-loan-module-probe', version: '1.0.0' }
    }, 1);
    console.log('    HTTP', r.status, '·', r.ct);
    const j = parseMaybeSSE(r.txt);
    if(j && j.result){
      console.log('    ✓ server:', JSON.stringify(j.result.serverInfo || j.result).slice(0, 160));
    } else if(j && j.error){
      console.log('    ✗ rpc error:', JSON.stringify(j.error).slice(0, 220));
    } else {
      console.log('    raw:', r.txt.slice(0, 300).replace(/\s+/g, ' '));
    }
  } catch(err){
    console.log('    ✗', err.message);
  }

  // 2 · tools/list — the payoff. Shows every callable operation.
  console.log('\n  → tools/list');
  try {
    const r = await rpc('tools/list', {}, 2);
    console.log('    HTTP', r.status, '·', r.ct);
    const j = parseMaybeSSE(r.txt);
    if(j && j.result && Array.isArray(j.result.tools)){
      const tools = j.result.tools;
      console.log('    ✓ ' + tools.length + ' tools exposed\n');
      const diu = tools.filter(t => /import|job|batch|journal|gl|account/i.test(t.name));
      if(diu.length){
        console.log('    Data-import / accounting relevant:\n');
        diu.forEach(t => console.log('      • ' + t.name + (t.description ? ' — ' + String(t.description).slice(0, 90) : '')));
      }
      console.log('\n    All tool names:');
      console.log('      ' + tools.map(t => t.name).join(', '));
    } else if(j && j.error){
      console.log('    ✗ rpc error:', JSON.stringify(j.error).slice(0, 300));
    } else {
      console.log('    raw:', r.txt.slice(0, 400).replace(/\s+/g, ' '));
    }
  } catch(err){
    console.log('    ✗', err.message);
  }

  console.log('\n  ' + '─'.repeat(72) + '\n');
})();
