import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  signAccessToken,
} from "@/lib/jwt-service";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ họ tên, email và mật khẩu." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu phải có tối thiểu 6 ký tự." },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email này đã được sử dụng trong hệ thống." },
        { status: 409 },
      );
    }

    // Hash password with scrypt
    const passwordHash = await hashPassword(password);

    // Create new user in Neon Postgres
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "admin",
        team: "maturex",
      },
    });

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
        message: "Tạo tài khoản thành công!",
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Đăng ký tài khoản thất bại.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
