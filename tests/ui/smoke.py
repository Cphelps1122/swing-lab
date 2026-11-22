import asyncio,sys
from playwright.async_api import async_playwright
STUB="""
(()=>{const snap=(docs)=>({docs:docs.map((d,i)=>({id:'x'+i,data:()=>d}))});
const q={orderBy(){return q},limit(){return q},where(){return q},onSnapshot(cb){setTimeout(()=>cb(snap([{batter:'Fin',ev:68,la:-21,createdAt:'2026-02-27',sport:'softball'}])),10);return()=>{}},get:async()=>snap([]),add:async()=>({id:'n'}),doc(){return{set:async()=>{},get:async()=>({exists:false}),delete:async()=>{}}}};
let cbA;window.firebase={initializeApp(){},auth:()=>({onAuthStateChanged(cb){cbA=cb;window.__login=()=>cb({uid:'u',email:'rice.chris.p4991@gmail.com'})},signOut(){}}),
firestore:()=>({collection:()=>q,doc:()=>({update:async()=>{},delete:async()=>{}})}),storage:()=>({ref:()=>({})})};})();
"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/firebasejs/**',lambda r:r.fulfill(body='',content_type='text/javascript'))
    await pg.route('**/fonts.googleapis.com/**',lambda r:r.fulfill(body=''))
    await pg.add_init_script(STUB)
    await pg.goto('file://'+sys.argv[1]+'/index.html'); await pg.wait_for_timeout(500)
    print('early errs',errs); print('gate visible:',await pg.is_visible('#slGate'))
    await pg.screenshot(path='/tmp/smoke/gate.png')
    print(await pg.evaluate('Object.keys(window.firebase||{}).join()+"|"+typeof window.__login'));await pg.evaluate('window.__login()'); await pg.wait_for_timeout(800)
    print('gate after login:',await pg.is_visible('#slGate'),'| acct:',await pg.text_content('#slAcct'))
    await pg.screenshot(path='/tmp/smoke/home.png')
    print('errors:',errs)
    await b.close()
asyncio.run(main())
