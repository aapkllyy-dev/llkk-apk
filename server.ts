import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

export type TransactionType = 'deposit' | 'withdraw';

interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
}

interface CustomerRecord {
  id: string;
  type: TransactionType;            // 'deposit' (进分/Bank-in) | 'withdraw' (洗分/Cuci)
  groupName: string;                // WhatsApp 群的名字
  platform: string;                 // 顾客玩的平台
  gameId: string;                   // 顾客游戏 ID
  userName: string;                 // User Name (顾客名字 / 昵称)
  amount: number;                   // bankin 进账数目 或 洗分数目 (RM)
  bankName: string;                 // 银行的名字
  date: string;                     // 日期 YYYY-MM-DD
  time: string;                     // 时间 HH:mm
  depositCount: number;             // 该顾客充值次数
  withdrawCount: number;            // 该顾客洗分次数
  branchName: string;               // 店的名字
  staffName?: string;
  notes?: string;
  timestamp: number;
}

interface DatabaseSchema {
  branches: Branch[];
  presets?: {
    groups: string[];
    platforms?: string[];
    banks: string[];
    quickAmounts?: number[];
    staffMembers?: string[];
    shifts?: string[];
    shiftTimes?: Record<string, { start: string; end: string }>;
    staffHours?: Record<string, { start: string; end: string }>;
  };
  systemSettings?: {
    systemName?: string;
    currency?: string;
  };
  records: CustomerRecord[];
}

const DB_PATH = path.resolve('data', 'db.json');

const DEFAULT_PRESETS = {
  groups: [
    'VIP 1群 (大客专属)',
    'Mega888 玩家总群',
    '918Kiss 专享交流群',
    'Pussy888 狂欢2群',
    '老客回馈交流群',
  ],
  platforms: [
    'Mega888',
    '918Kiss',
    'Pussy888',
    'Joker123',
    'Evo888',
    'Live22',
    'XE88',
    'Pragmatic Play',
  ],
  banks: [
    'Maybank (马银行)',
    'CIMB Bank',
    'Public Bank (大众)',
    'Hong Leong (丰隆)',
    'RHB Bank',
    'AmBank',
    'Touch \'n Go eWallet',
    'DuitNow QR',
    'Alliance Bank',
  ],
  quickAmounts: [50, 100, 200, 300, 500, 1000, 2000, 5000],
  staffMembers: ['客服小美', '主管阿明', '前台小陈', '夜班阿强'],
  shifts: ['早班', '晚班'],
  shiftTimes: { 早班: { start: '08:00', end: '20:00' }, 晚班: { start: '20:00', end: '08:00' } },
  staffHours: {},
};

function normalizeRecord(r: any): CustomerRecord {
  const isWithdraw = r.type === 'withdraw' || (r.notes && r.notes.includes('洗分'));
  const timeStr = r.time || new Date().toTimeString().slice(0, 5);
  const hour = parseInt(timeStr.split(':')[0], 10);
  const defaultShift = hour >= 8 && hour < 20 ? '早班' : '晚班';

  return {
    id: r.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: isWithdraw ? 'withdraw' : 'deposit',
    groupName: r.groupName || 'VIP 1群',
    platform: r.platform || '',
    gameId: String(r.gameId || '未知ID').trim(),
    userName: String(r.userName || r.customerName || r.gameId || '玩家').trim(),
    amount: Number(r.amount) || 0,
    bankName: r.bankName || r.paymentMethod || 'Maybank (马银行)',
    date: r.date || new Date().toISOString().split('T')[0],
    time: timeStr,
    depositCount: Number(r.depositCount) || 1,
    withdrawCount: Number(r.withdrawCount) || 0,
    branchName: r.branchName || '吉隆坡总店',
    staffName: r.staffName || '值班员工',
    shift: r.shift || defaultShift,
    notes: r.notes || '',
    timestamp: r.timestamp || Date.now(),
  };
}

function getDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const initial: DatabaseSchema = {
        branches: [
          { id: 'b-kl', name: '吉隆坡总店', code: 'KL01' },
          { id: 'b-pg', name: '槟城分店', code: 'PG01' },
          { id: 'b-jb', name: '新山分店', code: 'JB01' },
          { id: 'b-online', name: '线上运营客服', code: 'OL01' },
        ],
        presets: DEFAULT_PRESETS,
        records: [],
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.presets) {
      parsed.presets = DEFAULT_PRESETS;
    } else {
      if (!parsed.presets.staffMembers) {
        parsed.presets.staffMembers = DEFAULT_PRESETS.staffMembers;
      }
      if (!parsed.presets.quickAmounts) {
        parsed.presets.quickAmounts = DEFAULT_PRESETS.quickAmounts;
      }
      if (!parsed.presets.shifts) parsed.presets.shifts = DEFAULT_PRESETS.shifts;
      if (!parsed.presets.shiftTimes) parsed.presets.shiftTimes = DEFAULT_PRESETS.shiftTimes;
      if (!parsed.presets.staffHours) parsed.presets.staffHours = {};
    }
    if (Array.isArray(parsed.records)) {
      parsed.records = parsed.records.map(normalizeRecord);
    } else {
      parsed.records = [];
    }
    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return {
      branches: [
        { id: 'b-kl', name: '吉隆坡总店', code: 'KL01' },
        { id: 'b-pg', name: '槟城分店', code: 'PG01' },
      ],
      presets: DEFAULT_PRESETS,
      records: [],
    };
  }
}

function saveDatabase(data: DatabaseSchema): boolean {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving database file:', err);
    return false;
  }
}

const app = express();
app.use(express.json());

// API: Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    systemTime: new Date().toISOString(),
    message: 'Multi-branch top-up & withdrawal server running',
  });
});

// API: Get complete shared dataset
app.get('/api/data', (_req, res) => {
  const db = getDatabase();
  res.json({
    success: true,
    data: db,
    syncedAt: new Date().toISOString(),
  });
});

// Helper to calculate customer counts automatically
function computeCustomerCounts(records: CustomerRecord[], userName: string, gameId: string) {
  const normalizedUser = userName.trim().toLowerCase();
  const normalizedGameId = gameId.trim().toLowerCase();

  const userRecords = records.filter((r) => {
    const rUser = (r.userName || '').trim().toLowerCase();
    const rGame = (r.gameId || '').trim().toLowerCase();
    return (
      (normalizedUser && rUser === normalizedUser) ||
      (normalizedGameId && rGame === normalizedGameId)
    );
  });

  const prevDepositCount = userRecords.filter((r) => r.type === 'deposit').length;
  const prevWithdrawCount = userRecords.filter((r) => r.type === 'withdraw').length;

  return {
    prevDepositCount,
    prevWithdrawCount,
  };
}

// API: Add Record (进分 或 洗分)
app.post('/api/records', (req, res) => {
  const db = getDatabase();
  const body = req.body;

  const numAmount = parseFloat(body.amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, message: '请输入有效的金额数目' });
  }

  const type: TransactionType = body.type === 'withdraw' ? 'withdraw' : 'deposit';
  const userName = String(body.userName || body.customerName || body.gameId || '玩家').trim();
  const gameId = String(body.gameId || '未填写').trim();
  const now = new Date();
  const dateStr = body.date || now.toISOString().split('T')[0];
  const timeStr = body.time || now.toTimeString().slice(0, 5);

  // Auto count for this customer
  const { prevDepositCount, prevWithdrawCount } = computeCustomerCounts(db.records, userName, gameId);
  const depositCount = type === 'deposit' ? prevDepositCount + 1 : prevDepositCount;
  const withdrawCount = type === 'withdraw' ? prevWithdrawCount + 1 : prevWithdrawCount;

  const newRecord: CustomerRecord = {
    id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    groupName: String(body.groupName || 'VIP 1群').trim(),
    platform: String(body.platform || '').trim(),
    gameId,
    userName,
    amount: numAmount,
    bankName: String(body.bankName || 'Maybank (马银行)').trim(),
    date: dateStr,
    time: timeStr,
    depositCount: body.depositCount !== undefined ? Number(body.depositCount) : depositCount,
    withdrawCount: body.withdrawCount !== undefined ? Number(body.withdrawCount) : withdrawCount,
    branchName: String(body.branchName || '吉隆坡总店').trim(),
    staffName: body.staffName || '值班员工',
    shift: body.shift || (parseInt(timeStr.split(':')[0], 10) >= 8 && parseInt(timeStr.split(':')[0], 10) < 20 ? '早班' : '晚班'),
    notes: body.notes || '',
    timestamp: Date.now(),
  };

  db.records.unshift(newRecord);
  saveDatabase(db);

  return res.json({
    success: true,
    message: `${type === 'deposit' ? '进分 (Bank-in)' : '洗分 (Cuci)'} 记录已成功保存并实时同步到所有手机`,
    record: newRecord,
    totalRecords: db.records.length,
  });
});

