import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export const metadata: Metadata = {
  title: "Đăng nhập | MatureX",
  description: "Đăng nhập hệ thống quản trị nội bộ MatureX",
};

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (token) {
    const user = await verifyAccessToken(token);
    if (user) {
      redirect("/");
    }
  }
  return (
    <main className="w-full max-w-[420px] mx-auto flex flex-col items-center justify-center">
      {/* Brand Icon & Heading */}
      <div className="flex flex-col items-center text-center mb-7 space-y-2.5">
        <div className="size-12 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-white/15 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/10 ring-1 ring-white/10">
          <span className="font-bold font-mono text-base tracking-tight bg-gradient-to-br from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
            MX
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-heading">
            MatureX Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Đăng nhập hệ thống điều hành & báo cáo tài chính
          </p>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full">
        <LoginForm />
      </div>
    </main>
  );
}
