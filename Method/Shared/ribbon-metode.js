/* =========================================================================
   RIBBON METODE — pita bertab di atas halaman metode Stat (gaya pita Calc)
   -------------------------------------------------------------------------
   Pita hanya MENGATUR TAMPILAN / PILIHAN UJI; langkah-langkah perhitungan
   di halaman tidak berubah. Muat SEBELUM Method/Stat/*.js.

   StatRibbon.mount({
     view: '#view-anova',                       // halaman metode
     key: 'anova',                              // id unik (dipakai untuk kelas CSS)
     tabs: [{
       id: 'hasil', label: 'Hasil',
       groups: [{ label: 'Tab hasil', items: [
         { type: 'toggle', key: 'steps', label: 'Langkah perhitungan',
           tab: 'an-tab-steps',                 // (opsional) id tab hasil yang disembunyikan
           hide: ['#an-conclusion-card'],       // (opsional) selektor yang disembunyikan
           def: true },                         // tampil secara bawaan
         { type: 'select', id: 'asmNormTest', label: 'Normalitas', options: [['jb','Jarque-Bera']], selected: 'jb' },
       ] }],
       tip: 'Teks bantu di bawah pita (HTML)', tipId: 'asmTestHint'   // keduanya opsional
     }],
   });

   Jenis item tambahan (dipakai halaman Graph): { type:'text'|'number', id, label, placeholder, def },
   { type:'color', id, label, def }, { type:'check', id, label, def }. Opsi cfg.onChange dipanggil
   tiap ada perubahan nilai di pita.

   Kelas CSS pada halaman: .rb-off-{key-toggle} -> bagian disembunyikan.
   ========================================================================= */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const CSS = `
.rb-main{ padding:0; overflow:hidden; }
.rb-tabs{ display:flex; gap:2px; padding:8px 10px 0; background:var(--paper-2); border-bottom:1px solid var(--rule-strong); overflow-x:auto; scrollbar-width:none; }
.rb-tabs::-webkit-scrollbar{ display:none; }
.rb-tab{ flex:1 1 0; max-width:150px; min-height:42px; padding:0 16px; border:1px solid transparent; border-bottom:none; border-radius:10px 10px 0 0; background:transparent; color:var(--ink-soft); font-family:var(--font-body); font-size:14px; font-weight:700; cursor:pointer; margin-bottom:-1px; white-space:nowrap; }
.rb-tab:hover{ color:var(--ink); background:rgba(255,255,255,.55); }
.rb-tab[aria-selected="true"]{ background:#fff; color:var(--accent); border-color:var(--rule-strong); box-shadow:inset 0 3px 0 var(--accent-2); }
.rb-panel{ display:none; background:#fff; }
.rb-panel.on{ display:block; }
.rb-body{ display:flex; flex-wrap:nowrap; align-items:stretch; padding:10px 8px 4px; overflow-x:auto; scrollbar-width:thin; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain; }
.rb-grp{ flex:0 0 auto; display:flex; flex-direction:column; padding:0 12px; border-right:1px solid var(--rule); }
.rb-grp:last-child{ border-right:none; }
.rb-gbody{ flex:1; display:grid; grid-template-columns:repeat(var(--rb-cols,2),max-content); gap:6px 8px; align-items:center; align-content:center; }
.rb-glabel{ text-align:center; font-size:11px; font-weight:700; letter-spacing:.04em; color:var(--ink-faint); padding:6px 0 4px; }
.rb-fld{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.rb-fld > label{ font-size:11.5px; font-weight:600; color:var(--ink-soft); line-height:1.2; }
.rb-main .select-input{ width:190px; min-width:0; height:40px; border-radius:10px; font-size:14px; padding:0 8px; }
.rb-chk{ display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; padding:8px 10px; border:1px solid var(--rule); border-radius:12px; background:var(--paper-2); cursor:pointer; line-height:1.2; }
.rb-chk input{ width:18px; height:18px; flex-shrink:0; accent-color:var(--accent); }
.rb-main .plain-input{ width:160px; min-width:0; height:40px; border-radius:10px; font-size:14px; padding:0 10px; text-align:left; font-family:var(--font-body); }
.rb-color{ display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:13px; font-weight:600; padding:6px 10px; border:1px solid var(--rule); border-radius:12px; background:var(--paper-2); cursor:pointer; line-height:1.2; white-space:nowrap; }
.rb-color input{ width:36px; height:30px; padding:0; border:1px solid var(--rule-strong); border-radius:8px; background:#fff; cursor:pointer; flex-shrink:0; }
.rb-tip{ margin:0; padding:6px 16px 12px; font-size:12.5px; color:var(--ink-soft); border-bottom:1px solid var(--rule); }
`;
  function injectCSS() {
    if (document.getElementById('rb-style')) return;
    const st = document.createElement('style'); st.id = 'rb-style'; st.textContent = CSS; document.head.appendChild(st);
  }

  function mount(cfg) {
    const view = $(cfg.view);
    if (!view || view.querySelector('.rb-main')) return null;
    injectCSS();
    const k = cfg.key;
    const rules = [], toggles = [];
    const itemHTML = (it) => {
      if (it.type === 'text' || it.type === 'number') {
        return `<div class="rb-fld"><label for="${it.id}">${esc(it.label)}</label><input type="text" class="plain-input" id="${it.id}"${it.type === 'number' ? ' inputmode="decimal"' : ''} placeholder="${esc(it.placeholder || '')}" value="${esc(it.def === undefined || it.def === null ? '' : it.def)}" autocomplete="off"></div>`;
      }
      if (it.type === 'color') {
        return `<label class="rb-color" for="${it.id}">${esc(it.label)}<input type="color" id="${it.id}" value="${esc(it.def || '#000000')}"></label>`;
      }
      if (it.type === 'check') {
        return `<label class="rb-chk" for="${it.id}"><input type="checkbox" id="${it.id}"${it.def ? ' checked' : ''}> ${esc(it.label)}</label>`;
      }
      if (it.type === 'select') {
        const opts = it.options.map(([v, l]) => `<option value="${esc(v)}"${v === it.selected ? ' selected' : ''}>${esc(l)}</option>`).join('');
        return `<div class="rb-fld"><label for="${it.id}">${esc(it.label)}</label><select id="${it.id}" class="select-input">${opts}</select></div>`;
      }
      const cls = 'rb-off-' + it.key;
      toggles.push(it);
      const sels = (it.hide || []).slice();
      if (it.tab) sels.push(`.tab-btn[data-tab="${it.tab}"]`, `#${it.tab}`);
      if (sels.length) rules.push(sels.map((s) => `${cfg.view}.${cls} ${s}`).join(',') + '{display:none !important;}');
      return `<label class="rb-chk"><input type="checkbox" data-rb="${it.key}"${it.def === false ? '' : ' checked'}> ${esc(it.label)}</label>`;
    };
    const tabsHTML = cfg.tabs.map((t, i) => `<button type="button" class="rb-tab" role="tab" data-rbtab="${t.id}" aria-selected="${i === 0}">${esc(t.label)}</button>`).join('');
    const panelsHTML = cfg.tabs.map((t, i) => `
      <div class="rb-panel${i === 0 ? ' on' : ''}" data-rbpanel="${t.id}" role="tabpanel">
        <div class="rb-body">${t.groups.map((g) => `
          <div class="rb-grp"><div class="rb-gbody" style="--rb-cols:${g.cols || (g.items.length > 3 ? 2 : g.items.length)}">${g.items.map(itemHTML).join('')}</div><div class="rb-glabel">${esc(g.label)}</div></div>`).join('')}
        </div>
        ${t.tip ? `<p class="rb-tip"${t.tipId ? ` id="${t.tipId}"` : ''}>${t.tip}</p>` : ''}
      </div>`).join('');
    const sec = document.createElement('section');
    sec.className = 'card rb-main';
    sec.setAttribute('aria-label', 'Pita pengaturan ' + k);
    sec.innerHTML = `<div class="rb-ribbon"><div class="rb-tabs" role="tablist">${tabsHTML}</div>${panelsHTML}</div>`;
    const head = view.querySelector('.chapter-head');
    if (head && head.parentNode) head.parentNode.insertBefore(sec, head.nextSibling); else view.prepend(sec);
    if (rules.length) { const st = document.createElement('style'); st.textContent = rules.join('\n'); document.head.appendChild(st); }

    $$('.rb-tab', sec).forEach((b) => b.addEventListener('click', () => {
      $$('.rb-tab', sec).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      $$('.rb-panel', sec).forEach((p) => p.classList.toggle('on', p.dataset.rbpanel === b.dataset.rbtab));
    }));

    /* Bila tab hasil yang aktif disembunyikan, pindah ke tab terlihat pertama. */
    function fixActive() {
      $$('.tabs', view).forEach((nav) => {
        const btns = $$('.tab-btn', nav), act = btns.find((b) => b.classList.contains('active'));
        if (act && act.offsetParent !== null) return;
        const first = btns.find((b) => b.offsetParent !== null);
        if (first && (!act || act.offsetParent === null)) first.click();
      });
    }
    function apply() {
      toggles.forEach((it) => {
        const c = sec.querySelector(`[data-rb="${it.key}"]`);
        view.classList.toggle('rb-off-' + it.key, !c.checked);
      });
      fixActive();
    }
    sec.addEventListener('change', (e) => { if (e.target.matches('[data-rb]')) apply(); });
    if (cfg.onChange) { sec.addEventListener('input', cfg.onChange); sec.addEventListener('change', cfg.onChange); }
    /* hasil baru menyetel ulang tab aktif -> periksa lagi */
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(fixActive, 30); }).observe(view, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    apply();
    return sec;
  }

  window.StatRibbon = { mount };
})();