// API: Edit existing record
app.put('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const index = db.records.findIndex((r) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: '未找到该笔记录' });
  }

  const updatedRecord = {
    ...db.records[index],
    ...req.body,
    id, // protect id
  };

  db.records[index] = normalizeRecord(updatedRecord);
  saveDatabase(db);

  return res.json({
    success: true,
    message: '记录更新成功',
    record: db.records[index],
  });
});

// API: Delete record
app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const initialLen = db.records.length;
  db.records = db.records.filter((r) => r.id !== id);

  if (db.records.length === initialLen) {
    return res.status(404).json({ success: false, message: '未找到要删除的记录' });
  }

  saveDatabase(db);
  return res.json({ success: true, message: '记录已成功删除' });
});

// API: Add custom WhatsApp Group
app.post('/api/presets/groups', (req, res) => {
  const db = getDatabase();
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: '群名不可为空' });
  if (!db.presets) db.presets = { groups: [], platforms: [], banks: [] };
  if (!db.presets.groups.includes(name)) {
    db.presets.groups.push(name);
    saveDatabase(db);
  }
  return res.json({ success: true, groups: db.presets.groups });
});

// API: Delete WhatsApp Group preset
app.delete('/api/presets/groups', (req, res) => {
  const db = getDatabase();
  const name = String(req.body.name || '').trim();
  if (db.presets?.groups) {
    db.presets.groups = db.presets.groups.filter((g) => g !== name);
    saveDatabase(db);
  }
  return res.json({ success: true, groups: db.presets?.groups || [] });
});

// API: Add custom Bank
app.post('/api/presets/banks', (req, res) => {
  const db = getDatabase();
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: '银行名称不可为空' });
  if (!db.presets) db.presets = { groups: [], platforms: [], banks: [] };
  if (!db.presets.banks.includes(name)) {
    db.presets.banks.push(name);
    saveDatabase(db);
  }
  return res.json({ success: true, banks: db.presets.banks });
});

// API: Delete Bank preset
app.delete('/api/presets/banks', (req, res) => {
  const db = getDatabase();
  const name = String(req.body.name || '').trim();
  if (db.presets?.banks) {
    db.presets.banks = db.presets.banks.filter((b) => b !== name);
    saveDatabase(db);
  }
  return res.json({ success: true, banks: db.presets?.banks || [] });
});

// API: Add custom branch
app.post('/api/branches', (req, res) => {
  const db = getDatabase();
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: '店名不可为空' });
  if (!db.branches.some((b) => b.name === name)) {
    db.branches.push({
      id: `b-${Date.now()}`,
      name,
      code: `B0${db.branches.length + 1}`,
    });
    saveDatabase(db);
  }
  return res.json({ success: true, branches: db.branches });
});

// API: Delete custom branch
app.delete('/api/branches/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  db.branches = db.branches.filter((b) => b.id !== id && b.name !== id);
  saveDatabase(db);
  return res.json({ success: true, branches: db.branches });
});

