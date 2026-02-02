
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser();

    if (!user || user.role !== "admin") {
        redirect("/login");
    }

    return (
        <div className="min-h-screen bg-zinc-950">
            {children}
        </div>
    );
}
