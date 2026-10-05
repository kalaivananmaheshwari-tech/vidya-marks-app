import { validateAndCalculateMark,type Allocation,type MarkInput } from "@/lib/domain/marks";
export type MarkDraft={theoryScore:string;practicalScore:string;internalScore:string;score:string;isAbsent:boolean;isExempt:boolean};
export const emptyMarkDraft=():MarkDraft=>({theoryScore:"",practicalScore:"",internalScore:"",score:"",isAbsent:false,isExempt:false});
export function draftFromMark(mark?:{theoryScore?:number|null;practicalScore?:number|null;internalScore?:number|null;score?:number|null;isAbsent?:boolean;isExempt?:boolean;status?:string}):MarkDraft {return {theoryScore:mark?.theoryScore==null?"":String(mark.theoryScore),practicalScore:mark?.practicalScore==null?"":String(mark.practicalScore),internalScore:mark?.internalScore==null?"":String(mark.internalScore),score:mark?.score==null?"":String(mark.score),isAbsent:mark?.isAbsent ?? mark?.status==="AB",isExempt:mark?.isExempt ?? mark?.status==="EXEMPT"};}
export function draftMarkInput(d:MarkDraft,allocation:Allocation):MarkInput {
  if(d.isAbsent)return {status:"AB"};if(d.isExempt)return {status:"EXEMPT"};
  const number=(s:string)=>s.trim()===""?null:Number(s);
  const input:MarkInput=allocation.mode==="TOTAL"?{score:number(d.score)}:{theoryScore:number(d.theoryScore),...(allocation.practicalMarks?{practicalScore:number(d.practicalScore)}:{}),...(allocation.internalMarks?{internalScore:number(d.internalScore)}:{})};
  validateAndCalculateMark(input,allocation);return input;
}
export function draftResult(d:MarkDraft,allocation:Allocation){try{return validateAndCalculateMark(draftMarkInput(d,allocation),allocation);}catch{return {status:"PENDING" as const,score:null};}}
export function draftChanged(d:MarkDraft,original:MarkDraft,allocation:Allocation){return d.isAbsent!==original.isAbsent || d.isExempt!==original.isExempt || (allocation.mode==="TOTAL"?d.score!==original.score:d.theoryScore!==original.theoryScore || d.practicalScore!==original.practicalScore || d.internalScore!==original.internalScore);}
