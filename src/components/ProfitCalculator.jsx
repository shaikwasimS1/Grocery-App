import React, { useState } from 'react';
import { Typography, Form, InputNumber, Select, Card, Row, Col, Divider, Statistic, Space, Radio, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, BoxPlotOutlined, InboxOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProfitCalculator({ products }) {
  const [form] = Form.useForm();
  const [calcMode, setCalcMode] = useState('weight');
  const [results, setResults] = useState({
    costPerUnit: 0,
    totalUnits: 0,
    expectedRevenue: 0,
    totalExpectedProfit: 0,
    lossOnUnsold: 0,
    netBalance: 0
  });

  const calculate = (values) => {
    if (calcMode === 'weight') {
      const { purchaseQty, purchaseUnit, purchasePrice, sellUnitSize, sellPrice, leftoverQty, leftoverUnit } = values;
      if (!purchaseQty || !purchasePrice || !sellUnitSize || !sellPrice) return;

      const totalGramsBought = purchaseUnit === 'kg' ? purchaseQty * 1000 : purchaseQty;
      const leftoverGrams = leftoverQty ? (leftoverUnit === 'kg' ? leftoverQty * 1000 : leftoverQty) : 0;
      const soldGrams = Math.max(0, totalGramsBought - leftoverGrams);
      const costPerGram = purchasePrice / totalGramsBought;
      const unitsSellable = totalGramsBought / sellUnitSize;
      const expectedRevenue = unitsSellable * sellPrice;
      const expectedProfit = expectedRevenue - purchasePrice;
      const lossOnUnsold = leftoverGrams * costPerGram;
      const actualRevenue = (soldGrams / sellUnitSize) * sellPrice;
      const netBalance = actualRevenue - purchasePrice;

      setResults({
        costPerUnit: costPerGram,
        totalUnits: unitsSellable,
        expectedRevenue,
        totalExpectedProfit: expectedProfit,
        lossOnUnsold,
        netBalance,
      });
    } else {
      // Packet mode
      const { totalPacketsBought, totalPacketCost, sellPricePerPacket, leftoverPackets } = values;
      if (!totalPacketsBought || !totalPacketCost || !sellPricePerPacket) return;

      const costPerPacket = totalPacketCost / totalPacketsBought;
      const unsold = leftoverPackets || 0;
      const soldPackets = Math.max(0, totalPacketsBought - unsold);
      const expectedRevenue = totalPacketsBought * sellPricePerPacket;
      const expectedProfit = expectedRevenue - totalPacketCost;
      const lossOnUnsold = unsold * costPerPacket;
      const actualRevenue = soldPackets * sellPricePerPacket;
      const netBalance = actualRevenue - totalPacketCost;

      setResults({
        costPerUnit: costPerPacket,
        totalUnits: totalPacketsBought,
        expectedRevenue,
        totalExpectedProfit: expectedProfit,
        lossOnUnsold,
        netBalance,
      });
    }
  };

  const handleProductChange = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (product.unit_type === 'packet') {
      setCalcMode('packet');
      form.resetFields();
      setTimeout(() => {
        form.setFieldsValue({
          totalPacketsBought: product.totalPacketsPurchased || 0,
          totalPacketCost: ((product.totalPacketsPurchased || 0) * (product.costPricePerPacket || 0)),
          sellPricePerPacket: product.sellingPricePerPacket || 0,
          leftoverPackets: product.remainingPackets || 0,
        });
        calculate(form.getFieldsValue());
      }, 0);
    } else {
      setCalcMode('weight');
      form.resetFields();
      setTimeout(() => {
        form.setFieldsValue({
          purchaseQty: product.purchaseQuantity || 0,
          purchaseUnit: product.purchaseUnit || 'kg',
          purchasePrice: product.purchasePrice || 0,
          sellUnitSize: product.marginSlabGrams || 1000,
          sellPrice: product.sellingPricePerSlab || 0,
          leftoverQty: ((product.currentStockGrams || 0) / 1000).toFixed(3),
          leftoverUnit: 'kg',
        });
        calculate(form.getFieldsValue());
      }, 0);
    }
  };

  const onModeChange = (e) => {
    setCalcMode(e.target.value);
    form.resetFields();
    if (e.target.value === 'weight') form.setFieldsValue({ purchaseUnit: 'kg', leftoverUnit: 'g' });
    setResults({ costPerUnit: 0, totalUnits: 0, expectedRevenue: 0, totalExpectedProfit: 0, lossOnUnsold: 0, netBalance: 0 });
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0 }}>Profit & Loss Calculator</Title>
        <Text type="secondary">Simulate margins and calculate potential profits or losses on stock.</Text>
      </div>

      {/* Mode Toggle */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Radio.Group value={calcMode} onChange={onModeChange} buttonStyle="solid" size="large">
          <Radio.Button value="weight"><BoxPlotOutlined /> By Weight (Vegetables / Powders)</Radio.Button>
          <Radio.Button value="packet"><InboxOutlined /> By Packet (Packaged Goods)</Radio.Button>
        </Radio.Group>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <Card title="Input Parameters" bordered={false}>
            <Form
              form={form}
              layout="vertical"
              onValuesChange={(_, allValues) => calculate(allValues)}
              initialValues={{ purchaseUnit: 'kg', leftoverUnit: 'g' }}
            >
              <Form.Item label="Pre-fill from Product" style={{ marginBottom: 16 }}>
                <Select placeholder="Select a product (optional)" onChange={handleProductChange} allowClear>
                  {products.map(p => (
                    <Option key={p.id} value={p.id}>
                      {p.unit_type === 'packet' ? '📦 ' : '⚖️ '}{p.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Divider style={{ margin: '16px 0' }} />

              {calcMode === 'weight' ? (
                <>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="purchaseQty" label="Total Bought Qty" style={{ width: '60%' }}>
                      <InputNumber style={{ width: '100%' }} min={0.1} />
                    </Form.Item>
                    <Form.Item name="purchaseUnit" label="Unit" style={{ width: '40%' }}>
                      <Select>
                        <Option value="kg">kg</Option>
                        <Option value="g">g</Option>
                      </Select>
                    </Form.Item>
                  </Space.Compact>

                  <Form.Item name="purchasePrice" label="Total Cost (₹)">
                    <InputNumber style={{ width: '100%' }} min={0} prefix="₹" />
                  </Form.Item>

                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="sellPrice" label="Selling Price (₹)" style={{ width: '50%' }}>
                      <InputNumber style={{ width: '100%' }} min={0} prefix="₹" />
                    </Form.Item>
                    <Form.Item name="sellUnitSize" label="Per Unit Size (g)" style={{ width: '50%' }}>
                      <InputNumber style={{ width: '100%' }} min={1} addonAfter="g" />
                    </Form.Item>
                  </Space.Compact>

                  <Divider style={{ margin: '16px 0' }} />
                  <Title level={5}>Unsold / Leftover Inventory (Optional)</Title>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="leftoverQty" style={{ width: '60%' }}>
                      <InputNumber style={{ width: '100%' }} min={0} placeholder="Unsold amount" />
                    </Form.Item>
                    <Form.Item name="leftoverUnit" style={{ width: '40%' }}>
                      <Select>
                        <Option value="kg">kg</Option>
                        <Option value="g">g</Option>
                      </Select>
                    </Form.Item>
                  </Space.Compact>
                </>
              ) : (
                <>
                  <Form.Item name="totalPacketsBought" label="Total Packets Bought">
                    <InputNumber style={{ width: '100%' }} min={1} addonAfter="packets" placeholder="e.g. 20" />
                  </Form.Item>
                  <Form.Item name="totalPacketCost" label="Total Cost Paid (for all packets)">
                    <InputNumber style={{ width: '100%' }} min={0} prefix="₹" placeholder="e.g. 200" />
                  </Form.Item>
                  <Form.Item name="sellPricePerPacket" label="Selling Price per Packet">
                    <InputNumber style={{ width: '100%' }} min={0} prefix="₹" addonAfter="/ pkt" placeholder="e.g. 15" />
                  </Form.Item>
                  <Divider style={{ margin: '16px 0' }} />
                  <Title level={5}>Unsold / Leftover Inventory (Optional)</Title>
                  <Form.Item name="leftoverPackets">
                    <InputNumber style={{ width: '100%' }} min={0} addonAfter="packets" placeholder="Unsold packets" />
                  </Form.Item>
                </>
              )}
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Results & Analysis" bordered={false} style={{ height: '100%' }}>
            <Row gutter={[16, 24]}>
              <Col span={12}>
                <Statistic title={calcMode === 'weight' ? 'Cost per Gram' : 'Cost per Packet'} value={results.costPerUnit} precision={4} prefix="₹" />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Total Sellable Units"
                  value={results.totalUnits}
                  precision={1}
                  suffix={calcMode === 'weight' ? ` units (${form.getFieldValue('sellUnitSize') || 0}g)` : ' packets'}
                />
              </Col>
              
              <Divider style={{ margin: '12px 0' }} />
              
              <Col span={12}>
                <Statistic 
                  title="Expected Revenue (If all sold)" 
                  value={results.expectedRevenue} 
                  precision={2} prefix="₹" 
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic 
                  title="Expected Profit (If all sold)" 
                  value={results.totalExpectedProfit} 
                  precision={2} prefix="₹"
                  valueStyle={{ color: results.totalExpectedProfit >= 0 ? '#3f8600' : '#cf1322' }}
                />
              </Col>

              <Divider style={{ margin: '12px 0' }} />

              <Col span={24}>
                <Card type="inner" style={{ background: '#fafafa' }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Statistic 
                        title="Loss on Unsold Stock" 
                        value={results.lossOnUnsold} 
                        precision={2} prefix="₹" 
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic 
                        title="Actual Net Balance" 
                        value={results.netBalance} 
                        precision={2} prefix="₹"
                        valueStyle={{ color: results.netBalance >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}
                      />
                    </Col>
                  </Row>
                  <div style={{ marginTop: 12 }}>
                    <Tag color={results.netBalance >= 0 ? 'success' : 'error'} style={{ fontSize: 12 }}>
                      {results.netBalance >= 0 ? '✅ Profitable' : '⚠️ At a Loss'}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: 4 }}>
                      * Net Balance = Revenue from Sold − Total Original Cost
                    </Text>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
