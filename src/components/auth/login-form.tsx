"use client";

import {
  ArrowRightIcon,
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
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
import { Separator } from "@/components/ui/separator";

export function LoginForm() {
  const [email, setEmail] = React.useState("admin@maturex.com");
  const [password, setPassword] = React.useState("••••••••••••");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate Auth validation & redirect
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 700);
    }, 900);
  };

  return (
    <Card className="border-border/70 shadow-xl bg-card/80 backdrop-blur-md relative overflow-hidden transition-all">
      <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-emerald-500 via-primary to-purple-500" />

      <CardHeader className="space-y-1.5 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold tracking-tight text-foreground font-heading">
            Đăng nhập Workspace
          </CardTitle>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Bảo mật SSL
          </span>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Nhập tài khoản định danh để truy cập báo cáo tài chính nội bộ.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-1">
          {/* Email field */}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-medium text-foreground/90 flex items-center justify-between"
            >
              <span>Email công việc</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                domain @maturex.com
              </span>
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
                className="pl-9 h-9 text-xs bg-background/60 font-medium"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-xs font-medium text-foreground/90"
              >
                Mật khẩu
              </Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <LockIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/70" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || isSuccess}
                className="pl-9 pr-9 h-9 text-xs bg-background/60 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-2.5 top-2.5 text-muted-foreground/70 hover:text-foreground transition-colors"
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

          {/* Quick Demo Credentials Pill */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-2 text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5 text-emerald-500" />
              Tài khoản Demo Admin sẵn sàng
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail("finance@maturex.com");
                setPassword("maturex2026!secure");
              }}
              className="text-[10px] font-semibold text-foreground underline hover:opacity-80 cursor-pointer"
            >
              Điền nhanh
            </button>
          </div>
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
                Đăng nhập thành công...
              </>
            ) : isLoading ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Đang xác thực...
              </>
            ) : (
              <>
                Đăng nhập vào Hệ thống
                <ArrowRightIcon className="size-3.5 ml-auto" />
              </>
            )}
          </Button>

          <div className="relative w-full my-1">
            <div className="absolute inset-0 flex items-center">
              <Separator className="border-border/60" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
              <span className="bg-card px-2 text-muted-foreground">
                Hoặc tiếp tục với
              </span>
            </div>
          </div>

          {/* SSO / Google Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-8.5 text-xs font-medium gap-2 cursor-pointer border-border/70 hover:bg-muted/50"
            disabled={isLoading || isSuccess}
            onClick={() => {
              setIsLoading(true);
              setTimeout(() => {
                window.location.href = "/";
              }, 800);
            }}
          >
            <svg className="size-3.5" viewBox="0 0 24 24" aria-hidden="true">
              <title>Google</title>
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google Workspace (SSO)
          </Button>

          <div className="text-center text-xs text-muted-foreground pt-1">
            Chưa có quyền truy cập?{" "}
            <Link
              href="/auth/register"
              className="font-semibold text-foreground hover:underline transition-all"
            >
              Yêu cầu cấp tài khoản
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
