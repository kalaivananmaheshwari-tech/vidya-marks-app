"use client";
import {Field,Input,Select} from "@/components/ui";
import {draftResult,type MarkDraft} from "@/lib/mark-drafts";
import type {Allocation} from "@/lib/domain/marks";
export default function MarkFields({label,allocation,draft,onChange,disabled=false}:{label:string;allocation:Allocation;draft:MarkDraft;onChange:(patch:Partial<MarkDraft>)=>void;disabled?:boolean}){
  const result=draftResult(draft,allocation);const nonnumeric=draft.isAbsent || draft.isExempt;
  const components=allocation.mode==="TOTAL"?[{key:"score" as const,title:"Total",max:100}]:[{key:"theoryScore" as const,title:"Theory",max:allocation.theoryMarks},...(allocation.practicalMarks?[{key:"practicalScore" as const,title:"Practical",max:allocation.practicalMarks}]:[]),...(allocation.internalMarks?[{key:"internalScore" as const,title:"Internal",max:allocation.internalMarks}]:[])];
  return <fieldset disabled={disabled} className="flex flex-wrap items-end gap-2" aria-label={`${label} marks`}>
    {components.map((c)=><Field key={c.key} label={`${label} ${c.title} /${c.max}`}><Input type="number" inputMode="decimal" min={0} max={c.max} step="0.01" className="no-print w-24" value={nonnumeric?"":draft[c.key]} disabled={disabled || nonnumeric} onChange={(e)=>onChange({[c.key]:e.target.value})} onKeyDown={(e)=>{if(["Enter","ArrowDown","ArrowUp"].includes(e.key)){e.preventDefault();const table=e.currentTarget.closest("table");if(table){const inputs=Array.from(table.querySelectorAll<HTMLInputElement>('input[type="number"]:not(:disabled)'));inputs[inputs.indexOf(e.currentTarget)+(e.key==="ArrowUp"?-1:1)]?.focus();}}}}/><span className="print-only">{nonnumeric?"—":draft[c.key] || "—"}</span></Field>)}
    <Field label={`${label} Entry state`}><Select className="w-32" value={draft.isAbsent?"AB":draft.isExempt?"EXEMPT":"MARKS"} onChange={(e)=>onChange({isAbsent:e.target.value==="AB",isExempt:e.target.value==="EXEMPT"})}><option value="MARKS">Marks</option><option value="AB">AB</option><option value="EXEMPT">Exemption</option></Select></Field>
    <output className="pb-2 text-sm font-semibold" aria-label={`${label} calculated result`}>{result.status==="NUMERIC"?`${result.score} /100 · ${result.score!>=35?"Pass":"Fail"}`:result.status==="EXEMPT"?"Exemption":result.status==="AB"?"AB":"Pending"}</output>
  </fieldset>;
}
