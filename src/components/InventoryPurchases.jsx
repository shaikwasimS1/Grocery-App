import React, { useMemo, useState } from 'react';
import { Typography, Card, Row, Col, Statistic, theme, Table, Space, Tag, Button, Input } from 'antd';
import { ShoppingOutlined, InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import { isLocalToday, isLocalThisMonth, isLocalThisYear, formatDate } from '../utils/timestamps';
import jsPDF from 'jspdf';
import SearchBar from './SearchBar';

const { Title, Text } = Typography;

export default function InventoryPurchases({ products }) {
  const { token } = theme.useToken();
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = useMemo(() => {
    let totalSpent = 0;
    let todaySpent = 0;
    let monthSpent = 0;
    let yearSpent = 0;
    let currentStockValue = 0;

    const items = (products || []).map(p => {
      const isPacket = p.unit_type === 'packet';
      const spent = isPacket 
        ? ((p.costPricePerPacket || 0) * (p.totalPacketsPurchased || 0)) 
        : (p.purchasePrice || 0);
      
      const currentVal = isPacket 
        ? ((p.costPricePerPacket || 0) * (p.remainingPackets || 0)) 
        : ((p.currentStockGrams || 0) * (p.costPerGram || 0));

      const qtyStr = isPacket
        ? `${p.totalPacketsPurchased || 0} pkts`
        : p.purchaseQuantity >= 1000 
            ? `${(p.purchaseQuantity / 1000).toFixed(2)}kg` 
            : `${p.purchaseQuantity || 0}${p.purchaseUnit || 'g'}`;
            
      const remQtyStr = isPacket
        ? `${p.remainingPackets || 0} pkts`
        : p.currentStockGrams >= 1000 
            ? `${(p.currentStockGrams / 1000).toFixed(2)}kg` 
            : `${p.currentStockGrams || 0}g`;

      totalSpent += spent;
      currentStockValue += currentVal;

      const dateStr = p.created_at || p.updated_at;
      if (dateStr) {
        if (isLocalToday(dateStr)) todaySpent += spent;
        if (isLocalThisMonth(dateStr)) monthSpent += spent;
        if (isLocalThisYear(dateStr)) yearSpent += spent;
      }

      return {
        key: p.id,
        name: p.name,
        unit_type: p.unit_type,
        spent,
        currentVal,
        qtyStr,
        remQtyStr,
        date: dateStr,
      };
    });

    return { totalSpent, todaySpent, monthSpent, yearSpent, currentStockValue, items };
  }, [products]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return metrics.items;
    const q = searchQuery.toLowerCase();
    return metrics.items.filter(item =>
      item.name?.toLowerCase().includes(q)
    );
  }, [metrics.items, searchQuery]);

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(185, 28, 28);
    doc.text('FreshTrack - Inventory Purchases Report', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 26);

    // Summary section
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(`Total Spent: Rs ${metrics.totalSpent.toFixed(2)}   |   Current Stock Value: Rs ${metrics.currentStockValue.toFixed(2)}`, 14, 34);

    // Table setup
    const headers = ['Item Name', 'Type', 'Date Added', 'Purchased Qty', 'Total Spent', 'Remaining', 'Stock Value'];
    const colWidths = [45, 22, 35, 30, 32, 28, 32];
    const startX = 14;
    let y = 44;
    const rowH = 9;

    // Draw header row
    doc.setFillColor(185, 28, 28);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    let x = startX;
    headers.forEach((h, i) => {
      doc.rect(x, y, colWidths[i], rowH, 'F');
      doc.text(h, x + 2, y + 6);
      x += colWidths[i];
    });
    y += rowH;

    // Draw data rows
    doc.setFont(undefined, 'normal');
    metrics.items.forEach((item, idx) => {
      const row = [
        item.name,
        item.unit_type === 'packet' ? 'Packet' : 'Weight',
        item.date ? formatDate(item.date) : '-',
        item.qtyStr,
        `Rs ${item.spent.toFixed(2)}`,
        item.remQtyStr,
        `Rs ${item.currentVal.toFixed(2)}`,
      ];

      // Alternate row background
      if (idx % 2 === 0) {
        doc.setFillColor(255, 242, 242);
        x = startX;
        colWidths.forEach(w => { doc.rect(x, y, w, rowH, 'F'); x += w; });
      }

      x = startX;
      row.forEach((cell, i) => {
        if (i === 4) {
          doc.setTextColor(185, 28, 28);
          doc.setFont(undefined, 'bold');
        } else if (i === 6) {
          doc.setTextColor(5, 150, 105);
          doc.setFont(undefined, 'bold');
        } else {
          doc.setTextColor(50, 50, 50);
          doc.setFont(undefined, 'normal');
        }
        doc.text(String(cell), x + 2, y + 6);
        x += colWidths[i];
      });

      // Row border
      doc.setDrawColor(220, 220, 220);
      x = startX;
      colWidths.forEach(w => { doc.rect(x, y, w, rowH); x += w; });

      y += rowH;
      if (y > 195) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`InventoryPurchases_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const columns = [
    {
      title: 'Item Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 14 }}>{text}</Text>
          <Tag color={record.unit_type === 'packet' ? 'blue' : 'green'} style={{ fontSize: 10, marginTop: 4 }}>
            {record.unit_type === 'packet' ? '📦 Packet' : '⚖️ Weight'}
          </Tag>
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Date Added/Updated',
      dataIndex: 'date',
      key: 'date',
      render: (date) => date ? formatDate(date) : '-',
      sorter: (a, b) => new Date(a.date || 0) - new Date(b.date || 0),
    },
    {
      title: 'Purchased Qty',
      dataIndex: 'qtyStr',
      key: 'qtyStr',
    },
    {
      title: 'Total Spent',
      dataIndex: 'spent',
      key: 'spent',
      render: (val) => <Text strong style={{ color: token.colorErrorText }}>₹{val.toFixed(2)}</Text>,
      sorter: (a, b) => a.spent - b.spent,
    },
    {
      title: 'Remaining Stock',
      dataIndex: 'remQtyStr',
      key: 'remQtyStr',
    },
    {
      title: 'Current Stock Value',
      dataIndex: 'currentVal',
      key: 'currentVal',
      render: (val) => <Text type="success" strong>₹{val.toFixed(2)}</Text>,
      sorter: (a, b) => a.currentVal - b.currentVal,
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShoppingOutlined style={{ fontSize: 28, color: token.colorPrimary }} />
          <Title level={2} style={{ margin: 0 }}>Inventory Purchases</Title>
        </div>
        <Space wrap>
          <SearchBar placeholder="Search by item name..." onSearch={setSearchQuery} />
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={downloadPDF}
            style={{ background: 'linear-gradient(135deg, #b91c1c, #ef4444)', border: 'none', fontWeight: 600 }}
          >
            Download PDF
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={6}>
          <Card size="small" style={{ background: token.colorFillAlter }}>
            <Statistic 
              title="Today's Purchases" 
              value={metrics.todaySpent} 
              precision={2} 
              prefix="₹" 
              valueStyle={{ color: token.colorErrorText }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card size="small" style={{ background: token.colorFillAlter }}>
            <Statistic 
              title="This Month" 
              value={metrics.monthSpent} 
              precision={2} 
              prefix="₹" 
              valueStyle={{ color: token.colorErrorText }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card size="small" style={{ background: token.colorFillAlter }}>
            <Statistic 
              title="This Year" 
              value={metrics.yearSpent} 
              precision={2} 
              prefix="₹" 
              valueStyle={{ color: token.colorErrorText }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card size="small" style={{ background: 'linear-gradient(90deg, #b91c1c 0%, #ef4444 100%)', border: 'none' }}>
            <Statistic 
              title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>All Time Spent</span>} 
              value={metrics.totalSpent} 
              precision={2} 
              prefix="₹" 
              valueStyle={{ color: '#fff', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)', border: 'none' }}>
        <Row align="middle" gutter={24}>
          <Col>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: '50%' }}>
              <InboxOutlined style={{ fontSize: 32, color: '#fff' }} />
            </div>
          </Col>
          <Col>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Total Value of Current Stock</Text>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', marginTop: 4 }}>
              ₹{metrics.currentStockValue.toFixed(2)}
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>
              If you sold everything at cost price right now.
            </Text>
          </Col>
        </Row>
      </Card>

      <Card title="Purchase Details" variant="borderless">
        <Table 
          columns={columns}
          dataSource={filteredItems}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
}
