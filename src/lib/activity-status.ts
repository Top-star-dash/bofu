/** 活动状态文案（无 Prisma 依赖，可供客户端引用） */
export function activityStatusMessage(status: string) {
  switch (status) {
    case "NOT_STARTED":
      return "活动未开始";
    case "MAINTENANCE":
      return "活动维护中，暂停抽奖";
    case "DRAFT":
      return "活动暂未开放";
    case "ENDED":
      return "活动已结束";
    case "RUNNING":
      return "活动进行中";
    default:
      return "活动未开放";
  }
}

export function activityStatusLabel(status: string) {
  switch (status) {
    case "NOT_STARTED":
      return "未开始";
    case "MAINTENANCE":
      return "维护中";
    case "DRAFT":
      return "草稿";
    case "ENDED":
      return "已结束";
    case "RUNNING":
      return "进行中";
    default:
      return status;
  }
}
