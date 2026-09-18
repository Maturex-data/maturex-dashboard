"use client";

import {
  ArrowRightIcon,
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [agreeTerms, setAgreeTerms] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không trùng khớp!");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có tối thiểu 6 ký tự!");
      return;
    }

    if (!agreeTerms) {
      setError("Vui lòng xác nhận quy định nội bộ.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerAction({ name, email, password });

      if (!res.success) {
        throw new Error(res.error || "Đăng ký không thành công");
      }

      setIsSuccess(true);
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Có lỗi xảy ra khi gửi yêu cầu.";
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-slate-900/60 backdrop-blur-2xl rounded-2xl relative overflow-hidden text-slate-100 ring-1 ring-white/5">
      {/* Top subtle highlight border line with Violet shimmer */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

      <CardHeader className="space-y-1.5 pb-3 pt-6 px-6 sm:px-7">
        <CardTitle className="text-lg font-semibold tracking-tight text-white flex items-center justify-between">
          <span>Đăng ký tài khoản</span>
          <span className="text-[10px] font-mono tracking-wider uppercase text-violet-400 font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/25">
            Onboarding
          </span>
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Điền thông tin để quản trị viên cấp quyền truy cập hệ thống.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3.5 pt-2 px-6 sm:px-7">
          {error ? (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400 font-medium">
              {error}
            </div>
          ) : null}

          {/* Full name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="text-xs font-medium text-slate-300"
            >
              Họ và tên
            </Label>
            <div className="relative group">
              <UserIcon className="absolute left-3.5 top-2.5 size-4 text-slate-500 transition-colors group-focus-within:text-violet-400" />
              <Input
                id="name"
                type="text"
                placeholder="Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading || isSuccess}
                className="pl-10 h-10 text-xs bg-slate-950/70 border-white/10 text-white placeholder:text-slate-600 rounded-xl focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/20 transition-all font-medium"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-medium text-slate-300"
            >
              Email công việc
            </Label>
            <div className="relative group">
              <MailIcon className="absolute left-3.5 top-2.5 size-4 text-slate-500 transition-colors group-focus-within:text-violet-400" />
              <Input
                id="email"
                type="email"
                placeholder="name@maturex.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || isSuccess}
                className="pl-10 h-10 text-xs bg-slate-950/70 border-white/10 text-white placeholder:text-slate-600 rounded-xl focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/20 transition-all font-medium"
              />
            </div>
          </div>

          {/* Password & Confirm Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-medium text-slate-300"
              >
                Mật khẩu
              </Label>
              <div className="relative group">
                <LockIcon className="absolute left-3.5 top-2.5 size-4 text-slate-500 transition-colors group-focus-within:text-violet-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || isSuccess}
                  className="pl-10 pr-9 h-10 text-xs bg-slate-950/70 border-white/10 text-white placeholder:text-slate-600 rounded-xl focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/20 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-200 transition-colors"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-3.5" />
                  ) : (
                    <EyeIcon className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-xs font-medium text-slate-300"
              >
                Xác nhận lại
              </Label>
              <div className="relative group">
                <LockIcon className="absolute left-3.5 top-2.5 size-4 text-slate-500 transition-colors group-focus-within:text-violet-400" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading || isSuccess}
                  className="pl-10 h-10 text-xs bg-slate-950/70 border-white/10 text-white placeholder:text-slate-600 rounded-xl focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/20 transition-all font-mono"
                />
              </div>
            </div>
          </div>

          {/* Policy agreement */}
          <label className="flex items-start gap-2.5 pt-1 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 rounded border-white/20 bg-slate-950 text-violet-500 focus:ring-violet-500/20 accent-violet-500 size-4 cursor-pointer"
            />
            <span className="leading-snug text-slate-400">
              Tôi cam kết là nhân sự nội bộ và tuân thủ quy chế bảo mật thông
              tin MatureX.
            </span>
          </label>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 pt-3 pb-6 px-6 sm:px-7 bg-transparent border-t-0">
          <Button
            type="submit"
            className="w-full h-10 text-xs font-semibold gap-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500 active:scale-[0.99] transition-all cursor-pointer shadow-lg shadow-violet-600/25 hover:shadow-violet-600/35"
            disabled={isLoading || isSuccess}
          >
            {isSuccess ? (
              <>
                <CheckCircle2Icon className="size-4 text-white" />
                Đăng ký thành công! Chờ Admin duyệt...
              </>
            ) : isLoading ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Đang gửi yêu cầu...
              </>
            ) : (
              <>
                Gửi yêu cầu đăng ký
                <ArrowRightIcon className="size-3.5 ml-auto" />
              </>
            )}
          </Button>

          <div className="text-center text-xs text-slate-400">
            Đã có tài khoản?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
