"""Uji panel samping Materi (geser lebar + ciutkan). Jalankan: python3 tests/materi-side-min.e2e.py (butuh playwright untuk Python)"""
import os, tempfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = tempfile.gettempdir()
fails=0
def chk(n,ok,i=''):
    global fails
    if not ok: fails+=1
    print(('OK    ' if ok else 'GAGAL ')+n+('   '+str(i) if i!='' else ''))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':900}); pg=ctx.new_page(); pg.set_default_timeout(4000)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://' + ROOT + '/index.html'); pg.wait_for_timeout(600)
    pg.evaluate("document.body.classList.remove('pre-auth')")
    def openT(t): pg.evaluate("t=>StatCalcMateri.open(t,null,{backTo:'materi'})",t); pg.wait_for_timeout(700)
    W=lambda s: pg.evaluate("s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().width):-1}",s)
    grips=lambda: pg.evaluate("[...document.querySelectorAll('#mtWrap > .col-grip')].map(g=>g.style.display==='none'?'-':'v')")
    openT('regresi'); pg.wait_for_timeout(300)
    t0,m0,r0=W('#mtWrap > .mt-tree'),W('#mtWrap > .mt-content'),W('#mtWrap > .mt-try')
    print('awal',t0,m0,r0,grips())
    chk('Pegangan geser kiri & kanan tampil',grips()==['v','v'])
    chk('Tombol ciutkan ada di kedua panel',pg.query_selector('#mtWrap > .mt-tree > .mtx-bar .mtx-btn') is not None and pg.query_selector('#mtWrap > .mt-try > .mtx-bar .mtx-btn') is not None)
    # geser kiri
    g=pg.query_selector('#mtWrap > .col-grip[data-side="l"]'); bx=g.bounding_box(); y=bx['y']+bx['height']/2 if bx['y']>0 else 450
    pg.mouse.move(bx['x']+7,450); pg.mouse.down(); pg.mouse.move(bx['x']+7+100,450,steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
    t1,m1=W('#mtWrap > .mt-tree'),W('#mtWrap > .mt-content')
    chk('Geser pegangan kiri melebarkan panel Daftar materi',t1>t0+80 and m1<m0-60,f'{t0}->{t1}, teks {m0}->{m1}')
    # geser kanan
    g=pg.query_selector('#mtWrap > .col-grip[data-side="r"]'); bx=g.bounding_box(); r0=W('#mtWrap > .mt-try')
    pg.mouse.move(bx['x']+7,450); pg.mouse.down(); pg.mouse.move(bx['x']+7-80,450,steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
    chk('Geser pegangan kanan melebarkan kartu kanan',W('#mtWrap > .mt-try')>r0+60,f'{r0}->{W("#mtWrap > .mt-try")}')
    # ganti topik: pegangan & lebar tetap
    pg.click('#mtWrap > .mt-tree .mtt-tp:not(.on)'); pg.wait_for_timeout(900)
    chk('Pindah topik: panel kiri tetap selebar hasil geseran',abs(W('#mtWrap > .mt-tree')-t1)<4,W('#mtWrap > .mt-tree'))
    chk('Pindah topik: pegangan kiri masih ada',grips()[0]=='v' if grips() else False,grips())
    pg.screenshot(path=OUT+'/materi-side-geser.png')
    # reset dblclick
    g=pg.query_selector('#mtWrap > .col-grip[data-side="l"]'); g.dispatch_event('dblclick'); pg.wait_for_timeout(300)
    chk('Klik dua kali = lebar default (264)',abs(W('#mtWrap > .mt-tree')-264)<4,W('#mtWrap > .mt-tree'))
    # ciutkan kiri
    openT('regresi'); pg.wait_for_timeout(300)
    m_before=W('#mtWrap > .mt-content')
    pg.click('#mtWrap > .mt-tree > .mtx-bar .mtx-btn'); pg.wait_for_timeout(400)
    tw=W('#mtWrap > .mt-tree'); m2=W('#mtWrap > .mt-content')
    chk('Kiri diciutkan jadi rel 44 px',40<=tw<=48,tw)
    chk('Teks bacaan melebar',m2>m_before+150,f'{m_before}->{m2}')
    chk('Isi panel kiri tersembunyi',pg.evaluate("document.querySelector('#mtWrap > .mt-tree .mtt-tp').offsetParent===null"))
    chk('Pegangan kiri disembunyikan saat rel',grips()[0]=='-',grips())
    pg.screenshot(path=OUT+'/materi-side-kiri-min.png')
    # ciutkan kanan
    pg.click('#mtWrap > .mt-try > .mtx-bar .mtx-btn'); pg.wait_for_timeout(400)
    rw=W('#mtWrap > .mt-try'); m3=W('#mtWrap > .mt-content')
    chk('Kanan diciutkan jadi rel 44 px',40<=rw<=48,rw)
    chk('Teks melebar lagi saat kedua panel ciut',m3>m2+200,f'{m2}->{m3}')
    pg.screenshot(path=OUT+'/materi-side-dua-min.png')
    # pindah topik saat ciut
    openT('anova'); pg.wait_for_timeout(300)
    chk('Pindah topik: kiri tetap ciut',40<=W('#mtWrap > .mt-tree')<=48,W('#mtWrap > .mt-tree'))
    # reload persist
    pg.reload(); pg.wait_for_timeout(600); pg.evaluate("document.body.classList.remove('pre-auth')"); openT('regresi'); pg.wait_for_timeout(300)
    chk('Pilihan ciut tersimpan setelah muat ulang',40<=W('#mtWrap > .mt-tree')<=48 and 40<=W('#mtWrap > .mt-try')<=48,(W('#mtWrap > .mt-tree'),W('#mtWrap > .mt-try')))
    # buka kembali lewat klik rel
    pg.click('#mtWrap > .mt-tree'); pg.wait_for_timeout(400)
    chk('Klik rel kiri membuka lagi',W('#mtWrap > .mt-tree')>200,W('#mtWrap > .mt-tree'))
    pg.click('#mtWrap > .mt-try > .mtx-bar .mtx-btn'); pg.wait_for_timeout(400)
    chk('Tombol di rel kanan membuka lagi',W('#mtWrap > .mt-try')>250,W('#mtWrap > .mt-try'))
    # 1200: kartu kanan tidak boleh hilang walau state r = true
    pg.evaluate("MateriSide.set({right:true})"); pg.set_viewport_size({'width':1200,'height':900}); pg.wait_for_timeout(500)
    chk('1200 px: kartu Coba di Dataset tetap terlihat',pg.evaluate("document.querySelector('#mtWrap .mt-try').offsetParent!==null && document.querySelector('#mtWrap .mt-try h3').offsetParent!==null"))
    chk('1200 px: bilah kanan tidak tampil',pg.evaluate("document.querySelector('#mtWrap .mt-try > .mtx-bar').offsetParent===null"))
    pg.set_viewport_size({'width':900,'height':900}); pg.wait_for_timeout(400)
    chk('900 px: bilah ciutkan kiri tidak tampil',pg.evaluate("document.querySelector('#mtWrap .mt-tree > .mtx-bar').offsetParent===null"))
    chk('Tidak ada galat JS',not errs,errs)
    b.close()
print('Semua uji lulus' if not fails else f'{fails} gagal')

raise SystemExit(1 if fails else 0)
