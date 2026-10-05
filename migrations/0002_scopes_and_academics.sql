-- Additive upgrade. No production tables, columns, IDs or academic records are removed.
-- Run inside the migration transaction. NOT VALID protects NEW writes without deleting
-- legacy inconsistencies; db:check reports any records requiring human review.

create table academic_years (
  id uuid primary key default gen_random_uuid(), label text not null unique,
  start_year integer not null unique, end_year integer not null,
  created_at timestamptz not null default now(), check (end_year = start_year + 1)
);
insert into academic_years (label, start_year, end_year)
select y::text || '-' || (y+1)::text, y, y+1 from generate_series(2026, 2040) y;
-- Preserve valid older/current years already used by this installation.
insert into academic_years (label, start_year, end_year)
select distinct label, left(label,4)::integer, right(label,4)::integer from (
  select academic_year label from schools union select academic_year from classes union select academic_year from exams
) old where label ~ '^[0-9]{4}-[0-9]{4}$' and right(label,4)::integer = left(label,4)::integer + 1
on conflict do nothing;

alter table schools add column educational_district text;
alter table schools add column block text;
alter table schools add column management text;
alter table schools add column school_type text;
alter table schools add column admin_contact_number text;
alter table schools add column academic_year_id uuid references academic_years(id);
alter table schools add constraint schools_management_check check (management in ('Government','Aided','Matric')) not valid;
alter table schools add constraint schools_type_check check (school_type in ('Higher Secondary','Secondary','Middle','Elementary')) not valid;
alter table users alter column school_id drop not null;
alter table users add column user_type text;
alter table sessions add column membership_id uuid;
alter table classes add column academic_year_id uuid references academic_years(id);
alter table exams add column academic_year_id uuid references academic_years(id);
alter table classes alter column academic_year set default '2026-2027';
alter table exams alter column academic_year set default '2026-2027';
alter table groups add column archived_at timestamptz;
alter table classes add column archived_at timestamptz;
alter table subjects add column archived_at timestamptz;
alter table exams add column archived_at timestamptz;
alter table students add column archived_at timestamptz;
alter table students add column uuid uuid not null default gen_random_uuid() unique;
update schools s set academic_year_id = a.id from academic_years a where a.label = s.academic_year;
update classes c set academic_year_id = a.id from academic_years a where a.label = c.academic_year;
update exams e set academic_year_id = a.id from academic_years a where a.label = e.academic_year;
update schools s set admin_contact_number = u.phone from users u where u.school_id = s.id and u.role = 'admin' and u.phone is not null;

create unique index users_school_id_idx on users(school_id,id);
create unique index groups_school_id_idx on groups(school_id,id);
create unique index classes_school_id_idx on classes(school_id,id);
create unique index subjects_school_id_idx on subjects(school_id,id);
create unique index students_school_id_uuid_idx on students(school_id,id,uuid);
create unique index students_school_uuid_idx on students(school_id,uuid);
create unique index exams_school_id_idx on exams(school_id,id);
create unique index marks_school_id_idx on marks(school_id,id);
alter table classes add constraint classes_group_scope_fk foreign key(school_id,group_id) references groups(school_id,id) not valid;
alter table classes add constraint classes_teacher_scope_fk foreign key(school_id,class_teacher_id) references users(school_id,id) not valid;
alter table subjects add constraint subjects_class_scope_fk foreign key(school_id,class_id) references classes(school_id,id) not valid;
alter table subjects add constraint subjects_group_scope_fk foreign key(school_id,group_id) references groups(school_id,id) not valid;
alter table subjects add constraint subjects_teacher_scope_fk foreign key(school_id,teacher_id) references users(school_id,id) not valid;
alter table students add constraint students_class_scope_fk foreign key(school_id,class_id) references classes(school_id,id) not valid;
alter table marks add constraint marks_subject_scope_fk foreign key(school_id,subject_id) references subjects(school_id,id) not valid;
alter table marks add constraint marks_exam_scope_fk foreign key(school_id,exam_id) references exams(school_id,id) not valid;
alter table marks add constraint marks_actor_scope_fk foreign key(school_id,entered_by_id) references users(school_id,id) not valid;

