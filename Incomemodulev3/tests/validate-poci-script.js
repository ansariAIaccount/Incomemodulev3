const engine=require('/sessions/affectionate-wonderful-curie/mnt/Incomemodulev3/Incomemodulev3/tests/engine-loader.js');
const fs=require('fs');
const DOC='/sessions/affectionate-wonderful-curie/mnt/Incomemodulev3/Incomemodulev3/Demo Scripts/PCS-Demo-Script-POCI-Three-Scenarios.md';
const md=fs.readFileSync(DOC,'utf8');
const N=s=>+String(s).replace(/,/g,'');
function inst(ecl,revs){return{id:'X',positionId:'P',securityId:'S',instrumentKind:'loan',legalEntity:'Bank',leid:1,
 deal:'X',position:'X',incomeSecurity:'X',counterpartyId:'C',transactionId:'T',currency:'USD',accountingFramework:'IFRS',
 faceValue:100e6,purchasePrice:60e6,commitment:100e6,settlementDate:'2026-01-01',maturityDate:'2031-12-31',
 availabilityEnd:'2026-01-01',dayBasis:'ACT/360',holidayCalendar:'usFederal',creditImpairedAtAcquisition:true,
 coupon:{type:'Fixed',fixedRate:0.08,floatingRate:0,spread:0,floor:null,cap:null},couponFrequency:'quarterly',
 principalSchedule:[],fees:[],ifrs:{ifrs9Classification:'AmortisedCost',sppiPassed:true,businessModel:'HoldToCollect',
 ecLStage:1,lifetimeECLAtAcquisition:ecl,computeECL:true,lifetimeECLRevisions:revs||[]},eclStage:1};}
const D={
  PAR :{ecl:40e6,target:60e6,revs:[]},
  MID :{ecl:22e6,target:78e6,revs:[]},
  POCI:{ecl:25e6,target:75e6,revs:[{date:'2028-01-01',amount:15e6}]}
};
for(const k of Object.keys(D)){
  const rows=engine.buildSchedule(inst(D[k].ecl,D[k].revs));
  const at=d=>rows.filter(r=>r.date<=d).pop();
  const win=(a,b)=>rows.filter(r=>r.date>=a&&r.date<=b);
  const sum=(a,f)=>a.reduce((t,r)=>t+(+r[f]||0),0);
  D[k].rows=rows; D[k].at=at; D[k].win=win; D[k].sum=sum;
  D[k].eir=rows[0].eirYieldUsed;
}
let pass=0, fail=0;
const chk=(label,claimed,actual,tol)=>{
  tol = tol==null ? 0.005 : tol;
  const ok = Math.abs(claimed-actual) <= tol;
  ok?pass++:fail++;
  console.log(`  ${ok?'ok  ':'FAIL'}  ${label.padEnd(44)} doc ${claimed.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}).padStart(16)}   engine ${actual.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}).padStart(16)}`);
};
const has=(label,re)=>{ const m=md.match(re); if(!m){console.log(`  FAIL  ${label} — not found in doc`); fail++; return null;} return m; };

console.log('\n── EIR rates (nominal ACT/360) ──');
for(const [k,nm] of [['POCI','DEMO-POCI'],['MID','DEMO-POCI-MID'],['PAR','DEMO-POCI-PAR']]){
  const m=has(nm+' rate', new RegExp('`'+nm+'` \\| ([0-9.]+)% \\| ([0-9.]+)%'));
  if(m){ chk(nm+' nominal %', N(m[1]), D[k].eir*100, 0.0001);
         chk(nm+' annual-effective %', N(m[2]), (Math.pow(1+D[k].eir/360,365)-1)*100, 0.0001); }
}
console.log('\n── PAR ──');
chk('Q1 EIR income',  2000000.00, D.PAR.sum(D.PAR.win('2026-01-01','2026-03-31'),'dailyCash')+D.PAR.sum(D.PAR.win('2026-01-01','2026-03-31'),'amortDaily'));
chk('Q1 cash coupon', 2000000.00, D.PAR.sum(D.PAR.win('2026-01-01','2026-03-31'),'dailyCash'));
chk('Q1 accretion',         0.00, D.PAR.sum(D.PAR.win('2026-01-01','2026-03-31'),'amortDaily'));
chk('Q1 carrying',   60000000.00, D.PAR.at('2026-03-31').carryingValue);
for(const y of [2026,2027,2028,2029,2030,2031]) chk('carrying end-'+y, 60000000.00, D.PAR.at(y+'-12-31').carryingValue);
chk('EIR = 8% x 100/60', 13.3333, 8*100/60, 0.0001);
chk('total coupon over life', 48688888.89, D.PAR.sum(D.PAR.rows,'dailyCash'));
chk('total collected',      108688888.89, D.PAR.sum(D.PAR.rows,'dailyCash')+60e6);