// API: Rename WhatsApp Group (and optionally update in historical records)
app.put('/api/presets/groups/rename', (req, res) => {
  const db = getDatabase();
  const { oldName, newName } = req.body;
  const oName = String(oldName || '').trim();
  const nName = String(newName || '').trim();
  if (!oName || !nName) return res.status(400).json({ success: false, message: '原群名与新群名不可为空' });

  if (db.presets?.groups) {
    const idx = db.presets.groups.indexOf(oName);
    if (idx !== -1) {
      db.presets.groups[idx] = nName;
    }
  }

  // Update records with oldName
  db.records.forEach((r) => {
    if (r.groupName === oName) r.groupName = nName;
  });

  saveDatabase(db);
  return res.json({ success: true, groups: db.presets?.groups || [], recordsUpdated: true });
});

// API: Rename Bank (and update in historical records)
app.put('/api/presets/banks/rename', (req, res) => {
  const db = getDatabase();
  const { oldName, newName } = req.body;
  const oName = String(oldName || '').trim();
  const nName = String(newName || '').trim();
  if (!oName || !nName) return res.status(400).json({ success: false, message: '原银行名与新银行名不可为空' });

  if (db.presets?.banks) {
    const idx = db.presets.banks.indexOf(oName);
    if (idx !== -1) {
      db.presets.banks[idx] = nName;
    }
  }

  // Update records with oldName
  db.records.forEach((r) => {
    if (r.bankName === oName) r.bankName = nName;
  });

  saveDatabase(db);
  return res.json({ success: true, banks: db.presets?.banks || [], recordsUpdated: true });
});

// API: Rename / Edit Branch
app.put('/api/branches/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name } = req.body;
  const newName = String(name || '').trim();
  if (!newName) return res.status(400).json({ success: false, message: '分店新名称不可为空' });

  const branch = db.branches.find((b) => b.id === id || b.name === id);
  if (!branch) return res.status(404).json({ success: false, message: '未找到该分店' });

  const oldBranchName = branch.name;
  branch.name = newName;

  db.records.forEach((r) => {
    if (r.branchName === oldBranchName) r.branchName = newName;
  });

  saveDatabase(db);
  return res.json({ success: true, branches: db.branches });
});

// API: Update Quick Amounts
app.put('/api/presets/quick-amounts', (req, res) => {
  const db = getDatabase();
  const { amounts } = req.body;
  if (!Array.isArray(amounts)) return res.status(400).json({ success: false, message: '金额列表格式错误' });

  const cleanAmounts = amounts.map((a: any) => Number(a)).filter((n: number) => !isNaN(n) && n > 0);
  if (!db.presets) db.presets = { groups: [], platforms: [], banks: [], quickAmounts: [] };
  db.presets.quickAmounts = cleanAmounts;
  saveDatabase(db);
  return res.json({ success: true, quickAmounts: db.presets.quickAmounts });
});

// API: Update shared shift times and individual employee working hours
app.put('/api/presets/shift-settings', (req, res) => {
  const db = getDatabase();
  if (!db.presets) db.presets = { ...DEFAULT_PRESETS };
  const isTime = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const { shiftTimes, staffHours } = req.body || {};

  if (shiftTimes !== undefined) {
    if (!shiftTimes || !['早班', '晚班'].every((key) =>
      isTime(shiftTimes[key]?.start) && isTime(shiftTimes[key]?.end)
    )) {
      return res.status(400).json({ success: false, message: '早班和晚班必须填写有效的开始及结束时间（HH:mm）' });
    }
    db.presets.shiftTimes = {
      早班: { start: shiftTimes.早班.start, end: shiftTimes.早班.end },
      晚班: { start: shiftTimes.晚班.start, end: shiftTimes.晚班.end },
    };
  }

  if (staffHours !== undefined) {
    if (!staffHours || typeof staffHours !== 'object' || Array.isArray(staffHours)) {
      return res.status(400).json({ success: false, message: '员工工时格式错误' });
    }
    const clean: Record<string, { start: string; end: string }> = {};
    for (const [name, hours] of Object.entries(staffHours)) {
      const value = hours as any;
      if (!name.trim() || !isTime(value?.start) || !isTime(value?.end)) {
        return res.status(400).json({ success: false, message: `员工【${name}】的开始或结束时间无效` });
      }
      clean[name] = { start: value.start, end: value.end };
    }
    db.presets.staffHours = clean;
  }

  if (!saveDatabase(db)) return res.status(500).json({ success: false, message: '保存班次设置失败' });
  return res.json({
    success: true,
    shiftTimes: db.presets.shiftTimes || DEFAULT_PRESETS.shiftTimes,
    staffHours: db.presets.staffHours || {},
  });
});

