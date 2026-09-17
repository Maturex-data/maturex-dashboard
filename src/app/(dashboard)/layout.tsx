import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;

  return (
    <SidebarProvider>
      <AppSidebar
        user={
          user
            ? {
                name: user.name,
                email: user.email,
              }
            : undefined
        }
      />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}
