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
      }}
      school={{
        name: auth.school.name,
        udiseCode: auth.school.udiseCode,
        academicYear: auth.school.academicYear,
        district: auth.school.district,
        state: auth.school.state,
      }}
    >
      {children}
    </Shell>
  );
}
