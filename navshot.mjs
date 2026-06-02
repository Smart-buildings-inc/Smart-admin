import { chromium } from '@playwright/test';
const b = await chromium.launch();
// desktop
let ctx = await b.newContext({ viewport:{width:1280,height:200} });
let p = await ctx.newPage();
await p.goto('http://localhost:3000/', {waitUntil:'domcontentloaded'});
await p.waitForTimeout(1200);
await p.screenshot({ path:'/tmp/nav-desktop.png', clip:{x:0,y:0,width:1280,height:80} });
await ctx.close();
// mobile
ctx = await b.newContext({ viewport:{width:390,height:300}, isMobile:true });
p = await ctx.newPage();
await p.goto('http://localhost:3000/', {waitUntil:'domcontentloaded'});
await p.waitForTimeout(1200);
await p.screenshot({ path:'/tmp/nav-mobile.png', clip:{x:0,y:0,width:390,height:64} });
await ctx.close();
await b.close();
console.log('done');
