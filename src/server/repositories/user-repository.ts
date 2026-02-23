// spec/010_auth.md 準拠
// User のデータアクセス層

import { prisma } from "@/lib/db/prisma";

export const userRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, name: true },
    });
  },

  async create(data: {
    email: string;
    passwordHash: string;
    name: string | null;
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
      },
      select: { id: true },
    });
  },
};
