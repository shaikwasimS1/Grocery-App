import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography, Card, Table, Button, Modal, Form, Input,
  Select, Space, Tag, Statistic, Row, Col, Popconfirm,
  message, Tabs, Divider, Badge, Empty
} from 'antd';
import {
  PlusOutlined, ShopOutlined, DollarOutlined,
  PhoneOutlined, EnvironmentOutlined, HistoryOutlined
} from '@ant-design/icons';
import {
  fetchSuppliers, addSupplier, fetchSupplierBalance,
  addSupplierPayment, fetchInventory
} from '../api';
import SearchBar from './SearchBar';

const { Title, Text } = Typography;
const { Option } = Select;

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]); // inventory items
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null); // selected supplier
  const [payModal, setPayModal] = useState(null); // supplier id to pay
  const [balances, setBalances] = useState({}); // { supplierId: { totalPurchases, totalPaid, pendingBalance } }
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleGlobalSearch = (e) => {
      setSearchQuery(e.detail.text);
    };
    window.addEventListener('global-search', handleGlobalSearch);
    return () => window.removeEventListener('global-search', handleGlobalSearch);
  }, []);

  const [form] = Form.useForm();
  const [payForm] = Form.useForm();

  const load = async () => {
    try {
      setLoading(true);
      const [supRes, invRes] = await Promise.all([fetchSuppliers(), fetchInventory()]);
      setSuppliers(supRes.data);
      setPurchases(invRes.data);

      // Load balances for all suppliers
      const balanceMap = {};
      await Promise.all(supRes.data.map(async (s) => {
        try {
          const res = await fetchSupplierBalance(s._id);
          balanceMap[s._id] = res.data;
        } catch {
          balanceMap[s._id] = { totalPurchases: 0, totalPaid: 0, pendingBalance: 0 };
        }
      }));
      setBalances(balanceMap);
    } catch (err) {
      message.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAddSupplier = async (values) => {
    try {
      await addSupplier(values);
      message.success('Supplier added!');
      form.resetFields();
      setAddModal(false);
      load();
    } catch {
      message.error('Failed to add supplier');
    }
  };

  const handlePay = async (values) => {
    try {
      await addSupplierPayment(payModal, {
        ...values,
        payment_date: values.payment_date || new Date().toISOString()
      });
      message.success('Payment recorded!');
      payForm.resetFields();
      setPayModal(null);
      load();
    } catch {
      message.error('Failed to record payment');
    }
  };

  const totalOwed = useMemo(() =>
    Object.values(balances).reduce((sum, b) => sum + (b.pendingBalance || 0), 0),
  [balances]);

  const supplierPurchases = (supplierId) =>
    purchases.filter(p => p.supplier_id === supplierId || p.supplier_id?._id === supplierId);

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(s =>
      s.supplier_name?.toLowerCase().includes(q) ||
      s.phone_number?.toLowerCase().includes(q)
    );
  }, [suppliers, searchQuery]);

  const columns = [
    {
      title: 'Supplier',
      key: 'name',
      render: (_, r) => (
        <div>
          <Text strong>{r.supplier_name}</Text>
          {r.phone_number && <><br /><Text type="secondary" style={{ fontSize: 12 }}><PhoneOutlined /> {r.phone_number}</Text></>}
          {r.address && <><br /><Text type="secondary" style={{ fontSize: 11 }}><EnvironmentOutlined /> {r.address}</Text></>}
        </div>
      )
    },
    {
      title: 'Total Purchased',
      key: 'purchased',
      render: (_, r) => {
        const b = balances[r._id];
        return <Text strong>₹{(b?.totalPurchases || 0).toFixed(2)}</Text>;
      }
    },
    {
      title: 'Total Paid',
      key: 'paid',
      render: (_, r) => {
        const b = balances[r._id];
        return <Text type="success">₹{(b?.totalPaid || 0).toFixed(2)}</Text>;
      }
    },
    {
      title: 'Balance Owed',
      key: 'balance',
      render: (_, r) => {
        const b = balances[r._id];
        const pending = b?.pendingBalance || 0;
        return (
          <Tag color={pending > 0 ? 'red' : 'green'} style={{ fontWeight: 700, fontSize: 13 }}>
            {pending > 0 ? `₹${pending.toFixed(2)} owed` : '✓ Cleared'}
          </Tag>
        );
      }
    },
    {
      title: 'Since',
      key: 'since',
      render: (_, r) => <Text type="secondary">{formatDate(r.created_at)}</Text>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<HistoryOutlined />} onClick={() => setDetailModal(r)}>Details</Button>
          <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => setPayModal(r._id)}>Pay</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Suppliers / Vendors</Title>
          <Text type="secondary">Track purchases linked to suppliers and manage payments.</Text>
        </div>
        <Space wrap>
          <SearchBar placeholder="Search by name or phone..." value={searchQuery} onSearch={setSearchQuery} />
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setAddModal(true)}>
            Add Supplier
          </Button>
        </Space>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="Total Suppliers"
              value={suppliers.length}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="Total Amount Owed"
              value={totalOwed.toFixed(2)}
              prefix="₹"
              valueStyle={{ color: totalOwed > 0 ? '#dc2626' : '#059669' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="Suppliers with Pending Dues"
              value={Object.values(balances).filter(b => (b.pendingBalance || 0) > 0).length}
              suffix={`/ ${suppliers.length}`}
              valueStyle={{ color: '#d97706' }}
            />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredSuppliers}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description={searchQuery ? 'No suppliers match your search.' : 'No suppliers yet. Add your first vendor!'} /> }}
      />

      {/* Add Supplier Modal */}
      <Modal
        title="Add Supplier / Vendor"
        open={addModal}
        onCancel={() => { setAddModal(false); form.resetFields(); }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddSupplier}>
          <Form.Item name="supplier_name" label="Supplier Name" rules={[{ required: true, message: 'Enter supplier name' }]}>
            <Input placeholder="e.g. Ram Traders, City Wholesale" size="large" />
          </Form.Item>
          <Form.Item name="phone_number" label="Phone Number">
            <Input placeholder="e.g. 9876543210" />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea placeholder="Market area, locality..." rows={2} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setAddModal(false); form.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit">Add Supplier</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Pay Supplier Modal */}
      <Modal
        title="Record Payment to Supplier"
        open={!!payModal}
        onCancel={() => { setPayModal(null); payForm.resetFields(); }}
        footer={null}
      >
        <Form form={payForm} layout="vertical" onFinish={handlePay}
          initialValues={{ payment_mode: 'cash', payment_date: new Date().toISOString().split('T')[0] }}>
          <Form.Item name="payment_date" label="Payment Date" tooltip="Backdate if needed">
            <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '8px', fontSize: '16px' }} />
          </Form.Item>
          <Form.Item name="amount_paid" label="Amount Paid (₹)" rules={[{ required: true, message: 'Enter amount' }]}>
            <Input type="number" min={0} placeholder="e.g. 500" size="large" prefix="₹" />
          </Form.Item>
          <Form.Item name="payment_mode" label="Payment Mode">
            <Select size="large">
              <Option value="cash">💵 Cash</Option>
              <Option value="UPI">📱 UPI</Option>
              <Option value="bank">🏦 Bank Transfer</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes (optional)">
            <Input placeholder="e.g. Partial payment for July invoice" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setPayModal(null); payForm.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit">Record Payment</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Supplier Detail Modal */}
      <Modal
        title={`📦 ${detailModal?.supplier_name} — History`}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={700}
      >
        {detailModal && (() => {
          const b = balances[detailModal._id] || {};
          const prchList = supplierPurchases(detailModal._id);
          return (
            <div>
              <Row gutter={12} style={{ marginBottom: 16 }}>
                <Col span={8}><Statistic title="Total Purchased" value={`₹${(b.totalPurchases || 0).toFixed(2)}`} /></Col>
                <Col span={8}><Statistic title="Total Paid" value={`₹${(b.totalPaid || 0).toFixed(2)}`} valueStyle={{ color: '#059669' }} /></Col>
                <Col span={8}><Statistic title="Balance Owed" value={`₹${(b.pendingBalance || 0).toFixed(2)}`} valueStyle={{ color: b.pendingBalance > 0 ? '#dc2626' : '#059669' }} /></Col>
              </Row>
              <Divider>Purchase History</Divider>
              {prchList.length === 0 ? (
                <Text type="secondary">No purchases linked to this supplier yet. When adding inventory, select this supplier.</Text>
              ) : (
                <Table
                  size="small"
                  dataSource={prchList}
                  rowKey="_id"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: 'Item', dataIndex: 'item_name', render: t => <Text strong>{t}</Text> },
                    { title: 'Date', dataIndex: 'created_at', render: formatDate },
                    { title: 'Amount', dataIndex: 'purchase_price_total', render: v => `₹${(v || 0).toFixed(2)}` },
                  ]}
                />
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
