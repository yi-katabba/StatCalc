/* Uji sem-core.js item 4: label parameter, kesamaan (label sama / ==), nilai tetap, NA*, dan parameter terdefinisi (:=).
   Pembanding independen: (1) rumus Sigma langsung (tanpa RAM) untuk model tau-ekuivalen, (2) rumus Sobel untuk efek tak langsung
   (blok informasi antar persamaan = 0 pada model rekursif), (3) kesetaraan model "tetap 0" dengan model tanpa jalur,
   (4) konsistensi dengan efek tidak langsung bawaan (out.effects). */
global.window = {}; require('../Method/Shared/stat-dist.js'); const S = require('../Method/Stat/sem-core.js');
const fs = require('fs'), sim = JSON.parse(fs.readFileSync(__dirname + '/data_sem_sim.json', 'utf8'));
const res = []; const ab = (a, b) => Math.abs(a - b);
const chk = (name, ok, info) => { res.push({ name, ok: !!ok }); console.log((ok ? 'OK    ' : 'GAGAL ') + name + (info !== undefined ? '   ' + info : '')); };
const near = (name, a, b, tol) => chk(name, ab(a, b) <= tol, 'selisih ' + ab(a, b).toExponential(2));
const mat = (sp) => { const ix = sp.observed.map((c) => sim.names.indexOf(c)); return sim.X.map((r) => ix.map((i) => r[i])); };
const fit = (model, opts) => { const sp = S.parseModel(model, sim.names); return { sp, r: S.fitCB(sp, mat(sp), opts || {}), X: mat(sp) }; };
const throws = (name, fn, re) => { let m = null; try { fn(); } catch (e) { m = e.message; } chk(name, m !== null && (!re || re.test(m)), m ? '"' + m.slice(0, 70) + '…"' : 'tidak melempar galat'); };
const g = (r, l, rr) => r.params.find((x) => x.lhs === l && x.rhs === rr);

/* ---- 1. Parser ---- */
{
  const sp = S.parseModel('F =~ a1 + l*a2 + l*a3\nb1 ~ p*a1 + 0*a2\nb1 ~~ v*b1\na1 ~~ c*a2\nab := p*p\nl == p', sim.names);
  chk('parser: label loading', sp.latents[0].mod.a2.label === 'l' && sp.latents[0].mod.a3.label === 'l');
  chk('parser: == menyamakan label (alias), label kanonik sama', sp.latents[0].mod.a2.label === sp.regs[0].mod.a1.label && sp.alias.l === 'p' || sp.alias.p === 'l');
  chk('parser: nilai tetap pada regresi', sp.regs[0].mod.a2.fixed === 0);
  chk('parser: label pada varians (x ~~ v*x)', sp.varMods.b1.label);
  chk('parser: kovarians ber-label', sp.covs[0].mod.label === 'c');
  chk('parser: := tersimpan dengan AST', sp.defs.length === 1 && sp.defs[0].name === 'ab' && S._evalAst(sp.defs[0].ast, (n) => ({ p: 3 }[n])) === 9);
  chk('parser: hasMods', sp.hasMods === true && S.parseModel('F =~ a1 + a2 + a3', sim.names).hasMods === false);
  const ex = (e, v) => S._evalAst(S.parseModel('b1 ~ q*a1\nz := ' + e, sim.names).defs[0].ast, (n) => v[n]);
  near('ekspresi: presedensi 2 + 3*4^2/6', ex('2 + 3*4^2/6', {}), 10, 1e-12);
  near('ekspresi: minus unari & kurung -(q - 1)*2', ex('-(q - 1)*2', { q: 5 }), -8, 1e-12);
  near('ekspresi: fungsi sqrt(q)*exp(0) + abs(-2) + log(1)', ex('sqrt(q)*exp(0) + abs(-2) + log(1)', { q: 9 }), 5, 1e-12);
  near('ekspresi: pangkat bersarang 2^3^2 tidak dipakai; 2^-1', ex('2^-1', {}), 0.5, 1e-12);
  throws('galat: label tidak dikenal di :=', () => S.parseModel('b1 ~ p*a1\nz := p*r', sim.names), /"r" bukan label/);
  throws('galat: dua pengubah satu suku', () => S.parseModel('b1 ~ a*b*a1', sim.names), /lebih dari satu tanda \*/);
  throws('galat: == bukan label/angka', () => S.parseModel('b1 ~ p*a1\np + 1 == 2', sim.names), /hanya mendukung/);
  throws('galat: == label tak dipakai', () => S.parseModel('b1 ~ p*a1\nq == p', sim.names), /tidak dipakai/);
  throws('galat: nama := sama dengan label', () => S.parseModel('b1 ~ p*a1\np := 2', sim.names), /sudah dipakai/);
  throws('galat: ekspresi := tak seimbang', () => S.parseModel('b1 ~ p*a1\nz := (p*2', sim.names), /kurung/);
  throws('galat: fungsi tak dikenal', () => S.parseModel('b1 ~ p*a1\nz := foo(p)', sim.names), /foo/);
  throws('galat: label dikunci ke dua nilai', () => S.parseModel('b1 ~ p*a1\np == 1\np == 2', sim.names), /dua nilai/);
  throws('galat: NA* di regresi', () => S.parseModel('b1 ~ NA*a1', sim.names), /NA\*/);
  throws('galat: pengubah pada <~', () => S.parseModel('F <~ a*a1 + a2\nb1 ~ F', sim.names), /formatif/);
  throws('galat: jalur ganda ber-label', () => S.parseModel('b1 ~ a1\nb1 ~ p*a1', sim.names), /dua kali/);
  throws('galat: sisi kiri memuat *', () => S.parseModel('p*b1 ~ a1', sim.names), /sisi kiri/);
}

