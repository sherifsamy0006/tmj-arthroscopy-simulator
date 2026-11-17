// Guided arthroscopy sequence and the visible state of the joint fluid.
// Teaching model. The order follows standard single-puncture arthroscopic lysis and
// lavage; rates are chosen so each effect can be read in a few seconds. They are
// not measured bleeding, flow or clearance values.
export const PROTRUSION=1.5; // mm anterior translation added to the 2.5 mm distraction
export const STEPS=Object.freeze([
 {id:'position',short:'Position',title:'1 · Protrude and distract the mandible',action:'Protrude mandible',
  text:'An assistant draws the mandible downward and forward. The condyle leaves the fossa and the posterior recess of the superior joint space opens for the puncture.',
  model:'Model: 2.5 mm distraction, then up to 1.5 mm anterior translation. Prescribed displacement, checked against bone and disc contact.'},
 {id:'insufflate',short:'Insufflate',title:'2 · Insufflate the superior joint space',action:'Insufflate joint',
  text:'A needle enters the posterior recess and Ringer’s solution (2–3 mL clinically) distends the capsule. Rebound of the plunger confirms that the tip is inside the joint.',
  model:'Model: the superior space is rebuilt at a larger lining displacement; the volume shown is the model volume.'},
 {id:'insert',short:'Insert scope',title:'3 · Puncture and insert the arthroscope',action:'Insert arthroscope',
  text:'Trocar and cannula puncture the distended capsule and the arthroscope takes the place of the trocar. Capsular vessels bleed: blood enters around the cannula and clouds the image.',
  model:'Model: checked lateral route to the prepared position. The bleeding is illustrative.'},
 {id:'lavage',short:'Lavage',title:'4 · Outflow needle and lavage',action:'Place outflow & irrigate',
  text:'An outflow needle is placed about 5 mm anterior to the cannula. Irrigation now runs through the joint and carries the blood out: the image clears from the lens outward.',
  model:'Model: well-mixed washout. No outflow means no clearing, whatever the inflow.'},
 {id:'suction',short:'Suction',title:'5 · Suction',action:'Apply suction',
  text:'Suction on the outflow removes the remaining blood, debris and bubbles. Keep the inflow running: suction alone collapses the joint space onto the lens.',
  model:'Model: suction raises the exchange rate and draws suspended material to the needle.'},
 {id:'explore',short:'Explore',title:'6 · Clear view · explore the joint',action:'Finish · withdraw scope',
  text:'Sweep the posterior recess, the medial synovial drape and the intermediate zone. The map on the right always shows where the lens is and where it is looking.',
  model:'Irrigation, outflow, suction and bleeding stay available below.'}
]);
export function createFluidState(){
 return{blood:0,bleed:0,debris:0,bubbles:0,haze:0,inflow:false,outflow:false,suction:false,collapse:0,exchangedML:0,elapsed:0,calibrated:false};
}
// Fraction of the superior space exchanged per second.
export function exchangeRate(s){return(s.inflow&&s.outflow?.34:0)+(s.suction?(s.inflow?.55:.30):0);}
export function stepFluid(s,dt,volumeML=.7){
 dt=Math.min(.1,Math.max(0,dt));if(!dt)return s;
 const exchange=exchangeRate(s);
 // A puncture bleeds less as it clots; irrigation pressure slows it sooner.
 // The last ooze stops quickly once the clot holds.
 if(s.bleed>0){s.bleed*=Math.exp(-dt/(s.bleed<.06?1.5:s.inflow?7:22));if(s.bleed<.004)s.bleed=0;}
 const pressure=s.inflow?(s.outflow?.75:.45):1;
 s.blood+=(s.bleed*pressure*.26*(1-s.blood)-exchange*s.blood)*dt;
 s.debris+=(s.bleed*.05*(1-s.debris)-(exchange*.35+(s.suction?.5:0))*s.debris)*dt;
 s.bubbles+=-(.05+exchange*.4+(s.suction?.7:0))*s.bubbles*dt;
 s.haze+=-(.03+exchange*.5)*s.haze*dt;
 s.collapse+=((s.suction&&!s.inflow?1:0)-s.collapse)*Math.min(1,dt/1.6);
 for(const k of['blood','debris','bubbles','haze','collapse'])s[k]=Math.max(0,Math.min(1,s[k]));
 // Settle fully once nothing feeds a level, so an idle view stops redrawing.
 if(!s.bleed){for(const k of['blood','debris'])if(s[k]<.0015)s[k]=0;}
 for(const k of['bubbles','haze'])if(s[k]<.0015)s[k]=0;
 if(!(s.suction&&!s.inflow)&&s.collapse<.002)s.collapse=0;
 s.exchangedML+=exchange*volumeML*dt;s.elapsed+=dt;
 return s;
}
// How much of the wall detail survives the blood veil at a typical 5 mm working distance.
export function clarity(s){return Math.round(100*Math.exp(-3.4*s.blood)*(1-.35*s.haze)*(1-.6*s.collapse));}
export function describeFluid(s){
 const parts=[];
 if(s.bleed>.02)parts.push(s.bleed>.15?'Bleeding from the puncture':'Slight ooze from the puncture');
 if(s.suction&&!s.inflow)parts.push('Suction without inflow · joint space collapsing');
 else if(s.suction)parts.push('Suction on the outflow needle · irrigation running');
 else if(s.inflow&&s.outflow)parts.push('Lavage running · inflow at the cannula, outflow at the needle');
 else if(s.inflow)parts.push('Inflow only · pressure rises, nothing leaves the joint');
 else if(s.outflow&&!s.suction)parts.push('Outflow open · no inflow');
 if(!parts.length)parts.push(s.blood>.03?'Blood suspended in still fluid':'Still, clear fluid');
 return parts.join(' · ');
}
