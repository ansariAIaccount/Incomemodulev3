#!/usr/bin/env node
/**
 * set-token.js — safely install the Investran bearer JWT into .env
 *
 * Why this exists: the token is ~700 chars of base64url with no checksum.
 * Pasting it through a shell command risks history leakage and mangling by
 * quoting/line-wrapping. This reads it from stdin, validates the structure,
 * shows you the decoded claims so you can confirm it's the right token for
 * the right tenant, then rewrites only the INVESTRAN_BEARER_TOKEN line.
 *
 * Usage:
 *   node set-token.js          → interactive paste
 *   pbpaste | node set-token.js → take it straight from the clipboard
 */

const fs   = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '.env');
const KEY      = 'INVESTRAN_BEARER_TOKEN';

function decodeSegment(seg){
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(pad, 'base64').toString('utf8'));
}

function fail(msg){
  console.error('\n  ✗ ' + msg + '\n');
  process.exit(1);
}

function install(raw){
  // Strip whitespace/newlines a copy-paste may have introduced, plus any
  // wrapping quotes or a leading "Bearer " the user may have included.
  let token = String(raw).replace(/\s+/g, '').replace(/^["']|["']$/g, '');
  if(/^Bearer/i.test(token)) token = token.replace(/^Bearer/i, '');

  if(!token) fail('No token received.');

  const parts = token.split('.');
  if(parts.length !== 3){
    fail('That does not look like a JWT — expected 3 dot-separated segments, got ' +
         parts.length + '.\n    Make sure you copied the whole token including the signature.');
  }

  let header, claims;
  try { header = decodeSegment(parts[0]); }
  catch(_){ fail('Could not decode the JWT header — the token is truncated or corrupted.'); }
  try { claims = decodeSegment(parts[1]); }
  catch(_){ fail('Could not decode the JWT payload — the token is truncated or corrupted.'); }

  // ── Show what we got so the operator can sanity-check the tenant ──
  const exp     = claims.exp ? new Date(claims.exp * 1000) : null;
  const daysLeft = exp ? Math.floor((exp - Date.now()) / 86400000) : null;

  console.log('\n  Token decoded successfully:\n');
  console.log('    Algorithm    ', header.alg || '—');
  console.log('    Audience     ', claims.aud || '—');
  console.log('    Issuer       ', claims.iss || '—');
  console.log('    Subject      ', claims.sub || '—');
  console.log('    Database     ', claims.Database || '(none in token)');
  console.log('    Server       ', claims.Server || '(none in token)');
  console.log('    Session tok  ', claims.accessToken ? claims.accessToken.slice(0, 8) + '…' : '(none)');
  console.log('    Issued       ', claims.iat ? new Date(claims.iat * 1000).toISOString() : '—');
  console.log('    Expires      ', exp ? exp.toISOString() : '—',
                                   daysLeft !== null ? ('  (' + daysLeft + ' days left)') : '');
  console.log('    Length       ', token.length, 'chars');

  if(exp && daysLeft < 0)  fail('This token EXPIRED ' + Math.abs(daysLeft) + ' day(s) ago. Request a fresh one from FIS.');
  if(exp && daysLeft <= 7) console.log('\n  ⚠  Expires in ' + daysLeft + ' day(s) — line up a replacement.');
  if(claims.aud && claims.aud !== 'investran-web-api'){
    console.log('\n  ⚠  Audience is "' + claims.aud + '", expected "investran-web-api".');
    console.log('     This may be a token for a different API.');
  }

  // ── Rewrite only the token line, preserving everything else ──
  if(!fs.existsSync(ENV_PATH)) fail('.env not found at ' + ENV_PATH);
  const original = fs.readFileSync(ENV_PATH, 'utf8');

  // Back up once so a bad run is always recoverable.
  const backup = ENV_PATH + '.bak';
  if(!fs.existsSync(backup)) fs.writeFileSync(backup, original, { mode: 0o600 });

  let updated;
  const line = KEY + '=' + token;
  if(new RegExp('^' + KEY + '=', 'm').test(original)){
    updated = original.replace(new RegExp('^' + KEY + '=.*$', 'm'), line);
  } else {
    updated = original.replace(/\s*$/, '\n') + line + '\n';
  }
  fs.writeFileSync(ENV_PATH, updated, { mode: 0o600 });

  console.log('\n  ✓ Written to .env  (backup at .env.bak, permissions 600)');
  console.log('\n  Next:  npm start\n');
}

// ── Input: piped stdin, or an interactive prompt ──
if(!process.stdin.isTTY){
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => { buf += d; });
  process.stdin.on('end', () => install(buf));
} else {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n  Paste the Investran bearer JWT, then press Enter.');
  console.log('  (Tip: pbpaste | node set-token.js  avoids the paste entirely.)\n');
  rl.question('  Token: ', ans => { rl.close(); install(ans); });
}
