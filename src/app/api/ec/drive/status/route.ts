import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleDriveConnection } from "@/lib/ec-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin")
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const [connection, runs] = await Promise.all([
    getGoogleDriveConnection(),
    prisma.ecDriveSyncRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  return NextResponse.json({ connection, runs });
}
