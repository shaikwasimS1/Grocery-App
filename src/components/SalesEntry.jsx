import React, { useState, useMemo } from 'react';
import {
  Table, Button, Modal, Form, InputNumber, Select,
  Typography, Space, Tag, message, Radio, Alert, Checkbox, Tabs
} from 'antd';
import { PlusOutlined, PrinterOutlined, ClockCircleOutlined, FilterOutlined } from '@ant-design/icons';
import { formatDate, formatTime, isLocalToday, isLocalYesterday, isLocalThisWeek, isLocalThisMonth } from '../utils/timestamps';
import { recordSale } from '../api';
import SearchBar from './SearchBar';

const { Title, Text } = Typography;
const { Option } = Select;

export default function SalesEntry({ products, setProducts, sales, setSales, wastage, setWastage, reloadData }) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [entryMode, setEntryMode] = useState('leftover');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const todayTotal = useMemo(() => {
    return sales
      .filter(s => isLocalToday(s.sold_at || s.date))
      .reduce((sum, s) => sum + (s.amountReceived || 0), 0);
  }, [sales]);

  const todayItemSummary = useMemo(() => {
    const summary = {};
    sales.filter(s => isLocalToday(s.sold_at || s.date)).forEach(s => {
      if (!summary[s.productId]) {
        summary[s.productId] = {
          productName: s.productName,
          unit_type: s.unit_type,
          totalGramsSold: 0,
          totalRevenue: 0,
        };
      }
      summary[s.productId].totalGramsSold += s.gramsSold || 0;
      summary[s.productId].totalRevenue += s.amountReceived || 0;
    });
    return Object.values(summary).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const d = s.sold_at || s.date;
      if (dateFilter === 'today') return isLocalToday(d);
      if (dateFilter === 'yesterday') return isLocalYesterday(d);
      if (dateFilter === 'week') return isLocalThisWeek(d);
      if (dateFilter === 'month') return isLocalThisMonth(d);
      return true; // 'all'
    });
  }, [sales, dateFilter]);

  const searchedSales = useMemo(() => {
    if (!searchQuery) return filteredSales;
    const q = searchQuery.toLowerCase();
    return filteredSales.filter(s =>
      s.productName?.toLowerCase().includes(q) ||
      (s.id && String(s.id).toLowerCase().includes(q))
    );
  }, [filteredSales, searchQuery]);

  const showModal = () => {
    setIsModalVisible(true);
    form.setFieldsValue({ weightUnit: 'kg', leftoverUnit: 'kg' });
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setSelectedProduct(null);
    setEntryMode('leftover');
  };

  // Revenue from grams (weight items)
  const revenueFromGrams = (product, grams) => {
    if (!product || !grams) return 0;
    return (grams / product.marginSlabGrams) * product.sellingPricePerSlab;
  };

  const handleProductChange = (productId) => {
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product);
    form.setFieldsValue({ amountReceived: 0, weightQty: undefined, leftoverQty: undefined, packetQty: undefined });

    if (product?.unit_type === 'packet') {
      setEntryMode('weight'); // packet mode uses "weight" tab for "qty sold" logic
    }
  };

  const calcFromLeftover = (product, qty, unit) => {
    if (!product || qty === undefined || qty === null) return;
    const leftoverGrams = unit === 'kg' ? qty * 1000 : qty;
    const soldGrams = Math.max(0, (product.currentStockGrams || 0) - leftoverGrams);
    form.setFieldsValue({ amountReceived: revenueFromGrams(product, soldGrams) });
  };

  const handleModeChange = (e) => {
    setEntryMode(e.target.value);
    form.setFieldsValue({ amountReceived: 0 });
  };

  const handleSave = async (values) => {
    const product = products.find(p => p.id === values.productId);
    if (!product) { message.error('Product not found'); return; }

    const isPacket = product.unit_type === 'packet';

    let qtySold = 0;
    if (isPacket) {
      qtySold = Math.round(values.packetQty || 0);
      if (qtySold <= 0) { message.warning('Enter number of packets sold.'); return; }
      if (qtySold > (product.remainingPackets || 0)) {
        message.warning(`Only ${product.remainingPackets} packets left!`); return;
      }
    } else {
      let gramsSold = 0;
      if (entryMode === 'weight') {
        gramsSold = values.weightUnit === 'kg' ? values.weightQty * 1000 : values.weightQty;
      } else {
        const leftoverGrams = values.leftoverUnit === 'kg' ? values.leftoverQty * 1000 : values.leftoverQty;
        gramsSold = Math.max(0, (product.currentStockGrams || 0) - leftoverGrams);
      }
      if (gramsSold <= 0 || isNaN(gramsSold)) {
        message.warning('Calculated sold quantity is 0 or invalid.'); return;
      }
      if (gramsSold > (product.currentStockGrams || 0)) {
        message.warning(`Stock too low! Available: ${product.currentStockGrams}g.`);
      }
      qtySold = gramsSold;
    }

    try {
      const payload = {
        item_id: product.id,
        qty_sold: qtySold,
        total_amount: values.amountReceived,
        auto_waste: !isPacket && entryMode === 'leftover', // Automatically waste the rest in Leftover mode
        transaction_date: values.transactionDate,
      };

      await recordSale(payload);
      message.success('Sale recorded successfully!');
      if (!isPacket && entryMode === 'leftover' && (product.currentStockGrams || 0) - qtySold > 0) {
        message.info('Auto-wastage recorded for remaining stock.');
      }
      
      await reloadData(false);
      setIsModalVisible(false);
      form.resetFields();
      setSelectedProduct(null);
      setEntryMode('leftover');
    } catch (error) {
      console.error('Error recording sale:', error);
      message.error(error.response?.data || 'Failed to record sale');
    }
  };

  const printReceipt = (record) => {
    const printWindow = window.open('', '_blank');
    const isPacket = record.unit_type === 'packet';
    const qtyStr = isPacket
      ? `${record.gramsSold} packet${record.gramsSold !== 1 ? 's' : ''}`
      : (record.gramsSold >= 1000
        ? `${(record.gramsSold / 1000).toFixed(2)} kg`
        : `${record.gramsSold} g`);

    const receiptId = record.id ? record.id.toString().substring(0, 8).toUpperCase() : 'N/A';

    printWindow.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body{font-family:monospace;padding:20px;width:300px;margin:0 auto}
        h2{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px}
        .row{display:flex;justify-content:space-between;margin-bottom:5px}
        .total{font-weight:bold;border-top:1px dashed #000;padding-top:10px;margin-top:10px;font-size:1.2em}
        .footer{text-align:center;margin-top:20px;font-size:0.8em}
        .ts{font-size:0.75em;color:#555;text-align:center;margin-bottom:8px}
      </style>
      </head><body>
      <h2>FreshTrack Shop</h2>
      <div class="ts">${formatDate(record.sold_at)} · ${formatTime(record.sold_at)}</div>
      <div class="ts">Receipt #: ${receiptId}</div><br/>
      <div class="row"><span>Item:</span><span>${record.productName}</span></div>
      <div class="row"><span>Qty:</span><span>${qtyStr}</span></div>
      <div class="row total"><span>Total:</span><span>Rs. ${record.amountReceived?.toFixed(2) || '0.00'}</span></div>
      <div class="footer">Thank you!</div>
      <script>
        window.onload = function() { window.print(); }
        window.onafterprint = function() { window.close(); }
      </script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const columns = [
    {
      title: 'Sale Date & Time',
      key: 'sold_at',
      sorter: (a, b) => new Date(a.sold_at || a.date) - new Date(b.sold_at || b.date),
      render: (_, r) => (
        <div style={{ lineHeight: 1.3 }}>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{formatDate(r.sold_at)}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{formatTime(r.sold_at)}</Text>
        </div>
      )
    },
    {
      title: 'Product',
      key: 'product',
      render: (_, r) => (
        <div>
          <Text strong>{r.productName}</Text>
          <br />
          <Tag color={r.unit_type === 'packet' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
            {r.unit_type === 'packet' ? '📦 Packet' : '⚖️ Weight'}
          </Tag>
        </div>
      )
    },
    {
      title: 'Qty Sold',
      key: 'qty',
      render: (_, r) => r.unit_type === 'packet'
        ? `${r.gramsSold} pkt`
        : (r.gramsSold >= 1000 ? `${(r.gramsSold / 1000).toFixed(2)} kg` : `${r.gramsSold} g`)
    },
    { title: 'Revenue', dataIndex: 'amountReceived', render: v => <Tag color="green">₹{v?.toFixed(2)}</Tag> },
    { title: 'Purchase Price', key: 'cogs', render: (_, r) => <Text type="secondary">₹{(r.cogs || 0).toFixed(2)}</Text> },
    {
      title: 'Gross Profit',
      key: 'profit',
      sorter: (a, b) => (a.grossProfit ?? (a.amountReceived - (a.cogs || 0))) - (b.grossProfit ?? (b.amountReceived - (b.cogs || 0))),
      render: (_, r) => {
        const profit = r.grossProfit ?? (r.amountReceived - (r.cogs || 0));
        return <Text type={profit >= 0 ? 'success' : 'danger'} strong>₹{profit.toFixed(2)}</Text>;
      }
    },
    {
      title: 'Stock Left',
      key: 'stockLeft',
      render: (_, r) => {
        const prod = products.find(p => p.id === r.productId);
        if (!prod) return <Text type="secondary">—</Text>;
        if (prod.unit_type === 'packet') {
          const qty = prod.remainingPackets ?? 0;
          const isLow = qty < 3;
          return (
            <Text type={isLow ? 'danger' : undefined} strong>
              {qty} pkt{isLow && <span style={{ display: 'block', fontSize: 10 }}>⚠ Low</span>}
            </Text>
          );
        }
        const grams = prod.currentStockGrams || 0;
        const isLow = grams < 500;
        return (
          <Text type={isLow ? 'danger' : undefined} strong>
            {grams >= 1000 ? `${(grams/1000).toFixed(2)} kg` : `${grams} g`}
            {isLow && <span style={{ display: 'block', fontSize: 10 }}>⚠ Low</span>}
          </Text>
        );

      }
    },
    {
      title: '',
      key: 'action',
      render: (_, r) => (
        <Button size="small" icon={<PrinterOutlined />} onClick={() => printReceipt(r)}>Print</Button>
      )
    }
  ];

  const itemSummaryColumns = [
    {
      title: 'Product',
      key: 'product',
      render: (_, r) => (
        <div>
          <Text strong>{r.productName}</Text>
          <br />
          <Tag color={r.unit_type === 'packet' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
            {r.unit_type === 'packet' ? '📦 Packet' : '⚖️ Weight'}
          </Tag>
        </div>
      )
    },
    {
      title: 'Total Qty Sold Today',
      key: 'qty',
      render: (_, r) => r.unit_type === 'packet'
        ? <Text strong>{r.totalGramsSold} pkt</Text>
        : <Text strong>{r.totalGramsSold >= 1000 ? `${(r.totalGramsSold / 1000).toFixed(2)} kg` : `${r.totalGramsSold} g`}</Text>
    },
    { 
      title: 'Revenue Today', 
      dataIndex: 'totalRevenue', 
      render: v => <Tag color="green" style={{ fontSize: 14 }}>₹{v?.toFixed(2)}</Tag> 
    },
    {
      title: 'Stock Left Now',
      key: 'stockLeft',
      render: (_, r) => {
        const prod = products.find(p => p.id === r.productId);
        if (!prod) return <Text type="secondary">—</Text>;
        if (prod.unit_type === 'packet') {
          const qty = prod.remainingPackets ?? 0;
          const isLow = qty < 3;
          return <Text type={isLow ? 'danger' : undefined} strong>{qty} pkt{isLow && ' ⚠'}</Text>;
        }
        const grams = prod.currentStockGrams || 0;
        const isLow = grams < 500;
        const label = grams >= 1000 ? `${(grams/1000).toFixed(2)} kg` : `${grams} g`;
        return <Text type={isLow ? 'danger' : undefined} strong>{label}{isLow && ' ⚠'}</Text>;
      }
    },
  ];

  const isPacketProduct = selectedProduct?.unit_type === 'packet';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Sales Entry</Title>
          <Space size="large" style={{ marginTop: 4 }}>
            <Text type="secondary">Record sales by weight sold, leftover, or packets.</Text>
            <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
              <strong>Today's Total Sales:</strong> ₹{todayTotal.toFixed(2)}
            </Tag>
          </Space>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={showModal} size="large">Log New Sale</Button>
      </div>

      <Alert message="Sales are append-only — once saved, a sale record cannot be modified." type="info" showIcon style={{ marginBottom: 16 }} closable />

      {/* Current Stock Overview Panel */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 13, color: '#555' }}>📦 Current Stock Overview</Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {products.map(p => {
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
                color={isLow ? 'red' : 'default'}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8 }}
              >
                <strong>{p.name}</strong>: {stockText}{isLow ? ' ⚠' : ''}
              </Tag>
            );
          })}
        </div>
      </div>

      <Tabs 
        defaultActiveKey="transactions" 
        tabBarExtraContent={
          <Space wrap>
            <SearchBar placeholder="Search by item or bill no..." onSearch={setSearchQuery} />
            <FilterOutlined style={{ color: '#888' }} />
            <Select value={dateFilter} onChange={setDateFilter} style={{ width: 140 }}>
              <Option value="today">Today</Option>
              <Option value="yesterday">Yesterday</Option>
              <Option value="week">This Week</Option>
              <Option value="month">This Month</Option>
              <Option value="all">All Time</Option>
            </Select>
          </Space>
        }
        items={[
          {
            key: 'summary',
            label: "Today's Item Totals",
            children: <Table columns={itemSummaryColumns} dataSource={todayItemSummary} rowKey="productName" pagination={{ pageSize: 8 }} scroll={{ x: 'max-content' }} />
          },
          {
            key: 'transactions',
            label: 'Transactions Log',
            children: <Table columns={columns} dataSource={searchedSales} rowKey="id" pagination={{ pageSize: 8 }} scroll={{ x: 'max-content' }} locale={{ emptyText: searchQuery ? 'No sales match your search.' : 'No sales found for this period.' }} />
          }
        ]} 
      />


      <Modal title="Log New Sale" open={isModalVisible} onCancel={handleCancel} footer={null}>

        {/* Mode toggle — only shown for weight items */}
        {!isPacketProduct && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Radio.Group value={entryMode} onChange={handleModeChange} buttonStyle="solid">
              <Radio.Button value="leftover">End of Day (Leftover)</Radio.Button>
              <Radio.Button value="weight">By Weight Sold</Radio.Button>
            </Radio.Group>
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{ transactionDate: new Date().toISOString().split('T')[0] }}
          onValuesChange={(changed, all) => {
            if (!selectedProduct || isPacketProduct) return;
            if (entryMode === 'leftover' && (changed.leftoverQty !== undefined || changed.leftoverUnit !== undefined)) {
              calcFromLeftover(selectedProduct, all.leftoverQty, all.leftoverUnit);
            }
            if (entryMode === 'weight' && (changed.weightQty !== undefined || changed.weightUnit !== undefined)) {
              const grams = all.weightUnit === 'kg' ? (all.weightQty || 0) * 1000 : (all.weightQty || 0);
              form.setFieldsValue({ amountReceived: revenueFromGrams(selectedProduct, grams) });
            }
          }}
        >
          <Form.Item name="transactionDate" label="Sale Date" tooltip="Date this sale happened (backdate if needed)">
            <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '8px', fontSize: '16px' }} />
          </Form.Item>
          
          <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
            <Select placeholder="Select product" onChange={handleProductChange}>
              {products.map(p => (
                <Option key={p.id} value={p.id}>
                  {p.unit_type === 'packet'
                    ? `📦 ${p.name} · ${p.remainingPackets ?? 0} pkts left · ₹${p.sellingPricePerPacket}/pkt`
                    : `⚖️ ${p.name} · ${((p.currentStockGrams || 0) / 1000).toFixed(2)}kg · ₹${p.sellingPricePerKg?.toFixed(2)}/kg`
                  }
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedProduct && (
            <Alert
              type={isPacketProduct ? 'info' : 'info'}
              style={{ marginBottom: 12 }}
              message={
                isPacketProduct ? (
                  <span style={{ fontSize: 12 }}>
                    Selling at <strong>₹{selectedProduct.sellingPricePerPacket}/packet</strong>
                    {' · '}Cost: <strong>₹{selectedProduct.costPricePerPacket}/packet</strong>
                    {' · '}Stock: <strong>{selectedProduct.remainingPackets} packets</strong>
                  </span>
                ) : (
                  <span style={{ fontSize: 12 }}>
                    Selling price: <strong>₹{selectedProduct.sellingPricePerSlab?.toFixed(2)} per {selectedProduct.marginSlabGrams}g</strong>
                    {' · '}Cost/gram: <strong>₹{selectedProduct.costPerGram?.toFixed(4)}</strong>
                  </span>
                )
              }
            />
          )}

          {/* ---- Packet quantity input ---- */}
          {isPacketProduct ? (
            <Form.Item
              name="packetQty"
              label="Number of Packets Sold"
              rules={[{ required: true, message: 'Enter number of packets' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                precision={0}
                placeholder="e.g. 2"
                addonAfter="packets"
                onChange={val => {
                  const amt = (val || 0) * (selectedProduct?.sellingPricePerPacket || 0);
                  form.setFieldsValue({ amountReceived: amt });
                }}
              />
            </Form.Item>
          ) : entryMode === 'weight' ? (
            <Form.Item label="Weight Sold" required>
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="weightQty" rules={[{ required: true }]} style={{ width: '70%', margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} min={0.001} placeholder="e.g. 1 or 500" />
                </Form.Item>
                <Form.Item name="weightUnit" style={{ width: '30%', margin: 0 }}>
                  <Select><Option value="kg">kg</Option><Option value="g">g</Option></Select>
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          ) : (
            <Form.Item label="Leftover stock right now" required>
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="leftoverQty" rules={[{ required: true }]} style={{ width: '70%', margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 500" />
                </Form.Item>
                <Form.Item name="leftoverUnit" style={{ width: '30%', margin: 0 }}>
                  <Select><Option value="kg">kg</Option><Option value="g">g</Option></Select>
                </Form.Item>
              </Space.Compact>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                We subtract this from current stock to figure out what was sold.
              </Text>
            </Form.Item>
          )}

          <Form.Item
            name="amountReceived"
            label="Cash Received (₹)"
            rules={[{ required: true }]}
            tooltip="Auto-calculated. Override for discounts."
          >
            <InputNumber style={{ width: '100%' }} min={0} prefix="₹" />
          </Form.Item>

          {/* Auto-waste checkbox is removed; handled automatically in leftover mode */}

          <Alert
            type="success"
            showIcon
            icon={<ClockCircleOutlined />}
            style={{ marginBottom: 16 }}
            message={
              <Text type="secondary" style={{ fontSize: 12 }}>
                <code>sold_at</code> will be set to the current server time at the moment you click "Log Sale" — it cannot be changed.
              </Text>
            }
          />

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Log Sale</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
