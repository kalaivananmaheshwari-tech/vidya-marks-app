"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {Button,Card,Field,Input,Select} from "@/components/ui";
import {apiRequest,useApi} from "@/lib/client";
import {DEFAULT_ACADEMIC_YEAR} from "@/lib/academic";
import {REGISTRATION_USER_TYPES,SCHOOL_MANAGEMENTS,SCHOOL_TYPES} from "@/lib/domain/geography";
export default function RegisterForm(){
  const router=useRouter();const years=useApi<{academicYears:Array<{id:string;label:string}>}>("/api/academic-years");
  const [form,setForm]=useState({userType:"HEADMASTER",schoolName:"",udiseCode:"",district:"",educationalDistrict:"",block:"",management:"Government",schoolType:"Secondary",academicYear:DEFAULT_ACADEMIC_YEAR,adminName:"",phone:"",email:"",password:"",confirmPassword:""});
  const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);
  const school=["HEADMASTER","PRINCIPAL"].includes(form.userType);
  const educational=school || ["DEO","BEO"].includes(form.userType);const block=school || form.userType==="BEO";
  function set(key:keyof typeof form,value:string){setForm((old)=>({...old,[key]:value}));}
  async function submit(event:React.FormEvent){event.preventDefault();setError(null);setLoading(true);try{
    const {userType,adminName,district,phone,email,password,confirmPassword}=form;
    await apiRequest("/api/auth/register",{method:"POST",body:JSON.stringify({userType,adminName,district,phone,email,password,confirmPassword,...(educational?{educationalDistrict:form.educationalDistrict}:{}),...(block?{block:form.block}:{}),...(school?{schoolName:form.schoolName,udiseCode:form.udiseCode,management:form.management,schoolType:form.schoolType,academicYear:form.academicYear,state:"Tamil Nadu",designation:userType}:{})})});
    router.replace("/dashboard");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Registration could not be submitted.");}finally{setLoading(false);}}
  return <div className="w-full max-w-xl"><Card className="p-6 sm:p-8"><h2 className="text-xl font-semibold text-slate-900">Register your school</h2><p className="mt-1 text-sm text-slate-500">UDISE is mandatory, unique and immutable. Teachers receive individual accounts and assignments from their school administrator.</p>
    <form onSubmit={submit} className="mt-6 space-y-5">
      <Field label="User Type"><Select value={form.userType} onChange={(e)=>set("userType",e.target.value)}>{REGISTRATION_USER_TYPES.map((r)=><option key={r} value={r}>{r}</option>)}</Select></Field>
      {!school && <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{form.userType} authority requires verified activation. Public privileged self-registration is not enabled; submitting this form cannot grant access.</div>}
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Registered geographic scope">
        <Field label="District"><Input required value={form.district} onChange={(e)=>set("district",e.target.value)} placeholder="Coimbatore" maxLength={150}/></Field>
        {educational && <Field label="Educational District"><Input required value={form.educationalDistrict} onChange={(e)=>set("educationalDistrict",e.target.value)} placeholder="Pollachi" maxLength={150}/></Field>}
        {block && <Field label="Block"><Input required value={form.block} onChange={(e)=>set("block",e.target.value)} placeholder="Kinathukadavu" maxLength={150}/></Field>}
      </section>
      {school && <section className="space-y-4 rounded-xl bg-slate-50 p-4" aria-label="School details">
        <Field label="Name of the school"><Input required value={form.schoolName} onChange={(e)=>set("schoolName",e.target.value)} maxLength={150}/></Field>
        <Field label="UDISE code (11 digits)" hint="Becomes the school admin username and cannot be changed."><Input required value={form.udiseCode} onChange={(e)=>set("udiseCode",e.target.value.replace(/\D/g,"").slice(0,11))} inputMode="numeric" pattern="[0-9]{11}" minLength={11} maxLength={11}/></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="School Management"><Select value={form.management} onChange={(e)=>set("management",e.target.value)}>{SCHOOL_MANAGEMENTS.map((m)=><option key={m}>{m}</option>)}</Select></Field><Field label="School Type"><Select value={form.schoolType} onChange={(e)=>set("schoolType",e.target.value)}>{SCHOOL_TYPES.map((t)=><option key={t}>{t}</option>)}</Select></Field></div>
        <Field label="Academic Year" hint="Relational records, initially 2026–2027 through 2040–2041; future years can be added by an administrator."><Select required value={form.academicYear} onChange={(e)=>set("academicYear",e.target.value)} disabled={years.loading || Boolean(years.error)}>{years.data?.academicYears.map((y)=><option key={y.id} value={y.label}>{y.label}</option>)}</Select></Field>
        {years.error && <p role="alert" className="text-sm text-rose-700">Academic years could not be loaded. Database readiness is required.</p>}
      </section>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Your name"><Input required value={form.adminName} onChange={(e)=>set("adminName",e.target.value)} maxLength={150}/></Field><Field label="Registered Admin Contact Number" hint="OTP recovery uses only this registered mobile number."><Input required type="tel" value={form.phone} onChange={(e)=>set("phone",e.target.value)} placeholder="9840012345" minLength={10} maxLength={20}/></Field></div>
      <Field label="Official email (optional)"><Input type="email" value={form.email} onChange={(e)=>set("email",e.target.value)}/></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Create password"><Input required type="password" autoComplete="new-password" value={form.password} onChange={(e)=>set("password",e.target.value)} minLength={10} maxLength={128} placeholder="At least 10 characters"/></Field><Field label="Confirm password"><Input required type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e)=>set("confirmPassword",e.target.value)} minLength={10} maxLength={128}/></Field></div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <Button type="submit" className="w-full" loading={loading} disabled={school && (years.loading || Boolean(years.error))}>{school?"Register school & open dashboard":"Submit for verified activation"}</Button>
      <p className="text-center text-sm text-slate-500">Already registered? <Link href="/login" className="font-semibold text-brand-600">Sign in here</Link></p>
    </form></Card></div>;
}
