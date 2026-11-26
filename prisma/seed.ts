import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing");
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(connectionString),
});

const PERMISSIONS = [
  ["activity", "活动配置"],
  ["assets", "素材管理"],
  ["prizes", "奖品管理"],
  ["rules", "规则管理"],
  ["consultants", "顾问管理"],
  ["leads", "线索管理"],
  ["redeem", "核销管理"],
  ["stats", "数据统计"],
  ["users", "用户权限"],
  ["settings", "系统设置"],
] as const;

async function main() {
  for (const [code, name] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }

  const passwordHash = await hash("bofuadminNsw1!", 10);
  const admin = await prisma.adminUser.upsert({
    where: { username: "bofuadmin" },
    update: {
      passwordHash,
      name: "超级管理员",
      isSuperAdmin: true,
      status: "ACTIVE",
    },
    create: {
      username: "bofuadmin",
      passwordHash,
      name: "超级管理员",
      isSuperAdmin: true,
      status: "ACTIVE",
    },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.adminUserPermission.upsert({
      where: {
        userId_permissionId: {
          userId: admin.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        permissionId: permission.id,
      },
    });
  }

  let activity = await prisma.activity.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!activity) {
    activity = await prisma.activity.create({
      data: {
        title: "博富·福美城<br />超级好礼全城派",
        subtitle: "幸运抽奖 100%中奖",
        status: "RUNNING",
        startAt: new Date("2026-11-23T09:00:00+08:00"),
        endAt: new Date("2026-12-31T23:59:59+08:00"),
        redeemDeadline: new Date("2027-01-07T23:59:59+08:00"),
        redeemPassword: "6666",
        phone: "0750-5236666",
        address: "博富·福美城冠军薈",
        shareTitle: "博富·福美城超级好礼全城派 幸运抽奖100%中奖",
        shareDesc: "参与线上抽奖，丰厚惊喜好礼，等你来解锁",
        posterUrl: "/activity/kv-popup.webp",
        backgroundUrl: "/activity/kv-bg.webp",
        wheelImageUrl: "/activity/大圆盘2.webp",
        rulesHtml:
          "<p>完成留资即可获得首次抽奖机会，邀请好友完成有效留资可增加抽奖次数。奖品数量有限，先到先得，领完即止。</p>",
        rulesDetailHtml:
          "<p><strong>活动对象：</strong>博富・福美城意向客户</p><p><strong>抽奖次数获取方式：</strong></p><ol><li>每位客户首次进入免费抽奖 1 次</li><li>每邀请 1 位好友完成“有效留资”增加抽奖 1 次</li><li>单人通过好友助力累计可获得的额外抽奖次数上限 3 次</li></ol><p><strong>兑奖有效期：</strong>全场礼品数量有限，先到先得，领完即止。领取时间截止至 2027 年 1 月 7 日，逾期视为自动放弃。</p><p><strong>领奖地址：</strong>博富・福美城冠军薈</p><p><strong>咨询电话：</strong>0750-5236666</p><p>声明：本活动最终解释权在法律允许范围内归博富·福美城所有</p>",
        rulesColor: "#fff1d5",
        exposureCount: 38913,
        participateCount: 26983,
        notices: {
          create: [
            { content: "幸运抽奖 100%中奖", sortOrder: 1 },
            { content: "加 2 万送全屋装修", sortOrder: 2 },
            { content: "参与线上抽奖，解锁惊喜好礼", sortOrder: 3 },
          ],
        },
        prizes: {
          create: [
            {
              level: "一等奖",
              name: "5000元购房抵扣券",
              imageUrl: "/activity/prize-1.webp",
              stock: 50,
              remainStock: 50,
              probability: 10,
              sortOrder: 1,
            },
            {
              level: "二等奖",
              name: "未来社区定制咖啡杯",
              imageUrl: "/activity/prize-2.webp",
              stock: 100,
              remainStock: 100,
              probability: 3,
              sortOrder: 2,
            },
            {
              level: "三等奖",
              name: "晴雨两用伞",
              imageUrl: "/activity/prize-3.webp",
              stock: 100,
              remainStock: 100,
              probability: 5,
              sortOrder: 3,
            },
            {
              level: "幸运参与奖",
              name: "咖啡文化周抵扣券10元",
              imageUrl: "/activity/prize-4.webp",
              stock: 5000,
              remainStock: 5000,
              probability: 80,
              sortOrder: 4,
            },
            {
              level: "感谢参与",
              name: "感谢参与",
              stock: 999999,
              remainStock: 999999,
              probability: 2,
              sortOrder: 99,
              isFallback: true,
            },
          ],
        },
        assets: {
          create: [
            {
              type: "property",
              title: "福美生活馆",
              subtitle: "城芯品质生活，住进理想社区",
              imageUrl: "/property/overall.webp",
              sortOrder: 1,
            },
            {
              type: "property",
              title: "全龄社区配套",
              subtitle: "运动、休闲、社交，一站满足日常所需",
              imageUrl: "/property/amenities.webp",
              sortOrder: 2,
            },
            {
              type: "property",
              title: "生态泳池",
              subtitle: "夏日清凉时光，家门口的休闲场",
              imageUrl: "/property/pool.webp",
              sortOrder: 3,
            },
            {
              type: "property",
              title: "最美上学路",
              subtitle: "家门口优质教育配套，陪伴孩子成长",
              imageUrl: "/property/school-road.webp",
              sortOrder: 4,
            },
            {
              type: "property",
              title: "未来社区福美校区",
              subtitle: "文化、艺术、科创多元成长空间",
              imageUrl: "/property/school.webp",
              sortOrder: 5,
            },
            {
              type: "property",
              title: "品质入户大堂",
              subtitle: "从归家开始，感受每天的仪式感",
              imageUrl: "/property/lobby.webp",
              sortOrder: 6,
            },
            {
              type: "property",
              title: "瑜伽室与阅读馆",
              subtitle: "在社区里保持热爱，也保持松弛",
              imageUrl: "/property/yoga.webp",
              sortOrder: 7,
            },
            {
              type: "highlight",
              title: "限时优惠",
              subtitle: "加2万即送全屋装修，再享3年物业管理费赠送",
              imageUrl: "/property/overall.webp",
              sortOrder: 1,
            },
            {
              type: "highlight",
              title: "区位交通",
              subtitle: "2分钟昌大昌 / 3分钟万达 / 约5分钟高速口",
              imageUrl: "/property/amenities.webp",
              sortOrder: 2,
            },
            {
              type: "highlight",
              title: "户型亮点",
              subtitle: "76㎡三房 / 106㎡四房 / 144㎡3+2房",
              imageUrl: "/property/lobby.webp",
              sortOrder: 3,
            },
          ],
        },
        consultants: {
          create: {
            name: "福美城置业顾问",
            phone: "0750-5236666",
            title: "置业顾问",
            intro: "Hi，我是您的专属置业顾问\n欢迎添加好友，咨询项目详情",
            message: "欢迎咨询博富·福美城项目详情与活动礼品。",
            shareCode: "default",
            isDefault: true,
          },
        },
      },
    });
  }

  console.log("Seed OK");
  console.log("Admin:", admin.username);
  console.log("Activity:", activity.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
