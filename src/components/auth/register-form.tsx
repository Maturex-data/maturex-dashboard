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
      setError("Vui lòng đồng ý với chính sách bảo mật nội bộ.");
      return;
    }

    setIsLoading(true);

    // Simulate account registration
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 1000);
    }, 900);
  };

  return (
    <Card className="border-border/70 shadow-xl bg-card/80 backdrop-blur-md relative overflow-hidden transition-all">
      <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-purple-500 via-primary to-emerald-500" />

      <CardHeader className="space-y-1.5 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold tracking-tight text-foreground font-heading">
            Tạo tài khoản Workspace
          </CardTitle>
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-purple-600 dark:text-purple-400 border border-purple-500/20">
            Nội bộ
          </span>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Đăng ký để nhận phân quyền truy cập dashboard theo team EC / Flowa /
          Microm.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3.5 pt-1">
          {error ? (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </div>
          ) : null}

          {/* Full name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="text-xs font-medium text-foreground/90"
            >
              Họ và tên
            </Label>
            <div className="relative">
              <UserIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/70" />
              <Input
                id="name"
                type="text"
                placeholder="Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading || isSuccess}
                className="pl-9 h-9 text-xs bg-background/60"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-medium text-foreground/90"
            >
              Email công việc
            </Label>
            <div className="relative">
              <MailIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/70" />
              <Input
                id="email"
                type="email"
                placeholder="name@maturex.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || isSuccess}
                className="pl-9 h-9 text-xs bg-background/60"
              />
            </div>
          </div>

          {/* Password & Confirm Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-medium text-foreground/90"
              >
                Mật khẩu
              </Label>
              <div className="relative">
                <LockIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/70" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || isSuccess}
                  className="pl-9 pr-8 h-9 text-xs bg-background/60 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-2 top-2.5 text-muted-foreground/70 hover:text-foreground"
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
                className="text-xs font-medium text-foreground/90"
              >
                Xác nhận lại
              </Label>
              <div className="relative">
                <LockIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/70" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading || isSuccess}
                  className="pl-9 h-9 text-xs bg-background/60 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Policy agreement */}
          <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
            />
            <span>
              Tôi đồng ý với chính sách bảo mật nội bộ và cam kết không chia sẻ
              dữ liệu kinh doanh ra ngoài.
            </span>
          </label>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3.5 pt-1 pb-4">
          <Button
            type="submit"
            className="w-full h-9 text-xs font-semibold gap-2 shadow-xs cursor-pointer"
            disabled={isLoading || isSuccess}
          >
            {isSuccess ? (
              <>
                <CheckCircle2Icon className="size-4 text-emerald-400" />
                Đăng ký thành công! Đang chuyển trang...
              </>
            ) : isLoading ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Đang xử lý yêu cầu...
              </>
            ) : (
              <>
                Hoàn tất đăng ký tài khoản
                <ArrowRightIcon className="size-3.5 ml-auto" />
              </>
            )}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            Đã có tài khoản được cấp quyền?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-foreground hover:underline transition-all"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