// API: Add Staff Member preset
app.post('/api/presets/staff', (req, res) => {
  const db = getDatabase();
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: '员工姓名不可为空' });
  if (!db.presets) db.presets = DEFAULT_PRESETS;
  if (!db.presets.staffMembers) db.presets.staffMembers = [...DEFAULT_PRESETS.staffMembers];
  if (!db.presets.staffMembers.includes(name)) {
    db.presets.staffMembers.push(name);
    saveDatabase(db);
  }
  return res.json({ success: true, staffMembers: db.presets.staffMembers });
});

// API: Delete Staff Member preset
app.delete('/api/presets/staff', (req, res) => {
  const db = getDatabase();
  const name = String(req.body.name || '').trim();
  if (db.presets?.staffMembers) {
    db.presets.staffMembers = db.presets.staffMembers.filter((s) => s !== name);
    if (db.presets.staffHours) delete db.presets.staffHours[name];
    saveDatabase(db);
  }
  return res.json({ success: true, staffMembers: db.presets?.staffMembers || [] });
});

// API: Rename Staff Member preset and cascade update past records
app.put('/api/presets/staff/rename', (req, res) => {
  const db = getDatabase();
  const { oldName, newName } = req.body;
  const oName = String(oldName || '').trim();
  const nName = String(newName || '').trim();
  if (!oName || !nName) return res.status(400).json({ success: false, message: '原员工名与新员工名不可为空' });

  if (!db.presets) db.presets = DEFAULT_PRESETS;
  if (!db.presets.staffMembers) db.presets.staffMembers = [...DEFAULT_PRESETS.staffMembers];

  const idx = db.presets.staffMembers.indexOf(oName);
  if (idx !== -1) {
    db.presets.staffMembers[idx] = nName;
  } else if (!db.presets.staffMembers.includes(nName)) {
    db.presets.staffMembers.push(nName);
  }

  if (db.presets.staffHours?.[oName]) {
    db.presets.staffHours[nName] = db.presets.staffHours[oName];
    delete db.presets.staffHours[oName];
  }

  let affected = 0;
  db.records.forEach((r) => {
    if (r.staffName === oName) {
      r.staffName = nName;
      affected++;
    }
  });

  saveDatabase(db);
  return res.json({ success: true, staffMembers: db.presets.staffMembers, recordsUpdated: affected });
});

// API: Rename Customer across all records
app.put('/api/customers/rename', (req, res) => {
  const db = getDatabase();
  const { oldName, newName, oldGameId, newGameId } = req.body;
  const oName = String(oldName || '').trim();
  const nName = String(newName || '').trim();
  const oGame = String(oldGameId || '').trim();
  const nGame = String(newGameId || '').trim();

  let affected = 0;
  db.records.forEach((r) => {
    let matched = false;
    if (oName && r.userName === oName) {
      if (nName) r.userName = nName;
      matched = true;
    }
    if (oGame && r.gameId === oGame) {
      if (nGame) r.gameId = nGame;
      matched = true;
    }
    if (matched) affected++;
  });

  saveDatabase(db);
  return res.json({ success: true, affectedCount: affected });
});

// API: Clear all records (for official clean start)
app.post('/api/records/clear-all', (req, res) => {
  const db = getDatabase();
  const count = db.records.length;
  db.records = [];
  saveDatabase(db);
  return res.json({ success: true, message: `已清空 ${count} 条记录，账本已初始化准备正式使用`, clearedCount: count });
});

// Start Full-stack Express with Vite Dev Middleware
async function bootstrap() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Server] Game Top-up & Cuci records server ready at http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
});
