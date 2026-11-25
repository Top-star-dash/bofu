export type ActivityClient = {
  id: string;
  /** 后台富文本，可含换行等 HTML */
  title: string;
  /** 后台富文本 */
  subtitle: string | null;
  status: string;
  startAt: string;
  endAt: string;
  redeemDeadline: string;
  phone: string;
  address: string;
  mapUrl: string | null;
  posterUrl: string | null;
  backgroundUrl: string | null;
  wheelImageUrl: string | null;
  rulesHtml: string | null;
  rulesColor: string | null;
  exposureCount: number;
  participateCount: number;
  notices: string[];
  prizes: Array<{
    id: string;
    level: string;
    name: string;
    imageUrl: string | null;
    stock: number;
    remainStock: number;
    description: string | null;
  }>;
  propertyAssets: Array<{
    id: string;
    title: string | null;
    subtitle: string | null;
    imageUrl: string;
  }>;
  highlightAssets: Array<{
    id: string;
    title: string | null;
    subtitle: string | null;
    imageUrl: string;
  }>;
  consultant: {
    id: string;
    name: string;
    phone: string;
    title: string;
    avatarUrl: string | null;
    qrcodeUrl: string | null;
    intro: string | null;
    message: string | null;
    shareCode: string;
  } | null;
};

export type CustomerClient = {
  id: string;
  drawChance: number;
  assistGained: number;
  hasLead: boolean;
  prizes: Array<{
    id: string;
    prizeName: string;
    prizeLevel: string;
    isWin: boolean;
    redeemStatus: string;
    createdAt: string;
    redeemCode: string;
  }>;
};

export type ModalKind =
  | "auth"
  | "lead"
  | "rules"
  | "prizes"
  | "help"
  | "consultant"
  | null;
