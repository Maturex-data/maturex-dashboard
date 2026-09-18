import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  signAccessToken,
} from "@/lib/jwt-service";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ email và mật khẩu." },
        { status: 400 },
      );
    }

    // Look up user in Neon Postgres database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Email hoặc mật khẩu không chính xác." },
        { status: 401 },
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { error: "Tài khoản của bạn đã bị vô hiệu hóa." },
        { status: 403 },
      );
    }

    // Only users with 'admin' role are permitted to login to the dashboard
    if (user.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Tài khoản của bạn chưa được cấp quyền Admin. Vui lòng liên hệ quản trị viên.",
        },
        { status: 403 },
      );
    }

    // Verify password hash with scrypt
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Email hoặc mật khẩu không chính xác." },
        { status: 401 },
      );
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const isSecure = req.nextUrl.protocol === "https:";
    const cookieStore = await cookies();

    // Set httpOnly Access Token cookie
    cookieStore.set({
      name: ACCESS_COOKIE_NAME,
      value: accessToken,
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Đăng nhập thất bại";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
