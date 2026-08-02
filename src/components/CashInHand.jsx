import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Card, Row, Col, Statistic, theme,
  InputNumber, Button, Table, Tag, Space, Empty
} from 'antd';
import {
  WalletOutlined, PlusOutlined, ArrowUpOutlined,
  ArrowDownOutlined, DeleteOutlined, CheckCircleOutlined, DownloadOutlined
} from '@ant-design/icons';
import { isLocalToday, isLocalThisWeek, isLocalThisMonth, isLocalThisYear } from '../utils/timestamps';
import jsPDF from 'jspdf';

const { Title, Text } = Typography;

const STORAGE_KEY = 'freshtrack_cash_entries';

export default function CashInHand({ sales }) {
  const { token } = theme.useToken();

  // Load saved entries from localStorage
  const [entries, setEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  });

  const [amount, setAmount] = useState(null);
  const [note, setNote] = useState('');

  // Persist to localStorage whenever entries change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  // Total earnings from actual sales
  const totalEarnings = useMemo(() => {
    let today = 0, week = 0, month = 0, year = 0, allTime = 0;
    (sales || []).forEach(s => {
      const amt = s.amountReceived || 0;
      const ts = s.sold_at || s.date;
      allTime += amt;
      if (isLocalToday(ts))     today += amt;
      if (isLocalThisWeek(ts))  week  += amt;
      if (isLocalThisMonth(ts)) month += amt;
      if (isLocalThisYear(ts))  year  += amt;
    });
    return { today, week, month, year, allTime };
  }, [sales]);

  // Total saved cash per period
  const totalSaved = useMemo(() => {
    let today = 0, week = 0, month = 0, year = 0, allTime = 0;
    entries.forEach(e => {
      const ts = e.date;
      allTime += e.amount;
      if (isLocalToday(ts))     today += e.amount;
      if (isLocalThisWeek(ts))  week  += e.amount;
      if (isLocalThisMonth(ts)) month += e.amount;
      if (isLocalThisYear(ts))  year  += e.amount;
    });
    return { today, week, month, year, allTime };
  }, [entries]);

  const saveEntry = () => {
    if (!amount || amount <= 0) return;
    const newEntry = {
      id: Date.now(),
      amount,
      note: note.trim() || 'Cash saved',
      date: new Date().toISOString(),
    };
    setEntries(prev => [newEntry, ...prev]);
    setAmount(null);
    setNote('');
  };

  const deleteEntry = (id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', bufferPages: true });
    const BRAND  = [79, 70, 229];
    const MUTED  = [107, 114, 128];
    const GREEN  = [5, 150, 105];
    const RED    = [192, 57, 43];
    const pageW  = doc.internal.pageSize.getWidth();
    const genTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // ── Header banner ──────────────────────────────────────────
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, 36, 'F');
    doc.setTextColor(255, 255, 255).setFontSize(18).setFont(undefined, 'bold');
    doc.text('FreshTrack', 14, 14);
    doc.setFontSize(9).setFont(undefined, 'normal');
    doc.setTextColor(200, 200, 255);
    doc.text('Cash in Hand Report', 14, 24);
    doc.text(`Generated: ${genTime}`, pageW - 14, 24, { align: 'right' });

    // ── Summary line ───────────────────────────────────────────
    let y = 46;
    doc.setTextColor(50, 50, 50).setFontSize(10).setFont(undefined, 'bold');
    doc.text(
      `Today's Revenue: Rs ${totalEarnings.today.toFixed(2)}   |   Cash Saved Today: Rs ${totalSaved.today.toFixed(2)}   |   All Time Revenue: Rs ${totalEarnings.allTime.toFixed(2)}`,
      14, y
    );
    y += 14;

    // ── Section heading: Period Comparison ─────────────────────
    doc.setFillColor(232, 233, 255);
    doc.rect(14, y, pageW - 28, 14, 'F');
    doc.setFillColor(...BRAND);
    doc.rect(14, y + 3, 5, 8, 'F');
    doc.setTextColor(...BRAND).setFontSize(10).setFont(undefined, 'bold');
    doc.text('Period Comparison', 22, y + 10);
    y += 18;

    const periods = [
      { label: 'Today',      earned: totalEarnings.today,   saved: totalSaved.today   },
      { label: 'This Week',  earned: totalEarnings.week,    saved: totalSaved.week    },
      { label: 'This Month', earned: totalEarnings.month,   saved: totalSaved.month   },
      { label: 'This Year',  earned: totalEarnings.year,    saved: totalSaved.year    },
      { label: 'All Time',   earned: totalEarnings.allTime, saved: totalSaved.allTime },
    ];

    const compHeaders = ['Period', 'Total Earned (Revenue)', 'Cash Saved', 'Difference'];
    const compWidths  = [44, 68, 60, 56];
    const startX = 14;
    const rowH   = 9;
    let x;

    doc.setFillColor(...BRAND);
    doc.setTextColor(255, 255, 255).setFontSize(8.5).setFont(undefined, 'bold');
    x = startX;
    compHeaders.forEach((h, i) => {
      doc.rect(x, y, compWidths[i], rowH, 'F');
      doc.text(h, x + 2, y + 6);
      x += compWidths[i];
    });
    y += rowH;

    doc.setFont(undefined, 'normal');
    periods.forEach((p, idx) => {
      const diff = p.saved - p.earned;
      const bg = idx % 2 === 0 ? [255, 255, 255] : [248, 248, 255];
      doc.setFillColor(...bg);
      x = startX;
      compWidths.forEach(w => { doc.rect(x, y, w, rowH, 'F'); x += w; });

      const row = [
        p.label,
        `Rs ${p.earned.toFixed(2)}`,
        `Rs ${p.saved.toFixed(2)}`,
        diff >= 0 ? `+Rs ${diff.toFixed(2)}` : `-Rs ${Math.abs(diff).toFixed(2)}`,
      ];

      x = startX;
      row.forEach((cell, i) => {
        const color = i === 3 ? (diff >= 0 ? GREEN : RED) : [50, 50, 50];
        doc.setTextColor(...color).setFont(undefined, i === 3 ? 'bold' : 'normal');
        doc.text(cell, x + 2, y + 6);
        x += compWidths[i];
      });
      doc.setDrawColor(210, 210, 230);
      x = startX;
      compWidths.forEach(w => { doc.rect(x, y, w, rowH); x += w; });
      y += rowH;
    });

    // ── Section heading: Cash Save History ────────────────────
    if (entries.length > 0) {
      y += 10;
      doc.setFillColor(232, 233, 255);
      doc.rect(14, y, pageW - 28, 14, 'F');
      doc.setFillColor(...BRAND);
      doc.rect(14, y + 3, 5, 8, 'F');
      doc.setTextColor(...BRAND).setFontSize(10).setFont(undefined, 'bold');
      doc.text('Cash Save History', 22, y + 10);
      y += 18;

      const histHeaders = ['Date & Time', 'Note', 'Amount Saved'];
      const histWidths  = [90, 110, 56];

      doc.setFillColor(...BRAND);
      doc.setTextColor(255, 255, 255).setFontSize(8.5).setFont(undefined, 'bold');
      x = startX;
      histHeaders.forEach((h, i) => {
        doc.rect(x, y, histWidths[i], rowH, 'F');
        doc.text(h, x + 2, y + 6);
        x += histWidths[i];
      });
      y += rowH;

      doc.setFont(undefined, 'normal');
      entries.forEach((e, idx) => {
        if (y > 185) { doc.addPage(); y = 20; }
        const bg = idx % 2 === 0 ? [255, 255, 255] : [248, 248, 255];
        doc.setFillColor(...bg);
        x = startX;
        histWidths.forEach(w => { doc.rect(x, y, w, rowH, 'F'); x += w; });

        const row = [
          new Date(e.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          e.note,
          `Rs ${e.amount.toFixed(2)}`,
        ];
        x = startX;
        row.forEach((cell, i) => {
          doc.setTextColor(...(i === 2 ? GREEN : [50, 50, 50]));
          doc.setFont(undefined, i === 2 ? 'bold' : 'normal');
          doc.text(String(cell), x + 2, y + 6);
          x += histWidths[i];
        });
        doc.setDrawColor(210, 210, 230);
        x = startX;
        histWidths.forEach(w => { doc.rect(x, y, w, rowH); x += w; });
        y += rowH;
      });
    }

    // ── Page numbers ───────────────────────────────────────────
    const range = doc.internal.getNumberOfPages();
    for (let i = 1; i <= range; i++) {
      doc.setPage(i);
      doc.setTextColor(...MUTED).setFontSize(8).setFont(undefined, 'normal');
      doc.text('Generated by FreshTrack POS', 14, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Page ${i} of ${range}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`FreshTrack_CashInHand_${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}.pdf`);
  };


  const todayDiff = totalEarnings.today - totalSaved.today;

  const columns = [
    {
      title: 'Date & Time',
      dataIndex: 'date',
      key: 'date',
      render: (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    },
    {
      title: 'Note',
      dataIndex: 'note',
      key: 'note',
      render: (t) => <Text>{t}</Text>,
    },
    {
      title: 'Amount Saved',
      dataIndex: 'amount',
      key: 'amount',
      render: (v) => <Text strong style={{ color: token.colorSuccessText, fontSize: 15 }}>₹{v.toFixed(2)}</Text>,
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => deleteEntry(record.id)}
        />
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <WalletOutlined style={{ fontSize: 28, color: token.colorPrimary }} />
          <Title level={2} style={{ margin: 0 }}>Cash in Hand</Title>
        </div>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={downloadPDF}
          style={{ background: 'linear-gradient(135deg, #4f46e5, #818cf8)', border: 'none', fontWeight: 600 }}
        >
          Download PDF
        </Button>
      </div>

      {/* Today's status banner */}
      <Card
        style={{
          marginBottom: 24,
          background: todayDiff <= 0
            ? 'linear-gradient(135deg, #064e3b 0%, #059669 100%)'
            : 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)',
          border: 'none',
          borderRadius: 16,
        }}
        variant="borderless"
      >
        <Row align="middle" gutter={[24, 16]}>
          <Col xs={24} md={8}>
            <Space>
              <WalletOutlined style={{ fontSize: 36, color: '#fbbf24' }} />
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Today's Revenue (Auto)</Text>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                  ₹{totalEarnings.today.toFixed(2)}
                </div>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <div>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Today's Cash Saved</Text>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#6ee7b7' }}>
                ₹{totalSaved.today.toFixed(2)}
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                {todayDiff > 0 ? '⚠️ Still Unaccounted' : '✅ All Accounted / Over'}
              </Text>
              <div style={{ fontSize: 28, fontWeight: 700, color: todayDiff > 0 ? '#fca5a5' : '#6ee7b7' }}>
                {todayDiff > 0 ? `-₹${todayDiff.toFixed(2)}` : `+₹${Math.abs(todayDiff).toFixed(2)}`}
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Add Entry */}
      <Card style={{ marginBottom: 24 }} title={<span><PlusOutlined /> Save Today's Cash Amount</span>}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={10}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Amount (₹) <span style={{ color: token.colorTextSecondary, fontWeight: 400, fontSize: 12 }}>— How much cash you have right now</span></Text>
            <InputNumber
              size="large"
              prefix="₹"
              placeholder="e.g. 1500"
              value={amount}
              onChange={setAmount}
              style={{ width: '100%' }}
              min={0}
            />
          </Col>
          <Col xs={24} sm={10}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Note <span style={{ color: token.colorTextSecondary, fontWeight: 400, fontSize: 12 }}>— Optional label</span></Text>
            <InputNumber
              size="large"
              placeholder="e.g. Evening count"
              value={note}
              onChange={setNote}
              style={{ width: '100%', display: 'none' }}
            />
            <input
              type="text"
              placeholder="e.g. Evening count"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{
                width: '100%', height: 40, borderRadius: 8,
                border: `1px solid ${token.colorBorder}`,
                padding: '0 12px', fontSize: 14,
                background: token.colorBgContainer,
                color: token.colorText,
              }}
            />
          </Col>
          <Col xs={24} sm={4}>
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              onClick={saveEntry}
              disabled={!amount || amount <= 0}
              style={{ width: '100%' }}
            >
              Save
            </Button>
          </Col>
        </Row>
      </Card>


      {/* History Table */}
      <Card title="💾 Cash Save History" variant="borderless">
        {entries.length === 0
          ? <Empty description="No cash entries yet. Add your first entry above!" />
          : <Table columns={columns} dataSource={entries} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
        }
      </Card>
    </div>
  );
}
