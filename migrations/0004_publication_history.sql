-- Append-only publication revisions preserve the roster, mappings and marks as published.
-- No legacy rows are changed, inferred publications created or user data removed.
create table exam_publications (
 id uuid primary key default gen_random_uuid(),
 school_id integer not null references schools(id),
 exam_id integer not null,
 class_id integer not null,
 generation integer not null check(generation>0),
 data jsonb not null,
 school_header jsonb not null,
 published_by integer not null references users(id),
 published_at timestamptz not null default now(),
 unique(school_id,exam_id,class_id,generation),
 foreign key(school_id,exam_id) references exams(school_id,id),
 foreign key(school_id,class_id) references classes(school_id,id)
);
create index publications_scope_exam_idx on exam_publications(school_id,exam_id,class_id,generation desc);
-- Preserve mark identity even if a future handler accidentally uses the legacy upsert key.
create function preserve_mark_enrollment_identity() returns trigger language plpgsql as $$
begin
 if old.enrollment_id is not null and (new.enrollment_id is distinct from old.enrollment_id or new.student_uuid is distinct from old.student_uuid or new.student_id is distinct from old.student_id or new.school_id is distinct from old.school_id or new.subject_id is distinct from old.subject_id or new.exam_id is distinct from old.exam_id or new.class_subject_id is distinct from old.class_subject_id or new.class_section_id is distinct from old.class_section_id) then
  raise exception 'Historical assessment identity is immutable' using errcode='23514';
 end if;
 return new;
end $$;
create trigger mark_enrollment_identity_immutable before update on marks for each row execute function preserve_mark_enrollment_identity();
create function preserve_publication_revision() returns trigger language plpgsql as $$
begin
 raise exception 'Publication revisions are append-only' using errcode='23514';
end $$;
create trigger publication_revision_immutable before update or delete on exam_publications for each row execute function preserve_publication_revision();
