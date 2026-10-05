-- Additional new-write protection and factual reporting metadata; no rekeying/deletion.
alter table students add column medium text check(medium in ('Tamil','English'));
create unique index students_school_id_idx on students(school_id,id);
alter table marks add constraint marks_student_scope_fk foreign key(school_id,student_id) references students(school_id,id) not valid;
create unique index memberships_id_user_idx on school_memberships(id,user_id);
alter table sessions add constraint session_membership_user_fk foreign key(membership_id,user_id) references school_memberships(id,user_id) not valid;
create unique index class_sections_scope_year_idx on class_sections(school_id,id,academic_year_id);
alter table student_enrollments add constraint enrollment_year_scope_fk foreign key(school_id,class_section_id,academic_year_id) references class_sections(school_id,id,academic_year_id);
create unique index allocations_scope_subject_idx on mark_allocations(school_id,id,class_subject_id);
alter table marks add constraint mark_allocation_subject_fk foreign key(school_id,allocation_id,class_subject_id) references mark_allocations(school_id,id,class_subject_id) not valid;
update marks m set allocation_id=a.id from mark_allocations a where m.class_subject_id=a.class_subject_id and m.school_id=a.school_id and m.allocation_id is null;
alter table marks add constraint mark_identity_required_check check(student_uuid is not null and enrollment_id is not null and class_section_id is not null and class_subject_id is not null and allocation_id is not null) not valid;
create unique index enrollment_active_person_idx on student_enrollments(school_id,student_uuid) where is_active;
-- Roman class names used by some legacy schools receive the same explicit approved rules.
update mark_allocations a set
 mode=case when c.name ~* '^(class[[:space:]]+)?(VIII|IX|X)$' and not a.has_practical then 'TOTAL' else 'COMPONENTS' end,
 theory_marks=case when c.name ~* '^(class[[:space:]]+)?(VIII|IX|X)$' then case when a.has_practical then 75 else 0 end else case when a.has_practical then 70 else 90 end end,
 practical_marks=case when a.has_practical then case when c.name ~* '^(class[[:space:]]+)?(VIII|IX|X)$' then 25 else 20 end else 0 end,
 internal_marks=case when c.name ~* '^(class[[:space:]]+)?(VIII|IX|X)$' then 0 else 10 end
from class_subjects cs join classes c on c.id=cs.class_id where a.class_subject_id=cs.id and c.name ~* '^(class[[:space:]]+)?(VI|VII|VIII|IX|X|XI|XII)$';
insert into mark_allocation_components(school_id,allocation_id,kind,maximum)
select a.school_id,a.id,v.kind,v.maximum from mark_allocations a cross join lateral (values ('theory',a.theory_marks),('practical',a.practical_marks),('internal',a.internal_marks),('total',case when a.mode='TOTAL' then 100 else 0 end)) v(kind,maximum) where a.mode<>'UNAPPROVED'
on conflict(allocation_id,kind) do update set maximum=excluded.maximum;
