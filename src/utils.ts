import { CustomerRecord, CustomerProfileSummary } from './types';

// Format currency
export function formatCurrency(amount: number, currency: string = 'RM'): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Get dates for Current Week (Monday to Sunday)
export function getCurrentWeekDates(targetDate = new Date()): { startStr: string; endStr: string; dayLabels: string[] } {
  const curr = new Date(targetDate);
  const day = curr.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMon = curr.getDate() - day + (day === 0 ? -6 : 1);
  
  const monday = new Date(curr.setDate(diffToMon));
  monday.setHours(0, 0, 0, 0);

  const dayLabels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dayLabels.push(d.toISOString().split('T')[0]);
  }

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    startStr: dayLabels[0],
    endStr: dayLabels[6],
    dayLabels,
  };
}

// Get Yesterday's date string YYYY-MM-DD
export function getYesterdayDateStr(targetDate = new Date()): string {
  const d = new Date(targetDate);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// Get Current Month start and end dates YYYY-MM-DD
export function getCurrentMonthDates(targetDate = new Date()): { startStr: string; endStr: string; monthStr: string } {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth(); // 0-indexed
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // last day of month

  const pad = (n: number) => String(n).padStart(2, '0');
  const monthStr = `${year}-${pad(month + 1)}`;
  return {
    startStr: `${year}-${pad(month + 1)}-01`,
    endStr: `${year}-${pad(month + 1)}-${pad(end.getDate())}`,
    monthStr,
  };
}

// Compute customer summaries for auto-fill and auto-stats
export function computeCustomerSummaries(records: CustomerRecord[]): Map<string, CustomerProfileSummary> {
  const map = new Map<string, CustomerProfileSummary>();

  // Process in chronological order (oldest to newest) to track running counts
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);

  for (const r of sorted) {
    const key = (r.userName || r.gameId || '').trim().toLowerCase();
    if (!key) continue;

    const existing = map.get(key) || {
      key,
      userName: r.userName || r.gameId,
      gameId: r.gameId,
      lastPlatform: r.platform,
      lastGroupName: r.groupName,
      lastBankName: r.bankName,
      totalDepositAmount: 0,
      totalWithdrawAmount: 0,
      depositCount: 0,
      withdrawCount: 0,
      netProfit: 0,
      lastDate: r.date,
      lastTime: r.time,
    };

    if (r.type === 'deposit') {
      existing.totalDepositAmount += r.amount;
      existing.depositCount += 1;
    } else {
      existing.totalWithdrawAmount += r.amount;
      existing.withdrawCount += 1;
    }

    existing.netProfit = existing.totalDepositAmount - existing.totalWithdrawAmount;
    existing.userName = r.userName || existing.userName;
    existing.gameId = r.gameId || existing.gameId;
    existing.lastPlatform = r.platform || existing.lastPlatform;
    existing.lastGroupName = r.groupName || existing.lastGroupName;
    existing.lastBankName = r.bankName || existing.lastBankName;
    existing.lastDate = r.date;
    existing.lastTime = r.time;

    map.set(key, existing);
  }

  return map;
}

// Export Comprehensive CSV
export function exportRecordsToCSV(records: CustomerRecord[], titlePrefix = '进分洗分流水报表') {
  if (records.length === 0) {
    alert('暂无记录可导出');
    return;
  }

  const headers = [
    '序号',
    '流水编号',
    '交易类型',
    'WhatsApp群名字',
    '顾客平台',
    '游戏ID',
    'User Name (顾客用户名)',
    'Bank-in 进账数目(RM)',
    '洗分出账数目(RM)',
    '银行的名字',
    '日期',
    '时间',
    '充值次数(该客)',
    '洗分次数(该客)',
    '店的名字',
    '经办员工',
    '班次(早班/晚班)',
    '备注'
  ];

  let totalDeposit = 0;
  let totalWithdraw = 0;
  let totalDepositCount = 0;
  let totalWithdrawCount = 0;

  const rows = records.map((r, idx) => {
    const isDep = r.type === 'deposit';
    const depAmt = isDep ? r.amount : 0;
    const withAmt = !isDep ? r.amount : 0;
    
    totalDeposit += depAmt;
    totalWithdraw += withAmt;
    if (isDep) totalDepositCount++;
    else totalWithdrawCount++;

    return [
      idx + 1,
      `"${r.id}"`,
      `"${isDep ? '进分 (Bank-in)' : '洗分 (Cuci)'}"`,
      `"${(r.groupName || '').replace(/"/g, '""')}"`,
      `"${(r.platform || '').replace(/"/g, '""')}"`,
      `"${(r.gameId || '').replace(/"/g, '""')}"`,
      `"${(r.userName || '').replace(/"/g, '""')}"`,
      isDep ? r.amount.toFixed(2) : '0.00',
      !isDep ? r.amount.toFixed(2) : '0.00',
      `"${(r.bankName || '').replace(/"/g, '""')}"`,
      `"${r.date}"`,
      `"${r.time}"`,
      r.depositCount,
      r.withdrawCount,
      `"${(r.branchName || '').replace(/"/g, '""')}"`,
      `"${(r.staffName || '').replace(/"/g, '""')}"`,
      `"${(r.shift || '早班').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ];
  });

  const netTotal = totalDeposit - totalWithdraw;
  const summaryRow = [
    '"【汇总统计】"',
    '""',
    `"进分 ${totalDepositCount} 笔 / 洗分 ${totalWithdrawCount} 笔"`,
    '""',
    '""',
    '""',
    `"净进账: RM ${netTotal.toFixed(2)}"`,
    totalDeposit.toFixed(2),
    totalWithdraw.toFixed(2),
    '""',
    '""',
    '""',
    totalDepositCount,
    totalWithdrawCount,
    '""',
    '""',
    '""'
  ];

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(r => r.join(',')),
    '',
    summaryRow.join(',')
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${titlePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
