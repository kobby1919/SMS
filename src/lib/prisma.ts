import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prismaClientSingleton = () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    transactionOptions: {
      timeout: 15_000,      // raise interactive transaction timeout to 15s
      maxWait: 10_000,      // max time to wait for a connection slot
    },
  });
};

interface CustomGlobal extends Global {
  prismaGlobal?: ReturnType<typeof prismaClientSingleton>;
}

const customGlobal = global as unknown as CustomGlobal;
const prisma = customGlobal.prismaGlobal ?? prismaClientSingleton();
export default prisma;

if (process.env.NODE_ENV !== "production") customGlobal.prismaGlobal = prisma;