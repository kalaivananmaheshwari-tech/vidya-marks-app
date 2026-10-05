"use client";
import {useCallback,useEffect,useRef,useState} from "react";
export class ApiError extends Error {constructor(message:string,public status:number,public code:string|undefined,public details:Record<string,unknown>){super(message);}}
export async function apiRequest<T>(url:string,options?:RequestInit):Promise<T>{
  const response=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options?.headers ?? {})}});
  const text=await response.text();let data:Record<string,unknown>;
  try{data=text?JSON.parse(text) as Record<string,unknown>:{};}catch{throw new ApiError(`Request failed (${response.status}).`,response.status,undefined,{});}
  if(!response.ok)throw new ApiError(typeof data.error==="string"?data.error:`Request failed (${response.status})`,response.status,typeof data.code==="string"?data.code:undefined,data);
  return data as T;
}
export type ApiState<T>={data:T|null;error:string|null;errorDetails:Record<string,unknown>|null;loading:boolean;refreshing:boolean;refresh:()=>Promise<void>;setData:(updater:T|((prev:T|null)=>T|null))=>void};
/** Abort stale context requests and clear failed data: a forbidden/incomplete report must never remain printable. */
export function useApi<T>(url:string|null,deps:unknown[]=[]):ApiState<T>{
  const [data,setData]=useState<T|null>(null);const [error,setError]=useState<string|null>(null);const [errorDetails,setDetails]=useState<Record<string,unknown>|null>(null);const [loading,setLoading]=useState(Boolean(url));const [refreshing,setRefreshing]=useState(false);
  const controller=useRef<AbortController|null>(null);const sequence=useRef(0);
  const load=useCallback(async(silent:boolean)=>{
    const id=++sequence.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;
    if(!url){setData(null);setError(null);setDetails(null);setLoading(false);setRefreshing(false);return;}
    if(silent)setRefreshing(true);else{setLoading(true);setData(null);setError(null);setDetails(null);}
    try{const result=await apiRequest<T>(url,{signal:abort.signal});if(id!==sequence.current || abort.signal.aborted)return;setData(result);setError(null);setDetails(null);}
    catch(e){if(id!==sequence.current || abort.signal.aborted)return;setData(null);setError(e instanceof Error?e.message:"The request could not be completed.");setDetails(e instanceof ApiError?e.details:null);}
    finally{if(id===sequence.current){setLoading(false);setRefreshing(false);}}
  },[url]);
  const cancel=useCallback(()=>{sequence.current++;controller.current?.abort();},[]);
  useEffect(()=>{void load(false);return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[url,...deps]);
  const refresh=useCallback(async()=>{await load(true);},[load]);
  const update=useCallback((updater:T|((p:T|null)=>T|null))=>setData((p)=>typeof updater==="function"?(updater as (v:T|null)=>T|null)(p):updater),[]);
  return {data,error,errorDetails,loading,refreshing,refresh,setData:update};
}
export function classNames(...values:Array<string|false|null|undefined>){return values.filter(Boolean).join(" ");}