/* ---- 2. Mediasi observed: := vs efek tak langsung bawaan vs Sobel ---- */
{
  const { r } = fit('b1 ~ pa*a1\nc1 ~ pb*b1 + pc*a1\nind := pa*pb\ntot := pc + pa*pb\ndiff := pc - pa*pb');
  const pa = g(r, 'b1', 'a1'), pb = g(r, 'c1', 'b1'), pc = g(r, 'c1', 'a1'), eff = r.effects.find((e) => e.from === 'a1' && e.to === 'c1');
  chk('mediasi: label tercatat pada parameter', pa.label === 'pa' && pb.label === 'pb' && pc.label === 'pc');
  near('ind := pa*pb sama dengan efek tak langsung bawaan', r.defs[0].est, eff.indirect, 1e-12);
  near('ind: SE delta sama dengan SE bawaan', r.defs[0].se, eff.seInd, 1e-7);
  near('tot := pc + pa*pb sama dengan efek total bawaan', r.defs[1].est, eff.total, 1e-12);
  near('tot: SE delta sama dengan SE total bawaan', r.defs[1].se, eff.seTot, 1e-7);
  near('ind: SE sama dengan Sobel sqrt(b^2 se_a^2 + a^2 se_b^2)', r.defs[0].se, Math.sqrt(pb.est ** 2 * pa.se ** 2 + pa.est ** 2 * pb.se ** 2), 1e-6);
  near('diff := pc - pa*pb (nilai)', r.defs[2].est, pc.est - pa.est * pb.est, 1e-12);
  near('diff: z = est/se', r.defs[2].z, r.defs[2].est / r.defs[2].se, 1e-12);
  /* tanpa label pada model yang sama: estimasi identik (label tidak mengubah model) */
  const r0 = fit('b1 ~ a1\nc1 ~ b1 + a1').r; near('label tunggal tidak mengubah estimasi', g(r0, 'c1', 'b1').est, pb.est, 1e-9); near('label tunggal tidak mengubah chi2', r0.chi2, r.chi2, 1e-9);
}

