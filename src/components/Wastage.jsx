import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, InputNumber, Select,
  Typography, Space, Tag, message, Input, Alert, Popconfirm, theme
} from 'antd';
import { ExperimentOutlined, DeleteOutlined, FilterOutlined } from '@ant-design/icons';
import { formatDate, formatTime, isLocalToday, isLocalYesterday, isLocalThisWeek, isLocalThisMonth } from '../utils/timestamps';
import { recordWastage, deleteWastage } from '../api';
import SearchBar from './SearchBar';

const { Title, Text } = Typography;
const { Option } = Select;

export default function Wastage({ products, setProducts, wastage, setWastage, sales, reloadData }) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [form] = Form.useForm();
  const { token } = theme.useToken();

  const showModal = (product = null) => {
    form.resetFields();
    setPreview(null);
    setSelectedProduct(null);
    if (product) {
      const isPacket = product.unit_type === 'packet';
      form.setFieldsValue({
        productId: product.id,
        wasteUnit: isPacket ? 'pkt' : 'g',
      });
      setSelectedProduct(product);
    } else {
      form.setFieldsValue({ wasteUnit: 'g' });
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setSelectedProduct(null);
    setPreview(null);
  };

  const filteredWastage = React.useMemo(() => {
    return wastage.filter(w => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!w.productName?.toLowerCase().includes(q)) return false;
      }
      const d = w.wasted_at;
      if (dateFilter === 'today') return isLocalToday(d);
      if (dateFilter === 'yesterday') return isLocalYesterday(d);
      if (dateFilter === 'week') return isLocalThisWeek(d);
      if (dateFilter === 'month') return isLocalThisMonth(d);
      return true; // 'all'
    });
  }, [wastage, dateFilter, searchQuery]);

  const updatePreview = (product, qty) => {
    if (!product || !qty) { setPreview(null); return; }
    const isPacket = product.unit_type === 'packet';
    const loss = isPacket
      ? qty * (product.costPricePerPacket || 0)
      : qty * (product.costPerGram || 0);
    setPreview({ qty, loss, isPacket });
  };

  const handleProductChange = (productId) => {
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product);
    const qty = form.getFieldValue('gramsWasted');
    const unit = form.getFieldValue('wasteUnit');
    if (product) {
      const isPacket = product.unit_type === 'packet';
      // reset unit to match product type
      form.setFieldsValue({ wasteUnit: isPacket ? 'pkt' : 'g' });
      const grams = (!isPacket && unit === 'kg') ? (qty || 0) * 1000 : (qty || 0);
      updatePreview(product, isPacket ? grams : grams);
    }
  };

  const handleSave = async (values) => {
    const product = products.find(p => p.id === values.productId);
    if (!product) return;

    const isPacket = product.unit_type === 'packet';

    let qtyWasted;
    if (isPacket) {
      qtyWasted = Math.round(values.gramsWasted || 0);
      if (qtyWasted <= 0) { message.warning('Invalid quantity'); return; }
      if (qtyWasted > (product.remainingPackets || 0)) {
        message.warning(`Only ${product.remainingPackets} packets remaining!`); return;
      }
    } else {
      qtyWasted = values.wasteUnit === 'kg' ? values.gramsWasted * 1000 : values.gramsWasted;
      if (qtyWasted <= 0 || isNaN(qtyWasted)) { message.warning('Invalid quantity'); return; }
      if (qtyWasted > (product.currentStockGrams || 0)) {
        message.warning(`Not enough stock! Available: ${((product.currentStockGrams || 0) / 1000).toFixed(2)}kg`); return;
      }
    }

    try {
      const payload = {
        item_id: product.id,
        qty_wasted: qtyWasted,
        reason: values.reason || 'Manual write-off',
        transaction_date: values.transactionDate
      };
      await recordWastage(payload);
      message.success('Wastage recorded!');
      await reloadData(false);
      setIsModalVisible(false);
      form.resetFields();
      setSelectedProduct(null);
      setPreview(null);
    } catch (error) {
      console.error('Error recording wastage:', error);
      message.error(error.response?.data || 'Failed to record wastage');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteWastage(id);
      message.success('Wastage record deleted. Inventory restored.');
      await reloadData(false);
    } catch (error) {
      message.error(error.response?.data || 'Failed to delete wastage record');
    }
  };

  const columns = [
    {
      title: 'Write-off Date & Time',
      key: 'wasted_at',
      sorter: (a, b) => new Date(a.wasted_at) - new Date(b.wasted_at),
      render: (_, r) => (
        <div style={{ lineHeight: 1.3 }}>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{formatDate(r.wasted_at)}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{formatTime(r.wasted_at)}</Text>
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
          <Tag color={r.unit_type === 'packet' ? 'blue' : 'orange'} style={{ fontSize: 10 }}>
            {r.unit_type === 'packet' ? '📦 Packet' : '⚖️ Weight'}
          </Tag>
        </div>
      )
    },
    {
      title: 'Wasted Qty',
      key: 'gramsWasted',
      render: (_, r) => (
        <Tag color="orange">
          {r.unit_type === 'packet'
            ? `${r.gramsWasted} pkt`
            : r.gramsWasted >= 1000 ? `${(r.gramsWasted / 1000).toFixed(2)} kg` : `${r.gramsWasted} g`}
        </Tag>
      )
    },
    {
      title: 'Loss (at Cost)',
      dataIndex: 'wastageLoss',
      sorter: (a, b) => (a.wastageLoss || 0) - (b.wastageLoss || 0),
      render: v => <Text type="danger" strong>₹{v?.toFixed(2)}</Text>
    },
    { title: 'Reason', dataIndex: 'reason', render: t => t ? <Tag>{t}</Tag> : <Text type="secondary">—</Text> },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Popconfirm title="Delete record and restore stock?" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} type="text" />
        </Popconfirm>
      )
    }
  ];

  const productOptions = products.filter(p => {
    const hasStock = p.unit_type === 'packet' ? (p.remainingPackets || 0) > 0 : (p.currentStockGrams || 0) > 0;
    return hasStock;
  });

  const isPacketProduct = selectedProduct?.unit_type === 'packet';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Wastage / Spoilage</Title>
          <Text type="secondary">Write off expired or damaged stock. Loss is valued at cost price.</Text>
        </div>
        <Space wrap>
          <SearchBar placeholder="Search by item name..." onSearch={setSearchQuery} />
          <div>
            <FilterOutlined style={{ color: '#888', marginRight: 8 }} />
            <Select value={dateFilter} onChange={setDateFilter} style={{ width: 140 }}>
              <Option value="today">Today</Option>
              <Option value="yesterday">Yesterday</Option>
              <Option value="week">This Week</Option>
              <Option value="month">This Month</Option>
              <Option value="all">All Time</Option>
            </Select>
          </div>
          <Button type="primary" danger icon={<ExperimentOutlined />} onClick={() => showModal()} size="large">
            Mark as Waste
          </Button>
        </Space>
      </div>

      <Alert
        message="Wastage loss is calculated at purchase cost price, not selling price. It reduces inventory stock to reflect reality."
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        closable
      />

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

      {/* Quick-write-off buttons */}
      {productOptions.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Text type="secondary" style={{ lineHeight: '32px' }}>Quick write-off:</Text>
          {productOptions.map(p => (
            <Button key={p.id} size="small" danger onClick={() => showModal(p)}>
              {p.unit_type === 'packet'
                ? `📦 ${p.name} (${p.remainingPackets ?? 0} pkts left)`
                : `⚖️ ${p.name} (${((p.currentStockGrams || 0) / 1000).toFixed(2)}kg left)`}
            </Button>
          ))}
        </div>
      )}

      <Table columns={columns} dataSource={filteredWastage} rowKey="id" pagination={{ pageSize: 8 }} scroll={{ x: 'max-content' }} />

      <Modal title="Record Wastage / Spoilage" open={isModalVisible} onCancel={handleCancel} footer={null}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{ transactionDate: new Date().toISOString().split('T')[0] }}
          onValuesChange={(changed, all) => {
            const prod = selectedProduct || products.find(p => p.id === all.productId);
            if (!prod) return;
            const isPacket = prod.unit_type === 'packet';
            const grams = (!isPacket && all.wasteUnit === 'kg') ? (all.gramsWasted || 0) * 1000 : (all.gramsWasted || 0);
            updatePreview(prod, grams);
          }}
        >
          <Form.Item name="transactionDate" label="Wastage Date" tooltip="Date this wastage occurred (backdate if needed)">
            <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '8px', fontSize: '16px' }} />
          </Form.Item>
          
          <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
            <Select placeholder="Which product is being written off?" onChange={handleProductChange}>
              {productOptions.map(p => (
                <Option key={p.id} value={p.id}>
                  {p.unit_type === 'packet'
                    ? `📦 ${p.name} · ${p.remainingPackets ?? 0} pkts remaining · Cost: ₹${p.costPricePerPacket}/pkt`
                    : `⚖️ ${p.name} · ${((p.currentStockGrams || 0) / 1000).toFixed(2)}kg remaining · Cost: ₹${p.costPerGram?.toFixed(4)}/g`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Quantity to Write Off" required tooltip={isPacketProduct ? 'Enter number of packets to write off' : 'Enter the weight that is being wasted'}>
            {isPacketProduct ? (
              <Form.Item name="gramsWasted" rules={[{ required: true, message: 'Enter number of packets' }]} style={{ margin: 0 }}>
                <InputNumber style={{ width: '100%' }} min={1} precision={0} placeholder="e.g. 3" addonAfter="packets" />
              </Form.Item>
            ) : (
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="gramsWasted" rules={[{ required: true, message: 'Enter quantity' }]} style={{ width: '70%', margin: 0 }}>
                  <InputNumber style={{ width: '100%' }} min={0.001} placeholder="e.g. 1 or 500" />
                </Form.Item>
                <Form.Item name="wasteUnit" style={{ width: '30%', margin: 0 }}>
                  <Select>
                    <Option value="kg">kg</Option>
                    <Option value="g">g</Option>
                  </Select>
                </Form.Item>
              </Space.Compact>
            )}
          </Form.Item>

          {/* Write-off loss preview */}
          {preview && (
            <div style={{ background: token.colorErrorBg, border: `1px solid ${token.colorErrorBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <Text type="danger" strong>📉 Wastage Write-off Preview</Text>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>
                  <Text type="secondary">Qty written off:</Text>
                  <br />
                  <Text strong>
                    {preview.isPacket
                      ? `${preview.qty} packet${preview.qty !== 1 ? 's' : ''}`
                      : preview.qty >= 1000 ? `${(preview.qty / 1000).toFixed(2)} kg` : `${preview.qty} g`}
                  </Text>
                </div>
                <div>
                  <Text type="secondary">Loss at cost price:</Text>
                  <br />
                  <Text type="danger" strong style={{ fontSize: 15 }}>₹{preview.loss.toFixed(2)}</Text>
                </div>
              </div>
            </div>
          )}

          <Form.Item name="reason" label="Reason (optional)">
            <Select placeholder="Select reason" allowClear>
              <Option value="expired">Expired</Option>
              <Option value="damaged">Damaged / Crushed</Option>
              <Option value="rotten">Rotten</Option>
              <Option value="over-purchased">Over-purchased</Option>
              <Option value="other">Other</Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" danger htmlType="submit">Confirm Write-off</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
