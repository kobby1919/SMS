import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const prismaClientSingleton = () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
};

interface CustomGlobal extends Global {
  prismaGlobal?: ReturnType<typeof prismaClientSingleton>;
}

const customGlobal = global as unknown as CustomGlobal;
const prisma = customGlobal.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") customGlobal.prismaGlobal = prisma;