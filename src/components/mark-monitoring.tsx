"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {Badge,Card,EmptyState,ErrorState,Field,Select,TableSkeleton} from "@/components/ui";
import {useApi} from "@/lib/client";
import type {ExamRow} from "@/lib/shared-types";
import type {MonitoringRow} from "@/lib/mark-entry";
export default function MarkMonitoring({teacher=false,examId:chosen}:{teacher?:boolean;examId?:string}){
  const exams=useApi<{exams:ExamRow[]}>("/api/exams");const [examId,setExam]=useState("");
  useEffect(()=>{if(chosen)setExam(chosen);else if(!examId && exams.data?.exams.length)setExam(String(exams.data.exams[0].id));},[chosen,examId,exams.data]);
  const status=useApi<{rows:MonitoringRow[]}>(examId?`/api/mark-entry/status?examId=${examId}`:null);const rows=status.data?.rows ?? [];
  return <Card padded={false}><div className="flex flex-wrap items-end justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">{teacher?"My assigned classes & entry completion":"Administrator mark-entry monitoring"}</h2><p className="text-xs text-slate-500">Class / Section / Subject / Teacher / Total Students / Entered / Pending / Status. Completion comes from stored entries.</p></div><Field label="Monitoring examination"><Select value={examId} onChange={(e)=>setExam(e.target.value)}><option value="">Select examination</option>{exams.data?.exams.map((e)=><option key={e.id} value={e.id}>{e.name} · {e.academicYear}</option>)}</Select></Field></div>
    {status.error?<ErrorState message={status.error} onRetry={status.refresh}/>:status.loading?<TableSkeleton rows={5} cols={8}/>:!rows.length?<EmptyState icon="📋" title={teacher?"No assignments for this examination year":"No mapped subjects for this examination year"} description="Administrators must configure classes, subjects and active teacher mappings."/>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr>{["Class","Section","Subject","Teacher","Total Students","Entered","Pending","Status","Open"].map((h)=><th scope="col" key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map((r)=><tr key={`${r.classId}:${r.subjectId}`} className="border-t border-slate-100"><td className="p-3">{r.className}</td><td className="p-3">{r.section}</td><td className="p-3">{r.subjectName}</td><td className="p-3">{r.teacherName}</td><td className="p-3 tabular-nums">{r.totalStudents}</td><td className="p-3 tabular-nums">{r.entered}</td><td className="p-3 tabular-nums">{r.pending}</td><td className="p-3"><Badge tone={r.status==="Complete"?"green":"amber"}>{r.status}</Badge></td><td className="p-3"><Link href={`/marks?classId=${r.classId}&subjectId=${r.subjectId}&examId=${examId}`} className="font-semibold text-brand-600">Enter marks →</Link></td></tr>)}</tbody></table></div>}
  </Card>;
}
