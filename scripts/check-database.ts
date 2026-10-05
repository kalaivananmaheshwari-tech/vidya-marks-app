import "dotenv/config";
import {reviewUnvalidatedConstraints} from "./constraint-review";
import {sql} from "drizzle-orm";
import {db,closeDatabase,databaseMode} from "../src/db";
import {schemaIsReady} from "../src/db/migrate";
async function main(){try{
  if(!(await schemaIsReady()))throw new Error("SCHEMA_NOT_READY");
  const result=await db.transaction(async(tx)=>{
    const queries:Record<string,string>={
      academicYears:"select count(*)::int as value from academic_years",
      duplicateActiveExamNumbers:"select count(*)::int as value from (select school_id,class_id,exam_number from student_enrollments where is_active group by school_id,class_id,exam_number having count(*)>1) d",
      missingMarkIdentities:"select count(*)::int as value from marks where student_uuid is null or enrollment_id is null or class_section_id is null or class_subject_id is null or allocation_id is null",
      crossSchoolOrOrphanMarks:"select count(*)::int as value from marks m left join student_enrollments e on e.id=m.enrollment_id and e.school_id=m.school_id and e.student_uuid=m.student_uuid left join class_subjects cs on cs.id=m.class_subject_id and cs.school_id=m.school_id and cs.class_section_id=m.class_section_id left join exams x on x.id=m.exam_id and x.school_id=m.school_id left join mark_allocations a on a.id=m.allocation_id and a.school_id=m.school_id and a.class_subject_id=m.class_subject_id where e.id is null or cs.id is null or x.id is null or a.id is null",
      orphanOrCrossScopeEnrollments:"select count(*)::int as value from student_enrollments e left join students s on s.id=e.student_id and s.uuid=e.student_uuid and s.school_id=e.school_id left join class_sections cs on cs.id=e.class_section_id and cs.school_id=e.school_id and cs.class_id=e.class_id and cs.academic_year_id=e.academic_year_id where s.id is null or cs.id is null",
      orphanOrCrossScopeAssignments:"select count(*)::int as value from teacher_subject_assignments a left join class_subjects cs on cs.id=a.class_subject_id and cs.school_id=a.school_id and cs.class_id=a.class_id and cs.subject_id=a.subject_id left join teacher_profiles p on p.id=a.teacher_profile_id and p.school_id=a.school_id and p.user_id=a.teacher_id where cs.id is null or p.id is null",
      invalidNonNumericStates:"select count(*)::int as value from marks where status in ('AB','EXEMPT') and (score is not null or theory_score is not null or practical_score is not null or internal_score is not null)",
      invalidNumericTotals:"select count(*)::int as value from marks where status='NUMERIC' and (score_exact is null or score_exact<0 or score_exact>100 or is_absent or is_exempt)",
      legacyPracticalAllocationReview:"select count(*)::int as value from marks m join mark_allocations a on a.id=m.allocation_id and a.school_id=m.school_id where m.status='NUMERIC' and a.mode='COMPONENTS' and (m.allocation_snapshot is null or (m.allocation_snapshot->>'theoryMarks')::integer is distinct from a.theory_marks or (m.allocation_snapshot->>'practicalMarks')::integer is distinct from a.practical_marks or (m.allocation_snapshot->>'internalMarks')::integer is distinct from a.internal_marks)",
      publishedWithoutSnapshots:"select count(*)::int as value from exams x where x.is_published and not exists(select 1 from exam_publications p where p.school_id=x.school_id and p.exam_id=x.id)",
      nonValidatedConstraints:"select count(*)::int as value from pg_constraint where connamespace='public'::regnamespace and not convalidated",
      archivedStudents:"select count(*)::int as value from students where archived_at is not null",
    };
    const checks:Record<string,number>={};for(const [key,q] of Object.entries(queries)){const r=await tx.execute<{value:number}>(sql.raw(q));checks[key]=Number(r.rows[0]?.value ?? 0);}return {checks,constraintReview:await reviewUnvalidatedConstraints(tx)};
  },{isolationLevel:"repeatable read",accessMode:"read only"});
  const faults=["duplicateActiveExamNumbers","missingMarkIdentities","crossSchoolOrOrphanMarks","orphanOrCrossScopeEnrollments","orphanOrCrossScopeAssignments","invalidNonNumericStates","invalidNumericTotals","legacyPracticalAllocationReview","publishedWithoutSnapshots"].filter((k)=>result.checks[k]>0);
  console.log(JSON.stringify({engine:databaseMode(),schemaReady:true,readOnly:true,checks:result.checks,constraintReview:result.constraintReview,dataReviewRequired:faults},null,2));if(faults.length || result.constraintReview.some((c)=>c.violatingRows>0))process.exitCode=1;
}catch{console.error("Database check unavailable; confirm configuration and migration readiness. No data was changed; connection details are suppressed.");process.exitCode=1;}finally{await closeDatabase();}}
void main();
