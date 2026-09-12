import test from "node:test";
import assert from "node:assert/strict";
import { createGeminiRequester, providerRetryDelayMs, requestGemini } from "../src/llm/gemini.js";

function clock() {
  let time=0;
  const sleeps=[];
  return { sleeps, now:()=>time, sleep:async ms=>{sleeps.push(ms);time+=ms;} };
}
const failure=(status,message="provider error")=>Object.assign(new Error(message),{status});

test("normal request succeeds immediately; a mocked client never waits for the live default", async()=>{
  const timer=clock();
  const request=createGeminiRequester({...timer,minIntervalMs:15000});
  assert.equal(await request(async()=>"ok"),"ok");
  assert.deepEqual(timer.sleeps,[]);
  const client={models:{async generateContent(request){assert.equal(request.config.httpOptions.retryOptions.attempts,1);return "mock";}}};
  assert.equal(await requestGemini(client,{}, {client}),"mock");
});

test("429 retries after Google RetryInfo JSON delay with a safety buffer", async()=>{
  const timer=clock();let calls=0;
  const error=failure(429,JSON.stringify({error:{code:429,status:"RESOURCE_EXHAUSTED",details:[{"@type":"type.googleapis.com/google.rpc.RetryInfo",retryDelay:"12s"}]}}));
  const request=createGeminiRequester({...timer,minIntervalMs:0});
  assert.equal(await request(async()=>{if(++calls===1)throw error;return "ok";}),"ok");
  assert.equal(calls,2);
  assert.deepEqual(timer.sleeps,[12250]);
});

test("Retry-After seconds, date, duration object and longest supplied delay are recognized",()=>{
  assert.equal(providerRetryDelayMs({headers:{"Retry-After":"3"}},0),3000);
  assert.equal(providerRetryDelayMs({response:{headers:new Headers({"retry-after":"Thu, 01 Jan 1970 00:00:10 GMT"})}},1000),9000);
  assert.equal(providerRetryDelayMs({details:[{retryDelay:{seconds:"2",nanos:500000000}}]}),2500);
  assert.equal(providerRetryDelayMs({headers:{"retry-after":"3"},details:[{retryDelay:"5s"}]}),5000);
});

test("fallback backoff and jitter are bounded and retry cap throws the original error",async()=>{
  const timer=clock();let calls=0;const error=failure(503);
  const request=createGeminiRequester({...timer,minIntervalMs:0,maxRetries:3,random:()=>0.5});
  await assert.rejects(request(async()=>{calls++;throw error;}),e=>e===error);
  assert.equal(calls,4);
  assert.deepEqual(timer.sleeps,[2250,4250,8250]);
  assert.match(error.geminiHint,/4 attempts/);
});

test("permanent 400/401/403/404 failures are never retried",async()=>{
  for(const status of [400,401,403,404]){
    const timer=clock();let calls=0;const error=failure(status);
    const request=createGeminiRequester({...timer,minIntervalMs:0});
    await assert.rejects(request(async()=>{calls++;throw error;}),e=>e===error);
    assert.equal(calls,1);assert.deepEqual(timer.sleeps,[]);
  }
});

test("408 and clearly transient network failures recover; arbitrary programming errors do not retry",async()=>{
  for(const error of [failure(408),Object.assign(new Error("fetch failed"),{cause:{code:"ECONNRESET"}})]){
    const timer=clock();let calls=0;
    const request=createGeminiRequester({...timer,minIntervalMs:0,random:()=>0});
    assert.equal(await request(async()=>{if(++calls===1)throw error;return "ok";}),"ok");
    assert.equal(calls,2);
  }
  let calls=0;
  await assert.rejects(createGeminiRequester({minIntervalMs:0})(async()=>{calls++;throw new TypeError("programming error");}),/programming/);
  assert.equal(calls,1);
});

test("concurrent requests share pacing, including retry starts, without real sleeps",async()=>{
  const timer=clock(),starts=[];
  const request=createGeminiRequester({...timer,minIntervalMs:15000,random:()=>0});
  let firstCalls=0;
  await Promise.all([
    request(async()=>{starts.push(timer.now());if(++firstCalls===1)throw failure(429);return "a";}),
    request(async()=>{starts.push(timer.now());return "b";}),
  ]);
  assert.deepEqual(starts,[0,15000,30000]);
  assert.deepEqual(timer.sleeps,[15000,15000]);
});

test("explicit daily quota and excessive provider delay stop requests instead of hammering",async()=>{
  for(const error of [failure(429,"Quota GenerateRequestsPerDay exhausted"),Object.assign(failure(429),{details:[{retryDelay:"3600s"}]})]){
    const timer=clock();let calls=0;
    const request=createGeminiRequester({...timer,minIntervalMs:0});
    const call=async()=>{calls++;throw error;};
    await assert.rejects(request(call),e=>e===error);
    await assert.rejects(request(call),e=>e===error);
    assert.equal(calls,1);assert.deepEqual(timer.sleeps,[]);
  }
});

test("exhausted transient retry does not poison a later request; invalid config is rejected",async()=>{
  const timer=clock();const request=createGeminiRequester({...timer,minIntervalMs:0,maxRetries:0});
  await assert.rejects(request(async()=>{throw failure(429);}),/provider/);
  assert.equal(await request(async()=>"recovered"),"recovered");
  for(const options of [{minIntervalMs:NaN},{maxRetries:-1},{maxRetries:11}]) assert.throws(()=>createGeminiRequester(options));
});