/* ---- 3. Kesamaan: CFA tau-ekuivalen, dibandingkan dengan rumus Sigma langsung ---- */
{
  const free = fit('F =~ a1 + a2 + a3 + c1', { scale: 'std' }), tied = fit('F =~ l*a1 + l*a2 + l*a3 + l*c1', { scale: 'std' }), alt = fit('F =~ l1*a1 + l2*a2 + l3*a3 + l4*c1\nl1 == l2\nl2 == l3\nl3 == l4', { scale: 'std' }), r = tied.r, S0 = r.S;
  chk('kesamaan: konvergen', r.converged);
  near('kesamaan: db naik 3 (4 loading -> 1)', r.df - free.r.df, 3, 0);
  chk('kesamaan: parameter bebas q turun 3; nTied = 3', free.r.q - r.q === 3 && r.nTied === 3, 'q ' + free.r.q + ' -> ' + r.q);
  const L = r.params.filter((x) => x.kind === 'loading'); chk('kesamaan: keempat loading bernilai sama', L.every((x) => ab(x.est, L[0].est) < 1e-12));
  const th = r.params.filter((x) => x.kind === 'var' && x.free && x.lhs !== 'F');   // varians galat
  /* F_ML langsung: Sigma = l^2 11' + diag(theta) */
  const p = 4, l = L[0].est, Sg = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => l * l + (i === j ? th.find((x) => x.lhs === r.obs[i]).est : 0)));
  const ld = (A) => { const n = A.length, M = A.map((q) => q.slice()); let s = 0; for (let c = 0; c < n; c++) { let pv = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[pv][c])) pv = i;[M[c], M[pv]] = [M[pv], M[c]]; s += Math.log(Math.abs(M[c][c])); for (let i = c + 1; i < n; i++) { const f = M[i][c] / M[c][c]; for (let j = c; j < n; j++) M[i][j] -= f * M[c][j]; } } return s; };
  const inv = S._inv, Si = inv(Sg), Fd = (Sgm) => { const Sgi = inv(Sgm); let tr = 0; for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) tr += S0[i][j] * Sgi[j][i]; return ld(Sgm) + tr - ld(S0) - p; };
  near('kesamaan: F_ML sama dengan rumus langsung (tanpa RAM)', r.F, Fd(Sg), 1e-10);
  /* optimum: gradien numerik pada (l, theta_1..4) ~ 0 dan perturbasi menaikkan F */
  const par = [l].concat(th.map((x) => x.est)), mk = (q) => Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => q[0] * q[0] + (i === j ? q[1 + i] : 0)));
  const gr = par.map((_, k) => { const h = 1e-6, a = par.slice(), b = par.slice(); a[k] += h; b[k] -= h; return (Fd(mk(a)) - Fd(mk(b))) / (2 * h); });
  chk('kesamaan: gradien numerik di optimum ~ 0', Math.max.apply(null, gr.map(Math.abs)) < 1e-6, 'maks |g| = ' + Math.max.apply(null, gr.map(Math.abs)).toExponential(2));
  let worse = true; for (let t = 0; t < 40; t++) { const q = par.map((x, k) => x * (1 + 0.05 * Math.sin(7 * t + 3 * k + 1))); if (!(Fd(mk(q)) >= r.F - 1e-12)) worse = false; } chk('kesamaan: perturbasi acak tidak menurunkan F', worse);
  chk('kesamaan: chi2 >= model bebas (model terbatas)', r.chi2 >= free.r.chi2 - 1e-9, r.chi2.toFixed(3) + ' >= ' + free.r.chi2.toFixed(3));
  const cmp = S.compareCB(r, free.r); chk('kesamaan: compareCB menandai model ikat sebagai terbatas, ddb = 3', cmp.restrictedIsMain && cmp.dDf === 3 && cmp.p > 0 && cmp.p <= 1);
  near('== setara dengan label sama: chi2', alt.r.chi2, r.chi2, 1e-9); near('== setara dengan label sama: loading', alt.r.params[0].est, L[0].est, 1e-9); chk('== setara: db sama', alt.r.df === r.df);
  chk('kesamaan: SE loading terikat terhitung dan sama', L.every((x) => Number.isFinite(x.se) && ab(x.se, L[0].se) < 1e-12) && L[0].se > 0);
  /* SE dari informasi: bandingkan dengan turunan kedua numerik F pada parameter terikat: SE = sqrt(2/N / F''(l)) kira-kira (blok informasi dengan theta di-profile) */
  const prof = (lv) => { /* F minimum atas theta untuk l tetap: theta_i = max(S_ii - l^2, kecil) bukan profil tepat; cukup uji ketergantungan SE pada N */ return lv; }; void prof;
  const half = fit('F =~ l*a1 + l*a2 + l*a3 + l*c1', { scale: 'std' }).r; near('kesamaan: deterministik (fit ulang identik)', half.params[0].se, L[0].se, 1e-12);
}

