// FixForward's authored teaching catalogue. Fictional scenarios, not item diagnoses.
// Source-checked prototype copy; educator / electrical-content review still pending.
export const version='2026-10-01';
export const sources=[
 {id:'vic-ewaste',name:'Victorian Government · batteries and e-waste',url:'https://www.environment.vic.gov.au/household-waste-recycling/ewaste'},
 {id:'vic-reuse',name:'Victorian Government · reuse and repair',url:'https://www.environment.vic.gov.au/household-waste-recycling/reduce-waste/reuse-repair'},
 {id:'itu',name:'ITU · e-waste classification guidance',url:'https://www.itu.int/en/ITU-D/Environment/Pages/Toolbox/Guidelines.aspx'},
 {id:'ritec',name:'UNICEF · RITEC Design Toolbox',url:'https://www.unicef.org/childrightsandbusiness/ritec-design-toolbox'}
];
export const collections=[
 {id:'computing',name:'Phones & computers',icon:'💻',color:'blue'},
 {id:'sound',name:'Sound & screens',icon:'🎧',color:'rose'},
 {id:'play',name:'Gaming & toys',icon:'🤖',color:'gold'},
 {id:'kitchen',name:'Kitchen gadgets',icon:'🫖',color:'mint'},
 {id:'home',name:'Home & cleaning',icon:'🏠',color:'blue'},
 {id:'care',name:'Personal care',icon:'🪥',color:'rose'},
 {id:'light',name:'Lighting',icon:'💡',color:'gold'},
 {id:'power',name:'Power & connections',icon:'🔌',color:'mint'},
 {id:'large',name:'Large appliances',icon:'🏡',color:'blue'},
 {id:'tools',name:'Tools & garden',icon:'🧰',color:'rose'}
];
const rows=[
 ['phone','Mobile phone','📱','computing','reuse','A rechargeable battery powers this phone.','It helps people talk, send messages and use apps.','The owner no longer needs this phone, and a relative would like it.','Before sharing, an adult also needs to handle personal data and accounts.'],
 ['laptop','Laptop','💻','computing','assess','This laptop can use a battery or a power adaptor.','It helps people write, learn and work.','The owner says this laptop will not start. The cause is unknown.','A photo cannot show whether the battery, software or another part caused a fault.'],
 ['headphones','Wireless headphones','🎧','sound','reuse','These wireless headphones use a rechargeable battery.','They turn an electrical signal into sound.','Their owner has finished using them. A friend wants the checked headphones.','Wireless headphones are electrical even when no cord is visible.'],
 ['television','Television','📺','sound','assess','This television has a power cord and plug.','Its screen and speakers use electricity to show pictures and sound.','The owner reports a fault with this television. It has not been assessed.','Knowing an item is a television does not tell us whether it is repairable.'],
 ['toy','Light-up robot','🤖','play','reuse','A battery powers this toy’s lights and sounds.','Its electrical parts make the toy light up and make sounds.','The family no longer wants the checked toy. Another family would like it.','A toy can be electrical even when its battery is hidden inside.'],
 ['remote_car','Remote-control car','🏎️','play','assess','A battery powers this toy car’s motor.','The motor turns electrical energy into movement.','An adult says the car no longer responds. We do not know the cause.','A toy car with a motor has different clues from a simple push-along toy.'],
 ['kettle','Kettle','🫖','kitchen','reuse','The kettle’s base has a cord and plug.','Electricity heats water inside the kettle.','The family no longer needs the checked kettle. A neighbour would like it.','Heating more water needs more energy under the same conditions. Follow the real kettle’s marked limits.'],
 ['toaster','Toaster','🍞','kitchen','assess','The toaster has a power cord and plug.','Its heating elements use electricity to toast bread.','The adult owner reports a fault. A qualified repairer has not assessed it.','Looking tidy does not prove that an appliance works or is safe.'],
 ['fan','Electric fan','🌀','home','reuse','This fan uses electricity through a cord and plug.','An electric motor moves its blades to move air.','The checked fan is no longer needed. Someone else has asked to use it.','An item can still be useful when its first owner no longer wants it.'],
 ['vacuum','Vacuum cleaner','🧹','home','assess','This vacuum cleaner has a power cord and plug.','Its electric motor helps move air and collect dust.','The owner reports a fault with the vacuum. The cause is unknown.','A repair decision needs more information than a picture or an item name.'],
 ['dryer','Hair dryer','💨','care','assess','This hair dryer uses a cord and plug.','Electricity powers a fan and heating element.','The adult owner reports a fault with the hair dryer.','Real electrical items stay with adults; a learning picture is not a safety check.'],
 ['toothbrush','Electric toothbrush','🪥','care','collection','A rechargeable battery powers this toothbrush.','Its motor helps move the brush head.','An adult is arranging collection of this unwanted electric toothbrush.','An electric toothbrush and a manual toothbrush have different power clues.'],
 ['bulb','LED light bulb','💡','light','collection','This LED bulb uses electricity when fitted in a suitable light.','Its electrical components produce light.','An adult is arranging collection of this unwanted LED bulb.','Different types of lamps may need different collection services. Check the exact type.'],
 ['lamp','Desk lamp','🔦','light','keep','This desk lamp has a power cord and plug.','It uses electricity to light a small area.','In this story, an adult’s lamp is working normally and is still wanted.','Electrical equipment becomes e-waste when it is discarded; being electrical alone is not a reason to discard it.'],
 ['charger','Phone charger','🔌','power','collection','The charger connects to a power socket.','It supplies electrical power for a compatible device.','An adult is arranging collection of an unwanted charger.','Small electrical accessories also need an appropriate next step.'],
 ['powerbank','Power bank','🔋','power','damage','A battery inside stores electrical energy.','It can supply power to a compatible device.','In this made-up story, an adult reports that the power bank’s case is swollen.','A damaged battery item needs adult attention. Children leave real items alone.'],
 ['fridge','Refrigerator','🧊','large','keep','The refrigerator has a power cord and plug.','It uses electricity to keep its inside cool.','In this story, the adult’s fridge is working normally and the household still needs it.','Large appliances can stay useful while they are still wanted and suitable for use.'],
 ['washer','Washing machine','🧺','large','collection','The washing machine has a power cord and plug.','Electricity powers its controls and moving parts.','An adult is arranging collection of an unwanted washing machine.','A collection service must accept large appliances and explain any collection arrangements.'],
 ['drill','Cordless drill','🛠️','tools','reuse','A rechargeable battery powers this drill.','Its motor turns the drill’s moving parts.','An adult no longer needs the checked drill. Another adult would like it.','A useful tool may have another owner. Children do not handle tools for this activity.'],
 ['mower','Electric lawn mower','🌿','tools','collection','This electric lawn mower uses a rechargeable battery.','An electric motor moves its cutting parts.','An adult is arranging collection of an unwanted electric mower.','Collection must be suitable for the exact item, including its battery. Children do not handle it.']
];
export const items=rows.map(([id,name,icon,collection,plan,power,purpose,scene,detail])=>({id,name,icon,collection,plan,power,purpose,scene,detail,sourceIds:['vic-ewaste','vic-reuse'],reviewDate:version,reviewStatus:'Source-checked prototype; subject-expert review pending',imageType:'Illustrative system icon',modelUrl:id==='kettle'?'../lab/':null}));
export const byId=Object.assign(Object.create(null),Object.fromEntries(items.map(i=>[i.id,i])));
export const contrasts=[
 {id:'wooden_toy',name:'Wooden push-along toy',icon:'🧸',collection:'play',power:'This simple wooden toy has no battery, plug or electrical parts.',purpose:'It moves when someone pushes it.',answer:'none',why:'The clue tells us it has no electrical parts.'},
 {id:'manual_brush',name:'Manual toothbrush',icon:'🪥',collection:'care',power:'This toothbrush has no battery, motor or electrical parts.',purpose:'It is moved by hand.',answer:'none',why:'It is moved by hand and has no electrical parts.'},
 {id:'paper_book',name:'Paper book',icon:'📖',collection:'computing',power:'This book has paper pages and no electrical parts.',purpose:'Someone turns its pages by hand.',answer:'none',why:'Paper pages do not need electricity.'},
 {id:'mystery_toy',name:'Mystery toy',icon:'🧩',collection:'play',power:'The picture does not tell us whether this toy has a battery or electrical parts.',purpose:'We know it is a toy, but we are missing a power clue.',answer:'unknown',why:'We need information about a battery, plug or electrical parts.'},
 {id:'mystery_lamp',name:'Mystery light',icon:'🏮',collection:'light',power:'We do not know whether this light uses a candle or electricity.',purpose:'The picture alone does not give us enough information.',answer:'unknown',why:'We have not been told how this light is powered.'}
];
export const allById=Object.assign(Object.create(null),byId,Object.fromEntries(contrasts.map(i=>[i.id,i])));
export const modes={spot:{name:'Spot the clue',label:'Electrical clues',short:'Look for a plug, battery or another power clue.',icon:'◉'},plan:{name:'Choose the next step',label:'Next steps',short:'Use a made-up story to help an adult decide.',icon:'◇'},service:{name:'Check the service',label:'Collection checks',short:'Find the service that confirms it takes the item.',icon:'▤'}};
const option=(id,text)=>({id,text});
const nextSteps=[option('reuse','An adult can arrange a new home'),option('assess','An adult needs qualified advice'),option('collection','An adult checks a collection service'),option('keep','The adult can keep the wanted item in use'),option('damage','Leave it alone and tell a grown-up')];
const hash=id=>[...id].reduce((sum,c)=>sum+c.charCodeAt(0),0);
export const rotate=(list,id)=>{const n=hash(id)%list.length;return [...list.slice(n),...list.slice(0,n)];};
export function decision(item){
 const base={title:'What could happen next?',scene:item.scene,clues:[],options:[],correct:item.plan,reasons:[],reason:'evidence',why:'',change:{}};
 const extras={
 reuse:{clue:'A qualified repairer checked it, the adult owner completed the sharing checks, and the new owner wants it.',why:'Both clues matter: the checks are complete and someone wants the working item.',reason:'The checks are complete and a new owner wants it.',change:'New clue: the other person no longer wants this item.',newAnswer:'Find another suitable next step with an adult',newWrong:'Send it to that person anyway',newWhy:'The new owner’s interest was part of the plan. An adult now needs another suitable next step.'},
 assess:{clue:'We do not know what caused the fault or whether repair is suitable. Children will not test or open the item.',why:'A fault has been reported, but the cause and suitable next step are unknown.',reason:'The fault has not been assessed.',change:'New clue: someone sends a clearer picture. It still does not explain the fault.',newAnswer:'An adult still needs qualified advice',newWrong:'The clearer picture proves the item is safe',newWhy:'A clearer picture does not prove the condition of a real electrical item.'},
 collection:{clue:'The adult has chosen to investigate collection. They still need to confirm which service accepts this exact item.',why:'An adult needs confirmed item acceptance before visiting or arranging collection.',reason:'The service must confirm it accepts this item.',change:'New clue: the service’s information is old and its accepted items may have changed.',newAnswer:'An adult checks acceptance again',newWrong:'The old information must still be correct',newWhy:'Accepted items and arrangements can change. Check the current information.'},
 keep:{clue:'The adult still uses and wants this item. This fictional story gives no reason to discard it.',why:'Being electrical does not mean something must be discarded. This adult still wants and uses it.',reason:'The item is still wanted and working normally in this story.',change:'New clue: the owner later reports a fault. Its cause is unknown.',newAnswer:'The adult seeks qualified advice before further use',newWrong:'Keep using it because it worked before',newWhy:'The information has changed. A reported fault needs adult attention.'},
 damage:{clue:'The story specifically reports damage to a battery item. A child should not handle, use or open it.',why:'The reported damage matters. Leave the real item alone and tell a grown-up.',reason:'The story reports damage to a battery item.',change:'New clue: the power bank’s light still turns on.',newAnswer:'It still needs adult attention; leave it alone',newWrong:'A working light means the damage does not matter',newWhy:'A working light does not cancel the reported damage.'}
 }[item.plan];
 base.clues=[item.power,extras.clue];base.why=extras.why;
 const other=item.plan==='reuse'?['assess','collection']:item.plan==='assess'?['reuse','keep']:item.plan==='keep'?['reuse','collection']:item.plan==='damage'?['keep','reuse']:['reuse','keep'];
 base.options=rotate([nextSteps.find(o=>o.id===item.plan),...other.map(id=>nextSteps.find(o=>o.id===id))],item.id+'plan');
 base.reasons=rotate([option('evidence',extras.reason),option('looks','The picture looks nice.'),option('size','Every item of this size has the same next step.')],item.id+'reason');
 base.change={text:extras.change,options:rotate([option('adapt',extras.newAnswer),option('old',extras.newWrong)],item.id+'change'),correct:'adapt',why:extras.newWhy};
 return base;
}
export function question(item,mode){
 if(mode==='plan')return decision(item);
 if(mode==='spot')return {title:'Is this an electrical item?',scene:item.purpose,clues:[item.power,'Use the power clue. A name or a picture alone may not tell the whole story.'],options:rotate([option('electrical','Electrical item'),option('none','Not electrical'),option('unknown','Need another clue')],item.id),correct:item.answer||'electrical',reasons:rotate([option('evidence',item.why||'The clue says it uses electricity.'),option('looks','Its colour tells me.'),option('size','Its size tells me.')],item.id+'reason'),reason:'evidence',why:item.why||`${item.power} That is the clue that makes it electrical.`};
 const battery=['powerbank','mower','drill','toothbrush'].includes(item.id);
 const noun=item.id==='headphones'?'pair of wireless headphones':item.name.toLowerCase();
 return {title:'Which service has the useful clue?',scene:`This is a new made-up story. An adult is planning collection of an unwanted ${noun}. The service cards are fictional.`,clues:[`They need a service that specifically accepts this exact ${noun}.`,battery?'The adult must also confirm battery and collection arrangements. They will handle the real item.':'Check the exact item and current arrangements before an adult visits.'],options:rotate([option('confirmed',`Service Cedar: confirms it accepts this ${noun}${battery?' and will advise the adult about battery arrangements':''}.`),option('different','Service Willow: accepts some other items. This one is not listed.'),option('unknown','Service Birch: is nearby, but has no item information.')],item.id+'service'),correct:'confirmed',reasons:rotate([option('evidence','It confirms acceptance of this exact item.'),option('near','It is the closest place.'),option('name','I like the name.')],item.id+'reason'),reason:'evidence',why:'Confirmed acceptance is the useful clue. An adult still checks opening times and collection arrangements.'};
}
export function makeQueue(mode,collection,records={},round=0){
 const pool=items.filter(i=>collection==='all'||i.collection===collection);
 const offset=pool.length?round%pool.length:0;
 const ordered=[...pool.slice(offset),...pool.slice(0,offset)].sort((a,b)=>Number(!!records[a.id]?.[mode])-Number(!!records[b.id]?.[mode]));
 if(mode==='spot'){
  const picked=ordered.slice(0,3).map(i=>i.id);
  const plain=contrasts.filter(i=>i.answer==='none');const unknown=contrasts.filter(i=>i.answer==='unknown');
  picked.splice(1,0,plain[round%plain.length].id);picked.push(unknown[round%unknown.length].id);return picked;
 }
 return ordered.slice(0,5).map(i=>i.id);
}
