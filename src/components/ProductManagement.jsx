import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber,
  Select, Space, Popconfirm, Typography, Tag, Divider, Tooltip, Alert, theme, message, Radio
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, BoxPlotOutlined, InboxOutlined, FilterOutlined } from '@ant-design/icons';
import { generateTimestamp, formatTimestamp, isLocalToday, isLocalYesterday, isLocalThisWeek, isLocalThisMonth } from '../utils/timestamps';
import { addInventoryItem, updateInventoryItem, deleteInventoryItem } from '../api';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Derive pricing for weight-based items
 */
function derivePricing({ purchaseQuantity, purchaseUnit, purchasePrice, sellingPricePerKg }) {
  const totalGrams    = purchaseUnit === 'kg' ? purchaseQuantity * 1000 : purchaseQuantity;
  const costPerGram   = purchasePrice / totalGrams;
  const costPerKg     = costPerGram * 1000;
  const marginPerKg   = sellingPricePerKg - costPerKg;
  const marginPerGram = marginPerKg / 1000;
  const marginSlabGrams     = 1000;
  const sellingPricePerSlab = sellingPricePerKg;
  const costPerSlab         = costPerKg;

  return {
    totalGrams, costPerGram, costPerKg, costPerSlab,
    marginPerKg, marginAmount: marginPerKg,
    marginSlabGrams, sellingPricePerKg, sellingPricePerSlab,
  };
}

