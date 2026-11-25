import { prisma } from "@/lib/db";
import type { ActivityStatus } from "@/generated/prisma/enums";

export function resolveActivityStatus(
  startAt: Date,
  endAt: Date,
  stored: ActivityStatus,
): ActivityStatus {
  if (stored === "DRAFT" || stored === "ENDED") return stored;
  const now = Date.now();
  if (now < startAt.getTime()) return "NOT_STARTED";
  if (now > endAt.getTime()) return "ENDED";
  return "RUNNING";
}

export async function getCurrentActivity() {
  const activity = await prisma.activity.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      notices: {
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
      },
      prizes: {
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
      },
      assets: {
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
      },
      consultants: {
        where: { enabled: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!activity) return null;

  return {
    ...activity,
    runtimeStatus: resolveActivityStatus(
      activity.startAt,
      activity.endAt,
      activity.status,
    ),
  };
}

export async function findConsultantByCode(activityId: string, code?: string | null) {
  if (code) {
    const matched = await prisma.consultant.findFirst({
      where: { activityId, shareCode: code, enabled: true },
    });
    if (matched) return matched;
  }

  return prisma.consultant.findFirst({
    where: { activityId, isDefault: true, enabled: true },
  });
}

/** 只按分享码精确匹配，不回落默认顾问：用于区分「销售链接」与「自然访问」 */
export async function findConsultantByShareCode(
  activityId: string,
  code?: string | null,
) {
  if (!code) return null;
  return prisma.consultant.findFirst({
    where: { activityId, shareCode: code, enabled: true },
  });
}

export async function findConsultantById(
  activityId: string,
  id?: string | null,
) {
  if (!id) return null;
  return prisma.consultant.findFirst({
    where: { id, activityId, enabled: true },
  });
}

export function findDefaultConsultant(activityId: string) {
  return prisma.consultant.findFirst({
    where: { activityId, isDefault: true, enabled: true },
  });
}

export function serializeActivityForClient(
  activity: NonNullable<Awaited<ReturnType<typeof getCurrentActivity>>>,
  consultant: Awaited<ReturnType<typeof findConsultantByCode>>,
) {
  const displayPrizes = activity.prizes.filter((prize) => !prize.isFallback);
  const propertyAssets = activity.assets.filter((asset) => asset.type === "property");
  const highlightAssets = activity.assets.filter((asset) => asset.type === "highlight");

  return {
    id: activity.id,
    title: activity.title,
    subtitle: activity.subtitle,
    status: activity.runtimeStatus,
    startAt: activity.startAt.toISOString(),
    endAt: activity.endAt.toISOString(),
    redeemDeadline: activity.redeemDeadline.toISOString(),
    phone: activity.phone,
    address: activity.address,
    mapUrl: activity.mapUrl,
    externalUrl: activity.externalUrl,
    shareTitle: activity.shareTitle,
    shareDesc: activity.shareDesc,
    shareCoverUrl: activity.shareCoverUrl,
    posterUrl: activity.posterUrl,
    backgroundUrl: activity.backgroundUrl,
    wheelImageUrl: activity.wheelImageUrl,
    logoUrl: activity.logoUrl,
    logoSubUrl: activity.logoSubUrl,
    rulesHtml: activity.rulesHtml,
    rulesColor: activity.rulesColor,
    firstDrawChance: activity.firstDrawChance,
    assistChance: activity.assistChance,
    assistMaxExtra: activity.assistMaxExtra,
    dailyDrawLimit: activity.dailyDrawLimit,
    totalDrawLimit: activity.totalDrawLimit,
    exposureCount: activity.exposureCount,
    participateCount: activity.participateCount,
    notices: activity.notices.map((item) => item.content),
    prizes: displayPrizes.map((prize) => ({
      id: prize.id,
      level: prize.level,
      name: prize.name,
      imageUrl: prize.imageUrl,
      stock: prize.stock,
      remainStock: prize.remainStock,
      description: prize.description,
    })),
    propertyAssets: propertyAssets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      subtitle: asset.subtitle,
      imageUrl: asset.imageUrl,
    })),
    highlightAssets: highlightAssets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      subtitle: asset.subtitle,
      imageUrl: asset.imageUrl,
    })),
    consultant: consultant
      ? {
          id: consultant.id,
          name: consultant.name,
          phone: consultant.phone,
          title: consultant.title,
          avatarUrl: consultant.avatarUrl,
          qrcodeUrl: consultant.qrcodeUrl,
          intro: consultant.intro,
          message: consultant.message,
          shareCode: consultant.shareCode,
        }
      : null,
  };
}
