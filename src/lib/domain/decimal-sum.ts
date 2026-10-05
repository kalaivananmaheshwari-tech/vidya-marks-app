/** Add finite nonnegative decimal marks without binary-float noise or an invented rounding rule. */
export function sumMarks(values:readonly number[]):number {
  if(!values.length)return 0;
  const parts=values.map((n)=>{if(!Number.isFinite(n) || n<0)throw new Error("Invalid numeric mark.");const [mantissa,exponent="0"]=n.toString().toLowerCase().split("e");const [whole,fraction=""]=mantissa.split(".");const scale=fraction.length-Number(exponent);return {coefficient:BigInt(whole+fraction),scale};});
  const scale=Math.max(0,...parts.map((p)=>p.scale));const total=parts.reduce((s,p)=>s+p.coefficient*BigInt(10)**BigInt(scale-p.scale),BigInt(0));if(!scale)return Number(total);
  const padded=total.toString().padStart(scale+1,"0");return Number(`${padded.slice(0,-scale)}.${padded.slice(-scale)}`);
}
