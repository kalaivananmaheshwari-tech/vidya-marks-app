import {sql} from "drizzle-orm";
import {marks} from "@/db/schema";
/** Authoritative decimal values. Legacy REAL columns remain intact for historical compatibility. */
export const markValues={
  score:sql<number|null>`coalesce(${marks.scoreExact},${marks.score}::numeric)`.mapWith(Number),
  theoryScore:sql<number|null>`coalesce(${marks.theoryScoreExact},${marks.theoryScore}::numeric)`.mapWith(Number),
  practicalScore:sql<number|null>`coalesce(${marks.practicalScoreExact},${marks.practicalScore}::numeric)`.mapWith(Number),
  internalScore:sql<number|null>`coalesce(${marks.internalScoreExact},${marks.internalScore}::numeric)`.mapWith(Number),
};
export function normalizedMark<T extends {score:number|null;theoryScore:number|null;practicalScore:number|null;internalScore:number|null;scoreExact?:number|null;theoryScoreExact?:number|null;practicalScoreExact?:number|null;internalScoreExact?:number|null}>(m:T):T{return {...m,score:m.scoreExact ?? m.score,theoryScore:m.theoryScoreExact ?? m.theoryScore,practicalScore:m.practicalScoreExact ?? m.practicalScore,internalScore:m.internalScoreExact ?? m.internalScore};}
