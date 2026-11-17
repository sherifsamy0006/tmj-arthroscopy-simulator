import {instrumentInput,pointerDelta,pairFrame,pairDelta} from './controls-r54.mjs';
// Native Pointer Events share one accumulator with the mouse wheel. Pinch/twist
// and steering are checked together; there is no second independent camera.
// r60: options().speed scales pointer and wheel motion (scope speed setting).
// r59: Ctrl-drag (with either button) also rotates the lens, and the wheel is eased over a
// few frames so insertion and withdrawal feel continuous instead of stepped.
export function bindInstrumentGestures(canvas,{enabled,options,submit,describe,schedule=fn=>requestAnimationFrame(fn)}){
 const points=new Map();let input=instrumentInput(options),previous=null,scheduled=false;
 const makeFrame=()=>{const p=[...points.values()];return p.length>=2?{kind:2,...pairFrame(p)}:p.length?{kind:1,...p[0]}:null;};
 const push=(delta,scaled=true)=>{const k=scaled?(options().speed||1):1,d={};for(const key in delta)d[key]=delta[key]*k;input.add(d);if(input.pending)submit(input);};
 const mode=e=>e.button===2||(e.buttons&2)!==0||e.altKey||e.ctrlKey?'roll':e.button===1||(e.buttons&4)!==0||e.shiftKey?'advance':options().mode;
 const flush=()=>{
  scheduled=false;const current=makeFrame();if(!current)return;
  if(previous?.kind===current.kind){
   if(current.kind===2)push(pairDelta(previous,current,options()));
   else push(pointerDelta(current.type==='touch'?options().mode:current.mode,current.x-previous.x,current.y-previous.y,options()));
  }
  previous=current;
 };
 let wheelDepth=0,wheelRoll=0,wheelBusy=false;
 const cancel=()=>{wheelDepth=wheelRoll=0;input.cancel();input=instrumentInput(options);points.clear();previous=null;describe(options().mode);};
 canvas.oncontextmenu=e=>e.preventDefault();
 canvas.onpointerdown=e=>{
  if(!enabled()||!(e.pointerType==='touch'||[0,1,2].includes(e.button)))return;
  flush();
  e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
  points.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType,mode:mode(e)});previous=makeFrame();describe(previous.kind===2?'combined':mode(e));
 };
 const update=e=>{
  if(!enabled()||!points.has(e.pointerId))return;
  e.preventDefault();const old=points.get(e.pointerId);points.set(e.pointerId,{...old,x:e.clientX,y:e.clientY,mode:mode(e)});
  // Capture every native/coalesced point before the next frame; preserving a
  // curved path matters more than how often requestAnimationFrame fires.
  flush();
 };
 canvas.onpointermove=e=>{const samples=e.getCoalescedEvents?.()||[];if(samples.length)for(const s of samples)update(s);else update(e);};
 canvas.onpointerup=e=>{if(!points.has(e.pointerId))return;update(e);flush();points.delete(e.pointerId);previous=makeFrame();describe(previous?.kind===2?'combined':options().mode);};
 canvas.onpointercancel=e=>{if(points.has(e.pointerId))cancel();};
 canvas.addEventListener('lostpointercapture',e=>{if(points.has(e.pointerId))cancel();});
 const drain=()=>{
  if(!enabled()){wheelDepth=wheelRoll=0;wheelBusy=false;return;}
  const part=v=>Math.abs(v)<.03?v:v*.34,depth=part(wheelDepth),roll=part(wheelRoll);wheelDepth-=depth;wheelRoll-=roll;
  if(depth||roll)push({depth,roll},false);
  if(wheelDepth||wheelRoll)schedule(drain);else wheelBusy=false;
 };
 canvas.addEventListener('wheel',e=>{if(!enabled())return;e.preventDefault();const pixels=Math.max(-80,Math.min(80,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1))),factor=options().fine?.28:1;if(e.altKey||e.ctrlKey)wheelRoll+=pixels*.12*factor*(options().speed||1);else wheelDepth-=pixels*.01*factor*(options().speed||1);if(!wheelBusy){wheelBusy=true;schedule(drain);}},{passive:false});
 return{cancel,get active(){return points.size;},get pending(){return input.pending;},get diagnostics(){return input.diagnostics;}};
}

