global.window={};require(__dirname+'/../Method/Shared/stat-dist.js');
const B=require(__dirname+'/../Method/Stat/basic-core.js');
const R=JSON.parse(require('fs').readFileSync(__dirname+'/ref_basic.json','utf8').replace(/-Infinity/g,'-1e999').replace(/Infinity/g,'1e999'));
const rel=(a,b)=>Math.abs(a-b)/Math.max(1e-12,Math.abs(b));let w={};const up=(k,e)=>{w[k]=Math.max(w[k]||0,e)};
const alt={'two-sided':'two',greater:'greater',less:'less'};
R.forEach(c=>{
 if(c.k==='corr'){const p=B.pearson(c.x,c.y),t=B.rTest(p.r,p.n),f=B.fisherCI(p.r,p.n,.95),s=B.spearman(c.x,c.y),k=B.kendall(c.x,c.y);
  up('pearson r',Math.abs(p.r-c.pr[0]));up('pearson p',rel(t.p,c.pr[1]));up('fisher ci',Math.max(Math.abs(f[0]-c.pr[2]),Math.abs(f[1]-c.pr[3])));
  up('spearman r',Math.abs(s.r-c.sp[0]));up('spearman p',rel(s.p,c.sp[1]));up('kendall tau',Math.abs(k.r-c.kd[0]));up('kendall p',rel(k.p,c.kd[1]));return}
 const a=alt[c.alt];let r=c.k==='one'?B.tOne(c.x,c.mu0,a,.95):c.k==='two'?B.tTwo(c.x,c.y,0,a,.95,c.ev):B.tPaired(c.x,c.y,0,a,.95);
 const key=c.k+(c.k==='two'?(c.ev?'-pooled':'-welch'):'');
 up(key+' t',rel(r.t,c.t));up(key+' df',rel(r.df,c.df));up(key+' p',rel(r.p,c.p));
 const e=(a,b)=>isFinite(b)?Math.abs(a-b):(a===b?0:1);up(key+' ci',Math.max(e(r.ci[0],c.ci[0]),e(r.ci[1],c.ci[1])));
});
console.log(R.length,'kasus');Object.keys(w).forEach(k=>console.log(k.padEnd(18),w[k].toExponential(2)));
const bad=Object.keys(w).filter(k=>w[k]>1e-9);console.log(bad.length?'GAGAL: '+bad.join(', '):'SEMUA COCOK (<1e-9)');
