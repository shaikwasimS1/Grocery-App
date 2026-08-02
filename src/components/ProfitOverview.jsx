import React, { useMemo, useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Statistic, theme, Space, Table, Tag, Button } from 'antd';
import { TrophyOutlined, FireOutlined, RiseOutlined, PrinterOutlined, ShoppingCartOutlined, WalletOutlined, DownloadOutlined } from '@ant-design/icons';
import { isLocalToday, isLocalYesterday, isLocalThisWeek, isLocalThisMonth, isLocalThisYear, getLocalDateKey, formatDate } from '../utils/timestamps';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

const { Title, Text } = Typography;

const MOTIVATIONAL_QUOTES = [
  { quote: "Success is not final, failure is not fatal: It is the courage to continue that counts.", author: "Winston Churchill" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { quote: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { quote: "Your business grows when you do.", author: "" },
  { quote: "Every sale you make is a step closer to your dream.", author: "" },
  { quote: "The harder you work for something, the greater you'll feel when you achieve it.", author: "" },
  { quote: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { quote: "A good shop runs on discipline, love, and hard work.", author: "" },
  { quote: "Revenue is vanity, profit is sanity.", author: "" },
  { quote: "Your income grows only when you grow.", author: "T. Harv Eker" },
  { quote: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { quote: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { quote: "Work hard in silence, let your profit make the noise.", author: "" },
  { quote: "Dream big. Start small. But most of all, start.", author: "Simon Sinek" },
  { quote: "Every day is a new opportunity to sell more and earn more.", author: "" },
  { quote: "The best investment you can make is in yourself.", author: "Warren Buffett" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Push yourself, because no one else is going to do it for you.", author: "" },
  { quote: "Great things never come from comfort zones.", author: "" },
  { quote: "Hustle beats talent when talent doesn't hustle.", author: "" },
  { quote: "One day or day one — you decide.", author: "" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "A little progress each day adds up to big results.", author: "" },
  { quote: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { quote: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Your shop, your rules — make every day profitable.", author: "" },
  { quote: "Today's efforts are tomorrow's rewards.", author: "" },
  { quote: "Turn your wounds into wisdom.", author: "Oprah Winfrey" },
  { quote: "If you can dream it, you can do it.", author: "Walt Disney" },
];

export default function ProfitOverview({ products, sales, wastage }) {
  const { token } = theme.useToken();

  // Live clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's quote — changes every day based on day of year
  const todayQuote = useMemo(() => {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];
  }, []);

  const profits = useMemo(() => {
    let today = 0, yesterday = 0, week = 0, month = 0, year = 0, allTime = 0;
    
    let purchasesToday = 0, purchasesWeek = 0, purchasesMonth = 0, purchasesYear = 0, purchasesAllTime = 0;

    (products || []).forEach(p => {
      const ts = p.created_at;
      const cost = p.unit_type === 'packet' 
        ? ((p.totalPacketsPurchased||0) * (p.costPricePerPacket||0)) 
        : (p.purchasePrice || 0);
      
      purchasesAllTime += cost;
      if (isLocalToday(ts))     purchasesToday += cost;
      if (isLocalThisWeek(ts))  purchasesWeek  += cost;
      if (isLocalThisMonth(ts)) purchasesMonth += cost;
      if (isLocalThisYear(ts))  purchasesYear  += cost;
    });

    (sales || []).forEach(s => {
      const p = s.grossProfit ?? (s.amountReceived - (s.cogs || s.costBasis || 0));
      const ts = s.sold_at || s.date;
      allTime += p;
      if (isLocalToday(ts)) today += p;
      else if (isLocalYesterday(ts)) yesterday += p;
      if (isLocalThisWeek(ts)) week += p;
      if (isLocalThisMonth(ts)) month += p;
      if (isLocalThisYear(ts)) year += p;
    });

    (wastage || []).forEach(w => {
      const loss = w.wastageLoss || 0;
      const ts = w.wasted_at;
      allTime -= loss;
      if (isLocalToday(ts)) today -= loss;
      else if (isLocalYesterday(ts)) yesterday -= loss;
      if (isLocalThisWeek(ts)) week -= loss;
      if (isLocalThisMonth(ts)) month -= loss;
      if (isLocalThisYear(ts)) year -= loss;
    });

    return { 
      today, yesterday, week, month, year, allTime,
      purchasesToday, purchasesWeek, purchasesMonth, purchasesYear, purchasesAllTime
    };
  }, [sales, wastage, products]);

  const dailyReport = useMemo(() => {
    const dailyMap = {};
    
    (sales || []).forEach(s => {
      const ts = s.sold_at || s.date;
      const key = getLocalDateKey(ts);
      if (!dailyMap[key]) dailyMap[key] = { date: key, revenue: 0, profit: 0, wastage: 0, purchases: 0 };
      dailyMap[key].revenue += s.amountReceived || 0;
      dailyMap[key].profit += s.grossProfit ?? (s.amountReceived - (s.cogs || s.costBasis || 0));
    });

    (products || []).forEach(p => {
      const ts = p.created_at;
      if (!ts) return;
      const key = getLocalDateKey(ts);
      const cost = p.unit_type === 'packet' 
        ? ((p.totalPacketsPurchased||0) * (p.costPricePerPacket||0)) 
        : (p.purchasePrice || 0);
      if (!dailyMap[key]) dailyMap[key] = { date: key, revenue: 0, profit: 0, wastage: 0, purchases: 0 };
      dailyMap[key].purchases += cost;
    });

    (wastage || []).forEach(w => {
      const ts = w.wasted_at;
      const key = getLocalDateKey(ts);
      if (!dailyMap[key]) dailyMap[key] = { date: key, revenue: 0, profit: 0, wastage: 0, purchases: 0 };
      dailyMap[key].wastage += w.wastageLoss || 0;
    });

    return Object.values(dailyMap).sort((a, b) => new Date(b.date) - new Date(a.date)).map(d => ({
      ...d,
      netProfit: d.profit - d.wastage
    }));
  }, [sales, wastage]);

  const columns = [
    { title: 'Date', dataIndex: 'date', render: v => <Text strong>{formatDate(v)}</Text> },
    { title: 'Purchases (Investments)', dataIndex: 'purchases', render: v => `₹${(v || 0).toFixed(2)}` },
    { title: 'Total Revenue', dataIndex: 'revenue', render: v => `₹${v.toFixed(2)}` },
    { title: 'Gross Profit', dataIndex: 'profit', render: v => `₹${v.toFixed(2)}` },
    { title: 'Wastage Loss', dataIndex: 'wastage', render: v => <Text type="danger">−₹{v.toFixed(2)}</Text> },
    { title: 'Net Profit', dataIndex: 'netProfit', render: v => <Tag color={v >= 0 ? 'green' : 'red'} style={{ fontSize: 14 }}>₹{v.toFixed(2)}</Tag> },
  ];

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', bufferPages: true });
    const BRAND = [79, 70, 229];
    const MUTED = [107, 114, 128];
    const pageW  = doc.internal.pageSize.getWidth();
    const genTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // ── Header banner ──────────────────────────────────────────
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, 36, 'F');
    doc.setTextColor(255, 255, 255).setFontSize(18).setFont(undefined, 'bold');
    doc.text('FreshTrack', 14, 14);
    doc.setFontSize(9).setFont(undefined, 'normal');
    doc.setTextColor(200, 200, 255);
    doc.text('Day-by-Day Profit Report', 14, 24);
    doc.text(`Generated: ${genTime}`, pageW - 14, 24, { align: 'right' });

    // ── Summary line ───────────────────────────────────────────
    let y = 46;
    doc.setTextColor(50, 50, 50).setFontSize(10).setFont(undefined, 'bold');
    doc.text(
      `All Time Net Profit: Rs ${profits.allTime.toFixed(2)}   |   This Month: Rs ${profits.month.toFixed(2)}   |   Today: Rs ${profits.today.toFixed(2)}`,
      14, y
    );
    y += 12;

    // ── Section heading ────────────────────────────────────────
    doc.setFillColor(232, 233, 255);
    doc.rect(14, y, pageW - 28, 14, 'F');
    doc.setFillColor(...BRAND);
    doc.rect(14, y + 3, 5, 8, 'F');
    doc.setTextColor(...BRAND).setFontSize(10).setFont(undefined, 'bold');
    doc.text('Daily Profit Breakdown', 22, y + 10);
    y += 18;

    // ── Table ─────────────────────────────────────────────────
    const headers   = ['Date', 'Purchases (Cost)', 'Revenue', 'Gross Profit', 'Wastage Loss', 'Net Profit'];
    const colWidths = [44, 44, 40, 40, 40, 44];
    const startX    = 14;
    const rowH      = 9;

    doc.setFillColor(...BRAND);
    doc.setTextColor(255, 255, 255).setFontSize(8.5).setFont(undefined, 'bold');
    let x = startX;
    headers.forEach((h, i) => {
      doc.rect(x, y, colWidths[i], rowH, 'F');
      doc.text(h, x + 2, y + 6);
      x += colWidths[i];
    });
    y += rowH;

    doc.setFont(undefined, 'normal');
    dailyReport.forEach((r, idx) => {
      if (y > 185) { doc.addPage(); y = 20; }

      const bg = idx % 2 === 0 ? [255, 255, 255] : [248, 248, 255];
      doc.setFillColor(...bg);
      x = startX;
      colWidths.forEach(w => { doc.rect(x, y, w, rowH, 'F'); x += w; });

      const row = [
        formatDate(r.date),
        `Rs ${(r.purchases || 0).toFixed(2)}`,
        `Rs ${r.revenue.toFixed(2)}`,
        `Rs ${r.profit.toFixed(2)}`,
        `Rs ${r.wastage.toFixed(2)}`,
        `Rs ${r.netProfit.toFixed(2)}`,
      ];

      x = startX;
      row.forEach((cell, i) => {
        let color = [50, 50, 50];
        let bold  = false;
        if (i === 5) { color = r.netProfit >= 0 ? [5, 150, 105] : [192, 57, 43]; bold = true; }
        if (i === 4) { color = [192, 57, 43]; }
        doc.setTextColor(...color).setFont(undefined, bold ? 'bold' : 'normal');
        doc.text(cell, x + 2, y + 6);
        x += colWidths[i];
      });

      doc.setDrawColor(210, 210, 230);
      x = startX;
      colWidths.forEach(w => { doc.rect(x, y, w, rowH); x += w; });
      y += rowH;
    });

    // ── Page numbers ───────────────────────────────────────────
    const range = doc.internal.getNumberOfPages();
    for (let i = 1; i <= range; i++) {
      doc.setPage(i);
      doc.setTextColor(...MUTED).setFontSize(8).setFont(undefined, 'normal');
      doc.text('Generated by FreshTrack POS', 14, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Page ${i} of ${range}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`FreshTrack_DailyProfit_${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}.pdf`);
  };

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    const exportData = dailyReport.map(r => ({
      'Date': formatDate(r.date),
      'Purchases (₹)': (r.purchases || 0).toFixed(2),
      'Total Revenue (₹)': r.revenue.toFixed(2),
      'Gross Profit (₹)': r.profit.toFixed(2),
      'Wastage Loss (₹)': r.wastage.toFixed(2),
      'Net Profit (₹)': r.netProfit.toFixed(2)
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), 'Daily Report');
    XLSX.writeFile(wb, 'FreshTrack_Daily_Profit_Report.xlsx');
  };

  return (
    <div>
      {/* Page Title */}
      <div style={{ marginBottom: 8 }}>
        <Title level={2} style={{ margin: 0 }}>💰 Profit Overview</Title>
        <Text type="secondary">Track your daily earnings and growth.</Text>
      </div>

      {/* Daily Motivational Quote */}
      <div style={{ marginBottom: 24, padding: '14px 18px', background: `linear-gradient(135deg, ${token.colorPrimaryBg}, ${token.colorInfoBg})`, borderRadius: 10, borderLeft: `4px solid ${token.colorPrimary}` }}>
        <Text style={{ fontSize: 15, fontStyle: 'italic', color: token.colorTextBase }}>
          "{todayQuote.quote}"
        </Text>
        {todayQuote.author ? (
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            — {todayQuote.author}
          </Text>
        ) : null}
      </div>

      <Row gutter={[16, 16]}>
        {/* Today vs Yesterday Comparison */}
        <Col xs={24} md={12}>
          <Card 
            style={{ 
              height: '100%',
              background: token.colorWarningBg, 
              border: `1px solid ${token.colorWarningBorder}` 
            }}
          >
            <Statistic 
              title={<Text strong style={{ fontSize: 16 }}>Today's Net Profit</Text>} 
              value={profits.today} 
              precision={2} prefix="₹" 
              valueStyle={{ fontSize: 32, color: token.colorWarningText, fontWeight: 700 }} 
            />
            <div style={{ marginTop: 16 }}>
              {profits.today > profits.yesterday ? (
                <Space>
                  <TrophyOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                  <Text strong style={{ color: '#52c41a', fontSize: 15 }}>
                    🎉 Great job! You earned more today than yesterday!
                  </Text>
                </Space>
              ) : (
                <Space>
                  <FireOutlined style={{ color: '#fa541c', fontSize: 20 }} />
                  <Text strong style={{ color: '#fa541c', fontSize: 15 }}>
                    🚀 Keep going! Earn more than yesterday's ₹{profits.yesterday.toFixed(2)}!
                  </Text>
                </Space>
              )}
              <br />
              <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                {profits.today > profits.yesterday 
                  ? `You beat yesterday by ₹${(profits.today - profits.yesterday).toFixed(2)}` 
                  : `Aim to beat yesterday's ₹${profits.yesterday.toFixed(2)}`}
              </Text>
            </div>
          </Card>
        </Col>

        {/* Other periods */}
        <Col xs={24} md={12}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ background: token.colorFillAlter }}>
                <Statistic
                  title={<span>Yesterday's Profit <span style={{ fontSize: 10, color: token.colorTextSecondary }}>📅 vs today</span></span>}
                  value={profits.yesterday} precision={2} prefix="₹" />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ background: token.colorFillAlter }}>
                <Statistic
                  title={<span>This Week <span style={{ fontSize: 10, color: token.colorTextSecondary }}>📆 last 7 days</span></span>}
                  value={profits.week} precision={2} prefix="₹"
                  valueStyle={{ color: token.colorSuccessText }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ background: token.colorFillAlter }}>
                <Statistic
                  title={<span>This Month <span style={{ fontSize: 10, color: token.colorTextSecondary }}>🗓️ current month</span></span>}
                  value={profits.month} precision={2} prefix="₹"
                  valueStyle={{ color: token.colorSuccessText }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ background: token.colorFillAlter }}>
                <Statistic
                  title={<span>This Year <span style={{ fontSize: 10, color: token.colorTextSecondary }}>📊 current year</span></span>}
                  value={profits.year} precision={2} prefix="₹"
                  valueStyle={{ color: token.colorSuccessText }}
                />
              </Card>
            </Col>
            <Col xs={24}>
              <Card size="small" style={{ background: 'linear-gradient(90deg, #1d39c4 0%, #0958d9 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>All Time Profit 🏆 Total earned ever</span>}
                  value={profits.allTime}
                  precision={2} prefix="₹"
                  valueStyle={{ color: '#fff', fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* Profit vs Purchases Comparison */}
      <div style={{ marginTop: 32 }}>
        <Title level={4}>⚖️ Profit vs Purchases Comparison</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Compare how much you spent on new stock versus how much net profit you made.
        </Text>
        <Row gutter={[16, 16]}>
          {[
            { label: 'Today',      emoji: '☀️', desc: 'Spent vs earned today',      profit: profits.today,      purchase: profits.purchasesToday },
            { label: 'This Week',  emoji: '📆', desc: 'Spent vs earned this week',  profit: profits.week,       purchase: profits.purchasesWeek  },
            { label: 'This Month', emoji: '🗓️', desc: 'Spent vs earned this month', profit: profits.month,      purchase: profits.purchasesMonth },
            { label: 'This Year',  emoji: '📊', desc: 'Spent vs earned this year',  profit: profits.year,       purchase: profits.purchasesYear  },
          ].map(item => (
            <Col xs={24} md={6} key={item.label}>
              <Card size="small" style={{ border: `1px solid ${token.colorBorder}` }}>
                <Text strong style={{ fontSize: 15 }}>{item.emoji} {item.label}</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 8 }}>{item.desc}</Text>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>🛒 Purchases</Text>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>₹{item.purchase.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>💰 Net Profit</Text>
                    <div style={{ fontSize: 16, fontWeight: 500, color: item.profit >= 0 ? token.colorSuccessText : token.colorErrorText }}>
                      ₹{item.profit.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: '8px', background: item.profit > item.purchase ? token.colorSuccessBg : token.colorWarningBg, borderRadius: 6, textAlign: 'center' }}>
                  <Text style={{ fontSize: 12, color: item.profit > item.purchase ? token.colorSuccessText : token.colorWarningText }}>
                    {item.profit > item.purchase 
                      ? `Profits exceed purchases by ₹${(item.profit - item.purchase).toFixed(2)}` 
                      : `You spent ₹${(item.purchase - item.profit).toFixed(2)} more than you made in profit`}
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* Daily Report Log */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>📅 Day-by-Day Report Log</Title>
            <Text type="secondary">
              A breakdown of your revenue and profit for every single day.
            </Text>
          </div>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={downloadExcel}>
              Export Excel
            </Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={downloadPDF}>
              Print / Save PDF
            </Button>
          </Space>
        </div>
        <Table 
          columns={columns} 
          dataSource={dailyReport} 
          rowKey="date" 
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  );
}
