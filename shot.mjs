import { chromium } from '@playwright/test';
const pages = [['/','console'],['/fleet','fleet'],['/landing','landing'],['/brand','brand'],['/sitemap','sitemap'],['/simulator','simulator']];
const b = await chromium.launch();
for (const theme of ['dark','light']) {
  const ctx = await b.newContext({ viewport:{width:1280,height:900} });
  // seed localStorage before any page load
  await ctx.addInitScript(t => { try{localStorage.setItem('atlas-theme', t)}catch(e){} }, theme);
  const p = await ctx.newPage();
  for (const [path,name] of pages) {
    await p.goto('http://localhost:3000'+path, {waitUntil:'networkidle'}).catch(()=>{});
    await p.waitForTimeout(1500);
    await p.screenshot({ path:`/tmp/${name}-${theme}.png` });
    console.log('shot', name, theme);
  }
  await ctx.close();
}
await b.close();
