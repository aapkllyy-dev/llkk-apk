/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CustomerRecord, Branch, TransactionType } from './types';
import { 
  formatCurrency, getCurrentWeekDates, getYesterdayDateStr, 
  getCurrentMonthDates, exportRecordsToCSV 
} from './utils';
import { 
  Download, Trash2, Search, Calendar, Clock, 
  DollarSign, Gamepad2, User, Building2, MessageSquare, 
  Store, Check, ArrowDownLeft, ArrowUpRight, RefreshCw, 
  Layers, Zap, Edit3, Plus, Settings, X, BookOpen, 
  Copy, CheckCheck, BarChart3, TrendingUp, Filter,
  Users, AlertTriangle, RotateCcw, Sliders, HelpCircle,
  UserCheck, Sun, Moon
} from 'lucide-react';

const DEFAULT_GROUPS = [
  'VIP 1群 (大客)',
  'Mega888 玩家群',
  '918Kiss 专享群',
  'Pussy888 交流群',
  '老客福利群'
];

const DEFAULT_BANKS = [
  'Maybank (马银行)',
  'CIMB Bank',
  'Public Bank (大众)',
  'Hong Leong (丰隆)',
  'RHB Bank',
  'Touch \'n Go',
  'DuitNow QR'
];

const DEFAULT_QUICK_AMOUNTS = [50, 100, 200, 300, 500, 1000, 2000, 5000];

const DEFAULT_STAFF_MEMBERS = ['客服小美', '主管阿明', '前台小陈', '夜班阿强'];

