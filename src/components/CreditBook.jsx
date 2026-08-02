import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography, Card, Table, Button, Modal, Form, Input,
  Select, Space, Tag, Statistic, Row, Col, Popconfirm,
  message, Divider, Empty, Badge, Alert, Radio
} from 'antd';
import {
  PlusOutlined, UserOutlined, DollarOutlined,
  PhoneOutlined, HistoryOutlined, CheckOutlined
} from '@ant-design/icons';
import {
  fetchCustomers, addCustomer, fetchCustomerBalance,
  addCreditSale, addCreditPayment, fetchCustomerSales, fetchCustomerPayments
} from '../api';
import SearchBar from './SearchBar';

const { Title, Text } = Typography;
const { Option } = Select;

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export default function CreditBook() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [creditModal, setCreditModal] = useState(null);
  const [balances, setBalances] = useState({});
  const [custHistory, setCustHistory] = useState({}); // { id: { sales: [], payments: [] } }
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('pending');

  useEffect(() => {
    const handleGlobalSearch = (e) => {
      setSearchQuery(e.detail.text);
    };
    window.addEventListener('global-search', handleGlobalSearch);
    return () => window.removeEventListener('global-search', handleGlobalSearch);
  }, []);

  const [form] = Form.useForm();
  const [payForm] = Form.useForm();
  const [creditForm] = Form.useForm();

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchCustomers();
      setCustomers(res.data);

      const balMap = {};
      await Promise.all(res.data.map(async (c) => {
        try {
          const b = await fetchCustomerBalance(c._id);
          balMap[c._id] = b.data;
        } catch {
          balMap[c._id] = { totalCredit: 0, totalPaid: 0, pendingBalance: 0 };
        }
      }));
      setBalances(balMap);
    } catch {
      message.error('Failed to load credit book');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAddCustomer = async (values) => {
    try {
      await addCustomer(values);
      message.success('Customer added!');
      form.resetFields();
      setAddModal(false);
      load();
    } catch {
      message.error('Failed to add customer');
    }
  };

  const handleAddCredit = async (values) => {
    try {
      await addCreditSale(creditModal, {
        ...values,
        credit_date: values.credit_date || new Date().toISOString()
      });
      message.success('Credit sale recorded!');
      creditForm.resetFields();
      setCreditModal(null);
      load();
    } catch {
      message.error('Failed to record credit sale');
    }
  };

  const handleOpenHistory = async (customer) => {
    setDetailModal(customer);
    try {
      const [salesRes, paymentsRes] = await Promise.all([
        fetchCustomerSales(customer._id),
        fetchCustomerPayments(customer._id)
      ]);
      setCustHistory(prev => ({ ...prev, [customer._id]: { sales: salesRes.data, payments: paymentsRes.data } }));
    } catch {
      message.error("Failed to load history");
    }
  };

  const handlePay = async (values) => {
    try {
      await addCreditPayment(payModal, {
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

  const totalStats = useMemo(() =>
    Object.values(balances).reduce((sum, b) => {
      sum.pending += (b.pendingBalance || 0);
      sum.given += (b.totalCredit || 0);
      sum.paid += (b.totalPaid || 0);
      return sum;
    }, { pending: 0, given: 0, paid: 0 }),
  [balances]);

  const columns = [
    {
      title: 'Customer',
      key: 'name',
      render: (_, r) => (
        <div>
          <Text strong>{r.customer_name}</Text>
          {r.phone_number && <><br /><Text type="secondary" style={{ fontSize: 12 }}><PhoneOutlined /> {r.phone_number}</Text></>}
        </div>
      )
    },
    {
      title: 'Total Credit Given',
      key: 'credit',
      render: (_, r) => {
        const b = balances[r._id];
        return <Text strong>₹{(b?.totalCredit || 0).toFixed(2)}</Text>;
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
      title: 'Pending Balance',
      key: 'balance',
      render: (_, r) => {
        const b = balances[r._id];
        const pending = b?.pendingBalance || 0;
        return (
          <Tag color={pending > 0 ? 'red' : 'green'} style={{ fontWeight: 700, fontSize: 13 }}>
            {pending > 0 ? `₹${pending.toFixed(2)} pending` : '✓ Settled'}
          </Tag>
        );
      }
    },
    {
      title: 'Customer Since',
      key: 'since',
      render: (_, r) => <Text type="secondary">{formatDate(r.created_at)}</Text>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
          <Space direction="vertical" size={8} style={{ paddingBottom: 4 }}>
    <Button size="small" icon={<HistoryOutlined />} onClick={() => handleOpenHistory(r)}>
      History
    </Button>
    <Button size="small" danger icon={<PlusOutlined />} onClick={() => setCreditModal(r._id)}>
      Add Udhaar
    </Button>
    <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => setPayModal(r._id)}>
      Collect
    </Button>
</Space>
      )
    }
  ];
  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (filterMode === 'pending') {
      result = result.filter(c => (balances[c._id]?.pendingBalance || 0) > 0);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.customer_name?.toLowerCase().includes(q) ||
        c.phone_number?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [customers, searchQuery, filterMode, balances]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Udhaar / Credit Book</Title>
          <Text type="secondary">Track goods sold on credit and collect payments from customers.</Text>
        </div>
        <Space wrap>
          <Radio.Group value={filterMode} onChange={e => setFilterMode(e.target.value)} buttonStyle="solid">
            <Radio.Button value="pending">Pending</Radio.Button>
            <Radio.Button value="all">All</Radio.Button>
          </Radio.Group>
          <SearchBar placeholder="Search by name or phone..." value={searchQuery} onSearch={setSearchQuery} />
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setAddModal(true)}>
            Add Customer
          </Button>
        </Space>
      </div>

      {totalStats.pending > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`Total pending Udhaar: ₹${totalStats.pending.toFixed(2)} across ${Object.values(balances).filter(b => b.pendingBalance > 0).length} customer(s)`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic title="Total Customers" value={customers.length} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="Total Credit Given"
              value={totalStats.given.toFixed(2)}
              prefix="₹"
              valueStyle={{ color: '#096dd9' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="Total Paid (Collected)"
              value={totalStats.paid.toFixed(2)}
              prefix="₹"
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="Total Udhaar Pending"
              value={totalStats.pending.toFixed(2)}
              prefix="₹"
              valueStyle={{ color: totalStats.pending > 0 ? '#dc2626' : '#059669' }}
            />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredCustomers}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description={searchQuery ? 'No customers match your search.' : 'No customers yet. Add your first credit customer!'} /> }}
      />

      {/* Add Customer Modal */}
      <Modal
        title="Add Credit Customer"
        open={addModal}
        onCancel={() => { setAddModal(false); form.resetFields(); }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddCustomer}>
          <Form.Item name="customer_name" label="Customer Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Ramesh Kumar" size="large" />
          </Form.Item>
          <Form.Item name="phone_number" label="Phone Number">
            <Input placeholder="e.g. 9876543210" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setAddModal(false); form.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit">Add Customer</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Credit Sale Modal */}
      <Modal
        title="📝 Add Udhaar (Credit Sale)"
        open={!!creditModal}
        onCancel={() => { setCreditModal(null); creditForm.resetFields(); }}
        footer={null}
      >
        <Form form={creditForm} layout="vertical" onFinish={handleAddCredit}
          initialValues={{ credit_date: new Date().toISOString().split('T')[0] }}>
          <Form.Item name="credit_date" label="Sale Date" tooltip="Backdate if needed">
            <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '8px', fontSize: '16px' }} />
          </Form.Item>
          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true, message: 'Enter credit amount' }]}>
            <Input type="number" min={0} placeholder="e.g. 200" size="large" prefix="₹" />
          </Form.Item>
          <Form.Item name="bill_no" label="Bill / Invoice No. (optional)">
            <Input placeholder="e.g. INV-001" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setCreditModal(null); creditForm.resetFields(); }}>Cancel</Button>
              <Button type="primary" danger htmlType="submit">Add Udhaar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Collect Payment Modal */}
      <Modal
        title="✅ Collect Payment from Customer"
        open={!!payModal}
        onCancel={() => { setPayModal(null); payForm.resetFields(); }}
        footer={null}
      >
        <Form form={payForm} layout="vertical" onFinish={handlePay}
          initialValues={{ payment_mode: 'cash', payment_date: new Date().toISOString().split('T')[0] }}>
          <Form.Item name="payment_date" label="Payment Date" tooltip="Backdate if needed">
            <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '8px', fontSize: '16px' }} />
          </Form.Item>
          <Form.Item name="amount_paid" label="Amount Collected (₹)" rules={[{ required: true }]}>
            <Input type="number" min={0} placeholder="e.g. 150" size="large" prefix="₹" />
          </Form.Item>
          <Form.Item name="payment_mode" label="Payment Mode">
            <Select size="large">
              <Option value="cash">💵 Cash</Option>
              <Option value="UPI">📱 UPI</Option>
              <Option value="bank">🏦 Bank Transfer</Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setPayModal(null); payForm.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit">Record Collection</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Customer Detail Modal */}
      <Modal
        title={`👤 ${detailModal?.customer_name} — Credit History`}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={700}
      >
        {detailModal && (() => {
          const b = balances[detailModal._id] || {};
          return (
            <div>
              <Row gutter={12} style={{ marginBottom: 16 }}>
                <Col span={8}><Statistic title="Total Credit" value={`₹${(b.totalCredit || 0).toFixed(2)}`} valueStyle={{ color: '#dc2626' }} /></Col>
                <Col span={8}><Statistic title="Total Paid" value={`₹${(b.totalPaid || 0).toFixed(2)}`} valueStyle={{ color: '#059669' }} /></Col>
                <Col span={8}><Statistic title="Pending Balance" value={`₹${(b.pendingBalance || 0).toFixed(2)}`} valueStyle={{ color: b.pendingBalance > 0 ? '#dc2626' : '#059669' }} /></Col>
              </Row>
              {(() => {
                const h = custHistory[detailModal._id];
                if (!h) return <div style={{ textAlign: 'center', padding: 20 }}>Loading history...</div>;
                const timeline = [
                  ...h.sales.map(s => ({ ...s, type: 'sale', date: s.credit_date })),
                  ...h.payments.map(p => ({ ...p, type: 'payment', date: p.payment_date }))
                ].sort((a, b) => new Date(b.date) - new Date(a.date));
                
                return (
                  <Table
                    dataSource={timeline}
                    rowKey="_id"
                    pagination={{ pageSize: 5 }}
                    size="small"
                    columns={[
                      { title: 'Date', dataIndex: 'date', render: d => formatDate(d) },
                      { title: 'Type', dataIndex: 'type', render: t => t === 'sale' ? <Tag color="red">Udhaar</Tag> : <Tag color="green">Payment</Tag> },
                      { title: 'Details', render: (_, r) => r.type === 'sale' ? (r.bill_no || 'Goods') : (r.payment_mode ? `Mode: ${r.payment_mode}` : 'Cash') },
                      { title: 'Amount', render: (_, r) => <Text strong style={{ color: r.type === 'sale' ? '#dc2626' : '#059669' }}>₹{(r.amount || r.amount_paid || 0).toFixed(2)}</Text> },
                      { title: 'Status', render: (_, r) => r.type === 'sale' ? (r.status === 'paid' ? <Tag color="success">Paid</Tag> : <Tag color="warning">Pending</Tag>) : '-' }
                    ]}
                  />
                );
              })()}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