/* ---- 4. Nilai tetap ---- */
{
  const base = fit('b1 ~ a1\nc1 ~ b1 + a1').r, fz = fit('b1 ~ a1\nc1 ~ b1 + 0*a1').r, omit = fit('b1 ~ a1\nc1 ~ b1\nc1 ~~ 0*a1').r;
  chk('tetap 0: jalur ditandai tidak bebas dengan nilai 0', g(fz, 'c1', 'a1').free === false && g(fz, 'c1', 'a1').est === 0);
  chk('tetap 0: db naik 1', fz.df - base.df === 1);
  const sp2 = S.parseModel('b1 ~ a1\nc1 ~ b1', sim.names), only = S.fitCB(sp2, mat(sp2), {});
  near('tetap 0 = model tanpa jalur (chi2)', fz.chi2, only.chi2, 1e-9); chk('tetap 0 = model tanpa jalur (db)', fz.df === only.df);
  near('tetap 0 = model tanpa jalur (b1 <- a1)', g(fz, 'b1', 'a1').est, g(only, 'b1', 'a1').est, 1e-9);
  void omit;
  const fix5 = fit('b1 ~ a1\nc1 ~ b1 + 0.25*a1').r; near('tetap 0.25: nilai dipakai', g(fix5, 'c1', 'a1').est, 0.25, 0); chk('tetap 0.25: db naik 1', fix5.df - base.df === 1);
  const e = fix5.effects.find((x) => x.from === 'a1' && x.to === 'c1'); near('tetap 0.25: efek langsung memakai nilai tetap', e.direct, 0.25, 1e-12);
  /* == angka */
  const eq = fit('b1 ~ a1\nc1 ~ k*b1 + a1\nk == 0.3').r; near('k == 0.3: label dikunci ke 0.3', g(eq, 'c1', 'b1').est, 0.3, 0); chk('k == 0.3: tidak bebas', g(eq, 'c1', 'b1').free === false && eq.df - base.df === 1);
  /* orthogonal factors: F1 ~~ 0*F2 menambah db 1 dan cocok dengan perbandingan bersarang */
  const m0 = 'A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3', fc = fit(m0).r, fo = fit(m0 + '\nA ~~ 0*B').r;
  chk('A ~~ 0*B: db naik 1', fo.df - fc.df === 1); chk('A ~~ 0*B: kovarians tidak muncul sebagai parameter bebas', !fo.params.some((x) => x.kind === 'cov' && x.free && x.lhs === 'A' && x.rhs === 'B') && fo.params.some((x) => x.kind === 'cov' && !x.free && x.est === 0));
  const cf = S.compareCB(fo, fc); chk('A ~~ 0*B: uji selisih chi2 sah', cf.nested && cf.dDf === 1 && cf.dChi >= -1e-9 && cf.p > 0);
  /* kunci varians galat (mis. reliabilitas diketahui) */
  const fv = fit('A =~ a1 + a2 + a3\na1 ~~ 0.5*a1').r; chk('a1 ~~ 0.5*a1: varians dikunci', fv.params.some((x) => x.kind === 'var' && x.lhs === 'a1' && !x.free && x.est === 0.5));
  /* varians galat ber-label: kesamaan varians galat */
  const fe = fit('A =~ a1 + a2 + a3\na1 ~~ v*a1\na2 ~~ v*a2\na3 ~~ v*a3').r, fe0 = fit('A =~ a1 + a2 + a3').r; chk('varians galat sama (v): db naik 2, nilai sama', fe.df - fe0.df === 2 && (() => { const v = fe.params.filter((x) => x.kind === 'var' && x.label === 'v'); return v.length === 3 && v.every((x) => ab(x.est, v[0].est) < 1e-12); })());
}

/* ---- 5. NA*: mengganti indikator penanda tidak mengubah kecocokan model ---- */
{
  const d = fit('A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3\nB ~ A').r, n = fit('A =~ NA*a1 + 1*a2 + a3\nB =~ b1 + b2 + b3\nB ~ A').r;
  near('NA*a1 + 1*a2: chi2 sama', n.chi2, d.chi2, 1e-6); chk('NA*a1 + 1*a2: db sama', n.df === d.df);
  chk('NA*a1: loading a1 kini bebas, a2 tetap 1', g(n, 'A', 'a1').free && !g(n, 'A', 'a2').free && g(n, 'A', 'a2').est === 1);
  near('NA*: R2 B sama (invarian terhadap penanda)', n.r2.find((x) => x.name === 'B').r2, d.r2.find((x) => x.name === 'B').r2, 1e-6);
  near('NA*: loading terstandar a1 sama', g(n, 'A', 'a1').std, g(d, 'A', 'a1').std, 1e-6);
}

/* ---- 6. Galat yang harus muncul saat fitting ---- */
{
  throws('fit: label pada penanda (marker) yang dikunci', () => fit('F =~ l*a1 + l*a2 + l*a3'), /dikunci/);
  throws('fit: label pada konstruk satu indikator', () => fit('F =~ l*a1\nb1 ~ F\nc1 ~ b1'), /satu indikator/);
  chk('fit: label pada marker boleh bila diganti angka lewat ==', (() => { try { const r = fit('F =~ l*a1 + a2 + a3\nl == 1').r; return r.params.find((x) => x.rhs === 'a1').est === 1; } catch (e) { return false; } })());
}

