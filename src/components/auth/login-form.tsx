"use client";

import {
  ArrowRightIcon,
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { loginAction } from "@/actions/auth";
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

export function LoginForm() {
  const [email, setEmail] = React.useState("admin@maturex.com");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await loginAction({ email, password });

      if (!res.success) {
        throw new Error(res.error || "Đăng nhập không thành công");
      }

      setIsSuccess(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Có lỗi xảy ra khi đăng nhập.";
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-slate-900/60 backdrop-blur-2xl rounded-2xl relative overflow-hidden text-slate-100 ring-1 ring-white/5">
      {/* Top subtle highlight border line with Emerald shimmer */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

      <CardHeader className="space-y-1.5 pb-3 pt-6 px-6 sm:px-7">
        <CardTitle className="text-lg font-semibold tracking-tight text-white flex items-center justify-between">
          <span>Đăng nhập</span>
          <span className="text-[10px] font-mono tracking-wider uppercase text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
            Internal Access
          </span>
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Nhập thông tin định danh được cấp để truy cập hệ thống quản trị.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-2 px-6 sm:px-7">
          {error ? (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400 font-medium">
              {error}
            </div>
          ) : null}
          {/* Email field */}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-medium text-slate-300"
            >
              Email nội bộ
            </Label>
            <div className="relative group">
              <MailIcon className="absolute left-3.5 top-2.5 size-4 text-slate-500 transition-colors group-focus-within:text-emerald-400" />
              <Input
                id="email"
                type="email"
                placeholder="name@maturex.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || isSuccess}
                className="pl-10 h-10 text-xs bg-slate-950/70 border-white/10 text-white placeholder:text-slate-600 rounded-xl focus-visible:border-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/20 transition-all font-medium"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-xs font-medium text-slate-300"
              >
                Mật khẩu
              </Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative group">
              <LockIcon className="absolute left-3.5 top-2.5 size-4 text-slate-500 transition-colors group-focus-within:text-emerald-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || isSuccess}
                className="pl-10 pr-10 h-10 text-xs bg-slate-950/70 border-white/10 text-white placeholder:text-slate-600 rounded-xl focus-visible:border-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/20 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3.5 top-2.5 text-slate-500 hover:text-slate-200 transition-colors"
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 pt-3 pb-6 px-6 sm:px-7 bg-transparent border-t-0">
          <Button
            type="submit"
            className="w-full h-10 text-xs font-semibold gap-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-[0.99] transition-all cursor-pointer shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35"
            disabled={isLoading || isSuccess}
          >
            {isSuccess ? (
              <>
                <CheckCircle2Icon className="size-4 text-slate-950" />
                Đăng nhập thành công...
              </>
            ) : isLoading ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                Đang xác thực...
              </>
            ) : (
              <>
                Đăng nhập vào Workspace
                <ArrowRightIcon className="size-3.5 ml-auto" />
              </>
            )}
          </Button>

          <div className="text-center text-xs text-slate-400">
            Chưa có tài khoản?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Đăng ký cấp quyền
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
