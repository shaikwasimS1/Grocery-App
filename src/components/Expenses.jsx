import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography, Card, Table, Button, Modal, Form, Input,
  Select, Space, Tag, Statistic, Row, Col, Popconfirm,
  message, Empty, Alert
} from 'antd';
import { PlusOutlined, DeleteOutlined, FilterOutlined } from '@ant-design/icons';
import { fetchExpenses, addExpense, deleteExpense } from '../api';
import SearchBar from './SearchBar';
import {
  isLocalToday, isLocalThisWeek, isLocalThisMonth, isLocalThisYear
} from '../utils/timestamps';

const { Title, Text } = Typography;
const { Option } = Select;

const EXPENSE_TYPES = [
  { value: 'rent', label: '🏠 Rent' },
  { value: 'electricity', label: '💡 Electricity' },
  { value: 'staff_wages', label: '👷 Staff Wages' },
  { value: 'transport', label: '🚚 Transport' },
  { value: 'packaging', label: '📦 Packaging' },
  { value: 'maintenance', label: '🔧 Maintenance' },
  { value: 'other', label: '📌 Other' },
];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [form] = Form.useForm();

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchExpenses();
      setExpenses(res.data);
    } catch {
      message.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (values) => {
    try {
      await addExpense({
        ...values,
        expense_date: values.expense_date || new Date().toISOString()
      });
      message.success('Expense recorded!');
      form.resetFields();
      setAddModal(false);
      load();
    } catch {
      message.error('Failed to add expense');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteExpense(id);
      message.success('Expense deleted');
      load();
    } catch {
      message.error('Failed to delete expense');
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const typeMatch = e.expense_type?.toLowerCase().includes(q);
        const notesMatch = e.notes?.toLowerCase().includes(q);
        if (!typeMatch && !notesMatch) return false;
      }
      const d = e.expense_date || e.entry_created_at;
      if (dateFilter === 'today') return isLocalToday(d);
      if (dateFilter === 'week') return isLocalThisWeek(d);
      if (dateFilter === 'month') return isLocalThisMonth(d);
      if (dateFilter === 'year') return isLocalThisYear(d);
      return true;
    });
  }, [expenses, dateFilter, searchQuery]);

  const totals = useMemo(() => {
    const byType = {};
    let total = 0;
    filteredExpenses.forEach(e => {
      total += e.amount || 0;
      byType[e.expense_type] = (byType[e.expense_type] || 0) + (e.amount || 0);
    });
    return { total, byType };
  }, [filteredExpenses]);

  const columns = [
    {
      title: 'Date',
      key: 'date',
      sorter: (a, b) => new Date(a.expense_date) - new Date(b.expense_date),
      render: (_, r) => <Text>{formatDate(r.expense_date)}</Text>
    },
    {
      title: 'Type',
      key: 'type',
      render: (_, r) => {
        const found = EXPENSE_TYPES.find(t => t.value === r.expense_type);
        return <Tag color="blue">{found?.label || r.expense_type}</Tag>;
      }
    },
    {
      title: 'Amount',
      key: 'amount',
      sorter: (a, b) => a.amount - b.amount,
      render: (_, r) => <Text strong type="danger">₹{(r.amount || 0).toFixed(2)}</Text>
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      render: t => t ? <Text type="secondary">{t}</Text> : <Text type="secondary">—</Text>
    },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Popconfirm title="Delete this expense?" onConfirm={() => handleDelete(r._id)}>
          <Button size="small" danger icon={<DeleteOutlined />} type="text" />
        </Popconfirm>
      )
    }
  ];

  const filterLabel = dateFilter === 'today' ? "Today's" : dateFilter === 'week' ? "This Week's" :
                      dateFilter === 'month' ? "This Month's" : dateFilter === 'year' ? "This Year's" : "All Time";

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Expenses</Title>
          <Text type="secondary">Track shop running costs — rent, electricity, staff wages, and more.</Text>
        </div>
        <Space wrap>
          <SearchBar placeholder="Search by type or notes..." onSearch={setSearchQuery} />
          <FilterOutlined style={{ color: '#888' }} />
          <Select value={dateFilter} onChange={setDateFilter} style={{ width: 140 }}>
            <Option value="today">Today</Option>
            <Option value="week">This Week</Option>
            <Option value="month">This Month</Option>
            <Option value="year">This Year</Option>
            <Option value="all">All Time</Option>
          </Select>
          <Button type="primary" danger icon={<PlusOutlined />} size="large" onClick={() => setAddModal(true)}>
            Add Expense
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="Expenses reduce your Net Profit. These are separate from wastage loss and COGS."
        style={{ marginBottom: 16 }}
        closable
      />

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title={`${filterLabel} Total Expenses`}
              value={totals.total.toFixed(2)}
              prefix="₹"
              valueStyle={{ color: '#dc2626' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic title="No. of Entries" value={filteredExpenses.length} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12 }}>
            <Text strong>By Category:</Text>
            <div style={{ marginTop: 8 }}>
              {Object.entries(totals.byType).map(([type, amount]) => {
                const found = EXPENSE_TYPES.find(t => t.value === type);
                return (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12 }}>{found?.label || type}</Text>
                    <Text strong style={{ fontSize: 12 }}>₹{amount.toFixed(2)}</Text>
                  </div>
                );
              })}
              {Object.keys(totals.byType).length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>No expenses in this period</Text>}
            </div>
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredExpenses}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="No expenses recorded yet." /> }}
      />

      {/* Add Expense Modal */}
      <Modal
        title="Add Expense"
        open={addModal}
        onCancel={() => { setAddModal(false); form.resetFields(); }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}
          initialValues={{ expense_date: new Date().toISOString().split('T')[0] }}>
          <Form.Item name="expense_date" label="Expense Date" tooltip="Backdate if needed">
            <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '8px', fontSize: '16px' }} />
          </Form.Item>
          <Form.Item name="expense_type" label="Expense Type" rules={[{ required: true, message: 'Select expense type' }]}>
            <Select placeholder="Select type" size="large">
              {EXPENSE_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true, message: 'Enter amount' }]}>
            <Input type="number" min={0} placeholder="e.g. 3000" size="large" prefix="₹" />
          </Form.Item>
          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea placeholder="e.g. August rent payment, part-time staff for weekend" rows={2} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setAddModal(false); form.resetFields(); }}>Cancel</Button>
              <Button type="primary" danger htmlType="submit">Save Expense</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
