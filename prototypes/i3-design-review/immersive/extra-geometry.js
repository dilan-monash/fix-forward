export const extraKinds=['ac_split','ac_portable','heater','desktop','monitor','keyboard','mouse','printer','router'];
export const extraPartIds={ac_split:['case','filter','coil','fan','outdoor'],ac_portable:['case','fan','coil','compressor','hose'],heater:['case','element','fan','control','cutoff'],desktop:['case','board','processor','storage','supply'],monitor:['case','screen','light','board','ports'],keyboard:['case','keys','switches','board','cable'],mouse:['case','buttons','sensor','board','cable'],printer:['case','paper','head','ink','board'],router:['case','board','radio','aerials','ports']};
export function buildExtra(id,p,{box,sphere,cylinder,rod,ring,palette:C}){
 const B=(g,pos,size,col=C.white,r=.035)=>box(g,...pos,...size,col,r);
 const cy=(g,pos,r,h,col=C.steel,axis='y')=>{const m=cylinder(g,...pos,r,r,h,col,16);if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;return m;};
 const board=(g,pos,size=[.6,.65,.035])=>{B(g,pos,size,0x277454,.008);for(let i=0;i<4;i++)B(g,[pos[0]+(i%2?-.16:.16),pos[1]+(i<2?.15:-.15),pos[2]+.027],[.13,.1,.04],C.dark,.005);};
 const shell=(g,pos,size,col)=>{const[x,y,z]=pos,[w,h,d]=size;B(g,[x,y,z-d/2],[w,h,.05],col);for(const side of [-1,1])B(g,[x+side*w/2,y,z],[.05,h,d],col);for(const side of [-1,1])B(g,[x,y+side*h/2,z],[w,.05,d],col);};
 const fan=(g,pos,r=.26)=>{cy(g,pos,r,.06,C.deep,'z');for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod(g,[pos[0],pos[1],pos[2]+.04],[pos[0]+Math.cos(a)*r*.85,pos[1]+Math.sin(a)*r*.85,pos[2]+.04],.035,C.yellow);}cy(g,[pos[0],pos[1],pos[2]+.07],.06,.04,C.white,'z');};
 const coil=(g,pos,w=.8,h=.55)=>{B(g,pos,[w,h,.10],C.steel);for(let i=0;i<10;i++)B(g,[pos[0]-w/2+i*w/9,pos[1],pos[2]+.07],[.018,h,.045],C.deep,.001);};
 if(id==='ac_split'){
  shell(p.case,[0,.7,0],[1.7,.53,.35],C.white);B(p.case,[0,.72,.22],[1.65,.38,.05],C.white,.05);for(let i=0;i<4;i++)B(p.case,[0,.48+i*.025,.20],[1.4,.012,.09],C.deep,.001);
  B(p.filter,[0,.72,.12],[1.35,.32,.025],C.teal,.008);for(let i=0;i<12;i++)rod(p.filter,[-.63+i*.115,.58,.14],[-.63+i*.115,.86,.14],.006,C.white);
  coil(p.coil,[0,.73,.05],1.3,.30);cy(p.fan,[0,.52,0],.08,1.3,C.blue,'x');for(let i=0;i<12;i++)cy(p.fan,[-.6+i*.11,.52,0],.10,.02,C.deep,'x');
  B(p.outdoor,[0,.3,-.8],[.9,.56,.36],C.white);fan(p.outdoor,[-.1,.32,-.57],.2);
 }else if(id==='ac_portable'){
  shell(p.case,[0,.69,0],[.72,1.2,.58],C.white);B(p.case,[0,.83,.33],[.67,.78,.04],C.white);for(let i=0;i<5;i++)B(p.case,[0,1+i*.04,.36],[.53,.017,.03],C.deep,.001);for(const x of [-.27,.27])cy(p.case,[x,.06,0],.07,.30,C.deep,'z');
  fan(p.fan,[0,1,.07],.23);coil(p.coil,[0,.70,0],.53,.65);sphere(p.compressor,0,.27,0,.20,C.dark,1,1.1,.85);
  for(let i=0;i<11;i++){const x=.33+i*.055,z=-.16-i*.04;const rr=ring(p.hose,x,.74,z,.13,.018,C.steel);rr.rotation.y=Math.PI/2;}B(p.hose,[.95,.74,-.59],[.08,.36,.33],C.white);
 }else if(id==='heater'){
  shell(p.case,[0,.70,0],[.91,1.03,.38],C.pink);for(const x of [-.35,.35])B(p.case,[x,.12,0],[.18,.16,.47],C.deep);for(let i=0;i<9;i++)rod(p.case,[-.39+i*.098,.25,.23],[-.39+i*.098,1.1,.23],.012,C.steel);
  for(let y=.37;y<1.04;y+=.12)rod(p.element,[-.32,y,.11],[.32,y,.11],.02,0xc88645);fan(p.fan,[0,.68,-.02],.31);cy(p.control,[0,1.27,0],.1,.08,C.deep);B(p.cutoff,[0,.19,0],[.22,.11,.17],C.yellow);
 }else if(id==='desktop'){
  shell(p.case,[0,.73,0],[.68,1.4,.73],C.deep);B(p.case,[0,.74,.40],[.61,1.32,.055],C.blue);cy(p.case,[0,1.14,.44],.035,.02,C.yellow,'z');for(let i=0;i<6;i++)B(p.case,[0,.42+i*.07,.436],[.38,.012,.008],C.dark,0);
  board(p.board,[0,.72,0],[.49,.92,.04]);B(p.processor,[0,.94,.10],[.33,.3,.13],C.steel);fan(p.processor,[0,.94,.2],.14);B(p.storage,[0,.43,.10],[.41,.20,.08],C.yellow);B(p.supply,[0,.2,0],[.51,.28,.46],C.steel);fan(p.supply,[0,.2,.26],.11);
 }else if(id==='monitor'){
  B(p.case,[0,.89,-.05],[1.57,.94,.12],C.deep);rod(p.case,[0,.41,0],[0,.10,0],.07,C.deep);B(p.case,[0,.08,.1],[.7,.07,.43],C.deep);B(p.screen,[0,.9,.03],[1.46,.83,.035],0x59bcb6);B(p.screen,[-.37,1.1,.058],[.38,.08,.01],C.white);B(p.screen,[0,.71,.058],[1,.07,.01],C.teal);B(p.light,[0,.9,0],[1.42,.78,.02],C.white);board(p.board,[0,.8,-.015],[.7,.4,.03]);for(let i=0;i<3;i++)B(p.ports,[-.22+i*.22,.5,0],[.15,.055,.1],C.steel,.005);
 }else if(id==='keyboard'){
  B(p.case,[0,.13,0],[1.65,.13,.58],C.deep);for(let row=0;row<4;row++)for(let col=0;col<12;col++)B(p.keys,[-.71+col*.13,.235,-.21+row*.13],[.105,.055,.10],row===3?C.teal:C.white,.012);B(p.switches,[0,.205,0],[1.51,.025,.50],C.yellow);board(p.board,[0,.15,0],[1.2,.04,.4]);rod(p.cable,[0,.13,-.3],[.15,.08,-.84],.02,C.deep);B(p.cable,[.15,.08,-.87],[.12,.06,.14],C.steel,.005);
 }else if(id==='mouse'){
  sphere(p.case,0,.28,0,.37,C.blue,.80,.75,1.3);for(const x of [-.13,.13])B(p.buttons,[x,.43,.17],[.2,.06,.34],C.white,.04);cy(p.buttons,[0,.45,.12],.06,.035,C.deep,'x');B(p.sensor,[0,.115,0],[.16,.04,.15],C.yellow);board(p.board,[0,.23,0],[.32,.035,.49]);rod(p.cable,[0,.22,-.40],[.15,.08,-1],.02,C.deep);
 }else if(id==='printer'){
  shell(p.case,[0,.55,0],[1.32,.83,.88],C.white);B(p.case,[0,.75,.45],[1.3,.38,.06],C.blue);B(p.case,[0,.20,.60],[1.05,.04,.48],C.white);for(const z of [-.1,.21])cy(p.paper,[0,.35,z],.07,1.05,C.deep,'x');rod(p.head,[-.55,.57,0],[.55,.57,0],.025,C.steel);B(p.head,[0,.59,.10],[.35,.24,.22],C.deep);for(let i=0;i<4;i++)B(p.ink,[-.27+i*.18,.81,.08],[.14,.23,.21],[C.deep,C.blue,C.pink,C.yellow][i]);board(p.board,[-.4,.6,0],[.22,.5,.035]);
 }else if(id==='router'){
  shell(p.case,[0,.24,0],[1,.3,.62],C.white);B(p.case,[0,.24,.34],[.95,.22,.04],C.white);for(let i=0;i<4;i++)sphere(p.case,-.3+i*.14,.24,.369,.021,C.teal);board(p.board,[0,.23,0],[.75,.035,.47]);B(p.radio,[.23,.31,.03],[.23,.07,.21],C.steel);for(const x of [-.4,.4])rod(p.aerials,[x,.34,-.21],[x*1.3,1,-.21],.038,C.deep);for(let i=0;i<4;i++)B(p.ports,[-.3+i*.2,.25,-.32],[.14,.08,.06],C.yellow,.003);
 }
}
