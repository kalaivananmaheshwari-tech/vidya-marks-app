import {sql,type SQLWrapper} from "drizzle-orm";
import {classNumber} from "@/lib/domain/marks";
import {HttpError} from "@/lib/http";
/** Existing approved rules only. Historical storage does not authorize primary-class calculations. */
export function assertApprovedScoring(name:string){const grade=classNumber(name);if(grade===null || grade<6)throw new HttpError("Scoring and result calculations for this class are not approved.",409,"FEATURE_NOT_APPROVED");}
/** Mirrors the approved numeric/Roman names recognized by classNumber for SQL-scoped aggregate reads. */
export function approvedScoringCondition(name:SQLWrapper){return sql`lower(regexp_replace(btrim(${name}), '^class[[:space:]]+', '', 'i')) in ('6','06','7','07','8','08','9','09','10','11','12','vi','vii','viii','ix','x','xi','xii')`;}
