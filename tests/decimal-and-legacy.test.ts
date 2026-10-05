import {describe,it,expect} from "vitest";
import {sumMarks} from "@/lib/domain/decimal-sum";
import {allocationFor,validateAndCalculateMark,resultForMark} from "@/lib/domain/marks";
import {allocationReviewRequired} from "@/lib/domain/legacy-allocations";
import {requestFingerprint} from "@/lib/security";
describe("exact numeric marks and non-destructive legacy review",()=>{
  it("sums decimals and scientific notation without binary-noise or rounding into a pass",()=>{expect(sumMarks([0.1,0.2])).toBe(0.3);expect(sumMarks([1e-8,2e-8])).toBe(3e-8);const m=validateAndCalculateMark({theoryScore:33.333,internalScore:1.666},allocationFor(7,false));expect(m.score).toBe(34.999);expect(resultForMark(m)).toBe("Fail");});
  it("does not tie distinct decimal totals by rounding",()=>{expect(sumMarks([40.001,70,80])).toBe(190.001);expect(sumMarks([40.004,70,80])).toBe(190.004);});
  it("preserves an existing final /100 total without inventing component conversion",()=>{expect(allocationReviewRequired({status:"NUMERIC",score:80,theoryScore:72,internalScore:8,practicalScore:null,allocationSnapshot:{legacy:true,theoryMarks:90,practicalMarks:0,internalMarks:10,maxMarks:100}},allocationFor(10,false))).toBe(false);});
  it("blocks legacy practical components with unapproved reinterpretation",()=>{expect(allocationReviewRequired({status:"NUMERIC",score:80,theoryScore:56,practicalScore:16,internalScore:8,allocationSnapshot:{legacy:true,theoryMarks:70,practicalMarks:20,internalMarks:10,maxMarks:100}},allocationFor(10,true))).toBe(true);});
  it("rotating a user agent cannot bypass the per-source rate limit",()=>{const a=requestFingerprint(new Request("https://app.test",{headers:{"user-agent":"first"}}));const b=requestFingerprint(new Request("https://app.test",{headers:{"user-agent":"rotated"}}));expect(a).toBe(b);});
});
