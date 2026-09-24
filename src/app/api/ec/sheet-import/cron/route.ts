import {
  GET as handleGet,
  POST as handlePost,
} from "@/app/api/cron/ec-sheet-sync/route";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleGet(request);
}

export async function POST(request: Request) {
  return handlePost(request);
}
