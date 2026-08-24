#!/usr/bin/env node
/**
 * dump-transaction-meta.js — save the full DIU field map for Transaction.
 *
 * The test run showed the Transaction entity uses this shape:
 *   Batch → journalEntries.journalEntry.transactions.transaction.<Field>
 *
 * which lines up with our jeIndex / txIndex JE model. We need the complete
 * field list (names, MappingKeys, FieldTypes, required flags) to build the
 * upload workbook correctly.
 *
 * Also re-probes /domain with several permission-flag combinations, because
 * the default (import=true) came back empty — which would block job creation.
 *
 * Writes:
 *   meta-transaction.json   full metadata payload
 *   meta-fields.txt         flattened, readable field list
 *
 * Usage:  node dump-transaction-meta.js [EntityName]
 */

const fs = require('fs');
const path = require('path');
const PROXY  = process.env.PROXY_URL || 'http://localhost:4318';
const ENTITY = process.argv[2] || 'Transaction';

async function get(p){
  const res = await fetch(PROXY + p);
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch(_){ data = { raw: txt.slice(0,400) }; }
  return { status: res.status, data };
}

// Walk the nested Groups/MappingItems structure and flatten every field.
function flatten(node, out, trail){
  if(node == null) return out;
  if(Array.isArray(node)){ node.forEach(n => flatten(n, out, trail)); return out; }
  if(typeof node !== 'object') return out;

  // A MappingItem looks like { name, fullQualifiedName, FieldType, MappingKey }
  if(node.fullQualifiedName || (node.name && node.MappingKey != null)){
    out.push({
      group:    node.GroupName || trail || '',
      name:     node.name || node.Name || '',
      path:     node.fullQualifiedName || '',
      type:     node.FieldType || '',
      key:      node.MappingKey,
      required: node.IsRequired === true || node.Required === true || undefined,
      lookup:   node.LookupValue || undefined
    });
  }
  for(const [k, v] of Object.entries(node)){
    if(v && typeof v === 'object') flatten(v, out, node.GroupName || node.entityName || trail || k);
  }
  return out;
}

(async () => {
  console.log('\n  Dumping DIU metadata for entity: ' + ENTITY);
  console.log('  ' + '─'.repeat(70));

  // ── Domains: the default probe returned [], so try the other flags.
  console.log('\n  Domain access probes (empty list blocks job creation):');
  for(const q of ['import=true', 'import=false', 'add=true', 'access=true', 'read=true', 'post=true', '']){
    const r = await get('/api/diu/domains' + (q ? '?' + q.replace('import=false','import=false') : ''));
    const list = r.data && r.data.domains;
    const n = Array.isArray(list) ? list.length : (list && Array.isArray(list.value) ? list.value.length : '?');
    console.log('    ' + ('?' + (q || '(none)')).padEnd(20) + ' → ' + n + ' domain(s)' +
      (Array.isArray(list) && list.length ? '  ' + JSON.stringify(list).slice(0, 160) : ''));
  }

  // ── Full metadata
  const meta = await get('/api/diu/metadata?entityName=' + encodeURIComponent(ENTITY));
  if(!(meta.data && meta.data.ok)){
    console.log('\n  ✗ metadata call failed:', JSON.stringify(meta.data).slice(0, 400));
    return;
  }

  const raw = meta.data.metadata;
  fs.writeFileSync(path.join(__dirname, 'meta-' + ENTITY.toLowerCase().replace(/\s+/g,'-') + '.json'),
                   JSON.stringify(raw, null, 2));

  const fields = flatten(raw, [], '');
  // De-duplicate on path+name
  const seen = new Set();
  const uniq = fields.filter(f => {
    const k = f.path + '|' + f.name;
    if(seen.has(k)) return false;
    seen.add(k); return true;
  });

  const byGroup = {};
  uniq.forEach(f => { (byGroup[f.group] = byGroup[f.group] || []).push(f); });

  const lines = [];
  lines.push('DIU field map · entity: ' + ENTITY);
  lines.push('='.repeat(72));
  Object.keys(byGroup).sort().forEach(g => {
    lines.push('');
    lines.push('[' + (g || 'ungrouped') + ']  ' + byGroup[g].length + ' fields');
    byGroup[g].forEach(f => {
      lines.push('  ' + (f.name || '').padEnd(38) +
                 (f.type || '').padEnd(14) +
                 'key=' + (f.key != null ? f.key : '—'));
      if(f.path) lines.push('      ' + f.path);
    });
  });
  fs.writeFileSync(path.join(__dirname, 'meta-fields.txt'), lines.join('\n'));

  console.log('\n  ✓ ' + uniq.length + ' fields across ' + Object.keys(byGroup).length + ' groups');
  console.log('    saved: meta-' + ENTITY.toLowerCase().replace(/\s+/g,'-') + '.json');
  console.log('    saved: meta-fields.txt');

  console.log('\n  Groups:');
  Object.keys(byGroup).sort().forEach(g => {
    console.log('    ' + (g || 'ungrouped').padEnd(30) + byGroup[g].length + ' fields');
  });

  console.log('\n  First 30 field names:');
  uniq.slice(0, 30).forEach(f => {
    console.log('    ' + (f.name || '').padEnd(36) + (f.type || ''));
  });
  console.log('');
})();
