import { type NextRequest, NextResponse } from "next/server";
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

    // Create new user in Neon Postgres with role 'user'
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "user",
        team: "maturex",
      },
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
        message:
          "Đăng ký thành công! Vui lòng liên hệ Admin để được cấp quyền truy cập.",
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Đăng ký tài khoản thất bại.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