export default function ProductManagement({ products, setProducts, reloadData }) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [preview, setPreview] = useState(null);
  const [unitType, setUnitType] = useState('weight'); // 'weight' | 'packet'
  const [form] = Form.useForm();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');

  const computePreview = (values) => {
    if (unitType !== 'weight') { setPreview(null); return; }
    const { purchaseQuantity, purchaseUnit, purchasePrice, sellingPricePerKg } = values;
    if (!purchaseQuantity || !purchaseUnit || !purchasePrice || !sellingPricePerKg) {
      setPreview(null); return;
    }
    const p = derivePricing({ purchaseQuantity, purchaseUnit, purchasePrice, sellingPricePerKg });
    const totalKg = p.totalGrams / 1000;
    setPreview({ ...p, totalKg, fullRevenue: totalKg * sellingPricePerKg, fullProfit: totalKg * sellingPricePerKg - purchasePrice, purchasePrice, sellingPricePerKg });
  };

  const showModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      const type = product.unit_type || 'weight';
      setUnitType(type);
      if (type === 'packet') {
        form.setFieldsValue({
          name: product.name,
          unitType: 'packet',
          totalPacketsPurchased: product.totalPacketsPurchased,
          totalPurchasePrice: product.totalPacketsPurchased * product.costPricePerPacket,
          sellingPricePerPacket: product.sellingPricePerPacket,
          remainingPackets: product.remainingPackets,
        });
        setPreview(null);
      } else {
        form.setFieldsValue({
          name: product.name,
          unitType: 'weight',
          purchaseQuantity: product.purchaseQuantity,
          purchaseUnit: product.purchaseUnit,
          purchasePrice: product.purchasePrice,
          sellingPricePerKg: product.sellingPricePerKg,
          remainingGrams: product.currentStockGrams,
        });
        computePreview({
          purchaseQuantity: product.purchaseQuantity,
          purchaseUnit: product.purchaseUnit,
          purchasePrice: product.purchasePrice,
          sellingPricePerKg: product.sellingPricePerKg,
        });
      }
    } else {
      setEditingProduct(null);
      setUnitType('weight');
      form.resetFields();
      form.setFieldsValue({ unitType: 'weight', purchaseUnit: 'kg' });
      setPreview(null);
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setPreview(null);
  };

  const handleSave = async (values) => {
    let payload;

    if (unitType === 'packet') {
      payload = {
        item_name: values.name,
        unit_type: 'packet',
        total_packets_purchased: values.totalPacketsPurchased,
        cost_price_per_packet: values.totalPurchasePrice / values.totalPacketsPurchased,
        selling_price_per_packet: values.sellingPricePerPacket,
        remaining_packets: values.remainingPackets,
      };
    } else {
      const pricing = derivePricing({
        purchaseQuantity: values.purchaseQuantity,
        purchaseUnit: values.purchaseUnit,
        purchasePrice: values.purchasePrice,
        sellingPricePerKg: values.sellingPricePerKg,
      });
      payload = {
        item_name: values.name,
        unit_type: 'weight',
        purchase_qty: values.purchaseQuantity,
        unit: values.purchaseUnit,
        purchase_price_total: values.purchasePrice,
        margin_slab_qty: 1000,
        margin_price: pricing.marginPerKg,
        selling_price_per_unit: pricing.sellingPricePerKg / 1000,
        remaining_qty: values.remainingGrams,
      };
    }

    setLoading(true);
    try {
      if (editingProduct) {
        await updateInventoryItem(editingProduct.id, payload);
        message.success('Product updated in database!');
      } else {
        await addInventoryItem(payload);
        message.success('Product added to database!');
      }
      await reloadData();
      setIsModalVisible(false);
      form.resetFields();
      setPreview(null);
    } catch (error) {
      console.error('Error saving product:', error);
      message.error(error.response?.data || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteInventoryItem(id);
      message.success('Product deleted from database!');
      await reloadData();
    } catch (error) {
      message.error('Failed to delete product');
    }
  };

  const columns = [
    {
      title: 'Product',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <div>
          <Text strong style={{ fontSize: 14 }}>{text}</Text>
          <br />
          <Tag color={record.unit_type === 'packet' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
            {record.unit_type === 'packet' ? '📦 Packet' : '⚖️ Weight'}
          </Tag>
        </div>
      )
    },
    {
      title: 'Date Added',
      key: 'created_at',
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      render: (_, record) => (
        <div style={{ lineHeight: 1.3 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatTimestamp(record.created_at)}
          </Text>
          {record.updated_at && (
            <div><span style={{ color: '#faad14', fontSize: 10 }}>· edited</span></div>
          )}
        </div>
      )
    },
    {
      title: 'Purchase',
      key: 'purchase',
      render: (_, r) => r.unit_type === 'packet' ? (
        <div style={{ lineHeight: 1.5 }}>
          <Text>{r.totalPacketsPurchased} packets · ₹{r.costPricePerPacket}/pkt</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>Total: ₹{(r.totalPacketsPurchased * r.costPricePerPacket).toFixed(2)}</Text>
        </div>
      ) : (
        <div style={{ lineHeight: 1.5 }}>
          <Text>{r.purchaseQuantity} {r.purchaseUnit} for <Text strong>₹{r.purchasePrice}</Text></Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>Costs you ₹{r.costPerGram ? (r.costPerGram * 1000).toFixed(2) : '—'}/kg</Text>
        </div>
      )
    },
    {
      title: 'Sell At',
      key: 'sell',
      sorter: (a, b) => {
        const aVal = a.unit_type === 'packet' ? (a.sellingPricePerPacket || 0) : (a.sellingPricePerKg || 0);
        const bVal = b.unit_type === 'packet' ? (b.sellingPricePerPacket || 0) : (b.sellingPricePerKg || 0);
        return aVal - bVal;
      },
      render: (_, r) => r.unit_type === 'packet' ? (
        <div style={{ lineHeight: 1.5 }}>
          <Tag color="blue" style={{ fontSize: 13 }}>₹{r.sellingPricePerPacket}/pkt</Tag>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            Profit: ₹{((r.sellingPricePerPacket || 0) - (r.costPricePerPacket || 0)).toFixed(2)}/pkt
          </Text>
        </div>
      ) : (
        <div style={{ lineHeight: 1.5 }}>
          <Tag color="green" style={{ fontSize: 13 }}>₹{r.sellingPricePerKg?.toFixed(2)}/kg</Tag>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>Profit: ₹{r.marginPerKg?.toFixed(2) ?? ((r.sellingPricePerKg || 0) - (r.costPerGram ? r.costPerGram * 1000 : 0)).toFixed(2)}/kg</Text>
        </div>
      )
    },
    {
      title: 'Stock Left',
      key: 'stock',
      sorter: (a, b) => {
        const aVal = a.unit_type === 'packet' ? (a.remainingPackets || 0) : (a.currentStockGrams || 0);
        const bVal = b.unit_type === 'packet' ? (b.remainingPackets || 0) : (b.currentStockGrams || 0);
        return aVal - bVal;
      },
      render: (_, r) => {
        if (r.unit_type === 'packet') {
          const isLow = (r.remainingPackets || 0) < 3;
          return (
            <Text type={isLow ? 'danger' : 'success'} strong>
              {r.remainingPackets ?? 0} pkt
              {isLow && <span style={{ fontSize: 10, display: 'block' }}>⚠ Low stock</span>}
            </Text>
          );
        }
        const kg = ((r.currentStockGrams || 0) / 1000).toFixed(2);
        const isLow = (r.currentStockGrams || 0) < 1000;
        return (
          <Text type={isLow ? 'danger' : 'success'} strong>
            {kg} kg
            {isLow && <span style={{ fontSize: 10, display: 'block' }}>⚠ Low stock</span>}
          </Text>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined />} onClick={() => showModal(record)} style={{ color: '#1890ff' }} />
          <Popconfirm title="Delete this product?" onConfirm={() => handleDelete(record.id)} okText="Yes" cancelText="No">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const filteredProducts = React.useMemo(() => {
    return products.filter(p => {
      if (dateFilter === 'all') return true;
      const d = p.created_at;
      if (dateFilter === 'today') return isLocalToday(d);
      if (dateFilter === 'yesterday') return isLocalYesterday(d);
      if (dateFilter === 'week') return isLocalThisWeek(d);
      if (dateFilter === 'month') return isLocalThisMonth(d);
      return true;
    });
  }, [products, dateFilter]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Inventory</Title>
          <Text type="secondary">Manage your available stock and prices.</Text>
        </div>
        <Space>
          <div style={{ marginRight: 16 }}>
            <FilterOutlined style={{ color: '#888', marginRight: 8 }} />
            <Select value={dateFilter} onChange={setDateFilter} style={{ width: 140 }}>
              <Option value="all">All Time</Option>
              <Option value="today">Added Today</Option>
              <Option value="yesterday">Added Yesterday</Option>
              <Option value="week">Added This Week</Option>
              <Option value="month">Added This Month</Option>
            </Select>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()} size="large">
            Add Product
          </Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={filteredProducts} rowKey="id" pagination={{ pageSize: 8 }} scroll={{ x: 800 }} />

      <Modal
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={540}
      >
        {editingProduct && (
          <Alert
            message={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Originally added: <strong>{formatTimestamp(editingProduct.created_at)}</strong> — this never changes.
              </Text>
            }
            type="warning"
            showIcon
            icon={<ClockCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          onValuesChange={(_, allValues) => computePreview(allValues)}
          initialValues={{ unitType: 'weight', purchaseUnit: 'kg' }}
        >
          <Form.Item name="name" label="Product Name" rules={[{ required: true, message: 'Enter product name' }]}>
            <Input placeholder="e.g. Tomatoes, Pepper Powder Packets" size="large" />
          </Form.Item>

          {/* ---- Unit type selector ---- */}
          <Form.Item name="unitType" label="Item Type">
            <Radio.Group
              buttonStyle="solid"
              onChange={e => { setUnitType(e.target.value); setPreview(null); }}
            >
              <Radio.Button value="weight"><InboxOutlined /> Weight-based (kg/g)</Radio.Button>
              <Radio.Button value="packet"><BoxPlotOutlined /> Packet / Piece</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {unitType === 'weight' ? (
            <>
              <Divider orientation="left" plain style={{ fontSize: 13, color: '#888' }}>
                🧑‍🌾 What did you buy?
              </Divider>

              <Space.Compact style={{ width: '100%' }}>
                <Form.Item
                  name="purchaseQuantity"
                  label="Quantity Bought"
                  rules={[{ required: true, message: 'Enter quantity' }]}
                  style={{ width: '55%' }}
                >
                  <InputNumber style={{ width: '100%' }} min={0.001} placeholder="e.g. 2" size="large" />
                </Form.Item>
                <Form.Item name="purchaseUnit" label="Unit" style={{ width: '45%' }}>
                  <Select size="large">
                    <Option value="kg">Kilograms (kg)</Option>
                    <Option value="g">Grams (g)</Option>
                  </Select>
                </Form.Item>
              </Space.Compact>

              <Form.Item
                name="purchasePrice"
                label="Total Amount Paid (₹)"
                rules={[{ required: true, message: 'Enter cost' }]}
                tooltip="Total money you paid"
              >
                <InputNumber style={{ width: '100%' }} min={0} prefix="₹" placeholder="e.g. 60" size="large" />
              </Form.Item>

              <Divider orientation="left" plain style={{ fontSize: 13, color: '#888' }}>
                🛒 What price will you sell to customers?
              </Divider>

              <Form.Item
                name="sellingPricePerKg"
                label="Your Selling Price (₹ per kg)"
                rules={[{ required: true, message: 'Enter selling price' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} prefix="₹" addonAfter="/kg" placeholder="e.g. 60" size="large" />
              </Form.Item>

              {/* Live preview box */}
              {preview && (
                <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 20, border: `1px solid ${token.colorBorder}` }}>
                  <div style={{ background: token.colorPrimary, color: '#fff', padding: '8px 16px', fontWeight: 600, fontSize: 13 }}>
                    📊 Your Numbers at a Glance
                  </div>
                  <div style={{ padding: '12px 16px', background: token.colorFillAlter }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
                      <div>
                        <Text type="secondary">Your cost per kg:</Text>
                        <br /><Text strong>₹{preview.costPerKg.toFixed(2)}/kg</Text>
                      </div>
                      <div>
                        <Text type="secondary">Your selling price:</Text>
                        <br /><Text strong style={{ color: '#1890ff' }}>₹{preview.sellingPricePerKg.toFixed(2)}/kg</Text>
                      </div>
                      <div>
                        <Text type="secondary">Profit per kg sold:</Text>
                        <br />
                        <Text strong style={{ color: preview.marginPerKg >= 0 ? '#52c41a' : '#ff4d4f' }}>
                          ₹{preview.marginPerKg.toFixed(2)}/kg
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary">Total stock:</Text>
                        <br /><Text strong>{preview.totalKg.toFixed(2)} kg</Text>
                      </div>
                    </div>
                    <Divider style={{ margin: '10px 0' }} />
                    <div style={{
                      background: token.colorSuccessBg, borderRadius: 6, padding: '8px 12px',
                      border: `1px solid ${token.colorSuccessBorder}`
                    }}>
                      <Text strong style={{ color: '#389e0d' }}>✅ If all {preview.totalKg.toFixed(2)}kg is sold:</Text>
                      <div style={{ marginTop: 4, fontSize: 13 }}>
                        Revenue: ₹{preview.fullRevenue.toFixed(2)} · Cost: ₹{preview.purchasePrice} ·{' '}
                        <Text strong style={{ color: '#389e0d' }}>Profit: ₹{preview.fullProfit.toFixed(2)}</Text>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Editable current stock — only when editing */}
              {editingProduct && (
                <Form.Item
                  name="remainingGrams"
                  label="Current Stock (grams)"
                  tooltip="Manually correct the current remaining stock in grams."
                >
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 500" size="large" addonAfter="g" />
                </Form.Item>
              )}
            </>
          ) : (
            <>
              <Divider orientation="left" plain style={{ fontSize: 13, color: '#888' }}>
                📦 Packet Purchase Details
              </Divider>

              <Form.Item
                name="totalPacketsPurchased"
                label="Total Packets Purchased"
                rules={[{ required: true, message: 'Enter number of packets' }]}
                tooltip="How many packets did you buy?"
              >
                <InputNumber style={{ width: '100%' }} min={1} precision={0} placeholder="e.g. 10" size="large" addonAfter="packets" />
              </Form.Item>

              <Form.Item
                name="totalPurchasePrice"
                label="Total Amount Paid for ALL Packets (₹)"
                rules={[{ required: true, message: 'Enter total amount paid' }]}
                tooltip="How much did you pay for the entire bundle of packets?"
              >
                <InputNumber style={{ width: '100%' }} min={0} prefix="₹" placeholder="e.g. 50" size="large" />
              </Form.Item>

              <Divider orientation="left" plain style={{ fontSize: 13, color: '#888' }}>
                🛒 What price will you sell each packet?
              </Divider>

              <Form.Item
                name="sellingPricePerPacket"
                label="Selling Price per Packet (₹)"
                rules={[{ required: true, message: 'Enter selling price' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} prefix="₹" addonAfter="/packet" placeholder="e.g. 12" size="large" />
              </Form.Item>

              {/* Profit preview for packets */}
              {form.getFieldValue('totalPacketsPurchased') && form.getFieldValue('totalPurchasePrice') !== undefined && form.getFieldValue('sellingPricePerPacket') !== undefined && (() => {
                const n = form.getFieldValue('totalPacketsPurchased') || 0;
                const totalCost = form.getFieldValue('totalPurchasePrice') || 0;
                const costPerPkt = n > 0 ? totalCost / n : 0;
                const sell = form.getFieldValue('sellingPricePerPacket') || 0;
                const profitPerPkt = sell - costPerPkt;
                const totalProfit = profitPerPkt * n;
                return (
                  <div style={{ background: token.colorSuccessBg, border: `1px solid ${token.colorSuccessBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                    <Text strong style={{ color: '#389e0d' }}>📊 Quick Summary</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, fontSize: 13 }}>
                      <div><Text type="secondary">Cost per packet:</Text><br /><Text strong>₹{costPerPkt.toFixed(2)}</Text></div>
                      <div><Text type="secondary">Profit per packet:</Text><br /><Text strong style={{ color: profitPerPkt >= 0 ? '#52c41a' : '#ff4d4f' }}>₹{profitPerPkt.toFixed(2)}</Text></div>
                      <div><Text type="secondary">If all {n} sold:</Text><br /><Text strong style={{ color: totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}>₹{totalProfit.toFixed(2)} profit</Text></div>
                      <div><Text type="secondary">Total revenue:</Text><br /><Text strong>₹{(sell * n).toFixed(2)}</Text></div>
                    </div>
                  </div>
                );
              })()}
              {/* Editable remaining packets — only when editing */}
              {editingProduct && (
                <Form.Item
                  name="remainingPackets"
                  label="Current Stock (packets remaining)"
                  tooltip="Manually correct how many packets are actually left in stock."
                >
                  <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="e.g. 6" size="large" addonAfter="pkts" />
                </Form.Item>
              )}
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit" size="large" loading={loading}>
                {editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