export default function App() {
  const [records, setRecords] = useState<CustomerRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([
    { id: 'b-kl', name: '吉隆坡总店', code: 'KL01' },
    { id: 'b-pg', name: '槟城分店', code: 'PG01' },
    { id: 'b-jb', name: '新山分店', code: 'JB01' },
    { id: 'b-online', name: '线上客服组', code: 'OL01' },
  ]);
  const [groups, setGroups] = useState<string[]>(DEFAULT_GROUPS);
  const [banks, setBanks] = useState<string[]>(DEFAULT_BANKS);
  const [quickAmounts, setQuickAmounts] = useState<number[]>(DEFAULT_QUICK_AMOUNTS);
  const [staffMembers, setStaffMembers] = useState<string[]>(DEFAULT_STAFF_MEMBERS);
  const [shiftTimes, setShiftTimes] = useState<Record<string, { start: string; end: string }>>({
    早班: { start: '08:00', end: '20:00' },
    晚班: { start: '20:00', end: '08:00' },
  });
  const [staffHours, setStaffHours] = useState<Record<string, { start: string; end: string }>>({});
  const [isSavingWorkHours, setIsSavingWorkHours] = useState(false);
  const [staffName, setStaffName] = useState<string>(() => localStorage.getItem('last_staff_name') || '客服小美');

  // Active Main View: 'records' (记账流水) | 'ledger' (看总账 / 核算中心)
  const [activeView, setActiveView] = useState<'records' | 'ledger'>('records');

  const [currentBranch, setCurrentBranch] = useState<string>('吉隆坡总店');

  // Form fields
  const [type, setType] = useState<TransactionType>('deposit');
  const [groupName, setGroupName] = useState<string>('VIP 1群 (大客)');
  const [platform, setPlatform] = useState<string>('');
  const [gameId, setGameId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [bankName, setBankName] = useState<string>('Maybank (马银行)');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState<string>(() => new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState<string>('');
  const [showQuickAddStaff, setShowQuickAddStaff] = useState<boolean>(false);
  const [quickStaffText, setQuickStaffText] = useState<string>('');
  const [newStaffInput, setNewStaffInput] = useState<string>('');
  const [renamingStaff, setRenamingStaff] = useState<{ old: string; val: string } | null>(null);

  // Shift state: 早班 ☀️ vs 晚班 🌙 (auto detects from hour or restores from localStorage)
  const [shift, setShift] = useState<string>(() => {
    const saved = localStorage.getItem('last_shift');
    if (saved && (saved === '早班' || saved === '晚班')) return saved;
    const hour = new Date().getHours();
    return hour >= 8 && hour < 20 ? '早班' : '晚班';
  });

  // Filter & Search in records view
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdraw'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'all'>('today');
  const [filterShift, setFilterShift] = useState<'all' | '早班' | '晚班'>('all');
  const [ledgerShift, setLedgerShift] = useState<'all' | '早班' | '晚班'>('all');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Edit single transaction record state
  const [editingRecord, setEditingRecord] = useState<CustomerRecord | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Settings / Manage presets state ("加东西 / 改动选项")
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<'options' | 'amounts' | 'customers' | 'danger'>('options');
  const [newGroupInput, setNewGroupInput] = useState<string>('');
  const [newBankInput, setNewBankInput] = useState<string>('');
  const [newBranchInput, setNewBranchInput] = useState<string>('');

  // Renaming inline states for settings modal
  const [renamingGroup, setRenamingGroup] = useState<{ old: string; val: string } | null>(null);
  const [renamingBank, setRenamingBank] = useState<{ old: string; val: string } | null>(null);
  const [renamingBranch, setRenamingBranch] = useState<{ id: string; old: string; val: string } | null>(null);

  // Quick Amount Management state
  const [newAmountInput, setNewAmountInput] = useState<string>('');

  // Customer Management / Rename state
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [renameCustomerOld, setRenameCustomerOld] = useState<string>('');
  const [renameCustomerNew, setRenameCustomerNew] = useState<string>('');
  const [renameGameIdOld, setRenameGameIdOld] = useState<string>('');
  const [renameGameIdNew, setRenameGameIdNew] = useState<string>('');
  const [isRenamingCustomer, setIsRenamingCustomer] = useState<boolean>(false);

  // Official Launch / Reset Database state
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // User Guide Modal state ("使用说明")
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Quick inline add toggles in main entry form
  const [showQuickAddGroup, setShowQuickAddGroup] = useState<boolean>(false);
  const [showQuickAddBank, setShowQuickAddBank] = useState<boolean>(false);
  const [quickGroupText, setQuickGroupText] = useState<string>('');
  const [quickBankText, setQuickBankText] = useState<string>('');

  // ================= 看总账 (Ledger) State =================
  const [ledgerPeriod, setLedgerPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [ledgerBranch, setLedgerBranch] = useState<string>('all');
  const [copiedTextTip, setCopiedTextTip] = useState<boolean>(false);

  // Fetch shared records and presets
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.records) setRecords(json.data.records);
        if (json.data.presets?.groups?.length > 0) setGroups(json.data.presets.groups);
        if (json.data.presets?.banks?.length > 0) setBanks(json.data.presets.banks);
        if (json.data.presets?.quickAmounts?.length > 0) setQuickAmounts(json.data.presets.quickAmounts);
        if (json.data.presets?.staffMembers?.length > 0) setStaffMembers(json.data.presets.staffMembers);
        if (json.data.presets?.shiftTimes) setShiftTimes(json.data.presets.shiftTimes);
        if (json.data.presets?.staffHours) setStaffHours(json.data.presets.staffHours);
        if (json.data.branches?.length > 0) setBranches(json.data.branches);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [fetchData]);

  // Customer historical intelligence based on Game ID
  const customerHistory = useMemo(() => {
    const g = gameId.trim().toLowerCase();
    if (!g) return null;

    const matched = records.filter((r) => {
      const rUser = (r.userName || '').trim().toLowerCase();
      const rGame = (r.gameId || '').trim().toLowerCase();
      return rGame === g || rUser === g;
    });

    if (matched.length === 0) return null;

    const deposits = matched.filter((r) => r.type === 'deposit');
    const withdraws = matched.filter((r) => r.type === 'withdraw');
    const latest = matched[0];

    const totalDep = deposits.reduce((s, r) => s + r.amount, 0);
    const totalWit = withdraws.reduce((s, r) => s + r.amount, 0);

    return {
      depositCount: deposits.length,
      withdrawCount: withdraws.length,
      totalDeposit: totalDep,
      totalWithdraw: totalWit,
      net: totalDep - totalWit,
      lastPlatform: latest?.platform,
      lastGroup: latest?.groupName,
      lastBank: latest?.bankName,
    };
  }, [gameId, records]);

  // Next predicted counts
  const nextDepositCount = (customerHistory?.depositCount || 0) + 1;
  const nextWithdrawCount = (customerHistory?.withdrawCount || 0) + 1;

  // Periods & Stats
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = getYesterdayDateStr(new Date());
  const { startStr: weekStart, endStr: weekEnd } = getCurrentWeekDates(new Date());
  const { startStr: monthStart, endStr: monthEnd, monthStr } = getCurrentMonthDates(new Date());

  const todayRecords = useMemo(() => records.filter((r) => r.date === todayStr), [records, todayStr]);
  const todayDepositTotal = useMemo(
    () => todayRecords.filter((r) => r.type === 'deposit').reduce((sum, r) => sum + r.amount, 0),
    [todayRecords]
  );
  const todayWithdrawTotal = useMemo(
    () => todayRecords.filter((r) => r.type === 'withdraw').reduce((sum, r) => sum + r.amount, 0),
    [todayRecords]
  );
  const todayDepositCount = useMemo(() => todayRecords.filter((r) => r.type === 'deposit').length, [todayRecords]);
  const todayWithdrawCount = useMemo(() => todayRecords.filter((r) => r.type === 'withdraw').length, [todayRecords]);
  const todayNet = todayDepositTotal - todayWithdrawTotal;

  const weekRecords = useMemo(
    () => records.filter((r) => r.date >= weekStart && r.date <= weekEnd),
    [records, weekStart, weekEnd]
  );
  const weekDepositTotal = useMemo(
    () => weekRecords.filter((r) => r.type === 'deposit').reduce((sum, r) => sum + r.amount, 0),
    [weekRecords]
  );
  const weekWithdrawTotal = useMemo(
    () => weekRecords.filter((r) => r.type === 'withdraw').reduce((sum, r) => sum + r.amount, 0),
    [weekRecords]
  );

  // ================= 看总账 (Ledger) Computations =================
  const ledgerRecords = useMemo(() => {
    return records.filter((r) => {
      // Branch filter
      if (ledgerBranch !== 'all' && r.branchName !== ledgerBranch) {
        return false;
      }
      // Shift filter
      if (ledgerShift !== 'all' && (r.shift || '早班') !== ledgerShift) {
        return false;
      }
      // Period filter
      if (ledgerPeriod === 'today') {
        return r.date === todayStr;
      }
      if (ledgerPeriod === 'yesterday') {
        return r.date === yesterdayStr;
      }
      if (ledgerPeriod === 'week') {
        return r.date >= weekStart && r.date <= weekEnd;
      }
      if (ledgerPeriod === 'month') {
        return r.date >= monthStart && r.date <= monthEnd;
      }
      if (ledgerPeriod === 'custom') {
        return r.date >= customStart && r.date <= customEnd;
      }
      return true; // 'all'
    });
  }, [records, ledgerBranch, ledgerShift, ledgerPeriod, todayStr, yesterdayStr, weekStart, weekEnd, monthStart, monthEnd, customStart, customEnd]);

  const ledgerStats = useMemo(() => {
    let depTotal = 0;
    let witTotal = 0;
    let depCount = 0;
    let witCount = 0;

    const bankMap = new Map<string, { bank: string; deposit: number; withdraw: number; net: number; depCount: number; witCount: number }>();
    const groupMap = new Map<string, { group: string; deposit: number; withdraw: number; net: number; depCount: number; witCount: number; users: Set<string> }>();
    const branchMap = new Map<string, { branch: string; deposit: number; withdraw: number; net: number; count: number }>();
    const staffMap = new Map<string, { staff: string; deposit: number; withdraw: number; net: number; depCount: number; witCount: number; totalCount: number }>();
    const shiftMap = {
      早班: { deposit: 0, withdraw: 0, net: 0, depCount: 0, witCount: 0, totalCount: 0 },
      晚班: { deposit: 0, withdraw: 0, net: 0, depCount: 0, witCount: 0, totalCount: 0 },
    };

    ledgerRecords.forEach((r) => {
      const isDep = r.type === 'deposit';
      const amt = r.amount || 0;

      if (isDep) {
        depTotal += amt;
        depCount += 1;
      } else {
        witTotal += amt;
        witCount += 1;
      }

      // Shift breakdown
      const rShift = (r.shift || '早班') === '晚班' ? '晚班' : '早班';
      if (isDep) {
        shiftMap[rShift].deposit += amt;
        shiftMap[rShift].depCount += 1;
      } else {
        shiftMap[rShift].withdraw += amt;
        shiftMap[rShift].witCount += 1;
      }
      shiftMap[rShift].totalCount += 1;
      shiftMap[rShift].net = shiftMap[rShift].deposit - shiftMap[rShift].withdraw;

      // Bank breakdown
      const bName = r.bankName || '未指定银行';
      const bData = bankMap.get(bName) || { bank: bName, deposit: 0, withdraw: 0, net: 0, depCount: 0, witCount: 0 };
      if (isDep) {
        bData.deposit += amt;
        bData.depCount += 1;
      } else {
        bData.withdraw += amt;
        bData.witCount += 1;
      }
      bData.net = bData.deposit - bData.withdraw;
      bankMap.set(bName, bData);

      // Group breakdown
      const gName = r.groupName || '未指定群';
      const gData = groupMap.get(gName) || { group: gName, deposit: 0, withdraw: 0, net: 0, depCount: 0, witCount: 0, users: new Set<string>() };
      if (isDep) {
        gData.deposit += amt;
        gData.depCount += 1;
      } else {
        gData.withdraw += amt;
        gData.witCount += 1;
      }
      gData.net = gData.deposit - gData.withdraw;
      gData.users.add(r.userName || r.gameId);
      groupMap.set(gName, gData);

      // Branch breakdown
      const brName = r.branchName || '未指定分店';
      const brData = branchMap.get(brName) || { branch: brName, deposit: 0, withdraw: 0, net: 0, count: 0 };
      if (isDep) {
        brData.deposit += amt;
      } else {
        brData.withdraw += amt;
      }
      brData.net = brData.deposit - brData.withdraw;
      brData.count += 1;
      branchMap.set(brName, brData);

      // Staff breakdown
      const sName = r.staffName || '值班员工';
      const sData = staffMap.get(sName) || { staff: sName, deposit: 0, withdraw: 0, net: 0, depCount: 0, witCount: 0, totalCount: 0 };
      if (isDep) {
        sData.deposit += amt;
        sData.depCount += 1;
      } else {
        sData.withdraw += amt;
        sData.witCount += 1;
      }
      sData.totalCount += 1;
      sData.net = sData.deposit - sData.withdraw;
      staffMap.set(sName, sData);
    });

    const net = depTotal - witTotal;
    const avgDep = depCount > 0 ? depTotal / depCount : 0;
    const avgWit = witCount > 0 ? witTotal / witCount : 0;

    return {
      depTotal,
      witTotal,
      depCount,
      witCount,
      net,
      avgDep,
      avgWit,
      banks: Array.from(bankMap.values()).sort((a, b) => (b.deposit + b.withdraw) - (a.deposit + a.withdraw)),
      groups: Array.from(groupMap.values()).map((g) => ({ ...g, userCount: g.users.size })).sort((a, b) => (b.deposit + b.withdraw) - (a.deposit + a.withdraw)),
      branches: Array.from(branchMap.values()).sort((a, b) => (b.deposit + b.withdraw) - (a.deposit + a.withdraw)),
      staffList: Array.from(staffMap.values()).sort((a, b) => b.totalCount - a.totalCount),
      shiftBreakdown: shiftMap,
    };
  }, [ledgerRecords]);

  // Copy formatted ledger text for WhatsApp / WeChat group reporting
  const handleCopyLedgerText = () => {
    let periodTitle = '今日总账';
    if (ledgerPeriod === 'yesterday') periodTitle = `昨日总账 (${yesterdayStr})`;
    else if (ledgerPeriod === 'today') periodTitle = `今日总账 (${todayStr})`;
    else if (ledgerPeriod === 'week') periodTitle = `本周总账 (${weekStart} ~ ${weekEnd})`;
    else if (ledgerPeriod === 'month') periodTitle = `本月总账 (${monthStr})`;
    else if (ledgerPeriod === 'custom') periodTitle = `自定义总账 (${customStart} ~ ${customEnd})`;
    else if (ledgerPeriod === 'all') periodTitle = '历史累计大总账';

    const branchText = ledgerBranch === 'all' ? '全部门店' : ledgerBranch;
    const shiftText = ledgerShift === 'all' ? '全部班次' : ledgerShift;

    let text = `📊【${periodTitle}】对账汇总单\n`;
    text += `🏪 核算门店: ${branchText} | 班次: ${shiftText}\n`;
    text += `──────────────────\n`;
    text += `🟢 进分 (Bank-in): RM ${ledgerStats.depTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${ledgerStats.depCount} 笔)\n`;
    text += `🔴 洗分 (Cuci): RM ${ledgerStats.witTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${ledgerStats.witCount} 笔)\n`;
    text += `💰 净结余 (Net): ${ledgerStats.net >= 0 ? '+' : ''}RM ${ledgerStats.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    text += `──────────────────\n`;
    text += `☀️ 早班与 🌙 晚班交更对账:\n`;
    text += `• ☀️ 早班: 共 ${ledgerStats.shiftBreakdown.早班.totalCount} 笔 | 进 RM ${ledgerStats.shiftBreakdown.早班.deposit.toLocaleString()} | 洗 RM ${ledgerStats.shiftBreakdown.早班.withdraw.toLocaleString()} | 净结余 ${ledgerStats.shiftBreakdown.早班.net >= 0 ? '+' : ''}RM ${ledgerStats.shiftBreakdown.早班.net.toLocaleString()}\n`;
    text += `• 🌙 晚班: 共 ${ledgerStats.shiftBreakdown.晚班.totalCount} 笔 | 进 RM ${ledgerStats.shiftBreakdown.晚班.deposit.toLocaleString()} | 洗 RM ${ledgerStats.shiftBreakdown.晚班.withdraw.toLocaleString()} | 净结余 ${ledgerStats.shiftBreakdown.晚班.net >= 0 ? '+' : ''}RM ${ledgerStats.shiftBreakdown.晚班.net.toLocaleString()}\n`;
    text += `──────────────────\n`;
    text += `🏦 银行账户进出明细:\n`;
    ledgerStats.banks.forEach((b) => {
      text += `• ${b.bank}: 进 RM ${b.deposit.toLocaleString()} | 出 RM ${b.withdraw.toLocaleString()} | 净 ${b.net >= 0 ? '+' : ''}RM ${b.net.toLocaleString()}\n`;
    });
    text += `──────────────────\n`;
    text += `💬 群业绩分布:\n`;
    ledgerStats.groups.forEach((g) => {
      text += `• ${g.group}: 进 RM ${g.deposit.toLocaleString()} | 出 RM ${g.withdraw.toLocaleString()} | 净 RM ${g.net.toLocaleString()} (${g.userCount}位客)\n`;
    });
    if (ledgerStats.staffList.length > 0) {
      text += `──────────────────\n`;
      text += `👤 经手员工记账统计:\n`;
      ledgerStats.staffList.forEach((s) => {
        text += `• ${s.staff}: 共记 ${s.totalCount} 笔 (进 ${s.depCount} / 洗 ${s.witCount}) | 净值 RM ${s.net.toLocaleString()}\n`;
      });
    }
    text += `──────────────────\n`;
    text += `共计 ${ledgerRecords.length} 笔流水，系统自动统计。\n`;

    navigator.clipboard.writeText(text);
    setCopiedTextTip(true);
    setTimeout(() => setCopiedTextTip(false), 2500);
  };

  // Apply last preferences
  const handleApplyPreferences = () => {
    if (customerHistory?.lastPlatform) setPlatform(customerHistory.lastPlatform);
    if (customerHistory?.lastGroup) setGroupName(customerHistory.lastGroup);
    if (customerHistory?.lastBank) setBankName(customerHistory.lastBank);
  };

  // Submit record
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalGameId = gameId.trim();
    if (!finalGameId) {
      alert('请填写顾客【游戏 ID (平台账号)】');
      return;
    }
    const finalStaff = (staffName.trim() || localStorage.getItem('last_staff_name') || '').trim();
    if (!finalStaff) {
      alert('请填写或点选【经手员工姓名】，以便确认是谁记录的账');
      return;
    }
    localStorage.setItem('last_staff_name', finalStaff);
    const finalShift = shift || '早班';
    localStorage.setItem('last_shift', finalShift);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('请输入正确的金额数目');
      return;
    }

    setIsSubmitting(true);
    try {
      const depCount = type === 'deposit' ? nextDepositCount : (customerHistory?.depositCount || 0);
      const witCount = type === 'withdraw' ? nextWithdrawCount : (customerHistory?.withdrawCount || 0);

      const payload = {
        type,
        groupName: groupName.trim() || 'VIP 1群',
        platform: platform.trim(),
        gameId: finalGameId,
        userName: finalGameId,
        amount: numAmount,
        bankName: bankName.trim() || 'Maybank',
        date,
        time,
        depositCount: depCount,
        withdrawCount: witCount,
        branchName: currentBranch,
        staffName: finalStaff,
        shift: finalShift,
        notes: notes.trim(),
      };

      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || '保存失败');
      }

      setRecords((prev) => [data.record, ...prev]);
      setAmount('');
      setNotes('');
      setTime(new Date().toTimeString().slice(0, 5));

      setFeedback({
        text: `✅ 已成功记录！该顾客当前是第 ${type === 'deposit' ? depCount : witCount} 次${type === 'deposit' ? '充值' : '洗分'}`,
        type: 'success',
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || '保存失败，请检查网络');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save edited record
  const handleSaveEditedRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/records/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRecord),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || '更新失败');
      }

      setRecords((prev) => prev.map((r) => (r.id === editingRecord.id ? data.record : r)));
      setEditingRecord(null);

      setFeedback({
        text: '✅ 记录已成功修改并同步！',
        type: 'success',
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || '保存修改失败');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ================= WhatsApp Groups Handlers =================
  const handleAddGroup = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try {
      const res = await fetch('/api/presets/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (data.success && data.groups) {
        setGroups(data.groups);
        setGroupName(clean);
        setNewGroupInput('');
        setQuickGroupText('');
        setShowQuickAddGroup(false);
        setFeedback({ text: `✅ 已成功添加群【${clean}】！`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      alert('添加群名失败');
    }
  };

  const handleRenameGroup = async (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) {
      setRenamingGroup(null);
      return;
    }
    try {
      const res = await fetch('/api/presets/groups/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: clean }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.groups) setGroups(data.groups);
        if (groupName === oldName) setGroupName(clean);
        setRecords((prev) => prev.map((r) => (r.groupName === oldName ? { ...r, groupName: clean } : r)));
        setRenamingGroup(null);
        setFeedback({ text: `✅ 群名已改动为【${clean}】，历史账目已全部同步更新！`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      alert('改动群名失败');
    }
  };

  const handleDeleteGroup = async (name: string) => {
    if (!confirm(`确定要删除群名【${name}】吗？`)) return;
    try {
      const res = await fetch('/api/presets/groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success && data.groups) {
        setGroups(data.groups);
        if (groupName === name) setGroupName(data.groups[0] || '默认群');
      }
    } catch {
      alert('删除失败');
    }
  };

  // ================= Banks Handlers =================
  const handleAddBank = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try {
      const res = await fetch('/api/presets/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (data.success && data.banks) {
        setBanks(data.banks);
        setBankName(clean);
        setNewBankInput('');
        setQuickBankText('');
        setShowQuickAddBank(false);
        setFeedback({ text: `✅ 已成功添加银行【${clean}】！`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      alert('添加银行失败');
    }
  };

  const handleRenameBank = async (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) {
      setRenamingBank(null);
      return;
    }
    try {
      const res = await fetch('/api/presets/banks/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: clean }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.banks) setBanks(data.banks);
        if (bankName === oldName) setBankName(clean);
        setRecords((prev) => prev.map((r) => (r.bankName === oldName ? { ...r, bankName: clean } : r)));
        setRenamingBank(null);
        setFeedback({ text: `✅ 银行名称已改动为【${clean}】，历史账目已同步更新！`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      alert('改动银行名称失败');
    }
  };

  const handleDeleteBank = async (name: string) => {
    if (!confirm(`确定要删除银行【${name}】吗？`)) return;
    try {
      const res = await fetch('/api/presets/banks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success && data.banks) {
        setBanks(data.banks);
        if (bankName === name) setBankName(data.banks[0] || 'Maybank');
      }
    } catch {
      alert('删除失败');
    }
  };

  // ================= Branches Handlers =================
  const handleAddBranch = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (data.success && data.branches) {
        setBranches(data.branches);
        setCurrentBranch(clean);
        setNewBranchInput('');
        setFeedback({ text: `✅ 已成功添加分店【${clean}】！`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      alert('添加分店失败');
    }
  };

  const handleRenameBranch = async (id: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) {
      setRenamingBranch(null);
      return;
    }
    const oldBranchName = renamingBranch?.old || '';
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (data.success && data.branches) {
        setBranches(data.branches);
        if (currentBranch === oldBranchName) setCurrentBranch(clean);
        setRecords((prev) => prev.map((r) => (r.branchName === oldBranchName ? { ...r, branchName: clean } : r)));
        setRenamingBranch(null);
        setFeedback({ text: `✅ 分店名称已改动为【${clean}】，历史账目已同步更新！`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      alert('改动分店名称失败');
    }
  };

  const handleDeleteBranch = async (id: string, name: string) => {
    if (branches.length <= 1) {
      alert('至少保留一个分店');
      return;
    }
    if (!confirm(`确定要删除分店【${name}】吗？`)) return;
    try {
      const res = await fetch(`/api/branches/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && data.branches) {
        setBranches(data.branches);
        if (currentBranch === name) setCurrentBranch(data.branches[0].name);
      }
    } catch {
      alert('删除分店失败');
    }
  };

  const saveWorkHoursSettings = async () => {
    setIsSavingWorkHours(true);
    try {
      const res = await fetch('/api/presets/shift-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftTimes, staffHours }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || '保存失败');
      setShiftTimes(data.shiftTimes);
      setStaffHours(data.staffHours);
      setFeedback({ text: '✅ 班次及员工工时已保存并同步到所有设备', type: 'success' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || '保存班次设置失败');
    } finally {
      setIsSavingWorkHours(false);
    }
  };

  // ================= Staff Members Handlers =================
  const handleAddStaff = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try {
      const res = await fetch('/api/presets/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (data.success && data.staffMembers) {
        setStaffMembers(data.staffMembers);
        setStaffName(clean);
        localStorage.setItem('last_staff_name', clean);
        setNewStaffInput('');
        setQuickStaffText('');
        setShowQuickAddStaff(false);
        setFeedback({ text: `✅ 已成功添加员工【${clean}】！`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      alert('添加员工失败');
    }
  };

  const handleRenameStaff = async (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) {
      setRenamingStaff(null);
      return;
    }
    try {
      const res = await fetch('/api/presets/staff/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: clean }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.staffMembers) setStaffMembers(data.staffMembers);
        if (staffName === oldName) {
          setStaffName(clean);
          localStorage.setItem('last_staff_name', clean);
        }
        setRecords((prev) => prev.map((r) => (r.staffName === oldName ? { ...r, staffName: clean } : r)));
        setRenamingStaff(null);
        setFeedback({ text: `✅ 员工姓名已改动为【${clean}】，历史账目已同步更新！`, type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      alert('改动员工姓名失败');
    }
  };

  const handleDeleteStaff = async (name: string) => {
    if (staffMembers.length <= 1) {
      alert('至少保留一名员工');
      return;
    }
    if (!confirm(`确定要删除员工【${name}】吗？`)) return;
    try {
      const res = await fetch('/api/presets/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success && data.staffMembers) {
        setStaffMembers(data.staffMembers);
        if (staffName === name) {
          const fallback = data.staffMembers[0] || '';
          setStaffName(fallback);
          localStorage.setItem('last_staff_name', fallback);
        }
        setFeedback({ text: `✅ 已删除员工【${name}】`, type: 'info' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      alert('删除失败');
    }
  };

  // ================= Quick Fill Amounts Handlers =================
  const handleAddQuickAmount = async (num: number) => {
    if (isNaN(num) || num <= 0) return;
    if (quickAmounts.includes(num)) {
      alert('该快捷金额已存在');
      return;
    }
    const nextAmounts = [...quickAmounts, num].sort((a, b) => a - b);
    try {
      const res = await fetch('/api/presets/quick-amounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amounts: nextAmounts }),
      });
      const data = await res.json();
      if (data.success && data.quickAmounts) {
        setQuickAmounts(data.quickAmounts);
        setNewAmountInput('');
        setFeedback({ text: `✅ 快捷金额 +${num} 已添加！`, type: 'success' });
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch {
      alert('添加快捷金额失败');
    }
  };

  const handleRemoveQuickAmount = async (num: number) => {
    if (quickAmounts.length <= 1) {
      alert('至少保留一个快捷金额');
      return;
    }
    const nextAmounts = quickAmounts.filter((n) => n !== num);
    try {
      const res = await fetch('/api/presets/quick-amounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amounts: nextAmounts }),
      });
      const data = await res.json();
      if (data.success && data.quickAmounts) {
        setQuickAmounts(data.quickAmounts);
      }
    } catch {
      alert('删除快捷金额失败');
    }
  };

  // ================= Customer Batch Rename Handler =================
  const handleBatchRenameCustomer = async () => {
    if (!renameCustomerOld.trim() && !renameGameIdOld.trim()) {
      alert('请填写需要更改的原顾客姓名或原游戏ID');
      return;
    }
    if (!renameCustomerNew.trim() && !renameGameIdNew.trim()) {
      alert('请填写改动后的新顾客姓名或新游戏ID');
      return;
    }

    setIsRenamingCustomer(true);
    try {
      const res = await fetch('/api/customers/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldName: renameCustomerOld.trim(),
          newName: renameCustomerNew.trim(),
          oldGameId: renameGameIdOld.trim(),
          newGameId: renameGameIdNew.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setFeedback({
          text: `✅ 顾客信息已在所有账目中完成更名！共更新了 ${data.affectedCount} 条流水`,
          type: 'success',
        });
        setRenameCustomerOld('');
        setRenameCustomerNew('');
        setRenameGameIdOld('');
        setRenameGameIdNew('');
        setTimeout(() => setFeedback(null), 3500);
      }
    } catch {
      alert('批量修改客户信息失败');
    } finally {
      setIsRenamingCustomer(false);
    }
  };

  // ================= Official Launch: Clear Test Records =================
  const handleClearAllRecords = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/records/clear-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setRecords([]);
        setShowResetConfirm(false);
        setShowSettingsModal(false);
        setFeedback({
          text: `🚀 测试记录已全部清空！账本已初始化，可以正式开启日常记账运营（群、银行和门店配置已完整保留）。`,
          type: 'success',
        });
        setTimeout(() => setFeedback(null), 5000);
      }
    } catch {
      alert('清空记录失败');
    } finally {
      setIsResetting(false);
    }
  };

  // Extract unique customers for customer management & suggestions
  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, { userName: string; gameId: string; platform: string; count: number; totalDeposit: number; totalWithdraw: number }>();
    records.forEach((r) => {
      const key = `${(r.userName || '').trim().toLowerCase()}__${(r.gameId || '').trim().toLowerCase()}`;
      if (!key || key === '__') return;
      const existing = map.get(key) || {
        userName: r.userName || '',
        gameId: r.gameId || '',
        platform: r.platform || '',
        count: 0,
        totalDeposit: 0,
        totalWithdraw: 0,
      };
      existing.count += 1;
      if (r.type === 'deposit') existing.totalDeposit += r.amount;
      else existing.totalWithdraw += r.amount;
      if (r.platform && !existing.platform) existing.platform = r.platform;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [records]);

  // Unique names and gameIDs for datalist
  const uniqueUserNames = useMemo(() => Array.from(new Set(records.map((r) => (r.userName || '').trim()).filter(Boolean))), [records]);
  const uniqueGameIds = useMemo(() => Array.from(new Set(records.map((r) => (r.gameId || '').trim()).filter(Boolean))), [records]);


  // Delete record
  const handleDelete = async (id: string, name: string, amt: number, t: string) => {
    const label = t === 'deposit' ? '进分' : '洗分';
    if (!confirm(`确认删除这笔流水吗？\n${label}: RM ${amt}\n顾客: ${name}`)) {
      return;
    }
    try {
      const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      alert('删除失败');
    }
  };

  // Filter records in records view
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterPeriod === 'today' && r.date !== todayStr) return false;
      if (filterPeriod === 'week' && (r.date < weekStart || r.date > weekEnd)) return false;
      if (filterType !== 'all' && r.type !== filterType) return false;
      if (filterShift !== 'all' && (r.shift || '早班') !== filterShift) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (r.userName || '').toLowerCase().includes(q) ||
          (r.gameId || '').toLowerCase().includes(q) ||
          (r.groupName || '').toLowerCase().includes(q) ||
          (r.platform || '').toLowerCase().includes(q) ||
          (r.bankName || '').toLowerCase().includes(q) ||
          (r.staffName || '').toLowerCase().includes(q) ||
          (r.shift || '').toLowerCase().includes(q) ||
          (r.date || '').includes(q)
        );
      }
      return true;
    });
  }, [records, filterPeriod, filterType, filterShift, searchQuery, todayStr, weekStart, weekEnd]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Sleek Top Bar with View Switcher */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-5 py-2.5 sm:py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>出入账流水管理系统</span>
                <span className="text-[11px] font-normal text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/80 font-mono">
                  云端多店同步
                </span>
              </h1>
            </div>
          </div>

          {/* Central Mode Switcher: 📝 记账流水 vs 📖 看总账 */}
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveView('records')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'records'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>📝 记账流水</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'ledger'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>📖 查看总账 (核算)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Guide & Instructions button */}
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-500/40 text-xs font-bold text-amber-300 transition-colors cursor-pointer"
              title="查看软件使用说明与员工操作手册"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>使用说明</span>
            </button>

            {/* Manage / Add Custom Options button */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
              title="在软件内添加新群、新银行或新分店"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>选项管理</span>
            </button>

            {/* Branch Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs text-slate-200">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={currentBranch}
                onChange={(e) => setCurrentBranch(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-medium text-xs"
              >
                {branches.map((b) => (
                  <option key={b.id || b.name} value={b.name} className="bg-slate-900">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto p-3 sm:p-5 space-y-4 flex-1">
        
        {/* ========================================================= */}
        {/* VIEW 1: 📖 财务总账中心 (看总账 / 核算对账) */}
        {/* ========================================================= */}
        {activeView === 'ledger' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Ledger Header & Period Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <span>财务总账核算中心</span>
                      <span className="text-xs font-normal text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                        方便查账算账
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      支持切换今日、昨日、本周、本月或自定义查账 · 银行与群流量对账全自动合计
                    </p>
                  </div>
                </div>

                {/* Ledger Actions: Copy WhatsApp Summary & Export Excel */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLedgerText}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    title="生成整齐的对账文字并复制，可直接粘贴到微信/WhatsApp管理群对账"
                  >
                    {copiedTextTip ? <CheckCheck className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTextTip ? '已复制对账文本！' : '一键复制发群对账'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportRecordsToCSV(ledgerRecords, `总账流水报表_${ledgerPeriod}`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="导出当前总账期内的 Excel 明细表"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>导出 Excel</span>
                  </button>
                </div>
              </div>

              {/* Time Period Filter Chips for Ledger */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    <span>总账周期:</span>
                  </span>

                  {[
                    { id: 'today', label: '☀️ 今日总账' },
                    { id: 'yesterday', label: '🌙 昨日总账' },
                    { id: 'week', label: '📅 本周总账' },
                    { id: 'month', label: '📆 本月总账' },
                    { id: 'all', label: '🌐 历史大总账' },
                    { id: 'custom', label: '🗓️ 自定义查账' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLedgerPeriod(p.id as any)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        ledgerPeriod === p.id
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : 'bg-slate-850 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Filter by Shift & Store */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Shift Filter for Ledger */}
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setLedgerShift('all')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                        ledgerShift === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      全班次
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerShift('早班')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
                        ledgerShift === '早班' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sun className="w-3 h-3 text-amber-500" />
                      <span>早班</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerShift('晚班')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
                        ledgerShift === '晚班' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Moon className="w-3 h-3 text-indigo-300" />
                      <span>晚班</span>
                    </button>
                  </div>

                  {/* Filter by store */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">核算门店:</span>
                    <select
                      value={ledgerBranch}
                      onChange={(e) => setLedgerBranch(e.target.value)}
                      className="bg-slate-850 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="all">全部分店汇总</option>
                      {branches.map((b) => (
                        <option key={b.id || b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Custom Date Range Picker (Only shown when custom is selected) */}
              {ledgerPeriod === 'custom' && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-3 animate-in fade-in">
                  <span className="text-xs font-medium text-amber-300">
                    选择自定义查账日期区间:
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">从:</span>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">到:</span>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Core General Ledger Cards: Big, Clear, Bold Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Bank-in (进分总数) */}
              <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-md space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> 进分总额 (Bank-in)
                  </span>
                  <span className="text-xs font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 text-emerald-300">
                    {ledgerStats.depCount} 笔充值
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono tracking-tight pt-1">
                  {formatCurrency(ledgerStats.depTotal)}
                </div>
                <p className="text-[11px] text-slate-400 pt-1 border-t border-emerald-950/80">
                  均笔充值: <span className="font-mono text-emerald-400 font-bold">{formatCurrency(ledgerStats.avgDep)}</span>
                </p>
              </div>

              {/* Total Cuci (洗分总数) */}
              <div className="bg-gradient-to-br from-rose-950/60 via-slate-900 to-slate-900 border-2 border-rose-500/50 rounded-2xl p-4 shadow-md space-y-1">
                <div className="flex items-center justify-between text-xs text-rose-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-rose-400" /> 洗分总额 (Cuci 出款)
                  </span>
                  <span className="text-xs font-mono bg-rose-950 px-2 py-0.5 rounded border border-rose-800 text-rose-300">
                    {ledgerStats.witCount} 笔洗分
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-rose-300 font-mono tracking-tight pt-1">
                  {formatCurrency(ledgerStats.witTotal)}
                </div>
                <p className="text-[11px] text-slate-400 pt-1 border-t border-rose-950/80">
                  均笔洗分: <span className="font-mono text-rose-400 font-bold">{formatCurrency(ledgerStats.avgWit)}</span>
                </p>
              </div>

              {/* Total Net Balance (净盈亏 / 净结余) */}
              <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/60 rounded-2xl p-4 shadow-md space-y-1">
                <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                  <span>💰 净进账总额 (Net Profit)</span>
                  <span className="text-xs font-mono bg-amber-950 px-2 py-0.5 rounded border border-amber-800 text-amber-300">
                    {ledgerRecords.length} 笔总流水
                  </span>
                </div>
                <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight pt-1 ${
                  ledgerStats.net >= 0 ? 'text-amber-300' : 'text-rose-400'
                }`}>
                  {ledgerStats.net >= 0 ? `+${formatCurrency(ledgerStats.net)}` : formatCurrency(ledgerStats.net)}
                </div>
                <p className="text-[11px] text-slate-400 pt-1 border-t border-amber-950/80 flex items-center justify-between">
                  <span>盈亏状态:</span>
                  <span className={ledgerStats.net >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {ledgerStats.net >= 0 ? '盈利状态 (正向进账)' : '洗分超出 (赤字)'}
                  </span>
                </p>
              </div>
            </div>

            {/* Shift Breakdown Card for Handover (☀️ 早班与 🌙 晚班交更对账表) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <Sun className="w-4 h-4 text-amber-400" />
                    <Moon className="w-4 h-4 text-indigo-400 -ml-1" />
                  </div>
                  <h3 className="text-sm font-bold text-white">☀️ 早班与 🌙 晚班交更对账表 (班次核算)</h3>
                </div>
                <span className="text-xs text-slate-400">方便员工交更对数与老板查验两个班次业绩</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 早班 Card */}
                <div className="bg-gradient-to-br from-amber-950/30 to-slate-850 p-3.5 rounded-xl border border-amber-500/40 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs sm:text-sm">
                      <Sun className="w-4 h-4 text-amber-400" />
                      <span>☀️ 早班对账核算 ({shiftTimes.早班.start} - {shiftTimes.早班.end})</span>
                    </span>
                    <span className="text-[11px] font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                      {ledgerStats.shiftBreakdown.早班.depCount + ledgerStats.shiftBreakdown.早班.witCount} 笔流水
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">进分总额 (Bank-in):</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {formatCurrency(ledgerStats.shiftBreakdown.早班.depTotal)}
                        <span className="text-[10px] text-slate-500 ml-1">({ledgerStats.shiftBreakdown.早班.depCount}进)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">洗分总额 (Cuci出款):</span>
                      <span className="font-mono text-rose-400 font-bold">
                        {formatCurrency(ledgerStats.shiftBreakdown.早班.witTotal)}
                        <span className="text-[10px] text-slate-500 ml-1">({ledgerStats.shiftBreakdown.早班.witCount}出)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                      <span className="text-slate-300 font-medium">早班净结余 (Net):</span>
                      <span className={`font-mono font-black text-sm ${
                        ledgerStats.shiftBreakdown.早班.net >= 0 ? 'text-amber-300' : 'text-rose-400'
                      }`}>
                        {ledgerStats.shiftBreakdown.早班.net >= 0 ? '+' : ''}{formatCurrency(ledgerStats.shiftBreakdown.早班.net)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 晚班 Card */}
                <div className="bg-gradient-to-br from-indigo-950/30 to-slate-850 p-3.5 rounded-xl border border-indigo-500/40 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-indigo-500/20">
                    <span className="font-bold text-indigo-300 flex items-center gap-1.5 text-xs sm:text-sm">
                      <Moon className="w-4 h-4 text-indigo-400" />
                      <span>🌙 晚班对账核算 ({shiftTimes.晚班.start} - {shiftTimes.晚班.end})</span>
                    </span>
                    <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/30">
                      {ledgerStats.shiftBreakdown.晚班.depCount + ledgerStats.shiftBreakdown.晚班.witCount} 笔流水
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">进分总额 (Bank-in):</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {formatCurrency(ledgerStats.shiftBreakdown.晚班.depTotal)}
                        <span className="text-[10px] text-slate-500 ml-1">({ledgerStats.shiftBreakdown.晚班.depCount}进)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">洗分总额 (Cuci出款):</span>
                      <span className="font-mono text-rose-400 font-bold">
                        {formatCurrency(ledgerStats.shiftBreakdown.晚班.witTotal)}
                        <span className="text-[10px] text-slate-500 ml-1">({ledgerStats.shiftBreakdown.晚班.witCount}出)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                      <span className="text-slate-300 font-medium">晚班净结余 (Net):</span>
                      <span className={`font-mono font-black text-sm ${
                        ledgerStats.shiftBreakdown.晚班.net >= 0 ? 'text-amber-300' : 'text-rose-400'
                      }`}>
                        {ledgerStats.shiftBreakdown.晚班.net >= 0 ? '+' : ''}{formatCurrency(ledgerStats.shiftBreakdown.晚班.net)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Accounts Breakdown Table (银行对账总表) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">各银行账户流水对账表</h3>
                </div>
                <span className="text-xs text-slate-400">核对银行卡进出与结余</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2.5">银行名称</th>
                      <th className="px-3 py-2.5 text-right">进账 (Bank-in)</th>
                      <th className="px-3 py-2.5 text-right">出账 (洗分)</th>
                      <th className="px-3 py-2.5 text-right">账户净差额</th>
                      <th className="px-3 py-2.5 text-center">流水笔数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {ledgerStats.banks.map((b) => (
                      <tr key={b.bank} className="hover:bg-slate-850/60 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-white flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{b.bank}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(b.deposit)}
                          <span className="text-[10px] text-slate-500 font-normal ml-1">({b.depCount}进)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-400">
                          {formatCurrency(b.withdraw)}
                          <span className="text-[10px] text-slate-500 font-normal ml-1">({b.witCount}出)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-black">
                          <span className={b.net >= 0 ? 'text-amber-300' : 'text-rose-400'}>
                            {b.net >= 0 ? `+${formatCurrency(b.net)}` : formatCurrency(b.net)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                          {b.depCount + b.witCount} 笔
                        </td>
                      </tr>
                    ))}
                    {ledgerStats.banks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          该总账周期内暂无银行交易记录
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {ledgerStats.banks.length > 0 && (
                    <tfoot className="bg-slate-950 font-bold border-t-2 border-slate-800">
                      <tr>
                        <td className="px-3 py-2.5 text-white">【全行总计】</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-400">
                          {formatCurrency(ledgerStats.depTotal)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-rose-400">
                          {formatCurrency(ledgerStats.witTotal)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-amber-300 font-black">
                          {ledgerStats.net >= 0 ? `+${formatCurrency(ledgerStats.net)}` : formatCurrency(ledgerStats.net)}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-white">
                          {ledgerRecords.length} 笔
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* WhatsApp Group & Branch Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* WhatsApp Groups Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white">各 WhatsApp 群出入总账</h3>
                  </div>
                  <span className="text-[10px] text-slate-400">算群业绩</span>
                </div>

                <div className="space-y-2">
                  {ledgerStats.groups.map((g) => (
                    <div key={g.group} className="bg-slate-850 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-white">{g.group}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {g.userCount} 位客户 · 进 {g.depCount} 笔 / 洗 {g.witCount} 笔
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-bold ${g.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          净 {g.net >= 0 ? '+' : ''}{formatCurrency(g.net)}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          进 RM {g.deposit.toLocaleString()} / 出 RM {g.withdraw.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {ledgerStats.groups.length === 0 && (
                    <p className="text-center text-slate-500 py-4 text-xs">暂无群数据</p>
                  )}
                </div>
              </div>

              {/* Store Branches Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-bold text-white">各分店总额核算</h3>
                  </div>
                  <span className="text-[10px] text-slate-400">多店对比</span>
                </div>

                <div className="space-y-2">
                  {ledgerStats.branches.map((br) => (
                    <div key={br.branch} className="bg-slate-850 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-white">{br.branch}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">共 {br.count} 笔账目</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-bold ${br.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          净 {br.net >= 0 ? '+' : ''}{formatCurrency(br.net)}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          进 RM {br.deposit.toLocaleString()} / 洗 RM {br.withdraw.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {ledgerStats.branches.length === 0 && (
                    <p className="text-center text-slate-500 py-4 text-xs">暂无分店数据</p>
                  )}
                </div>
              </div>
            </div>

            {/* Staff Performance & Accountability Breakdown (经手员工录单统计) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">经手员工录单核算表 (问责对账)</h3>
                </div>
                <span className="text-xs text-slate-400">核对每位员工记录的笔数与金额</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {ledgerStats.staffList.map((s) => (
                  <div key={s.staff} className="bg-slate-850 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1">
                        <span className="text-amber-400">👤</span>
                        <span>{s.staff}</span>
                      </span>
                      <span className="text-[11px] font-mono bg-slate-900 text-amber-300 px-2 py-0.5 rounded border border-slate-700">
                        {s.totalCount} 笔录单
                      </span>
                    </div>
                    <div className="pt-1 space-y-0.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">进分:</span>
                        <span className="font-mono text-emerald-400 font-bold">{s.depCount} 笔 (RM {s.deposit.toLocaleString()})</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">洗分:</span>
                        <span className="font-mono text-rose-400 font-bold">{s.witCount} 笔 (RM {s.withdraw.toLocaleString()})</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                        <span className="text-slate-400">经手净值:</span>
                        <span className={`font-mono font-bold ${s.net >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                          {s.net >= 0 ? '+' : ''}RM {s.net.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {ledgerStats.staffList.length === 0 && (
                  <p className="col-span-full text-center text-slate-500 py-4 text-xs">暂无员工录单记录</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: 📝 记账流水 (原主要录单界面) */}
        {/* ========================================================= */}
        {activeView === 'records' && (
          <div className="space-y-4">
            {/* 3 Modern Financial Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Today Deposit */}
              <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-3.5 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> 今日进分 (Bank-in)
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800 font-mono">
                    {todayDepositCount} 笔充值
                  </span>
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-300 font-mono tracking-tight">
                  {formatCurrency(todayDepositTotal)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  本周累计进分: <span className="font-mono text-slate-300">{formatCurrency(weekDepositTotal)}</span>
                </p>
              </div>

              {/* Today Withdraw */}
              <div className="bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 rounded-2xl p-3.5 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-rose-400" /> 今日洗分 (Cuci)
                  </span>
                  <span className="text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800 font-mono">
                    {todayWithdrawCount} 笔洗分
                  </span>
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-rose-300 font-mono tracking-tight">
                  {formatCurrency(todayWithdrawTotal)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  本周累计洗分: <span className="font-mono text-slate-300">{formatCurrency(weekWithdrawTotal)}</span>
                </p>
              </div>

              {/* Today Net Balance with Quick Jump to Ledger */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>今日净进账 (Net Balance)</span>
                  <button
                    type="button"
                    onClick={() => setActiveView('ledger')}
                    className="text-[10px] text-amber-300 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>看总账 &gt;</span>
                  </button>
                </div>
                <div className={`mt-2 text-xl sm:text-2xl font-black font-mono tracking-tight ${
                  todayNet >= 0 ? 'text-amber-300' : 'text-rose-400'
                }`}>
                  {todayNet >= 0 ? `+${formatCurrency(todayNet)}` : formatCurrency(todayNet)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>盈余状态:</span>
                  <span className={todayNet >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {todayNet >= 0 ? '正向盈利 (Profit)' : '出分超出 (Loss)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Polished Entry Form */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>快速详细录入</span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    支持键盘快速Tab切换 · 自动识别常客并累加充值/洗分次数
                  </p>
                </div>

                {/* Tactile Transaction Type Toggle */}
                <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setType('deposit')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      type === 'deposit'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>进分 (Bank-in)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('withdraw')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      type === 'withdraw'
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>洗分 (Cuci)</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-3.5">
                {/* Auto Customer Identification Insight Card */}
                {customerHistory && (
                  <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        VIP
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>已识别顾客游戏账号: <span className="font-mono text-teal-300">{gameId}</span></span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            历史充值: <b className="text-emerald-400 font-mono">{customerHistory.depositCount}次</b> · 洗分: <b className="text-rose-400 font-mono">{customerHistory.withdrawCount}次</b>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {customerHistory.lastPlatform && (
                            <span>上次平台: <span className="text-teal-300">{customerHistory.lastPlatform}</span> · </span>
                          )}
                          常用群: <span className="text-blue-300">{customerHistory.lastGroup}</span> · 
                          银行: <span className="text-indigo-300">{customerHistory.lastBank}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] bg-slate-800 text-amber-300 px-2.5 py-1 rounded-lg border border-slate-700 font-bold font-mono">
                        本次自动记为第 {type === 'deposit' ? nextDepositCount : nextWithdrawCount} 次{type === 'deposit' ? '充值' : '洗分'}
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyPreferences}
                        className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 font-medium transition-colors cursor-pointer"
                      >
                        带入上次设置
                      </button>
                    </div>
                  </div>
                )}

                {/* Amount Input with Quick Buttons */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  type === 'deposit'
                    ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <DollarSign className={`w-4 h-4 ${type === 'deposit' ? 'text-emerald-400' : 'text-rose-400'}`} />
                      <span>{type === 'deposit' ? 'Bank-in 进账数目 (RM) *' : '洗分出款数目 (RM) *'}</span>
                    </label>
                    {amount && (
                      <span className={`text-xs font-mono font-black ${
                        type === 'deposit' ? 'text-emerald-300' : 'text-rose-300'
                      }`}>
                        {type === 'deposit' ? '+' : '-'} RM {Number(amount).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    placeholder="请输入金额，例如: 500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-3 text-xl sm:text-2xl font-black text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono tracking-wide"
                  />

                  {/* Quick Amount Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <span className="text-[11px] text-slate-400 mr-1">快捷填入:</span>
                    {quickAmounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(String(amt))}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold touch-manipulation active:scale-95 transition-all cursor-pointer ${
                          amount === String(amt)
                            ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
                        }`}
                      >
                        +{amt}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsTab('amounts');
                        setShowSettingsModal(true);
                      }}
                      className="min-h-[38px] text-[11px] text-amber-400 hover:underline px-2.5 py-1 flex items-center gap-1 cursor-pointer ml-1"
                      title="自定义或修改快捷填入金额"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>改金额</span>
                    </button>
                  </div>
                </div>

                {/* Datalists for customer suggestions */}
                <datalist id="customer-usernames">
                  {uniqueUserNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <datalist id="customer-gameids">
                  {uniqueGameIds.map((gid) => (
                    <option key={gid} value={gid} />
                  ))}
                </datalist>

                {/* Row 1: Staff Name (谁记的账) & Game ID (顾客账号) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Left Column: 经手员工姓名 & 班次选择 (早班/晚班) */}
                  <div className="space-y-2 bg-slate-850/80 border border-amber-500/30 rounded-xl p-3">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <label className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>经手员工与值班班次 *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddStaff(!showQuickAddStaff)}
                        className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>加员工</span>
                      </button>
                    </div>

                    {/* Shift Selector Buttons (☀️ 早班 / 🌙 晚班) */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShift('早班');
                          localStorage.setItem('last_shift', '早班');
                        }}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                          shift === '早班'
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 border-amber-300 shadow-md scale-[1.01]'
                            : 'bg-slate-900 text-slate-400 border-slate-700/80 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        <Sun className={`w-4 h-4 ${shift === '早班' ? 'text-slate-950' : 'text-amber-400'}`} />
                        <span>☀️ 早班 ({shiftTimes.早班.start} - {shiftTimes.早班.end})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShift('晚班');
                          localStorage.setItem('last_shift', '晚班');
                        }}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                          shift === '晚班'
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400 shadow-md scale-[1.01]'
                            : 'bg-slate-900 text-slate-400 border-slate-700/80 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        <Moon className={`w-4 h-4 ${shift === '晚班' ? 'text-white' : 'text-indigo-400'}`} />
                        <span>🌙 晚班 ({shiftTimes.晚班.start} - {shiftTimes.晚班.end})</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="输入或点击下方快捷选择员工"
                      value={staffName}
                      onChange={(e) => {
                        setStaffName(e.target.value);
                        if (e.target.value.trim()) localStorage.setItem('last_staff_name', e.target.value.trim());
                      }}
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />

                    {/* Quick Add Staff Inline Box */}
                    {showQuickAddStaff && (
                      <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 border border-amber-500/40 rounded-xl animate-in fade-in">
                        <input
                          type="text"
                          placeholder="输入新员工名字"
                          value={quickStaffText}
                          onChange={(e) => setQuickStaffText(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddStaff(quickStaffText)}
                          className="px-2.5 py-1 text-xs font-bold bg-amber-400 text-slate-950 rounded-lg cursor-pointer"
                        >
                          确认添加
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickAddStaff(false)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Staff selection chips */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {staffMembers.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setStaffName(s);
                            localStorage.setItem('last_staff_name', s);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer touch-manipulation active:scale-95 ${
                            staffName === s
                              ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold shadow-sm'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                          }`}
                        >
                          👤 {s}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>💾 本机已记住经手人: <b className="text-amber-300">{staffName || '未指定'}</b></span>
                      <span className="text-[9px] text-slate-500">换班可一键切换</span>
                    </p>
                  </div>

                  {/* Right Column: 顾客游戏 ID (平台账号) */}
                  <div className="space-y-1.5 bg-slate-850/80 border border-teal-500/30 rounded-xl p-3 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-teal-300 font-bold flex items-center gap-1.5">
                          <Gamepad2 className="w-3.5 h-3.5 text-teal-400" />
                          <span>顾客游戏 ID (平台账号) *</span>
                        </label>
                        <span className="text-[10px] text-slate-400">无需填顾客名字，以此识别</span>
                      </div>

                      <input
                        type="text"
                        required
                        list="customer-gameids"
                        placeholder="例如: VIP888、mg9988、kiss102"
                        value={gameId}
                        onChange={(e) => {
                          setGameId(e.target.value);
                          setUserName(e.target.value);
                        }}
                        className="w-full bg-slate-900 border border-teal-500/40 rounded-xl px-3 py-2 text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 font-mono tracking-wide"
                      />
                    </div>

                    {/* Recent gameIds quick chips */}
                    <div className="pt-1">
                      <span className="text-[10px] text-slate-400 mr-1">常玩顾客游戏 ID:</span>
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {uniqueGameIds.slice(0, 5).map((gid) => (
                          <button
                            key={gid}
                            type="button"
                            onClick={() => {
                              setGameId(gid);
                              setUserName(gid);
                            }}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono transition-colors cursor-pointer ${
                              gameId === gid
                                ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 font-bold'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                          >
                            {gid}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: WhatsApp Group & Platform */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>WhatsApp 群的名字 *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddGroup(!showQuickAddGroup)}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>加新群</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="例如: VIP 1群、Mega888玩家群"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-medium"
                    />

                    {/* Quick Add Group Inline Box */}
                    {showQuickAddGroup && (
                      <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 border border-slate-700 rounded-xl animate-in fade-in">
                        <input
                          type="text"
                          placeholder="输入要添加的群名"
                          value={quickGroupText}
                          onChange={(e) => setQuickGroupText(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddGroup(quickGroupText)}
                          className="px-2.5 py-1 text-xs font-bold bg-emerald-500 text-slate-950 rounded-lg cursor-pointer"
                        >
                          确认加群
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickAddGroup(false)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Preset Group Chips */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {groups.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGroupName(g)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                            groupName === g
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Platform (Self-filled / Optional) */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        <span>顾客玩的平台 (后面自己填)</span>
                      </span>
                      <span className="text-[10px] text-slate-500">选填 / 可留空</span>
                    </label>
                    <input
                      type="text"
                      placeholder="自己填写平台（例如: Mega888，或留空）"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 font-medium"
                    />
                  </div>
                </div>

                {/* Row 3: Bank Name & Date/Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>银行的名字 *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddBank(!showQuickAddBank)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>加银行</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="例如: Maybank, CIMB, Public Bank, TNG"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-medium"
                    />

                    {/* Quick Add Bank Inline Box */}
                    {showQuickAddBank && (
                      <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 border border-slate-700 rounded-xl animate-in fade-in">
                        <input
                          type="text"
                          placeholder="输入要添加的银行或电子钱包"
                          value={quickBankText}
                          onChange={(e) => setQuickBankText(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddBank(quickBankText)}
                          className="px-2.5 py-1 text-xs font-bold bg-indigo-500 text-white rounded-lg cursor-pointer"
                        >
                          确认加银行
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickAddBank(false)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Preset Bank Chips */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {banks.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setBankName(b)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                            bankName === b
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-bold'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          {b.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>日期与时间 (自动今天)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setDate(new Date().toISOString().split('T')[0]);
                          setTime(new Date().toTimeString().slice(0, 5));
                        }}
                        className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> 刷新至此时
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Note Input */}
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="备注 (选填，如：DuitNow转账单号、扫码等)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
                  />
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full min-h-[48px] py-3.5 rounded-xl text-sm font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation ${
                    type === 'deposit'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400 text-white shadow-rose-500/20'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {isSubmitting
                      ? '正在同步保存...'
                      : type === 'deposit'
                      ? `确认保存进分 Bank-in (自动记为第 ${nextDepositCount} 次充值)`
                      : `确认保存洗分 Cuci (自动记为第 ${nextWithdrawCount} 次洗分)`}
                  </span>
                </button>

                {feedback && (
                  <div className="p-2.5 text-center text-xs font-semibold rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 animate-in fade-in">
                    {feedback.text}
                  </div>
                )}
              </form>
            </div>

            {/* Polished Streamlined Transaction List with Edit Button */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
              {/* Header Controls */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>流水记录明细</span>
                    <span className="text-xs text-slate-400 font-mono">({filteredRecords.length} 笔)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    每笔记录均可点击“修改”按钮随时改动金额、姓名、平台、银行或次数
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveView('ledger')}
                    className="px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>查看总账对账</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportRecordsToCSV(filteredRecords, '进分洗分流水报表')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="导出完整的 Excel/CSV 报表文件"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>导出 Excel</span>
                  </button>
                </div>
              </div>

              {/* Filtering row */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                {/* Period Filter */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFilterPeriod('today')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      filterPeriod === 'today' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    今日数据
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPeriod('week')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      filterPeriod === 'week' ? 'bg-emerald-400 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    本周数据
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPeriod('all')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      filterPeriod === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    全部历史
                  </button>
                </div>

                {/* Shift Filter */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFilterShift('all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      filterShift === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    全部班次
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterShift('早班')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      filterShift === '早班' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <Sun className="w-3 h-3 text-amber-500" />
                    <span>早班</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterShift('晚班')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      filterShift === '晚班' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    <Moon className="w-3 h-3 text-indigo-300" />
                    <span>晚班</span>
                  </button>
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      filterType === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    全部流水
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('deposit')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      filterType === 'deposit' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    仅看进分
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('withdraw')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      filterType === 'withdraw' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    仅看洗分
                  </button>
                </div>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="快速搜索群名、顾客姓名、游戏ID、平台、银行、班次、员工、日期..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Transaction Cards List */}
              <div className="space-y-2">
                {filteredRecords.map((r) => {
                  const isDep = r.type === 'deposit';

                  return (
                    <div
                      key={r.id}
                      className="bg-slate-850 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors"
                    >
                      {/* Left Column: Basic Details */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Type Badge */}
                          <span
                            className={`text-[11px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              isDep
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {isDep ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                            <span>{isDep ? '进分 (Bank-in)' : '洗分 (Cuci)'}</span>
                          </span>

                          {/* Game ID (Primary Customer Identifier) */}
                          <span className="font-bold text-white text-sm font-mono flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-teal-500/40 text-teal-300">
                            <Gamepad2 className="w-3.5 h-3.5 text-teal-400" />
                            <span>ID: {r.gameId}</span>
                          </span>

                          {/* Staff Name Badge - Who Recorded It */}
                          <span className="text-xs font-semibold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-500/40 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                            <span>经手: {r.staffName || '值班员工'}</span>
                          </span>

                          {/* Shift Badge (早班 / 晚班) */}
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 border ${
                            (r.shift || '早班') === '早班'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          }`}>
                            {(r.shift || '早班') === '早班' ? (
                              <Sun className="w-3 h-3 text-amber-400" />
                            ) : (
                              <Moon className="w-3 h-3 text-indigo-400" />
                            )}
                            <span>{r.shift || '早班'}</span>
                          </span>

                          {/* Platform (if filled) */}
                          {r.platform && (
                            <span className="text-xs font-medium text-blue-300 bg-blue-950/70 px-2 py-0.5 rounded border border-blue-800/60">
                              {r.platform}
                            </span>
                          )}

                          {/* WhatsApp Group */}
                          <span className="text-xs text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-emerald-400" />
                            <span>{r.groupName}</span>
                          </span>
                        </div>

                        {/* Metadata line */}
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-indigo-400" />
                            <strong className="text-slate-200">{r.bankName}</strong>
                          </span>
                          <span>·</span>
                          <span className="text-amber-300 font-mono font-medium">
                            {isDep ? `第 ${r.depositCount} 次充值` : `第 ${r.withdrawCount} 次洗分`}
                          </span>
                          <span>·</span>
                          <span className="text-slate-500 font-mono text-[11px]">{r.date} {r.time}</span>
                          <span>·</span>
                          <span className="text-slate-500 text-[11px]">{r.branchName}</span>
                          {r.notes && (
                            <>
                              <span>·</span>
                              <span className="text-slate-400 italic">备注: {r.notes}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Amount & Action (Edit & Delete) */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right mr-1">
                          <span
                            className={`font-mono font-black text-base sm:text-lg ${
                              isDep ? 'text-emerald-300' : 'text-rose-400'
                            }`}
                          >
                            {isDep ? '+' : '-'} {formatCurrency(r.amount)}
                          </span>
                        </div>

                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={() => setEditingRecord({ ...r })}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-amber-950/60 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer touch-manipulation active:scale-95"
                          title="修改此笔记录"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id, r.userName, r.amount, r.type)}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer touch-manipulation active:scale-95"
                          title="删除这笔流水"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <div className="py-10 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    暂无记录，可在上方填写并立即保存
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Edit Record (在软件里面直接改动流水) */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">修改单笔流水记录</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedRecord} className="space-y-3">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord({ ...editingRecord, type: 'deposit' })}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    editingRecord.type === 'deposit'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  进分 (Bank-in)
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRecord({ ...editingRecord, type: 'withdraw' })}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    editingRecord.type === 'withdraw'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  洗分 (Cuci)
                </button>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">金额 (RM) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editingRecord.amount}
                  onChange={(e) => setEditingRecord({ ...editingRecord, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Staff Member & Game ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs text-amber-300 font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>经手员工姓名 (修改记录人) *</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">记录人</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRecord.staffName || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, staffName: e.target.value })}
                    placeholder="例如: 客服小美"
                    className="w-full bg-slate-850 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-bold"
                  />
                  {/* Quick Staff chips in edit modal */}
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {staffMembers.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditingRecord({ ...editingRecord, staffName: s })}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                          editingRecord.staffName === s
                            ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 font-bold'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-teal-300 font-bold flex items-center gap-1">
                    <Gamepad2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>顾客游戏 ID (账号) *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRecord.gameId}
                    onChange={(e) => setEditingRecord({ ...editingRecord, gameId: e.target.value, userName: e.target.value })}
                    className="w-full bg-slate-850 border border-teal-500/50 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              {/* Group & Platform */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">WhatsApp 群名 *</label>
                  <input
                    type="text"
                    required
                    value={editingRecord.groupName}
                    onChange={(e) => setEditingRecord({ ...editingRecord, groupName: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                  {/* Preset quick picks */}
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {groups.slice(0, 3).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setEditingRecord({ ...editingRecord, groupName: g })}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">平台 (选填)</label>
                  <input
                    type="text"
                    value={editingRecord.platform || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, platform: e.target.value })}
                    placeholder="例如: Mega888"
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Bank Name & Branch */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">银行的名字 *</label>
                  <input
                    type="text"
                    required
                    value={editingRecord.bankName}
                    onChange={(e) => setEditingRecord({ ...editingRecord, bankName: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {banks.slice(0, 3).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setEditingRecord({ ...editingRecord, bankName: b })}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                      >
                        {b.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">经办分店 *</label>
                  <select
                    value={editingRecord.branchName}
                    onChange={(e) => setEditingRecord({ ...editingRecord, branchName: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id || b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Counts Adjustment: depositCount & withdrawCount */}
              <div className="grid grid-cols-2 gap-2.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <label className="text-[11px] text-emerald-400 font-medium">充值次数 (第几次)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingRecord.depositCount}
                    onChange={(e) => setEditingRecord({ ...editingRecord, depositCount: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-rose-400 font-medium">洗分次数 (第几次)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingRecord.withdrawCount}
                    onChange={(e) => setEditingRecord({ ...editingRecord, withdrawCount: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">日期</label>
                  <input
                    type="date"
                    value={editingRecord.date}
                    onChange={(e) => setEditingRecord({ ...editingRecord, date: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">时间</label>
                  <input
                    type="time"
                    value={editingRecord.time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, time: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">备注</label>
                <input
                  type="text"
                  value={editingRecord.notes || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                  placeholder="修改备注信息"
                  className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 shadow-md cursor-pointer"
                >
                  {isSavingEdit ? '保存中...' : '确认保存改动'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Comprehensive In-App Customization & Settings (全能自定义 / 加或改任何东西) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl space-y-4 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>系统设置与选项管理</span>
                    <span className="text-[10px] text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      内容均可增删改
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    在软件里直接改动或增加群、银行、门店、快捷金额与顾客信息
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs for Settings */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setSettingsTab('options')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  settingsTab === 'options'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>🏷️ 群/银行/员工/分店</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('amounts')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  settingsTab === 'amounts'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>⚡ 快捷金额 ({quickAmounts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('customers')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  settingsTab === 'customers'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>👥 游戏ID更名 ({uniqueGameIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('danger')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  settingsTab === 'danger'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-rose-400/80 hover:text-rose-300'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>🚀 正式启用准备</span>
              </button>
            </div>

            {/* TAB 1: 选项名单 (群、银行、门店) */}
            {settingsTab === 'options' && (
              <div className="space-y-4 text-xs max-h-[60vh] overflow-y-auto pr-1">
                {/* 1. WhatsApp Groups */}
                <div className="space-y-2 bg-slate-850 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp 群列表 ({groups.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">点击笔图标可改名 · × 可删除</span>
                  </div>

                  <div className="space-y-1.5">
                    {groups.map((g) => {
                      const isRenaming = renamingGroup?.old === g;
                      return (
                        <div
                          key={g}
                          className="flex items-center justify-between bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 rounded-lg"
                        >
                          {isRenaming ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <input
                                type="text"
                                autoFocus
                                value={renamingGroup.val}
                                onChange={(e) => setRenamingGroup({ ...renamingGroup, val: e.target.value })}
                                className="bg-slate-950 border border-emerald-500 rounded px-2 py-0.5 text-xs text-white flex-1 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameGroup(g, renamingGroup.val)}
                                className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                              >
                                保存改名
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingGroup(null)}
                                className="px-1.5 py-0.5 text-slate-400 hover:text-white"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-200 font-medium">{g}</span>
                          )}

                          {!isRenaming && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setRenamingGroup({ old: g, val: g })}
                                className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer rounded hover:bg-slate-800"
                                title="改动此群名"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteGroup(g)}
                                className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer rounded hover:bg-slate-800 text-sm font-bold"
                                title="删除该群"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add new group form */}
                  <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/80">
                    <input
                      type="text"
                      placeholder="输入要添加的新群名，例如: VIP 3群 (豪客)"
                      value={newGroupInput}
                      onChange={(e) => setNewGroupInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddGroup(newGroupInput)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors cursor-pointer"
                    >
                      + 加群
                    </button>
                  </div>
                </div>

                {/* 2. Banks Management */}
                <div className="space-y-2 bg-slate-850 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>银行与电子钱包列表 ({banks.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">点击笔图标可改名 · × 可删除</span>
                  </div>

                  <div className="space-y-1.5">
                    {banks.map((b) => {
                      const isRenaming = renamingBank?.old === b;
                      return (
                        <div
                          key={b}
                          className="flex items-center justify-between bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 rounded-lg"
                        >
                          {isRenaming ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <input
                                type="text"
                                autoFocus
                                value={renamingBank.val}
                                onChange={(e) => setRenamingBank({ ...renamingBank, val: e.target.value })}
                                className="bg-slate-950 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white flex-1 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameBank(b, renamingBank.val)}
                                className="px-2 py-0.5 rounded bg-indigo-500 text-white font-bold text-[11px] cursor-pointer"
                              >
                                保存改名
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingBank(null)}
                                className="px-1.5 py-0.5 text-slate-400 hover:text-white"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-200 font-medium">{b}</span>
                          )}

                          {!isRenaming && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setRenamingBank({ old: b, val: b })}
                                className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer rounded hover:bg-slate-800"
                                title="改动银行名称"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBank(b)}
                                className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer rounded hover:bg-slate-800 text-sm font-bold"
                                title="删除该银行"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add new bank form */}
                  <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/80">
                    <input
                      type="text"
                      placeholder="输入要添加的银行，例如: Alliance Bank、BigPay"
                      value={newBankInput}
                      onChange={(e) => setNewBankInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddBank(newBankInput)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 transition-colors cursor-pointer"
                    >
                      + 加银行
                    </button>
                  </div>
                </div>

                {/* 3. Branches Management */}
                <div className="space-y-2 bg-slate-850 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-emerald-400" />
                      <span>门店分店列表 ({branches.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">支持改名与新增门店</span>
                  </div>

                  <div className="space-y-1.5">
                    {branches.map((b) => {
                      const isRenaming = renamingBranch?.id === b.id;
                      return (
                        <div
                          key={b.id || b.name}
                          className="flex items-center justify-between bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 rounded-lg"
                        >
                          {isRenaming ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <input
                                type="text"
                                autoFocus
                                value={renamingBranch.val}
                                onChange={(e) => setRenamingBranch({ ...renamingBranch, val: e.target.value })}
                                className="bg-slate-950 border border-emerald-500 rounded px-2 py-0.5 text-xs text-white flex-1 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameBranch(b.id, renamingBranch.val)}
                                className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                              >
                                保存改名
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingBranch(null)}
                                className="px-1.5 py-0.5 text-slate-400 hover:text-white"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-200 font-medium">{b.name}</span>
                          )}

                          {!isRenaming && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setRenamingBranch({ id: b.id, old: b.name, val: b.name })}
                                className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer rounded hover:bg-slate-800"
                                title="改动此门店名称"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              {branches.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBranch(b.id, b.name)}
                                  className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer rounded hover:bg-slate-800 text-sm font-bold"
                                  title="删除此分店"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add new branch form */}
                  <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/80">
                    <input
                      type="text"
                      placeholder="输入要添加的分店名称，例如: 怡保分店"
                      value={newBranchInput}
                      onChange={(e) => setNewBranchInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddBranch(newBranchInput)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors cursor-pointer"
                    >
                      + 加门店
                    </button>
                  </div>
                </div>

                {/* Work shift and employee working-hour settings */}
                <div className="space-y-3 bg-slate-850 p-3.5 rounded-xl border border-indigo-500/30">
                  <div>
                    <div className="font-bold text-white">🕒 班次时间与员工上下班时间</div>
                    <p className="text-[10px] text-slate-400 mt-1">这里修改后会保存到服务器，并同步给所有设备。</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(['早班', '晚班'] as const).map((name) => (
                      <div key={name} className="space-y-1.5">
                        <div className="text-xs font-bold text-slate-200">{name}开始 / 结束</div>
                        <label className="block text-[10px] text-slate-400">开始时间</label>
                        <input type="time" value={shiftTimes[name]?.start || '08:00'}
                          onChange={(e) => setShiftTimes((prev) => ({ ...prev, [name]: { ...prev[name], start: e.target.value } }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white" />
                        <label className="block text-[10px] text-slate-400">结束时间</label>
                        <input type="time" value={shiftTimes[name]?.end || '20:00'}
                          onChange={(e) => setShiftTimes((prev) => ({ ...prev, [name]: { ...prev[name], end: e.target.value } }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white" />
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-700 pt-3 space-y-2">
                    <div className="text-xs font-bold text-white">每位员工实际上下班时间</div>
                    {staffMembers.map((name) => {
                      const hours = staffHours[name] || { start: '', end: '' };
                      return (
                        <div key={name} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
                          <span className="text-xs text-slate-200 truncate">{name}</span>
                          <input aria-label={name + '上班时间'} type="time" value={hours.start}
                            onChange={(e) => setStaffHours((prev) => ({ ...prev, [name]: { ...hours, start: e.target.value } }))}
                            className="min-w-0 w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white" />
                          <input aria-label={name + '下班时间'} type="time" value={hours.end}
                            onChange={(e) => setStaffHours((prev) => ({ ...prev, [name]: { ...hours, end: e.target.value } }))}
                            className="min-w-0 w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white" />
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-slate-500">员工时间留空表示暂未设置；员工改名后工时设置会自动沿用旧姓名。</p>
                  </div>
                  <button type="button" onClick={saveWorkHoursSettings} disabled={isSavingWorkHours}
                    className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-3 py-2 text-xs font-bold text-white">
                    {isSavingWorkHours ? '保存中...' : '保存班次及员工工时并同步'}
                  </button>
                </div>

                {/* 4. Staff Members Management */}
                <div className="space-y-2 bg-slate-850 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>经手员工名单列表 ({staffMembers.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">更名后历史账单自动同步</span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    管理店里负责做记录的员工姓名，员工录单时可一键点选自己的名字；如有问题清楚责任人绝不找错人。
                  </p>

                  <div className="space-y-1.5">
                    {staffMembers.map((s) => {
                      const isRenaming = renamingStaff?.old === s;
                      return (
                        <div
                          key={s}
                          className="flex items-center justify-between bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 rounded-lg"
                        >
                          {isRenaming ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <input
                                type="text"
                                autoFocus
                                value={renamingStaff.val}
                                onChange={(e) => setRenamingStaff({ ...renamingStaff, val: e.target.value })}
                                className="bg-slate-950 border border-amber-400 rounded px-2 py-0.5 text-xs text-white flex-1 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameStaff(renamingStaff.old, renamingStaff.val)}
                                className="px-2 py-0.5 bg-amber-400 text-slate-950 font-bold rounded text-[11px]"
                              >
                                保存更名
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingStaff(null)}
                                className="px-1.5 py-0.5 text-slate-400 hover:text-white"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-amber-300 font-bold">👤 {s}</span>
                              {staffName === s && (
                                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/40">
                                  本机当前登录
                                </span>
                              )}
                            </div>
                          )}

                          {!isRenaming && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setRenamingStaff({ old: s, val: s })}
                                className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer rounded hover:bg-slate-800"
                                title="更名员工并同步历史所有账目"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              {staffMembers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaff(s)}
                                  className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer rounded hover:bg-slate-800 text-sm font-bold"
                                  title="删除该员工"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add new staff member form */}
                  <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/80">
                    <input
                      type="text"
                      placeholder="输入要添加的员工姓名，例如: 客服小林、夜班阿豪"
                      value={newStaffInput}
                      onChange={(e) => setNewStaffInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddStaff(newStaffInput)}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition-colors cursor-pointer"
                    >
                      + 加员工
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 快捷金额管理 */}
            {settingsTab === 'amounts' && (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <span>充值与洗分快捷填入金额配置</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        可随时添加平时常用的金额，录入时一键点击自动填入，避免员工手滑敲错
                      </p>
                    </div>
                  </div>

                  {/* Quick amounts chips list */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {quickAmounts.map((amt) => (
                      <span
                        key={amt}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold flex items-center gap-2 shadow-xs"
                      >
                        <span>+RM {amt.toLocaleString()}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveQuickAmount(amt)}
                          className="text-slate-500 hover:text-rose-400 cursor-pointer font-bold"
                          title="删除此快捷金额"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add custom quick amount */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                    <input
                      type="number"
                      step="any"
                      placeholder="输入新快捷金额，例如: 80、2500、10000"
                      value={newAmountInput}
                      onChange={(e) => setNewAmountInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const n = parseFloat(newAmountInput);
                        if (!isNaN(n) && n > 0) handleAddQuickAmount(n);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition-colors cursor-pointer"
                    >
                      + 增加快捷金额
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: 顾客档案与批量改名 */}
            {settingsTab === 'customers' && (
              <div className="space-y-4 text-xs max-h-[60vh] overflow-y-auto pr-1">
                {/* Batch Rename Card */}
                <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                    <Gamepad2 className="w-4 h-4 text-teal-400" />
                    <span>跨历史账目批量修改顾客游戏 ID</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    若顾客游戏ID敲错或需要更名，在此更名后，所有过往的历史充值与洗分记录将一次性全部同步改动！
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">原游戏 ID (或历史记录中的旧识别名)</label>
                      <input
                        type="text"
                        placeholder="例如: mg1234"
                        value={renameGameIdOld}
                        onChange={(e) => {
                          setRenameGameIdOld(e.target.value);
                          setRenameCustomerOld(e.target.value);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-teal-400 font-bold">改动后的正确游戏 ID</label>
                      <input
                        type="text"
                        placeholder="例如: VIP8888"
                        value={renameGameIdNew}
                        onChange={(e) => {
                          setRenameGameIdNew(e.target.value);
                          setRenameCustomerNew(e.target.value);
                        }}
                        className="w-full bg-slate-900 border border-teal-500/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 text-right">
                    <button
                      type="button"
                      disabled={isRenamingCustomer}
                      onClick={handleBatchRenameCustomer}
                      className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all cursor-pointer shadow-sm"
                    >
                      {isRenamingCustomer ? '正在批量更新...' : '一键批量更名所有历史流水'}
                    </button>
                  </div>
                </div>

                {/* Customer Directory List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">活跃顾客游戏 ID 列表 (可点击快速带入更名)</span>
                    <input
                      type="text"
                      placeholder="快速搜索游戏 ID..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="bg-slate-850 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white placeholder-slate-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    {uniqueCustomers
                      .filter((c) => {
                        if (!customerSearch.trim()) return true;
                        const q = customerSearch.toLowerCase();
                        return c.userName.toLowerCase().includes(q) || c.gameId.toLowerCase().includes(q);
                      })
                      .map((c) => (
                        <div
                          key={`${c.userName}-${c.gameId}`}
                          className="bg-slate-850 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-teal-300 font-mono text-sm">
                                🎮 ID: {c.gameId || c.userName}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              流水 {c.count} 笔 · 进分 RM {c.totalDeposit.toLocaleString()} · 洗分 RM {c.totalWithdraw.toLocaleString()}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const targetId = c.gameId || c.userName;
                              setRenameCustomerOld(targetId);
                              setRenameCustomerNew(targetId);
                              setRenameGameIdOld(targetId);
                              setRenameGameIdNew(targetId);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg border border-slate-700 text-[11px] font-medium cursor-pointer"
                          >
                            修改此 ID
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: 正式启用准备 (清空测试数据) */}
            {settingsTab === 'danger' && (
              <div className="space-y-4 text-xs">
                <div className="bg-rose-950/30 border-2 border-rose-500/50 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5 text-rose-300">
                    <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <h4 className="font-bold text-sm text-white">
                      正式投入使用准备 / 初始化账本
                    </h4>
                  </div>

                  <p className="text-slate-300 leading-relaxed">
                    在您测试软件完毕、准备正式给店里或各分店员工使用时，可以点击下方按钮<b>一键清空全部测试流水记录</b>。
                  </p>

                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1.5 text-slate-400">
                    <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>会完整保留的内容:</span>
                    </p>
                    <p className="pl-5 text-[11px]">
                      • 所有您刚刚添加或修改的 <b>WhatsApp 群名称</b><br />
                      • 所有您自定义添加的 <b>银行及电子钱包账户</b><br />
                      • 所有您设置好的 <b>分店与门店列表</b><br />
                      • 所有配置好的 <b>快捷金额 (+50, +100, +2000...)</b>
                    </p>

                    <p className="text-rose-400 font-bold flex items-center gap-1.5 pt-1">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>将被初始化的内容:</span>
                    </p>
                    <p className="pl-5 text-[11px]">
                      • 当前记录的 {records.length} 笔流水明细将重置为 0，供正式营业重新起账。
                    </p>
                  </div>

                  {!showResetConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>清空测试记录，准备正式运营 (当前共 {records.length} 笔)</span>
                    </button>
                  ) : (
                    <div className="bg-slate-950 p-3.5 rounded-xl border-2 border-rose-500 space-y-2 animate-in fade-in">
                      <p className="text-rose-300 font-bold text-center">
                        ⚠️ 确认要清空这 {records.length} 笔测试记录并正式开启正式账本吗？此操作不可逆。
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowResetConfirm(false)}
                          className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                        >
                          点错了，取消
                        </button>
                        <button
                          type="button"
                          disabled={isResetting}
                          onClick={handleClearAllRecords}
                          className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                        >
                          {isResetting ? '正在初始化...' : '确认清空，开启正式使用'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                所有修改立即自动保存并同步至所有手机
              </span>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                完成 / 关闭设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Comprehensive User Guide & Operation Manual (使用说明与员工新手指南) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto">
            {/* Guide Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>系统使用说明与新手操作指南</span>
                    <span className="text-[11px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      人人都会用
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    专为各分店前台、线上客服与财务老板设计 · 3分钟轻松上手
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guide Content: 4 Clear Illustrated Steps */}
            <div className="space-y-4 text-xs max-h-[65vh] overflow-y-auto pr-1">
              
              {/* Step 1: 日常员工录单 */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center font-mono">1</span>
                  <span>第一步：员工日常录单（进分 Bank-in 与 洗分 Cuci）</span>
                </div>
                <div className="space-y-1.5 text-slate-300 pl-8 leading-relaxed">
                  <p>
                    • <b>选类型</b>：顾客充值进账点绿色【<b>进分 (Bank-in)</b>】；顾客提现赢钱点红色【<b>洗分 (Cuci)</b>】。
                  </p>
                  <p>
                    • <b>填金额</b>：输入金额数字，或直接点击【<b>+50</b>】、【<b>+100</b>】、【<b>+500</b>】等快捷标签一键填入，防手滑输错。
                  </p>
                  <p>
                    • <b>经手员工自动记住</b>：
                    <br />
                    - 每台手机或电脑只要选过或输入过自己的名字（如【客服小美】），系统会自动记住，后续记账<b>无需重复打字</b>！
                    <br />
                    - 交接换班时点击上方员工名字即可一键切换；每笔账单都会标明记录人，问责清晰绝不找错人！
                  </p>
                  <p>
                    • <b>填顾客游戏 ID (无需填多余姓名)</b>：
                    <br />
                    - 顾客无需输入真实姓名，直接填入其【<b>游戏 ID (账号)</b>】即可！
                    <br />
                    - 曾来过的老客会自动识别并提示累计充值/洗分次数（自动记为第 2 次充值），无需人工查账！
                  </p>
                  <p>
                    • <b>选群、银行与平台</b>：点击下方群标签（如 VIP 1群）或银行标签（如 Maybank），平台可手填（如 Mega888）。
                  </p>
                  <p>
                    • <b>点击【确认保存】</b>：数据立即保存并<b>实时云端同步</b>到所有员工与老板的手机界面上。
                  </p>
                </div>
              </div>

              {/* Step 2: 财务与老板看总账 */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <span className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center font-mono">2</span>
                  <span>第二步：财务与老板看总账（每天自动核算对账）</span>
                </div>
                <div className="space-y-1.5 text-slate-300 pl-8 leading-relaxed">
                  <p>
                    • <b>进入总账中心</b>：点击顶部【<b>📖 查看总账 (核算)</b>】按钮。
                  </p>
                  <p>
                    • <b>灵活切换周期</b>：支持一键切换【今日总账】、【昨日总账】、【本周总账】、【本月总账】或【自定义日期】。
                  </p>
                  <p>
                    • <b>三大核心总数一眼清</b>：
                    <br />
                    - 🟢 <b>进分总额 (Bank-in)</b>：总共收了多少钱、总充值笔数、平均每笔金额。
                    <br />
                    - 🔴 <b>洗分总额 (Cuci)</b>：总共出了多少款、总洗分笔数、平均每笔洗分。
                    <br />
                    - 💰 <b>净进账总额 (Net)</b>：进分减去洗分，正数代表净赚盈利，负数代表亏损赤字。
                  </p>
                  <p>
                    • <b>银行卡出入流水明细表</b>：清晰列出 Maybank、CIMB、Public Bank 等各张银行卡的充值进账、洗分出款与净差额，拿去对网银一目了然！
                  </p>
                  <p>
                    • <b>群业绩与门店业绩</b>：统计每个 WhatsApp 群进了多少钱、洗了多少钱、有几位老客。
                  </p>
                  <p>
                    • <b>一键发群对账</b>：点击【<b>一键复制发群对账</b>】，系统自动生成排版好的文本，直接粘贴到管理微信/WhatsApp群交更！
                  </p>
                </div>
              </div>

              {/* Step 3: 修改与增减选项 */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center font-mono">3</span>
                  <span>第三步：在软件内随时修改、加东西或删减（自由度100%）</span>
                </div>
                <div className="space-y-1.5 text-slate-300 pl-8 leading-relaxed">
                  <p>
                    • <b>改单笔账目</b>：任何记录写错，点击该流水右侧的【<b>✏️ 修改</b>】图标，金额、名字、次数、银行均可直接改动并重新保存。
                  </p>
                  <p>
                    • <b>加群名、加银行、加门店</b>：点击顶部【<b>选项管理</b>】，在对应位置输入新名字，点击添加即可；点击笔图标还可<b>直接改名</b>，改名后系统会自动把旧记录同步替换成新名字！
                  </p>
                  <p>
                    • <b>加改快捷金额</b>：在【选项管理】的“⚡ 快捷金额”页面，可以任意增加平时常用的快捷金额（如 +80、+2500、+10000）或删掉不用的。
                  </p>
                  <p>
                    • <b>顾客批量更名</b>：顾客改名换ID时，在【选项管理】的“👥 顾客更名”输入旧名与新名，一键更新过往所有历史记录。
                  </p>
                </div>
              </div>

              {/* Step 4: 正式运营与多店同步 */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <span className="w-6 h-6 rounded-lg bg-rose-500/20 flex items-center justify-center font-mono">4</span>
                  <span>第四步：测试完毕，正式投入使用！</span>
                </div>
                <div className="space-y-1.5 text-slate-300 pl-8 leading-relaxed">
                  <p>
                    • <b>初始化测试数据</b>：测试满意后，点击【选项管理】→【<b>🚀 正式启用准备</b>】→【清空测试记录】。
                  </p>
                  <p>
                    • <b>放心清空</b>：清空只会清除测试账目，<b>您自定义添加的所有群、银行、门店和快捷金额都会 100% 完整保留</b>！
                  </p>
                  <p>
                    • <b>多手机/多分店协同</b>：员工在任何手机或电脑打开网页均可直接使用，数据每 3 秒自动刷新同步，无需手动刷新网页。
                  </p>
                </div>
              </div>
            </div>

            {/* Guide Footer */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                员工如有疑问，可随时点击顶部“使用说明”重温操作指南
              </span>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-sm"
              >
                我知道了，开始使用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
