import { acquire, connect } from "@cloudflare/playwright";
interface Env { BROWSER: Fetcher; }
type State={sessionId?:string;lastError?:string;lastErrorAt?:number;nextAcquireAt?:number;acquisitions:number};
type Action={action:"status"}|{action:"linkedin_check"}|{action:"open";url:string}|{action:"snapshot"}|{action:"click";selector:string}|{action:"type";selector:string;text:string}|{action:"back"}|{action:"live_view"};
const LINKEDIN=/^https:\/\/([a-z0-9-]+\.)*linkedin\.com(?:\/|$)/i;
export class BrowserSessionDO extends DurableObject<Env>{
 private state:State={acquisitions:0};
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);ctx.blockConcurrencyWhile(async()=>{const s=await ctx.storage.get<State>("state");if(s)this.state=s;});}
 private async save(){await this.ctx.storage.put("state",this.state);}
 private classify(e:unknown){const m=e instanceof Error?e.message:String(e);if(/time limit exceeded for today|daily.*limit|10 minutes.*day/i.test(m))return"BROWSER_DAILY_LIMIT_REACHED";if(/429|rate limit|too many requests/i.test(m))return"BROWSER_RATE_LIMITED";if(/session.*(closed|expired|not found)|invalid.*session/i.test(m))return"BROWSER_SESSION_EXPIRED";if(/timeout|timed out|connectovercdp|connection/i.test(m))return"BROWSER_TIMEOUT";return"BROWSER_ERROR";}
 private async ensure(){const now=Date.now();if(this.state.nextAcquireAt&&now<this.state.nextAcquireAt)throw new Error("BROWSER_RATE_LIMITED: acquisition cooldown active");if(this.state.sessionId)return this.state.sessionId;try{const r=await acquire(this.env.BROWSER,{keepAlive:600000,targets:true});this.state.sessionId=r.sessionId;this.state.acquisitions++;this.state.nextAcquireAt=undefined;await this.save();return r.sessionId;}catch(e){const c=this.classify(e);if(c==="BROWSER_RATE_LIMITED"){this.state.nextAcquireAt=now+20000;this.state.lastError=c;this.state.lastErrorAt=now;await this.save();}throw new Error(c+": "+(e instanceof Error?e.message:String(e)));}}
 private async withBrowser<T>(fn:(b:any)=>Promise<T>){const sid=await this.ensure();try{const b=await connect(this.env.BROWSER,sid);try{return await fn(b);}finally{await b.close();}}catch(e){const c=this.classify(e);this.state.lastError=c;this.state.lastErrorAt=Date.now();if(c==="BROWSER_SESSION_EXPIRED"||c==="BROWSER_TIMEOUT")this.state.sessionId=undefined;await this.save();throw new Error(c+": "+(e instanceof Error?e.message:String(e)));}}
 private async page(b:any){const c=b.contexts()[0]??await b.newContext();return c.pages()[0]??await c.newPage();}
 private async snap(b:any){const p=await this.page(b);const text=await p.locator("body").innerText({timeout:10000}).catch(()=> "");return{url:p.url(),title:await p.title().catch(()=>""),text:text.slice(0,20000)};}
 private async check(b:any){const p=await this.page(b);await p.goto("https://www.linkedin.com/",{waitUntil:"domcontentloaded",timeout:45000});const url=p.url();const body=(await p.locator("body").innerText({timeout:10000}).catch(()=> "")).slice(0,20000).toLowerCase();if(/captcha|challenge|verification|verify you|security check/.test(body))return{status:"HUMAN_INTERVENTION_REQUIRED",url};if(/\/login(?:[/?#]|$)/i.test(url)||/sign in to linkedin|email or phone|password/.test(body))return{status:"LOGIN_REQUIRED",url};return{status:"LOGGED_IN",url,title:await p.title()};}
 private async action(a:Action){switch(a.action){case"status":return{ok:true,session:this.state.sessionId?"configured":"inactive",sessionIdPresent:Boolean(this.state.sessionId),lastError:this.state.lastError??null,lastErrorAt:this.state.lastErrorAt??null,nextAcquireAt:this.state.nextAcquireAt??null,acquisitions:this.state.acquisitions};case"linkedin_check":return this.withBrowser(b=>this.check(b));case"open":if(!LINKEDIN.test(a.url))throw new Error("URL_NOT_ALLOWED: LinkedIn only");return this.withBrowser(async b=>{const p=await this.page(b);await p.goto(a.url,{waitUntil:"domcontentloaded",timeout:45000});return{url:p.url(),title:await p.title()};});case"snapshot":return this.withBrowser(b=>this.snap(b));case"click":return this.withBrowser(async b=>{const p=await this.page(b);await p.locator(a.selector).first().click({timeout:15000});return{ok:true,url:p.url(),title:await p.title()};});case"type":return this.withBrowser(async b=>{const p=await this.page(b);await p.locator(a.selector).first().fill(a.text,{timeout:15000});return{ok:true};});case"back":return this.withBrowser(async b=>{const p=await this.page(b);await p.goBack({waitUntil:"domcontentloaded",timeout:30000});return{ok:true,url:p.url(),title:await p.title()};});case"live_view":return this.withBrowser(async b=>{const p=await this.page(b);const cdp=await p.context().newCDPSession(p);const r=await cdp.send("Cloudflare.getLiveView",{expiresInMs:300000}) as{devtoolsFrontendUrl?:string};if(!r.devtoolsFrontendUrl)throw new Error("LIVE_VIEW_UNAVAILABLE");return{status:"HUMAN_INTERVENTION_REQUIRED",liveViewUrl:r.devtoolsFrontendUrl,expiresInMs:300000};}}}
 async fetch(req:Request){
  if(req.method!=="POST") return Response.json({ok:false,error:{code:"METHOD_NOT_ALLOWED"}},{status:405});
  let response: Response;
  await this.ctx.blockConcurrencyWhile(async()=>{
    let a:Action;
    try { a=await req.json() as Action; }
    catch { response=Response.json({ok:false,error:{code:"INVALID_JSON"}},{status:400}); return; }
    try {
      response=Response.json({ok:true,result:await this.action(a)});
    } catch(e) {
      const m=e instanceof Error?e.message:String(e);
      const c=m.split(":")[0]||"BROWSER_ERROR";
      response=Response.json({ok:false,error:{code:c,message:m.slice(0,2000),retryable:c==="BROWSER_RATE_LIMITED"||c==="BROWSER_TIMEOUT"}},{status:c==="BROWSER_RATE_LIMITED"?429:502});
    }
  });
  return response!;
 }
}