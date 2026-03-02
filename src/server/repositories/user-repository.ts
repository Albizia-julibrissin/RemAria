// spec/010_auth.md 準拠
// User のデータアクセス層

import { prisma } from "@/lib/db/prisma";

export const userRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, accountId: true, passwordHash: true, name: true },
    });
  },

  async findByAccountId(accountId: string) {
    return prisma.user.findUnique({
      where: { accountId },
      select: { id: true },
    });
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, accountId: true },
    });
  },

  async create(data: {
    email: string;
    accountId: string;
    passwordHash: string;
    name: string;
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        accountId: data.accountId,
        passwordHash: data.passwordHash,
        name: data.name,
      },
      select: { id: true },
    });
  },
};
