import asyncio,sys,json
from playwright.async_api import async_playwright
STUB=open('/tmp/smoke/t.py').read().split('STUB="""')[1].split('"""')[0]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg=await b.new_page(viewport={'width':1200,'height':900})
    pg.on('pageerror',lambda e:print('ERR',e))
    await pg.route('**/firebasejs/**',lambda r:r.fulfill(body='',content_type='text/javascript'))
    await pg.add_init_script(STUB)
    await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_timeout(500); await pg.evaluate('window.__login()'); await pg.wait_for_timeout(800)
    r=await pg.evaluate('''async()=>{ const bl=await (await fetch("fin.mp4")).blob(); const f=new File([bl],"fin.mp4",{type:"video/mp4"});
      let res; try{ res=await window.__swingLab.analyze(f,{useBat:%s,fps:"auto"}); }catch(e){ if(!e.retry) throw e; window.__first=JSON.stringify(window.__dbg||{}).slice(0,800); try{ res=await window.__swingLab.analyze(f,{useBat:%s,fps:"auto",_retry:true}); }catch(e2){ return {err:String(e2),first:window.__first,dbg:JSON.stringify(window.__dbg),ev:JSON.stringify(window.__ev)}; } } const o={keys:Object.keys(res)}; const A=res.A||res; for(const k of ["ev","la","result","bounceFt","pitch","batSpeed","l2c","carry"]) o[k]=A[k]; const ob=res.out||res.video||(res.A&&res.A.out); if(ob&&ob.blob){ const b=new Uint8Array(await ob.blob.arrayBuffer()); let s=""; for(let i=0;i<b.length;i+=32768) s+=String.fromCharCode(...b.subarray(i,i+32768)); window.__vid=btoa(s); o.vtype=ob.blob.type; } 
      o.flags=res.flags; o.first=window.__first; o.dbg=window.__dbg&&JSON.stringify(window.__dbg).slice(0,1500); return o; }'''%(sys.argv[1],sys.argv[1]))
    r.pop('dbg',None); print(json.dumps(r,default=str)[:3000]);
    v=await pg.evaluate('window.__vid||null')
    import base64
    if v: open('/tmp/smoke/out.'+('mp4' if 'mp4' in (r.get('vtype') or '') else 'webm'),'wb').write(base64.b64decode(v))
    await b.close()
asyncio.run(main())
