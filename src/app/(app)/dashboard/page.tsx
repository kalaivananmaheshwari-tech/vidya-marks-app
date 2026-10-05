import {redirect} from "next/navigation";
import {getAuth} from "@/lib/auth";
import DashboardContent from "./dashboard-content";
export default async function DashboardPage(){const auth=await getAuth();if(!auth)redirect("/login");if(auth.user.mustChangePassword)redirect("/account");if(auth.geographicScope)redirect("/geographic");return <DashboardContent role={auth.user.role}/>;}
