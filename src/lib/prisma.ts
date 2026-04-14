import "dotenv/config"; // must be the FIRST import
import { PrismaClient } from "../generated/prisma";

const prismaClientSingleton = () => new PrismaClient();

interface CustomGlobal extends Global {
  prismaGlobal?: ReturnType<typeof prismaClientSingleton>;
}

const customGlobal = global as unknown as CustomGlobal;
const prisma = customGlobal.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") customGlobal.prismaGlobal = prisma;
