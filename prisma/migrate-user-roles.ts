/**
 * 历史迁移脚本（一次性）。
 * 旧版 AdminUserPermission 已删除；现仅用于确保系统预置角色存在。
 * 用法：npx tsx prisma/migrate-user-roles.ts
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { SYSTEM_ROLES } from "../src/lib/roles";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing");
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(connectionString),
});

async function ensureSystemRoles() {
  const permissionRows = await prisma.permission.findMany();
  const byCode = new Map(permissionRows.map((row) => [row.code, row]));

  for (const preset of SYSTEM_ROLES) {
    const role = await prisma.adminRole.upsert({
      where: { code: preset.code },
      update: {
        name: preset.name,
        description: preset.description,
        isSystem: true,
      },
      create: {
        code: preset.code,
        name: preset.name,
        description: preset.description,
        isSystem: true,
      },
    });

    await prisma.adminRolePermission.deleteMany({ where: { roleId: role.id } });
    const rows = preset.permissions
      .map((code) => byCode.get(code))
      .filter(Boolean)
      .map((permission) => ({
        roleId: role.id,
        permissionId: permission!.id,
      }));
    if (rows.length) {
      await prisma.adminRolePermission.createMany({ data: rows });
    }
  }
}

async function main() {
  await ensureSystemRoles();
  console.log("系统预置角色已同步。旧用户直连权限表已废弃，无需再迁移。");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