console.log('\n── MID ──');
const q1m=D.MID.win('2026-01-01','2026-03-31'), y1m=D.MID.win('2026-01-01','2026-12-31');
chk('Q1 EIR income',  2442432.33, D.MID.sum(q1m,'dailyCash')+D.MID.sum(q1m,'amortDaily'));
chk('Q1 cash coupon', 2000000.00, D.MID.sum(q1m,'dailyCash'));
chk('Q1 accretion',    442432.33, D.MID.sum(q1m,'amortDaily'));
chk('Q1 carrying',   60442432.33, D.MID.at('2026-03-31').carryingValue);
const mpath=[[2026,61911008.89,1911008.89],[2027,64163617.56,4163617.56],[2028,66826779.27,6826779.27],
             [2029,69958099.74,9958099.74],[2030,73649155.10,13649155.10],[2031,78000000.00,18000000.00]];
for(const [y,cv,acc] of mpath){ chk('carrying end-'+y, cv, D.MID.at(y+'-12-31').carryingValue);
                                chk('accreted-to-date '+y, acc, D.MID.at(y+'-12-31').cumAmort); }
for(const [y,acc,un] of [[2026,1911008.89,16088991.11],[2029,9958099.74,8041900.26],[2031,18000000.00,0.00]])
  chk('identity '+y+' (acc+unacc=18m)', 18000000.00, acc+un, 0.02);
chk('Year1 EIR income', 10022120.00, D.MID.sum(y1m,'dailyCash')+D.MID.sum(y1m,'amortDaily'));
chk('Year1 cash coupon', 8111111.11, D.MID.sum(y1m,'dailyCash'));
chk('Year1 accretion',   1911008.89, D.MID.sum(y1m,'amortDaily'));
chk('total collected',  126688888.89, D.MID.sum(D.MID.rows,'dailyCash')+78e6);

console.log('\n── POCI (with the 2028 revision) ──');
const y1p=D.POCI.win('2026-01-01','2026-12-31');
chk('Year1 EIR income', 9725015.22, D.POCI.sum(y1p,'dailyCash')+D.POCI.sum(y1p,'amortDaily'));
chk('Year1 cash coupon',8111111.11, D.POCI.sum(y1p,'dailyCash'));
chk('Year1 accretion',  1613904.11, D.POCI.sum(y1p,'amortDaily'));
const ppath=[[2026,61613904.11],[2027,63507762.30],[2028,65736726.58],[2029,68345745.59],[2030,71407335.18],[2031,75000000.00]];
for(const [y,cv] of ppath) chk('gross carrying end-'+y, cv, D.POCI.at(y+'-12-31').carryingValue);
chk('allowance 31 Dec 2027',        0.00, D.POCI.at('2027-12-31').eclAllowance);
chk('gross  1 Jan 2028',     63513378.23, D.POCI.at('2028-01-01').carryingValue);
chk('allowance 1 Jan 2028', -10000000.00, D.POCI.at('2028-01-01').eclAllowance);
chk('net    1 Jan 2028',     73513378.23, D.POCI.at('2028-01-01').netCarryingValue);
chk('net   31 Dec 2031',     85000000.00, D.POCI.at('2031-12-31').netCarryingValue);
chk('EIR unchanged by revision', D.POCI.eir*100, D.POCI.at('2028-06-01').eirYieldUsed*100, 1e-9);
chk('total collected (expected)', 123688888.89, D.POCI.sum(D.POCI.rows,'dailyCash')+75e6);
chk('total collected (face)',     148688888.89, D.POCI.sum(D.POCI.rows,'dailyCash')+100e6);

console.log(`\n${fail? 'FAILURES: '+fail : 'ALL '+pass+' CHECKS TIE'}   (${pass} passed, ${fail} failed)`);
process.exit(fail?1:0);
