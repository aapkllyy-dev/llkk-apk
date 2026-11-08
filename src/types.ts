export type TransactionType = 'deposit' | 'withdraw'; // 'deposit' = 进分 (Bank-in), 'withdraw' = 洗分 (Cuci)

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  code: string;
  branchId: string;
  role: 'admin' | 'manager' | 'staff';
}

export interface CustomerRecord {
  id: string;
  type: TransactionType;            // 进分 (deposit) | 洗分 (withdraw)
  groupName: string;                // WhatsApp 群的名字
  platform: string;                 // 顾客玩的平台 (Mega888, 918Kiss, 等)
  gameId: string;                   // 顾客游戏 ID
  userName: string;                 // User Name (顾客名字 / 用户名)
  amount: number;                   // bankin 进账数目 或 洗分数目 (RM)
  bankName: string;                 // 银行的名字 (Maybank, CIMB, 等)
  date: string;                     // 日期 YYYY-MM-DD
  time: string;                     // 时间 HH:mm
  depositCount: number;             // 该顾客充值次数 (自动计算累加)
  withdrawCount: number;            // 该顾客洗分次数 (自动计算累加)
  branchName: string;               // 店的名字 / 分店
  staffName?: string;               // 经办员工
  shift?: string;                   // 班次: 早班 / 晚班
  notes?: string;                   // 备注
  timestamp: number;
}

export interface CustomerProfileSummary {
  key: string;                      // 唯一识别: userName or gameId
  userName: string;
  gameId: string;
  lastPlatform: string;
  lastGroupName: string;
  lastBankName: string;
  totalDepositAmount: number;       // 历史进分总额
  totalWithdrawAmount: number;      // 历史洗分总额
  depositCount: number;             // 历史充值次数
  withdrawCount: number;            // 历史洗分次数
  netProfit: number;                // 净差额 (进分 - 洗分)
  lastDate: string;
  lastTime: string;
}

export interface PresetData {
  groups: string[];
  platforms: string[];
  banks: string[];
  branches: string[];
  quickAmounts?: number[];
  staffMembers?: string[];
  shifts?: string[];
}
