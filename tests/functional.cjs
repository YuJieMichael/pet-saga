const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PET_SAGA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.PET_SAGA_TEST_OUTPUT||path.join(root,'test-results');
const results=[];
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'index.html')))});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({headless:true,channel:process.env.PET_SAGA_BROWSER||'msedge'});
  async function test(name,fn){
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install({time:new Date('2026-10-03T12:00:00Z')});
    await page.clock.pauseAt(new Date('2026-10-03T12:00:01Z'));
    try{
      await page.goto(url);
      await page.evaluate(()=>{
        let seed=219;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
        S.pets=[1,6,8,2,5,6].map(sp=>mk(sp,20,1));
        S.pets.forEach((p,i)=>{p.sk=i==0?['嘲讽','反震']:i==1?['治疗','护佑']:i==2?['烈火']:['再生'];p.ab=5;p.nat=5;p.job=0});
        S.coins=10000;S.gems=1000;S.stone=30;S.shard=0;S.badges=[];S.ng=0;S.stage=5;S.maxStage=20;S.mode='main';
        S.team=S.pets.slice(0,3).map(p=>p.id);S.formation=S.team.slice();S.sel=S.pets[3].id;S.mg=[];S.xps=[null,null,null];S.xsel={car:0,z:0,d:0,ids:[]};S.off=null;
        S.farmOn=false;S.farmHold=false;S.expBoostUntil=0;
        Object.keys(ITEMS).forEach(id=>S.bag[id]=20);Object.keys(POTION_PARTS).forEach(id=>S.bag[id]=20);SKN.forEach(k=>S.bag.books[k]=5);Object.keys(PACKS).forEach(id=>S.bag.packs[id]=10);
        B={run:0};bstart();B.T.forEach(t=>{t.hp=t.mx=10000;t.a.hp=10000});B.F.forEach(f=>{f.hp=f.mx=10000;f.atk=40});
        S.farmOn=true;autoRun();S.tab='pets';render();
      });
      await fn(page);
      assert.deepEqual(errors,[],'Browser JavaScript errors');
      results.push({name,status:'PASS'});console.log('PASS '+name);
    }catch(error){
      results.push({name,status:'FAIL',error:error.stack,consoleErrors:errors});console.error('FAIL '+name+'\n'+error.message);
      await page.screenshot({path:path.join(out,`failure-${results.length}.png`),fullPage:true}).catch(()=>{});
    }finally{await context.close()}
  }
  try{
    await test('All pages render during auto battle, mobile layout stays within viewport',async page=>{
      for(const tab of ['pets','bag','cultivate','fight','catch','fuse','idle','quest','dex','shop']){
        await page.locator(`[data-a="tab"][data-v="${tab}"]`).first().click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,tab+' overflows');
      }
      assert.equal(await page.evaluate(()=>!!B.run&&!!B.auto),true);
    });
    await test('Coin/gem purchases and pet cosmetics remain available during battle',async page=>{
      await page.locator('[data-a="tab"][data-v="shop"]').click();
      await page.locator('[data-a="buyitem"][data-v="red,3"]').click();
      assert.deepEqual(await page.evaluate(()=>[S.coins,itemCount('red')]),[9955,23]);
      await page.locator('[data-a="nat"]').click();
      assert.equal(await page.evaluate(()=>S.coins),9655);
      await page.locator('[data-a="shopcurrency"][data-v="gems"]').click();
      await page.locator('[data-a="buyitem"][data-v="mutDew,1"]').click();
      await page.locator('[data-a="skinbuy"]').click();
      assert.deepEqual(await page.evaluate(()=>[S.gems,get(S.sel).skin,B.auto]),[955,'green',1]);
      const fighterId=await page.evaluate(()=>S.team[0]);
      await page.locator(`[data-a="sel"][data-v="${fighterId}"]`).first().click();
      assert.equal(await page.locator('[data-a="ab"]').isDisabled(),true);
      await page.locator('[data-a="skinequip"][data-v="green"]').click();
      assert.equal(await page.evaluate(()=>B.T[0].p.skin),'green');
    });
    await test('Pack rewards arrive once, float five seconds, repeated opening resets timer',async page=>{
      await page.evaluate(()=>{S.tab='bag';BAG_FILTER='pack';BAG_ITEM='pack:supplies';render()});
      const slot=page.locator('[data-a="bagselect"]').filter({hasText:'补给小礼包'});await slot.click();
      await page.locator('[data-a="openpack"][data-v="supplies,1"]').click();
      assert.deepEqual(await page.evaluate(()=>[packCount('supplies'),itemCount('red'),itemCount('blue')]),[9,23,22]);
      assert.equal(await page.locator('#pack-notice').isVisible(),true);
      assert.equal(await page.getByText('收好奖励',{exact:true}).count(),0);
      await page.clock.runFor(4000);
      await page.locator('[data-a="openpack"][data-v="supplies,1"]').click();
      await page.clock.runFor(4999);assert.equal(await page.locator('#pack-notice').isVisible(),true);
      await page.clock.runFor(1);assert.equal(await page.locator('#pack-notice').isVisible(),false);
      assert.equal(await page.evaluate(()=>packCount('supplies')),8);
    });
    await test('Crafting and experience pills work while automatic turns continue',async page=>{
      await page.evaluate(()=>{S.tab='bag';BAG_ITEM='redPart';render()});
      await page.locator('[data-a="craftpotion"][data-v="redPart,all"]').click();
      assert.deepEqual(await page.evaluate(()=>[itemCount('redPart'),itemCount('red')]),[0,24]);
      await page.locator('[data-a="bagselect"][data-v="exp"]').click();
      await page.locator('[data-a="useitem"][data-v="exp"]').click();
      assert.deepEqual(await page.evaluate(()=>[itemCount('exp'),expBoostMultiplier(),S.expBoostUntil-Date.now()]),[19,2,3600000]);
      await page.clock.runFor(2500);assert.equal(await page.evaluate(()=>B.r>0&&!!B.auto),true);
    });
    await test('Reserve pets learn and wash; active pets cannot consume training items',async page=>{
      await page.locator('[data-a="tab"][data-v="cultivate"]').click();
      await page.locator('[data-a="book"][data-v="烈火"]').click();
      assert.equal(await page.evaluate(()=>get(S.sel).sk.includes('烈火')),true);
      await page.locator('[data-a="washprepare"]').click();
      await page.locator('[data-a="washapply"]').click();
      assert.equal(await page.evaluate(()=>itemCount('dew')),19);
      const id=await page.evaluate(()=>S.team[0]);await page.locator(`[data-a="sel"][data-v="${id}"]`).click();
      assert.equal(await page.locator('[data-a="washprepare"]').isDisabled(),true);
      assert.equal(await page.locator('[data-a="book"][data-v="烈火"]').isDisabled(),true);
      const before=await page.evaluate(()=>JSON.stringify([get(S.sel).sk,S.bag.books,S.bag.dew,S.coins,S.pets.length]));
      await page.evaluate(()=>{act('book','烈火');act('washprepare','dew');act('washapply','dew');act('rel');act('rel');act('evo')});
      assert.equal(await page.evaluate(()=>JSON.stringify([get(S.sel).sk,S.bag.books,S.bag.dew,S.coins,S.pets.length])),before);
    });
    await test('Reserve fusion preserves the combat party and supports unrestricted inheritance',async page=>{
      await page.evaluate(()=>{S.pets[3].sk=['弱金','弱木','烈火','治疗'];S.pets[4].sk=['弱水','弱火','反震','护佑'];S.tab='fuse';render()});
      const ids=await page.evaluate(()=>S.pets.map(p=>p.id));
      assert.equal(await page.locator(`[data-a="mg"][data-v="${ids[0]}"]`).isDisabled(),true);
      await page.locator(`[data-a="mg"][data-v="${ids[3]}"]`).click();await page.locator(`[data-a="mg"][data-v="${ids[4]}"]`).click();
      // Keep pet generation random, force only the eight per-skill inheritance rolls below 50%.
      await page.evaluate(()=>{const original=mk;globalThis.restoreMk=original;mk=(...args)=>{const pet=original(...args);const rng=Math.random;let calls=0;Math.random=()=>++calls<=17?.1:rng();return pet}});
      await page.locator('[data-a="fuse"]').click();
      assert.equal(await page.evaluate(()=>!!B.run&&B.T.every(t=>S.pets.includes(t.p))),true);
      assert.equal(await page.evaluate(()=>S.tab),'fuse');
      assert.equal(await page.evaluate(()=>S.pets.length),5);
      assert.equal(await page.evaluate(()=>get(S.sel).sk.includes('弱木')),true);
    });
    await test('Renaming survives background updates, evolution, washing and reload',async page=>{
      await page.locator('summary').filter({hasText:'改名'}).click();
      await page.locator('#pet-name').fill('测试灵宠');
      await page.clock.runFor(9000);
      assert.equal(await page.locator('#pet-name').inputValue(),'测试灵宠');
      await page.getByRole('button',{name:'确认改名',exact:true}).click();
      await page.evaluate(()=>{const p=get(S.sel);p.lv=60;act('evo');act('washprepare','dew');act('washapply','dew');S.farmOn=false;save()});
      assert.equal(await page.evaluate(()=>get(S.sel).n),'测试灵宠');
      await page.reload();assert.equal(await page.evaluate(()=>get(S.sel).n),'测试灵宠');
    });
    await test('Offline ad shares cap and awards exactly one high book during combat',async page=>{
      await page.evaluate(()=>{S.off={h:11,c:100,exp:100};S.tab='idle';render()});
      await page.locator('[data-a="offad"]').click();
      assert.equal(await page.locator('[data-a="oc"]').isDisabled(),true);
      await page.clock.runFor(1500);
      assert.equal(await page.evaluate(()=>S.off.h),12);
      assert.equal(await page.locator('[data-a="offad"]').isDisabled(),true);
      const before=await page.evaluate(()=>BOSS_BOOKS.reduce((n,k)=>n+bookCount(k),0));
      await page.locator('[data-a="oc"]').click();
      assert.equal(await page.evaluate(()=>BOSS_BOOKS.reduce((n,k)=>n+bookCount(k),0)),before+1);
      await page.evaluate(()=>act('oc'));
      assert.equal(await page.evaluate(()=>BOSS_BOOKS.reduce((n,k)=>n+bookCount(k),0)),before+1);
      assert.equal(await page.evaluate(()=>S.off),null);assert.equal(await page.evaluate(()=>!!B.run&&!!B.auto),true);
    });
    await test('Capture, expedition and job collection remain available during combat',async page=>{
      await page.locator('[data-a="tab"][data-v="catch"]').click();
      await page.locator('[data-a="explore"]').click();
      await page.locator('[data-a="capselection"]').first().click();
      // Fix only the next catch roll; encounter generation keeps the seeded RNG.
      await page.evaluate(()=>{const original=Math.random;Math.random=()=>{Math.random=original;return 0}});
      await page.locator('[data-a="cap"]').first().click();
      assert.equal(await page.evaluate(()=>S.pets.length),7);
      await page.evaluate(()=>{S.xsel.ids=[S.pets[3].id];S.tab='idle';render()});
      await page.locator('[data-a="xs"]').click();assert.equal(await page.evaluate(()=>S.xps[0].ids.length),1);
      await page.locator('[data-a="xc"][data-v="0"]').click();assert.equal(await page.evaluate(()=>S.xps[0]),null);
      await page.evaluate(()=>{const p=S.pets[4];p.job=Date.now()-8*3600000;render()});
      const id=await page.evaluate(()=>S.pets[4].id),before=await page.evaluate(()=>S.coins);
      await page.locator(`[data-a="jr"][data-v="${id}"]`).click();assert.equal(await page.evaluate(()=>S.coins>0&&S.pets[4].job===0),true);
      assert.ok(await page.evaluate(()=>S.coins)>before);
    });
    await test('Battle party, scene and save reset remain protected',async page=>{
      const before=await page.evaluate(()=>JSON.stringify([S.team,S.stage,S.mode,S.pets.length,S.coins]));
      await page.evaluate(()=>{act('teamremove',String(S.team[0]));act('reg','1');act('mode','tower');act('reset');S.sel=S.team[0];act('pt','2,all');act('ptconfirm');act('rel');act('rel')});
      assert.equal(await page.evaluate(()=>JSON.stringify([S.team,S.stage,S.mode,S.pets.length,S.coins])),before);
      assert.equal(await page.evaluate(()=>B.auto),1);
    });
    await test('Taunt redirects single hits, reflects damage, expires, and leaves area damage intact',async page=>{
      const facts=await page.evaluate(()=>{
        stopAutoRun();B.r=1;const tank=B.T[0],ally=B.T[1],foe=B.F[0];tank.cmd='taunt';pAct(tank);const mana=tank.mp;
        const h=ally.hp,t=tank.hp,f=foe.hp;fAct(foe);const single=ally.hp===h&&tank.hp<t&&foe.hp<f;
        foe.boss=true;foe.phase='burst';const a=ally.hp;fAct(foe);const area=ally.hp<a;
        tank.hp=1;tank.p.ab=5;tank.p.sk=['嘲讽','反震'];hurtPet(tank,100);return{single,area,mana,expired:tank.tauntUntil===0};
      });
      assert.equal(facts.single,true);assert.equal(facts.area,true);assert.equal(facts.expired,true);assert.ok(facts.mana>=0);
    });
    await test('Queued round survives pause/resume; stopping background auto completes battle once',async page=>{
      await page.clock.runFor(800);
      const phase=await page.evaluate(()=>B.playback.phase);assert.ok(['execute','complete'].includes(phase));
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});
      const snapshot=await page.evaluate(()=>JSON.stringify([B.r,B.T.map(t=>t.hp),B.F.map(f=>f.hp),B.playback]));
      await page.clock.runFor(10000);assert.equal(await page.evaluate(()=>JSON.stringify([B.r,B.T.map(t=>t.hp),B.F.map(f=>f.hp),B.playback])),snapshot);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));B.F.forEach(f=>f.hp=1);S.tab='pets';render()});
      await page.locator('[data-a="stopbackground"]').click();
      await page.clock.runFor(25000);
      assert.equal(await page.evaluate(()=>B.run),0);assert.equal(await page.evaluate(()=>S.farmOn),false);
      const balance=await page.evaluate(()=>S.coins);await page.evaluate(()=>bend(1));assert.equal(await page.evaluate(()=>S.coins),balance);
      assert.equal(await page.locator('#background-battle').isVisible(),false);
    });
    await test('Full automatic battles terminate in all three modes with bounded health and mana',async page=>{
      for(const mode of ['main','tower','hunt']){
        await page.evaluate(mode=>{stopAutoRun();if(BATTLE_TIMER)clearTimeout(BATTLE_TIMER);S.farmOn=false;S.mode=mode;S.stage=1;S.floor=1;S.hunt={d:new Date().toDateString(),clears:0};S.pets.forEach(p=>p.lv=60);B={run:0};S.tab='fight';bstart();S.battleSpeed=4;autoRun();render()},mode);
        await page.clock.runFor(120000);
        assert.equal(await page.evaluate(()=>B.run),0,mode+' did not finish');
        assert.equal(await page.evaluate(()=>B.T.every(t=>Number.isFinite(t.hp)&&t.hp>=0&&t.hp<=t.mx&&t.mp>=0&&t.mp<=t.mm)),true,mode+' invalid stats');
      }
      await page.screenshot({path:path.join(out,'battle-mobile.png'),fullPage:true});
    });
    await test('Saved inventory, names, expanded skills and offline ad hours survive migration',async page=>{
      await page.evaluate(()=>{S.farmOn=false;const p=S.pets[3];p.nickname='存档宠';refreshPetName(p);p.sk=['弱金','弱木','弱水','弱火','弱土','治疗','嘲讽'];p.fusionSlots=3;S.sel=p.id;S.off={h:12,adH:4,c:123,exp:45};S.bag.life=2;save()});
      const gems=await page.evaluate(()=>S.gems);await page.reload();
      assert.deepEqual(await page.evaluate(()=>[get(S.sel).n,get(S.sel).sk.length,slots(get(S.sel)),S.off.h,S.off.adH===undefined,S.gems]),['存档宠',7,7,12,true,gems+40]);
      await page.reload();assert.equal(await page.evaluate(()=>S.gems),gems+40);
    });
  }finally{
    fs.writeFileSync(path.join(out,'functional-report.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),results},null,2));
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
  console.log(`${results.filter(r=>r.status==='PASS').length}/${results.length} tests passed`);
  if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1});
