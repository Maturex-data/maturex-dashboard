"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  signAccessToken,
} from "@/lib/jwt-service";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export interface AuthActionResult<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface UserSessionData {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function loginAction(
  formDataOrData: FormData | { email?: string; password?: string },
): Promise<AuthActionResult<{ user: UserSessionData }>> {
  try {
    let email = "";
    let password = "";

    if (formDataOrData instanceof FormData) {
      email = String(formDataOrData.get("email") || "")
        .trim()
        .toLowerCase();
      password = String(formDataOrData.get("password") || "");
    } else {
      email = String(formDataOrData.email || "")
        .trim()
        .toLowerCase();
      password = String(formDataOrData.password || "");
    }

    if (!email || !password) {
      return {
        success: false,
        error: "Vui lòng nhập đầy đủ email và mật khẩu.",
      };
    }

    // Look up user in Neon Postgres database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        success: false,
        error: "Email hoặc mật khẩu không chính xác.",
      };
    }

    if (!user.active) {
      return {
        success: false,
        error: "Tài khoản của bạn đã bị vô hiệu hóa.",
      };
    }

    // Only users with 'admin' role are permitted to login to the dashboard
    if (user.role !== "admin") {
      return {
        success: false,
        error:
          "Tài khoản của bạn chưa được cấp quyền Admin. Vui lòng liên hệ quản trị viên.",
      };
    }

    // Verify password hash with scrypt
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        success: false,
        error: "Email hoặc mật khẩu không chính xác.",
      };
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const cookieStore = await cookies();

    // Set httpOnly Access Token cookie
    cookieStore.set({
      name: ACCESS_COOKIE_NAME,
      value: accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Đăng nhập thất bại.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function registerAction(
  formDataOrData:
    | FormData
    | { name?: string; email?: string; password?: string },
): Promise<AuthActionResult<{ user: UserSessionData }>> {
  try {
    let name = "";
    let email = "";
    let password = "";

    if (formDataOrData instanceof FormData) {
      name = String(formDataOrData.get("name") || "").trim();
      email = String(formDataOrData.get("email") || "")
        .trim()
        .toLowerCase();
      password = String(formDataOrData.get("password") || "");
    } else {
      name = String(formDataOrData.name || "").trim();
      email = String(formDataOrData.email || "")
        .trim()
        .toLowerCase();
      password = String(formDataOrData.password || "");
    }

    if (!name || !email || !password) {
      return {
        success: false,
        error: "Vui lòng điền đầy đủ họ tên, email và mật khẩu.",
      };
    }

    if (password.length < 6) {
      return {
        success: false,
        error: "Mật khẩu phải có tối thiểu 6 ký tự.",
      };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        error: "Email này đã được sử dụng trong hệ thống.",
      };
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

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Đăng ký tài khoản thất bại.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  redirect("/auth/login");
}
