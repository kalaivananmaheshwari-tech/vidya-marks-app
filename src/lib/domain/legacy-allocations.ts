import {markState,validateAndCalculateMark,type Allocation,type ResultMark} from "@/lib/domain/marks";
export type StoredAssessment=ResultMark & {theoryScore:number|null;practicalScore:number|null;internalScore:number|null;allocationSnapshot:unknown};
/** No conversion of historical practical components is approved. Preserve, isolate and require source-based review. */
export function allocationReviewRequired(mark:StoredAssessment,allocation:Allocation):boolean{
  const state=markState(mark);if(state==="PENDING")return false;
  if(state!=="NUMERIC")return [mark.score,mark.theoryScore,mark.practicalScore,mark.internalScore].some((v)=>v!==null);
  const snapshot=mark.allocationSnapshot as Partial<Allocation> & {legacy?:boolean} | null;
  // A stored final total /100 already has the exact meaning of the approved TOTAL-only rule. Do not rewrite legacy components.
  if(allocation.mode==="TOTAL")return mark.score===null || !Number.isFinite(mark.score) || mark.score<0 || mark.score>100;
  if(!snapshot || snapshot.theoryMarks!==allocation.theoryMarks || snapshot.practicalMarks!==allocation.practicalMarks || snapshot.internalMarks!==allocation.internalMarks || snapshot.maxMarks!==allocation.maxMarks)return true;
  try{validateAndCalculateMark({status:"NUMERIC",score:mark.score,theoryScore:mark.theoryScore,practicalScore:mark.practicalScore,internalScore:mark.internalScore},allocation);return false;}catch{return true;}
}