create table user_identities (
  id uuid primary key default gen_random_uuid(), user_id integer not null references users(id),
  provider text not null default 'password', subject text not null
);
create unique index identities_provider_subject_idx on user_identities(provider,subject);
insert into user_identities(user_id,subject) select id,username from users;
create table school_memberships (
  id uuid primary key default gen_random_uuid(), school_id integer not null references schools(id),
  user_id integer not null references users(id), is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index memberships_school_user_idx on school_memberships(school_id,user_id);
create unique index memberships_school_id_idx on school_memberships(school_id,id);
create unique index memberships_scope_user_idx on school_memberships(school_id,id,user_id);
create table membership_roles (
  id uuid primary key default gen_random_uuid(), membership_id uuid not null references school_memberships(id),
  role text not null check(role in ('ADMIN','HEADMASTER','PRINCIPAL','TEACHER'))
);
create unique index membership_roles_unique_idx on membership_roles(membership_id,role);
insert into school_memberships(school_id,user_id,is_active) select school_id,id,is_active from users where school_id is not null;
-- Preserve ambiguous legacy 'admin' designations as ADMIN; do not guess HEADMASTER vs PRINCIPAL.
insert into membership_roles(membership_id,role)
select m.id,case when u.role='admin' then 'ADMIN' else 'TEACHER' end from school_memberships m join users u on u.id=m.user_id;
update sessions s set membership_id=m.id from school_memberships m join users u on u.id=m.user_id and u.school_id=m.school_id where s.user_id=u.id;
alter table sessions add constraint session_membership_fk foreign key(membership_id) references school_memberships(id);
create table teacher_profiles (
  id uuid primary key default gen_random_uuid(), school_id integer not null references schools(id),
  user_id integer not null references users(id), membership_id uuid not null,
  constraint teacher_profiles_membership_scope_fk foreign key(school_id,membership_id) references school_memberships(school_id,id),
  constraint teacher_profiles_member_user_fk foreign key(school_id,membership_id,user_id) references school_memberships(school_id,id,user_id)
);
create unique index teacher_profiles_school_user_idx on teacher_profiles(school_id,user_id);
create unique index teacher_profiles_school_id_idx on teacher_profiles(school_id,id);
create unique index teacher_profiles_scope_user_idx on teacher_profiles(school_id,id,user_id);
insert into teacher_profiles(school_id,user_id,membership_id) select m.school_id,m.user_id,m.id from school_memberships m join membership_roles r on r.membership_id=m.id where r.role='TEACHER';

create table sections (
  id uuid primary key default gen_random_uuid(), school_id integer not null references schools(id), name text not null
);
create unique index sections_school_name_idx on sections(school_id,name);
create unique index sections_school_id_idx on sections(school_id,id);
insert into sections(school_id,name) select distinct school_id,section from classes;
create table class_sections (
  id uuid primary key default gen_random_uuid(), school_id integer not null references schools(id),
  class_id integer not null references classes(id), section_id uuid not null,
  academic_year_id uuid not null references academic_years(id),
  constraint class_sections_class_scope_fk foreign key(school_id,class_id) references classes(school_id,id),
  constraint class_sections_section_scope_fk foreign key(school_id,section_id) references sections(school_id,id)
);
create unique index class_sections_legacy_class_idx on class_sections(class_id);
create unique index class_sections_school_id_idx on class_sections(school_id,id);
create unique index class_sections_scope_class_idx on class_sections(school_id,id,class_id);
insert into class_sections(school_id,class_id,section_id,academic_year_id)
select c.school_id,c.id,s.id,c.academic_year_id from classes c join sections s on s.school_id=c.school_id and s.name=c.section where c.academic_year_id is not null;
create table class_subjects (
  id uuid primary key default gen_random_uuid(), school_id integer not null references schools(id),
  class_section_id uuid not null, class_id integer not null references classes(id), subject_id integer not null references subjects(id),
  is_required boolean not null default true,
  constraint class_subjects_section_scope_fk foreign key(school_id,class_section_id,class_id) references class_sections(school_id,id,class_id),
  constraint class_subjects_subject_scope_fk foreign key(school_id,subject_id) references subjects(school_id,id)
);
create unique index class_subjects_class_subject_idx on class_subjects(class_id,subject_id);
create unique index class_subjects_school_id_idx on class_subjects(school_id,id);
create unique index class_subjects_school_id_section_idx on class_subjects(school_id,id,class_section_id);
create unique index class_subjects_scope_pair_idx on class_subjects(school_id,id,class_id,subject_id);
insert into class_subjects(school_id,class_section_id,class_id,subject_id)
select c.school_id,cs.id,c.id,s.id from classes c join class_sections cs on cs.class_id=c.id
join subjects s on s.school_id=c.school_id and (
  s.class_id=c.id or (not exists(select 1 from subjects own where own.class_id=c.id and own.school_id=c.school_id) and s.class_id is null and (s.group_id is null or s.group_id=c.group_id))
);
create table teacher_subject_assignments (
  id uuid primary key default gen_random_uuid(), school_id integer not null references schools(id),
  class_id integer not null references classes(id), subject_id integer not null references subjects(id),
  class_subject_id uuid not null, teacher_id integer not null references users(id), teacher_profile_id uuid not null,
  created_at timestamptz not null default now(),
  constraint assignment_subject_scope_fk foreign key(school_id,class_subject_id,class_id,subject_id) references class_subjects(school_id,id,class_id,subject_id),
  constraint assignment_teacher_scope_fk foreign key(school_id,teacher_profile_id,teacher_id) references teacher_profiles(school_id,id,user_id)
);
create unique index assignments_class_subject_idx on teacher_subject_assignments(class_id,subject_id);
create index assignments_school_teacher_idx on teacher_subject_assignments(school_id,teacher_id);
insert into teacher_subject_assignments(school_id,class_id,subject_id,class_subject_id,teacher_id,teacher_profile_id)
select cs.school_id,cs.class_id,cs.subject_id,cs.id,p.user_id,p.id from class_subjects cs join subjects s on s.id=cs.subject_id join teacher_profiles p on p.school_id=cs.school_id and p.user_id=s.teacher_id;

create table student_enrollments (
  id uuid primary key default gen_random_uuid(), school_id integer not null references schools(id),
  student_id integer not null references students(id), student_uuid uuid not null references students(uuid),
  class_id integer not null references classes(id), class_section_id uuid not null,
  academic_year_id uuid not null references academic_years(id), exam_number integer not null,
  is_active boolean not null default true, archived_at timestamptz, created_at timestamptz not null default now(),
  constraint enrollment_person_scope_fk foreign key(school_id,student_id,student_uuid) references students(school_id,id,uuid),
  constraint enrollment_section_scope_fk foreign key(school_id,class_section_id,class_id) references class_sections(school_id,id,class_id)
);
create unique index enrollments_student_class_idx on student_enrollments(student_uuid,class_section_id);
create unique index enrollments_scope_identity_idx on student_enrollments(school_id,id,class_section_id,student_uuid);
insert into student_enrollments(school_id,student_id,student_uuid,class_id,class_section_id,academic_year_id,exam_number)
select s.school_id,s.id,s.uuid,s.class_id,c.id,c.academic_year_id,s.roll_no from students s join class_sections c on c.class_id=s.class_id and c.school_id=s.school_id;
-- Existing duplicates cause rollback and an explicit review blocker, never renumbering/deletion.
create unique index enrollments_active_exam_number_idx on student_enrollments(school_id,academic_year_id,class_section_id,exam_number) where is_active;

create table mark_allocations (
  id uuid primary key default gen_random_uuid(), school_id integer not null references schools(id), class_subject_id uuid not null,
  has_practical boolean not null default false, mode text not null check(mode in ('TOTAL','COMPONENTS','UNAPPROVED')),
  theory_marks integer not null, practical_marks integer not null, internal_marks integer not null,
  max_marks integer not null default 100 check(max_marks=100), pass_marks integer not null default 35 check(pass_marks=35),
  constraint allocation_subject_scope_fk foreign key(school_id,class_subject_id) references class_subjects(school_id,id)
);
create unique index allocation_class_subject_idx on mark_allocations(class_subject_id);
create unique index allocations_school_id_idx on mark_allocations(school_id,id);
insert into mark_allocations(school_id,class_subject_id,has_practical,mode,theory_marks,practical_marks,internal_marks)
select cs.school_id,cs.id,s.has_practical,
case when coalesce(substring(c.name from '[0-9]+')::integer,0) not between 6 and 12 then 'UNAPPROVED'
 when substring(c.name from '[0-9]+')::integer between 8 and 10 and not s.has_practical then 'TOTAL' else 'COMPONENTS' end,
case when substring(c.name from '[0-9]+')::integer between 8 and 10 then case when s.has_practical then 75 else 0 end else case when s.has_practical then 70 else 90 end end,
case when s.has_practical then case when substring(c.name from '[0-9]+')::integer between 8 and 10 then 25 else 20 end else 0 end,
case when substring(c.name from '[0-9]+')::integer between 8 and 10 then 0 else 10 end
from class_subjects cs join subjects s on s.id=cs.subject_id join classes c on c.id=cs.class_id;
create table mark_allocation_components (
  id uuid primary key default gen_random_uuid(), school_id integer not null, allocation_id uuid not null, kind text not null, maximum integer not null,
  constraint allocation_component_scope_fk foreign key(school_id,allocation_id) references mark_allocations(school_id,id)
);
create unique index allocation_component_unique_idx on mark_allocation_components(allocation_id,kind);
insert into mark_allocation_components(school_id,allocation_id,kind,maximum)
select a.school_id,a.id,v.kind,v.maximum from mark_allocations a cross join lateral (values ('theory',a.theory_marks),('practical',a.practical_marks),('internal',a.internal_marks),('total',case when a.mode='TOTAL' then 100 else 0 end)) v(kind,maximum) where v.maximum>0 and a.mode<>'UNAPPROVED';

alter table marks add column student_uuid uuid;
alter table marks add column enrollment_id uuid;
alter table marks add column class_section_id uuid;
alter table marks add column class_subject_id uuid;
alter table marks add column allocation_id uuid;
alter table marks add column allocation_snapshot jsonb;
alter table marks add column status text not null default 'PENDING';
alter table marks add column is_exempt boolean not null default false;
update marks m set student_uuid=s.uuid, enrollment_id=e.id, class_section_id=e.class_section_id,
  class_subject_id=cs.id, status=case when m.is_absent then 'AB' when m.score is not null then 'NUMERIC' else 'PENDING' end,
  allocation_snapshot=jsonb_build_object('legacy',true,'theoryMarks',sub.theory_marks,'practicalMarks',sub.practical_marks,'internalMarks',sub.internal_marks,'maxMarks',sub.max_marks)
from students s join student_enrollments e on e.student_id=s.id and e.school_id=s.school_id join subjects sub on sub.school_id=s.school_id
left join class_subjects cs on cs.class_id=e.class_id and cs.subject_id=sub.id and cs.school_id=s.school_id
where m.student_id=s.id and m.subject_id=sub.id and m.school_id=s.school_id;
alter table marks add constraint mark_person_scope_fk foreign key(school_id,student_id,student_uuid) references students(school_id,id,uuid) not valid;
alter table marks add constraint mark_enrollment_scope_fk foreign key(school_id,enrollment_id,class_section_id,student_uuid) references student_enrollments(school_id,id,class_section_id,student_uuid) not valid;
alter table marks add constraint mark_class_subject_scope_fk foreign key(school_id,class_subject_id,class_section_id) references class_subjects(school_id,id,class_section_id) not valid;
alter table marks add constraint mark_allocation_scope_fk foreign key(school_id,allocation_id) references mark_allocations(school_id,id) not valid;
alter table marks add constraint mark_state_check check(
 (status='NUMERIC' and score between 0 and 100 and not is_absent and not is_exempt)
 or (status='PENDING' and score is null and not is_absent and not is_exempt)
 or (status='AB' and is_absent and not is_exempt and score is null and theory_score is null and practical_score is null and internal_score is null)
 or (status='EXEMPT' and is_exempt and not is_absent and score is null and theory_score is null and practical_score is null and internal_score is null)
) not valid;
create index marks_school_exam_enrollment_idx on marks(school_id,exam_id,enrollment_id);
create table assessment_mark_components (
  id uuid primary key default gen_random_uuid(), school_id integer not null, mark_id integer not null references marks(id), kind text not null, score real,
  constraint assessment_component_scope_fk foreign key(school_id,mark_id) references marks(school_id,id)
);
create unique index assessment_component_unique_idx on assessment_mark_components(mark_id,kind);
insert into assessment_mark_components(school_id,mark_id,kind,score)
select m.school_id,m.id,v.kind,v.score from marks m cross join lateral(values ('theory',m.theory_score),('practical',m.practical_score),('internal',m.internal_score)) v(kind,score) where v.score is not null and not m.is_absent;

create table geographic_scopes (
  user_id integer primary key references users(id), role text not null check(role in ('CEO','DEO','BEO')),
  district text not null check(length(trim(district))>0), educational_district text, block text,
  check(role='CEO' or (educational_district is not null and length(trim(educational_district))>0)), check(role<>'BEO' or (block is not null and length(trim(block))>0))
);
create table audit_events (
  id uuid primary key default gen_random_uuid(), actor_id integer references users(id), school_id integer references schools(id),
  action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_school_created_idx on audit_events(school_id,created_at);
create table recovery_challenges (
  id uuid primary key default gen_random_uuid(), user_id integer references users(id), username_key text not null, otp_hash text not null,
  expires_at timestamptz not null, attempts integer not null default 0, used_at timestamptz, created_at timestamptz not null default now()
);
create index recovery_username_created_idx on recovery_challenges(username_key,created_at);
create table security_rate_limits(key text primary key, window_start timestamptz not null, hits integer not null default 1);
create table school_policies(school_id integer primary key references schools(id), settings jsonb not null default '{}');
insert into school_policies(school_id) select id from schools;
insert into audit_events(action,entity_type,metadata) values ('schema.upgraded','migration','{"version":"0002","legacy_ids_preserved":true,"cce_workflow_enabled":false}');

-- Database-level immutable recovery identifier, including writes outside the API.
create function protect_school_udise() returns trigger language plpgsql as $$
begin
 if new.udise_code is distinct from old.udise_code then raise exception 'UDISE is immutable'; end if;
 return new;
end $$;
create trigger schools_udise_immutable before update of udise_code on schools for each row execute function protect_school_udise();
