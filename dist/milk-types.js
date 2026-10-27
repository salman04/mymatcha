export const MILK_TYPES = Object.freeze({
 fresh: {name:'Fresh Milk',accent:'#94b9cd',ink:'#406e86',paper:'#f5efe1',liquid:'#ffffff'},
 almond: {name:'Almond Milk',accent:'#cba77c',ink:'#986337',paper:'#f3e7d4',liquid:'#eadcc7'},
 oat: {name:'Oat Milk',accent:'#a8af7d',ink:'#666d39',paper:'#f3edd7',liquid:'#f5efdf'},
});
export const milkName = type => MILK_TYPES[type]?.name || (type==='mixed'?'Campuran susu':'Belum ada susu');
export function milkDescription(glass){
 const parts=Object.entries(glass.milkParts||{}).filter(([,ml])=>ml>0);
 return parts.length?parts.map(([type,ml])=>`${milkName(type)} ${Math.round(ml)} ml`).join(' + '):milkName(glass.milkType);
}
