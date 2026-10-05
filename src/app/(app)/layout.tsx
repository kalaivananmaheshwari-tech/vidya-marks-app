import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Shell from "@/components/shell";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect("/login");

  return (
    <Shell
      user={{
        id: auth.user.id,
        name: auth.user.name,
        username: auth.user.username,
        role: auth.user.role,
        designation: auth.user.designation,
        mustChangePassword: auth.user.mustChangePassword,
      }}
      school={{
        name: auth.school?.name ?? `${auth.user.role} · ${auth.geographicScope?.district ?? "Geographic scope"}`,
        udiseCode: auth.school?.udiseCode ?? "",
        academicYear: auth.school?.academicYear ?? "Authorized geographic reports",
        district: auth.school?.district ?? auth.geographicScope?.district ?? null,
        state: auth.school?.state ?? "Tamil Nadu",
      }}
    >
      {children}
    </Shell>
  );
}