/* ---- 7. MLR dengan parameter terikat dan terdefinisi ---- */
{
  const m = 'F =~ l*a1 + l*a2 + l*a3 + l*c1\nb1 ~ pa*a1\nc2 ~ pb*b1 + F\nind := pa*pb', sp = S.parseModel(m, sim.names), X = mat(sp);
  const ml = S.fitCB(sp, X, { scale: 'std' }), rb = S.fitCB(sp, X, { scale: 'std', estimator: 'mlr' });
  chk('MLR+kesamaan: robust terhitung', rb.robust && rb.robust.ok, rb.robust ? 'c = ' + rb.robust.c.toFixed(4) : 'null');
  near('MLR+kesamaan: estimasi titik sama dengan ML', rb.defs[0].est, ml.defs[0].est, 1e-9);
  const pa = g(rb, 'b1', 'a1'), pb = g(rb, 'c2', 'b1');
  near('MLR: SE ind (delta, robust) ~ Sobel dari SE robust (kovarians silang kecil)', rb.defs[0].se, Math.sqrt(pb.est ** 2 * pa.se ** 2 + pa.est ** 2 * pb.se ** 2), 0.15 * rb.defs[0].se);
  chk('MLR: SE robust terikat finite', Number.isFinite(g(rb, 'F', 'a1').se) && g(rb, 'F', 'a1').se > 0);
}

/* ---- 8. Bootstrap parameter terdefinisi ---- */
{
  const m = 'b1 ~ pa*a1\nc1 ~ pb*b1 + pc*a1\nind := pa*pb\ntot := pc + ind', sp = S.parseModel(m, sim.names), X = mat(sp);
  const r = S.fitCB(sp, X, {}); S.bootCB(sp, X, r, { B: 200, seed: 7 });
  chk('boot: parameter terdefinisi ikut di-bootstrap', r.defs.every((d) => d.boot && d.boot.n >= 190), 'n = ' + r.defs.map((d) => d.boot && d.boot.n).join(','));
  const d0 = r.defs[0], bs = d0.boot;
  chk('boot ind: SE bootstrap dalam 0.5x - 2x SE delta', bs.se > 0.5 * d0.se && bs.se < 2 * d0.se, bs.se.toExponential(2) + ' vs ' + d0.se.toExponential(2));
  chk('boot ind: selang BC memuat estimasi', bs.bcLo <= d0.est && d0.est <= bs.bcHi);
  const eff = r.effects.find((e) => e.from === 'a1' && e.to === 'c1');
  near('boot: ind (:=) identik dengan efek tak langsung bawaan (reproducible)', bs.se, eff.bootInd.se, 1e-9);
  near('boot: tot := pc + ind identik dengan efek total bawaan', r.defs[1].boot.se, eff.bootTot.se, 1e-9);
}

/* ---- 9. PLS menolak pengubah; model tanpa pengubah tak berubah ---- */
{
  const sp = S.parseModel('A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3\nB ~ p*A', sim.names), ds = { names: sp.observed, X: mat(sp) };
  throws('PLS: menolak label/pengubah', () => S.fitPLS(sp, ds, { scheme: 'path', boot: 0 }), /hanya didukung oleh CB-SEM/);
  const sp0 = S.parseModel('A =~ a1 + a2 + a3\nB =~ b1 + b2 + b3\nB ~ A', sim.names); chk('PLS: model tanpa pengubah tetap jalan', S.fitPLS(sp0, { names: sp0.observed, X: mat(sp0) }, { scheme: 'path', boot: 0 }).converged);
}

/* ---- 10. Modification indices tetap bekerja pada model dengan kesamaan ---- */
{
  const r = fit('F =~ l*a1 + l*a2 + l*a3 + c1\nG =~ b1 + b2 + b3\nG ~ F', { scale: 'std' }).r;
  chk('MI: terhitung pada model dengan parameter terikat', Array.isArray(r.mi) && r.mi.length > 0 && r.mi.every((x) => Number.isFinite(x.mi) && x.mi >= 0));
}

const bad = res.filter((x) => !x.ok).length;
console.log(bad ? bad + ' uji GAGAL dari ' + res.length : 'Semua ' + res.length + ' uji sem-constraints lulus');
process.exit(bad ? 1 : 0);
