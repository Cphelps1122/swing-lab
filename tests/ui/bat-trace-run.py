import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg=await b.new_page(viewport={'width':2600,'height':800})
    pg.on('console',lambda m:print('console',m.text[:200])); pg.on('pageerror',lambda e:print('ERR',e))
    await pg.goto('http://localhost:8765/t2.html'); await pg.wait_for_function('window.DONE',timeout=180000)
    print(await pg.evaluate('window.DONE')); el=await pg.query_selector('#c'); await el.screenshot(path='out.png'); await b.close()
asyncio.run(main())
