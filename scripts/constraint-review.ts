import {sql} from "drizzle-orm";
import type {DbExecutor} from "../src/db";
const identifier=(value:string)=>`"${value.replaceAll('"','""')}"`;
type CatalogConstraint={table_name:string;conname:string;contype:"c"|"f";definition:string;expression:string|null;referenced_schema:string|null;referenced_table:string|null;child_columns:string[];parent_columns:string[]};
/** Diagnostics only. CHECK UNKNOWN and nullable MATCH SIMPLE FKs are not counted as PostgreSQL violations. */
export async function reviewUnvalidatedConstraints(tx:DbExecutor){
  const catalog=await tx.execute<CatalogConstraint>(sql.raw(`select t.relname as table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) as definition,
    pg_get_expr(c.conbin,c.conrelid) as expression,n.nspname as referenced_schema,p.relname as referenced_table,
    coalesce(array(select a.attname::text from unnest(c.conkey) with ordinality k(num,pos) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num order by k.pos),'{}'::text[]) as child_columns,
    coalesce(array(select a.attname::text from unnest(c.confkey) with ordinality k(num,pos) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num order by k.pos),'{}'::text[]) as parent_columns
    from pg_constraint c join pg_class t on t.oid=c.conrelid left join pg_class p on p.oid=c.confrelid left join pg_namespace n on n.oid=p.relnamespace
    where c.connamespace='public'::regnamespace and not c.convalidated order by t.relname,c.conname`));
  const review=[];
  for(const c of catalog.rows){
    let predicate:string;
    if(c.contype==="c" && c.expression)predicate=`(${c.expression}) is false`;
    else if(c.contype==="f" && c.referenced_table && c.referenced_schema && c.child_columns.length && c.child_columns.length===c.parent_columns.length){
      const present=c.child_columns.map((col)=>`child.${identifier(col)} is not null`).join(" and ");
      const matches=c.child_columns.map((col,i)=>`parent.${identifier(c.parent_columns[i])}=child.${identifier(col)}`).join(" and ");
      predicate=`${present} and not exists(select 1 from ${identifier(c.referenced_schema)}.${identifier(c.referenced_table)} parent where ${matches})`;
    }else throw new Error("UNSUPPORTED_CONSTRAINT_REVIEW");
    const count=await tx.execute<{value:number}>(sql.raw(`select count(*)::int as value from public.${identifier(c.table_name)} child where ${predicate}`));
    review.push({table:c.table_name,constraint:c.conname,definition:c.definition,validated:false,violatingRows:Number(count.rows[0]?.value ?? 0),validationPerformed:false,productionReview:"REQUIRES AUTHORIZED PRODUCTION REVIEW"});
  }
  return review;
}
