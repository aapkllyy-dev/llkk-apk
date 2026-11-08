import React, { useMemo } from 'react';
import { CustomerRecord } from '../types';
import { formatCurrency } from '../utils';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend 
} from 'recharts';
import { TrendingUp, Flame, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface Props {
  todayRecords: CustomerRecord[];
}

export const TodayTrendChart: React.FC<Props> = ({ todayRecords }) => {
  // Compute distribution across 2-hour intervals for both Deposit (进分) and Withdraw (洗分)
  const { chartData, totalDeposit, totalWithdraw, depositCount, withdrawCount, peakSlot } = useMemo(() => {
    const slots = [
      { time: '08:00', startHour: 8, endHour: 10, depositAmt: 0, depositCount: 0, withdrawAmt: 0, withdrawCount: 0, net: 0 },
      { time: '10:00', startHour: 10, endHour: 12, depositAmt: 0, depositCount: 0, withdrawAmt: 0, withdrawCount: 0, net: 0 },
      { time: '12:00', startHour: 12, endHour: 14, depositAmt: 0, depositCount: 0, withdrawAmt: 0, withdrawCount: 0, net: 0 },
      { time: '14:00', startHour: 14, endHour: 16, depositAmt: 0, depositCount: 0, withdrawAmt: 0, withdrawCount: 0, net: 0 },
      { time: '16:00', startHour: 16, endHour: 18, depositAmt: 0, depositCount: 0, withdrawAmt: 0, withdrawCount: 0, net: 0 },
      { time: '18:00', startHour: 18, endHour: 20, depositAmt: 0, depositCount: 0, withdrawAmt: 0, withdrawCount: 0, net: 0 },
      { time: '20:00', startHour: 20, endHour: 22, depositAmt: 0, depositCount: 0, withdrawAmt: 0, withdrawCount: 0, net: 0 },
      { time: '22:00', startHour: 22, endHour: 24, depositAmt: 0, depositCount: 0, withdrawAmt: 0, withdrawCount: 0, net: 0 },
    ];

    let tDeposit = 0;
    let tWithdraw = 0;
    let dCount = 0;
    let wCount = 0;

    todayRecords.forEach((rec) => {
      const amt = Number(rec.amount) || 0;
      let hour = 12;
      if (rec.time && rec.time.includes(':')) {
        hour = parseInt(rec.time.split(':')[0], 10);
      }
      
      const targetSlot = slots.find((s) => hour >= s.startHour && hour < s.endHour) || slots[slots.length - 1];
      if (targetSlot) {
        if (rec.type === 'deposit') {
          targetSlot.depositAmt += amt;
          targetSlot.depositCount += 1;
          tDeposit += amt;
          dCount += 1;
        } else {
          targetSlot.withdrawAmt += amt;
          targetSlot.withdrawCount += 1;
          tWithdraw += amt;
          wCount += 1;
        }
        targetSlot.net = targetSlot.depositAmt - targetSlot.withdrawAmt;
      }
    });

    let peak = slots[0];
    slots.forEach((s) => {
      if (s.depositAmt + s.withdrawAmt > peak.depositAmt + peak.withdrawAmt) {
        peak = s;
      }
    });

    return {
      chartData: slots,
      totalDeposit: tDeposit,
      totalWithdraw: tWithdraw,
      depositCount: dCount,
      withdrawCount: wCount,
      peakSlot: (peak.depositAmt > 0 || peak.withdrawAmt > 0) ? peak : null,
    };
  }, [todayRecords]);

  const netToday = totalDeposit - totalWithdraw;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>今日进分与洗分时段走势</span>
              <span className="text-[10px] font-normal text-slate-400">
                (进账 vs 出账对比)
              </span>
            </h3>
          </div>
        </div>

        {peakSlot && (
          <div className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/50 border border-amber-800/60 px-2 py-0.5 rounded-full font-mono">
            <Flame className="w-3 h-3 text-amber-400" />
            <span>最活跃时段: {peakSlot.time} (进: RM {peakSlot.depositAmt} / 洗: RM {peakSlot.withdrawAmt})</span>
          </div>
        )}
      </div>

      {/* Chart Legend Summary */}
      <div className="flex items-center gap-4 text-xs font-mono pt-1">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
          <span>进分 Bank-in: RM {totalDeposit.toLocaleString()} ({depositCount}次)</span>
        </div>
        <div className="flex items-center gap-1.5 text-rose-400">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
          <span>洗分 Cuci: RM {totalWithdraw.toLocaleString()} ({withdrawCount}次)</span>
        </div>
      </div>

      {/* Recharts Dual Area Chart */}
      <div className="h-40 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 12, left: -22, bottom: 0 }}
          >
            <defs>
              <linearGradient id="depositGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="withdrawGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-900/95 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs backdrop-blur-md space-y-1">
                      <p className="text-slate-400 font-mono text-[10px]">
                        时段: {data.time} ~ {data.endHour}:00
                      </p>
                      <div className="flex items-center justify-between gap-4 text-emerald-400 font-mono">
                        <span>进分 Bank-in:</span>
                        <span className="font-bold">RM {data.depositAmt.toLocaleString()} ({data.depositCount}笔)</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-rose-400 font-mono">
                        <span>洗分 Cuci:</span>
                        <span className="font-bold">RM {data.withdrawAmt.toLocaleString()} ({data.withdrawCount}笔)</span>
                      </div>
                      <div className="border-t border-slate-800 pt-1 flex items-center justify-between gap-4 text-amber-300 font-mono font-bold">
                        <span>净进账:</span>
                        <span>RM {data.net.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="depositAmt"
              name="进分 Bank-in"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#depositGradient)"
              dot={{ r: 2, fill: '#10b981' }}
            />
            <Area
              type="monotone"
              dataKey="withdrawAmt"
              name="洗分 Cuci"
              stroke="#f43f5e"
              strokeWidth={2}
              fill="url(#withdrawGradient)"
              dot={{ r: 2, fill: '#f43f5e' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80">
        <span>今日总计 {todayRecords.length} 笔流水</span>
        <div className="flex items-center gap-2">
          <span>今日净进账:</span>
          <span className={`font-mono font-black ${netToday >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(netToday)}
          </span>
        </div>
      </div>
    </div>
  );
};
