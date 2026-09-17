import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export const metadata: Metadata = {
  title: "Đăng ký tài khoản | MatureX",
  description: "Đăng ký tài khoản nội bộ MatureX",
};

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (token) {
    const user = await verifyAccessToken(token);
    if (user) {
      redirect("/");
    }
  }
  return (
    <main className="w-full max-w-[440px] mx-auto flex flex-col items-center justify-center">
      {/* Brand Icon & Heading */}
      <div className="flex flex-col items-center text-center mb-7 space-y-2.5">
        <div className="size-12 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-white/15 text-white flex items-center justify-center shadow-2xl shadow-violet-500/10 ring-1 ring-white/10">
          <span className="font-bold font-mono text-base tracking-tight bg-gradient-to-br from-white via-slate-200 to-violet-400 bg-clip-text text-transparent">
            MX
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-heading">
            Tạo tài khoản Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gửi yêu cầu phân quyền tài khoản thành viên nội bộ
          </p>
        </div>
      </div>

      {/* Register Card */}
      <div className="w-full">
        <RegisterForm />
      </div>
    </main>
  );
}
