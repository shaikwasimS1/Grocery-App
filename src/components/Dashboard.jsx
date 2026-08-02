import React, { useState, useMemo } from 'react';
import {
  Typography, Card, Row, Col, Statistic, Button, Table,
  Select, Space, Alert, List, Tabs, Tag, theme, InputNumber, Spin, Tooltip
} from 'antd';
import { DownloadOutlined, WarningOutlined, FilePdfOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, Legend, ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import axios from 'axios';
import {
  formatTimestamp, formatDate, getLocalDateKey,
  isLocalToday, isLocalYesterday, isLocalThisWeek, isLocalThisMonth, isLocalThisYear
} from '../utils/timestamps';
import { computeItemPnL } from '../utils/costing';
import { FilterOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

export default function Dashboard({ sales, products, wastage = [] }) {
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [cashInHand, setCashInHand] = useState(null);
  const { token } = theme.useToken();

  // PDF report state
  const todayStr = new Date().toISOString().split('T')[0];
  const [pdfFrom, setPdfFrom] = useState(todayStr);
  const [pdfTo, setPdfTo] = useState(todayStr);
  const [pdfLoading, setPdfLoading] = useState(false);

  const downloadPdf = async () => {
    if (!pdfFrom || !pdfTo) return;
    try {
      setPdfLoading(true);
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const url = `${apiBase.replace(/\/api$/, '')}/api/reports/full-pdf?from=${pdfFrom}&to=${pdfTo}`;
      const response = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `FreshTrack_Report_${pdfFrom}_to_${pdfTo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('PDF download failed:', err);
      alert('Failed to generate PDF. Make sure the server is running.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Low stock alerts — uses per-product threshold, with smart defaults
  const lowStockProducts = useMemo(() =>
    (products || []).filter(p => {
      if (p.unit_type === 'packet') {
        const threshold = p.low_stock_threshold ?? 3;
        return (p.remainingPackets ?? 0) <= threshold;
      } else {
        const threshold = p.low_stock_threshold ?? 500; // grams
        return (p.currentStockGrams ?? 0) <= threshold;
      }
    }),
    [products]
  );
  // Filtered sales for sales table and P&L
  const filteredSales = useMemo(() => {
    if (filterPeriod === 'today')  return sales.filter(s => isLocalToday(s.sold_at || s.date));
    if (filterPeriod === 'yesterday') return sales.filter(s => isLocalYesterday(s.sold_at || s.date));
    if (filterPeriod === 'week')   return sales.filter(s => isLocalThisWeek(s.sold_at || s.date));
    if (filterPeriod === 'month')  return sales.filter(s => isLocalThisMonth(s.sold_at || s.date));
    if (filterPeriod === 'year')   return sales.filter(s => isLocalThisYear(s.sold_at || s.date));
    return sales;
  }, [sales, filterPeriod]);

  // Filtered wastage for P&L
  const filteredWastage = useMemo(() => {
    if (filterPeriod === 'today')  return wastage.filter(w => isLocalToday(w.wasted_at));
    if (filterPeriod === 'yesterday') return wastage.filter(w => isLocalYesterday(w.wasted_at));
    if (filterPeriod === 'week')   return wastage.filter(w => isLocalThisWeek(w.wasted_at));
    if (filterPeriod === 'month')  return wastage.filter(w => isLocalThisMonth(w.wasted_at));
    if (filterPeriod === 'year')   return wastage.filter(w => isLocalThisYear(w.wasted_at));
    return wastage;
  }, [wastage, filterPeriod]);

  // Summary cards (Dynamic based on filterPeriod)
  const summaries = useMemo(() => {
    let revenue = 0, profit = 0, wastageLoss = 0;
    let purchases = 0;
    
    filteredSales.forEach(s => {
      revenue += s.amountReceived || 0;
      profit += s.grossProfit ?? (s.amountReceived - (s.cogs || s.costBasis || 0));
    });

    filteredWastage.forEach(w => {
      wastageLoss += (w.wastageLoss || 0);
    });

    (products || []).forEach(p => {
      const ts = p.created_at;
      const cost = p.unit_type === 'packet' 
        ? ((p.totalPacketsPurchased||0) * (p.costPricePerPacket||0)) 
        : (p.purchasePrice || 0);
      
      let include = false;
      if (filterPeriod === 'today') include = isLocalToday(ts);
      else if (filterPeriod === 'yesterday') include = isLocalYesterday(ts);
      else if (filterPeriod === 'week') include = isLocalThisWeek(ts);
      else if (filterPeriod === 'month') include = isLocalThisMonth(ts);
      else if (filterPeriod === 'year') include = isLocalThisYear(ts);
      else include = true;

      if (include) purchases += cost;
    });

    return { 
      revenue, 
      profit, 
      wastageLoss, 
      netResult: profit - wastageLoss,
      purchases
    };
  }, [filteredSales, filteredWastage, products, filterPeriod]);

  const filterLabel = filterPeriod === 'today' ? "Today's" : 
                      filterPeriod === 'yesterday' ? "Yesterday's" :
                      filterPeriod === 'week' ? "This Week's" :
                      filterPeriod === 'month' ? "This Month's" : 
                      filterPeriod === 'year' ? "This Year's" : "All Time";

  // Global Revenue Snapshot
  const revenueSnapshot = useMemo(() => {
    let today = 0, week = 0, month = 0, year = 0, allTime = 0;
    sales.forEach(s => {
      const amt = s.amountReceived || 0;
      const ts = s.sold_at || s.date;
      allTime += amt;
      if (isLocalToday(ts)) today += amt;
      if (isLocalThisWeek(ts)) week += amt;
      if (isLocalThisMonth(ts)) month += amt;
      if (isLocalThisYear(ts)) year += amt;
    });
    return { today, week, month, year, allTime };
  }, [sales]);

  // Purchase (Investment) Snapshot
  const purchaseSnapshot = useMemo(() => {
    let today = 0, week = 0, month = 0, year = 0, allTime = 0;
    (products || []).forEach(p => {
      const ts = p.created_at || p.updated_at;
      const cost = p.unit_type === 'packet'
        ? ((p.totalPacketsPurchased || 0) * (p.costPricePerPacket || 0))
        : (p.purchasePrice || 0);
      allTime += cost;
      if (ts) {
        if (isLocalToday(ts))      today += cost;
        if (isLocalThisWeek(ts))   week  += cost;
        if (isLocalThisMonth(ts))  month += cost;
        if (isLocalThisYear(ts))   year  += cost;
      }
    });
    return { today, week, month, year, allTime };
  }, [products]);

  const quickProfits = useMemo(() => {
    let today = 0, yesterday = 0;
    sales.forEach(s => {
      const p = s.grossProfit ?? (s.amountReceived - (s.cogs || s.costBasis || 0));
      const ts = s.sold_at || s.date;
      if (isLocalToday(ts)) today += p;
      else if (isLocalYesterday(ts)) yesterday += p;
    });
    wastage.forEach(w => {
      const loss = w.wastageLoss || 0;
      const ts = w.wasted_at;
      if (isLocalToday(ts)) today -= loss;
      else if (isLocalYesterday(ts)) yesterday -= loss;
    });
    return { today, yesterday };
  }, [sales, wastage]);

  // Chart data — last 7 days (profit vs wastage)
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d.toISOString());
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
      let profit = 0, revenue = 0, wastageLoss = 0;
      sales.forEach(s => {
        if (getLocalDateKey(s.sold_at || s.date) === key) {
          profit += s.grossProfit ?? (s.amountReceived - (s.cogs || s.costBasis || 0));
          revenue += s.amountReceived;
        }
      });
      wastage.forEach(w => {
        if (getLocalDateKey(w.wasted_at) === key) wastageLoss += (w.wastageLoss || 0);
      });
      data.push({ date: label, Revenue: revenue, Profit: profit, Wastage: wastageLoss });
    }
    return data;
  }, [sales, wastage]);


  // Per-item P&L report
  const itemPnL = useMemo(() => {
    return (products || []).map(product => {
      const productSales   = filteredSales.filter(s => s.productId === product.id);
      const productWastage = filteredWastage.filter(w => w.productId === product.id);
      return computeItemPnL(product, productSales, productWastage);
    });
  }, [products, filteredSales, filteredWastage]);

  // Export to Excel — combines sales report + per-item P&L sheet
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sales sheet
    const salesData = filteredSales.map(s => ({
      'Sale Date':           formatDate(s.sold_at || s.date),
      'Sale Time':           formatTimestamp(s.sold_at || s.date),
      'sold_at (UTC)':       s.sold_at || s.date,
      'Product':             s.productName,
      'Grams Sold':          s.gramsSold,
      'Revenue (₹)':         s.amountReceived,
      'Purchase Price (₹)':            (s.cogs || s.costBasis || 0).toFixed(2),
      'Gross Profit (₹)':    (s.grossProfit ?? (s.amountReceived - (s.cogs || s.costBasis || 0))).toFixed(2),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), 'Sales');

    // Wastage sheet
    const wastageData = wastage.map(w => ({
      'Write-off Date': formatDate(w.wasted_at),
      'wasted_at (UTC)': w.wasted_at,
      'Product':          w.productName,
      'Grams Wasted':     w.gramsWasted,
      'Loss at Cost (₹)': w.wastageLoss?.toFixed(2),
      'Reason':           w.reason || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wastageData), 'Wastage');

    // Per-item P&L sheet
    const pnlData = itemPnL.map(r => ({
      'Product':              r.productName,
      'Purchased (kg)':       r.purchasedKg,
      'Purchase Cost (₹)':    r.purchasePrice,
      'Sold (kg)':            r.soldKg,
      'Revenue (₹)':          r.revenue.toFixed(2),
      'Purchase Price (₹)':             r.cogs.toFixed(2),
      'Gross Profit (₹)':     r.grossProfit.toFixed(2),
      'Wasted (kg)':          r.wastedKg,
      'Wastage Loss (₹)':     r.wastageLoss.toFixed(2),
      'Net Profit (₹)':       r.netResult.toFixed(2),
      'Remaining Stock (kg)': r.remainingStockKg,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pnlData), 'Per-Item P&L');

    XLSX.writeFile(wb, `FreshTrack_Report_${filterPeriod}_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  const salesColumns = [
    { title: 'Date & Time', key: 'sold_at', sorter: (a, b) => new Date(a.sold_at || a.date) - new Date(b.sold_at || b.date), render: (_, r) => formatTimestamp(r.sold_at || r.date) },
    { title: 'Product', dataIndex: 'productName', sorter: (a, b) => a.productName.localeCompare(b.productName) },
    { title: 'Qty', key: 'qty', sorter: (a, b) => (a.gramsSold || 0) - (b.gramsSold || 0), render: (_, r) => r.gramsSold >= 1000 ? `${(r.gramsSold / 1000).toFixed(2)}kg` : `${r.gramsSold}g` },
    { title: 'Revenue', dataIndex: 'amountReceived', sorter: (a, b) => (a.amountReceived || 0) - (b.amountReceived || 0), render: v => `₹${v?.toFixed(2)}` },
    { title: 'Purchase Price', key: 'cogs', sorter: (a, b) => (a.cogs || a.costBasis || 0) - (b.cogs || b.costBasis || 0), render: (_, r) => `₹${(r.cogs || r.costBasis || 0).toFixed(2)}` },
    { title: 'Gross Profit', key: 'gp', sorter: (a, b) => {
        const p1 = a.grossProfit ?? (a.amountReceived - (a.cogs || a.costBasis || 0));
        const p2 = b.grossProfit ?? (b.amountReceived - (b.cogs || b.costBasis || 0));
        return p1 - p2;
      }, render: (_, r) => {
      const p = r.grossProfit ?? (r.amountReceived - (r.cogs || r.costBasis || 0));
      return <Text type={p >= 0 ? 'success' : 'danger'} strong>₹{p.toFixed(2)}</Text>;
    }}
  ];

  const pnlColumns = [
    { title: 'Product', dataIndex: 'productName', sorter: (a, b) => a.productName.localeCompare(b.productName), render: (t, r) => (
      <span>
        <Text strong>{t}</Text><br />
        <Tag color={r.unit_type === 'packet' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
          {r.unit_type === 'packet' ? '📦 Packet' : '⚖️ Weight'}
        </Tag>
      </span>
    )},
    { title: 'Purchased', key: 'purch', sorter: (a, b) => a.purchasePrice - b.purchasePrice, render: (_, r) => `${r.purchaseLabel} · ₹${(r.purchasePrice||0).toFixed(2)}` },
    { title: 'Sold', key: 'sold', sorter: (a, b) => a.revenue - b.revenue, render: (_, r) => <Text type="success">{r.soldLabel} · ₹{r.revenue.toFixed(2)}</Text> },
    { title: 'Purchase Price', key: 'cogs', sorter: (a, b) => a.cogs - b.cogs, render: (_, r) => `₹${r.cogs.toFixed(2)}` },
    { title: 'Gross Profit', key: 'gp', sorter: (a, b) => a.grossProfit - b.grossProfit, render: (_, r) => (
      <Text type={r.grossProfit >= 0 ? 'success' : 'danger'}>₹{r.grossProfit.toFixed(2)}</Text>
    )},
    {
      title: 'Wasted',
      key: 'wasted',
      sorter: (a, b) => a.wastageLoss - b.wastageLoss,
      render: (_, r) => r.wastageLoss > 0
        ? <Text type="danger">−₹{r.wastageLoss.toFixed(2)} ({r.wastedLabel})</Text>
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Net Profit',
      key: 'net',
      sorter: (a, b) => a.netResult - b.netResult,
      render: (_, r) => (
        <Tag color={r.netResult >= 0 ? 'green' : 'red'} style={{ fontWeight: 700, fontSize: 13 }}>
          ₹{r.netResult.toFixed(2)}
        </Tag>
      )
    },
    { title: 'Stock Left', key: 'stock', render: (_, r) => r.stockLabel },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Reports Dashboard</Title>
          <Text type="secondary">Profit, wastage, and net result per item — all in one place.</Text>
        </div>
      <Space wrap>
        <FilterOutlined style={{ color: '#888' }} />
        <Select value={filterPeriod} onChange={setFilterPeriod} style={{ width: 140 }}>
          <Option value="today">Today</Option>
          <Option value="yesterday">Yesterday</Option>
          <Option value="week">This Week</Option>
          <Option value="month">This Month</Option>
          <Option value="year">This Year</Option>
          <Option value="all">All Time</Option>
        </Select>
      </Space>
    </div>

    {/* PDF Download Strip */}
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      background: 'linear-gradient(135deg, #ede9fe, #f5f3ff)',
      border: '1.5px solid #c4b5fd', borderRadius: 12,
      padding: '14px 20px', marginBottom: 20
    }}>
      <FilePdfOutlined style={{ color: '#7c3aed', fontSize: 20 }} />
      <Text strong style={{ color: '#5b21b6', marginRight: 8 }}>📄 Download Full Report (PDF)</Text>
      <Space wrap>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>From:</Text>
          <input
            type="date" value={pdfFrom}
            onChange={e => setPdfFrom(e.target.value)}
            max={pdfTo}
            style={{ padding: '5px 10px', border: '1px solid #c4b5fd', borderRadius: 8, fontSize: 13, background: '#fff' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>To:</Text>
          <input
            type="date" value={pdfTo}
            onChange={e => setPdfTo(e.target.value)}
            min={pdfFrom}
            style={{ padding: '5px 10px', border: '1px solid #c4b5fd', borderRadius: 8, fontSize: 13, background: '#fff' }}
          />
        </div>
        <Button
          type="primary"
          icon={pdfLoading ? <Spin size="small" /> : <FilePdfOutlined />}
          onClick={downloadPdf}
          disabled={pdfLoading || !pdfFrom || !pdfTo}
          style={{ background: '#7c3aed', borderColor: '#7c3aed', fontWeight: 600 }}
        >
          {pdfLoading ? 'Generating…' : 'Download PDF'}
        </Button>
      </Space>
    </div>

      {lowStockProducts.length > 0 && (
        <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, #fff7ed, #fef3c7)', border: '1.5px solid #fbbf24', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <WarningOutlined style={{ color: '#d97706', fontSize: 18 }} />
            <Text strong style={{ fontSize: 15, color: '#92400e' }}>⚠️ Low Stock Alert — {lowStockProducts.length} item{lowStockProducts.length > 1 ? 's' : ''} need restocking</Text>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lowStockProducts.map(p => {
              const isPacket = p.unit_type === 'packet';
              const stockText = isPacket
                ? `${p.remainingPackets ?? 0} pkts`
                : (p.currentStockGrams ?? 0) >= 1000
                  ? `${((p.currentStockGrams ?? 0) / 1000).toFixed(2)} kg`
                  : `${p.currentStockGrams ?? 0} g`;
              return (
                <Tag
                  key={p.id}
                  color="red"
                  style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, fontWeight: 600 }}
                >
                  {p.name}: {stockText} left ⚠
                </Tag>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Stock Overview Panel */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ fontSize: 13, color: '#555' }}>📦 Current Stock Overview</Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {(products || []).map(p => {
            let stockText = '';
            let isLow = false;
            if (p.unit_type === 'packet') {
              const qty = p.remainingPackets ?? 0;
              isLow = qty < 3;
              stockText = `${qty} pkt`;
            } else {
              const g = p.currentStockGrams || 0;
              isLow = g < 500;
              stockText = g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
            }
            return (
              <Tag
                key={p.id}
                color={isLow ? 'red' : 'green'}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8 }}
              >
                <strong>{p.name}</strong>: {stockText}{isLow ? ' ⚠' : ''}
              </Tag>
            );
          })}
        </div>
      </div>

      {/* All Time Revenue Snapshot */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ fontSize: 13, color: '#555' }}>📈 Revenue Snapshot</Text>
        <Row gutter={[12, 12]} style={{ marginTop: 8 }}>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" variant="borderless" style={{ background: token.colorFillAlter }}>
              <Statistic title="Today" value={revenueSnapshot.today} precision={2} prefix="₹" valueStyle={{ fontSize: 16 }} />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" variant="borderless" style={{ background: token.colorFillAlter }}>
              <Statistic title="This Week" value={revenueSnapshot.week} precision={2} prefix="₹" valueStyle={{ fontSize: 16 }} />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" variant="borderless" style={{ background: token.colorFillAlter }}>
              <Statistic title="This Month" value={revenueSnapshot.month} precision={2} prefix="₹" valueStyle={{ fontSize: 16 }} />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Card size="small" variant="borderless" style={{ background: token.colorFillAlter }}>
              <Statistic title="This Year" value={revenueSnapshot.year} precision={2} prefix="₹" valueStyle={{ fontSize: 16 }} />
            </Card>
          </Col>
          <Col xs={24} sm={8} md={7}>
            <Card size="small" variant="borderless" style={{ background: 'linear-gradient(90deg, #1d39c4 0%, #0958d9 100%)' }}>
              <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>All Time Revenue</span>} value={revenueSnapshot.allTime} precision={2} prefix="₹" valueStyle={{ fontSize: 18, color: '#fff', fontWeight: 700 }} />
            </Card>
          </Col>
        </Row>
      </div>


      {/* End of Day Summary cards */}
      <Title level={4}>{filterLabel} Summary</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Performance metrics for the selected time period.
      </Text>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ background: token.colorSuccessBg, border: `1px solid ${token.colorSuccessBorder}` }}>
            <Statistic 
              title={`${filterLabel} Revenue`} 
              value={summaries.revenue} 
              precision={2} prefix="₹" 
              valueStyle={{ color: token.colorSuccessText }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ background: token.colorInfoBg, border: `1px solid ${token.colorInfoBorder}` }}>
            <Statistic 
              title={`${filterLabel} Gross Profit`} 
              value={summaries.profit} 
              precision={2} prefix="₹" 
              valueStyle={{ color: token.colorInfoText }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ background: token.colorErrorBg, border: `1px solid ${token.colorErrorBorder}` }}>
            <Statistic 
              title={`${filterLabel} Wastage Loss`} 
              value={summaries.wastageLoss} 
              precision={2} prefix="−₹" 
              valueStyle={{ color: token.colorErrorText }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ 
            background: summaries.netResult >= 0 ? token.colorWarningBg : token.colorErrorBg, 
            border: `1px solid ${summaries.netResult >= 0 ? token.colorWarningBorder : token.colorErrorBorder}` 
          }}>
            <Statistic
              title={`${filterLabel} Profit`}
              value={summaries.netResult}
              precision={2} prefix="₹"
              valueStyle={{ color: summaries.netResult >= 0 ? token.colorWarningText : token.colorErrorText, fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Purchases / Investments Summary cards */}
      <Title level={4}>Inventory Purchases (Investments)</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Amount of money spent on buying new stock during this period.
      </Text>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card variant="borderless" style={{ background: token.colorFillAlter, border: `1px solid ${token.colorBorder}` }}>
            <Statistic 
              title={`Purchased ${filterLabel.replace("'s", "")}`} 
              value={summaries.purchases} 
              precision={2} prefix="₹" 
            />
          </Card>
        </Col>
      </Row>

      {/* Chart */}
      <Card title="7-Day Trend: Revenue vs Profit vs Wastage" variant="borderless" style={{ marginBottom: 24 }}>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis />
              <RechartTooltip formatter={v => `₹${v.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Revenue" fill="#8884d8" radius={[4,4,0,0]} />
              <Bar dataKey="Profit"  fill="#82ca9d" radius={[4,4,0,0]} />
              <Bar dataKey="Wastage" fill="#ff7875" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tabbed tables */}
      <Card variant="borderless" extra={
        <Space>
          <Select value={filterPeriod} onChange={setFilterPeriod} style={{ width: 140 }}>
            <Option value="today">Today</Option>
            <Option value="week">This Week</Option>
            <Option value="month">This Month</Option>
            <Option value="year">This Year</Option>
            <Option value="all">All Time</Option>
          </Select>
          <Button type="primary" icon={<DownloadOutlined />} onClick={exportToExcel}>
            Export Excel (3 sheets)
          </Button>
        </Space>
      }>
        <Tabs
          items={[
            {
              key: 'pnl',
              label: '📊 Per-Item P&L Report',
              children: (
                <Table
                  columns={pnlColumns}
                  dataSource={itemPnL}
                  rowKey="productId"
                  pagination={false}
                  scroll={{ x: 900 }}
                  summary={data => {
                    const totalNet = data.reduce((acc, r) => acc + r.netResult, 0);
                    return (
                      <Table.Summary.Row>
                        <Table.Summary.Cell colSpan={6} index={0}><Text strong>Total Net Profit</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={6}>
                          <Tag color={totalNet >= 0 ? 'green' : 'red'} style={{ fontWeight: 700, fontSize: 14 }}>
                            ₹{totalNet.toFixed(2)}
                          </Tag>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={7} />
                      </Table.Summary.Row>
                    );
                  }}
                />
              )
            },
            {
              key: 'sales',
              label: '🧾 Sales Log',
              children: (
                <Table columns={salesColumns} dataSource={filteredSales} rowKey="id" pagination={{ pageSize: 6 }} scroll={{ x: 'max-content' }} />
              )
            },
          ]}
        />
      </Card>
    </div>
  );
}
