import "dotenv/config";
import { defineConfig } from "prisma/config";

const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED;

if (!directUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL_UNPOOLED must be configured.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: directUrl,
  },
});
