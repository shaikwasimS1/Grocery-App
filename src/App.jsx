import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, theme, ConfigProvider, Switch, Typography } from 'antd';
import {
  AppstoreOutlined,
  CalculatorOutlined,
  ShoppingCartOutlined,
  LineChartOutlined,
  ShoppingOutlined,
  BulbOutlined,
  BulbFilled,
  ExperimentOutlined
} from '@ant-design/icons';
import './App.css';

import ProductManagement from './components/ProductManagement';
import ProfitCalculator from './components/ProfitCalculator';
import SalesEntry from './components/SalesEntry';
import Wastage from './components/Wastage';
import Dashboard from './components/Dashboard';
import { fetchInventory, fetchSales, fetchWastage } from './api';

const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;

// ---------------------------------------------------------------------------
// LiveClock — UI-only state, updated by setInterval every second.
// ---------------------------------------------------------------------------
function LiveClock({ collapsed }) {
  const [now, setNow] = useState(new Date());
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const SHOP_TIMEZONE = 'Asia/Kolkata';
  const dateStr = now.toLocaleDateString('en-IN', { timeZone: SHOP_TIMEZONE, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { timeZone: SHOP_TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  if (collapsed) {
    return <div style={{ textAlign: 'center', padding: '8px 0', color: 'rgba(255,255,255,0.65)', fontSize: 18 }}>🕐</div>;
  }

  return (
    <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', margin: '0 8px 8px', borderRadius: 8, textAlign: 'center', borderLeft: '3px solid #52c41a' }}>
      <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 700 }}>{timeStr}</div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{dateStr}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('1'); // Default to Dashboard (now key 1)
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('freshTrack_darkMode') === 'true');

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [wastage, setWastage] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, salesRes, wasRes] = await Promise.all([
        fetchInventory(),
        fetchSales(),
        fetchWastage()
      ]);

      setProducts(invRes.data.map(p => {
        const isPacket = p.unit_type === 'packet';
        return {
          id: p.item_id,
          name: p.item_name,
          unit_type: p.unit_type || 'weight',
          // weight fields
          purchaseQuantity: p.purchase_qty,
          purchaseUnit: p.unit,
          purchasePrice: p.purchase_price_total,
          costPerGram: p.cost_price_per_unit,
          sellingPricePerKg: p.selling_price_per_unit ? p.selling_price_per_unit * 1000 : null,
          sellingPricePerSlab: p.selling_price_per_unit ? p.selling_price_per_unit * 1000 : null,
          marginSlabGrams: p.margin_slab_qty || 1000,
          currentStockGrams: p.remaining_qty,
          // packet fields
          totalPacketsPurchased: p.total_packets_purchased,
          costPricePerPacket: p.cost_price_per_packet,
          sellingPricePerPacket: p.selling_price_per_packet,
          remainingPackets: p.remaining_packets,
          // common
          created_at: p.created_at,
          updated_at: p.updated_at,
        };
      }));

      setSales(salesRes.data.map(s => ({
        id: s.sale_id,
        productId: s.item_id,
        productName: s.item_name,
        unit_type: s.unit_type || 'weight',
        gramsSold: s.qty_sold,         // for weight items (grams); for packet items this is packet count
        amountReceived: s.total_amount,
        cogs: s.qty_sold * s.cost_price_per_unit,
        grossProfit: s.profit,
        sold_at: s.sold_at
      })));

      setWastage(wasRes.data.map(w => ({
        id: w.wastage_id,
        productId: w.item_id,
        productName: w.item_name,
        unit_type: w.unit_type || 'weight',
        gramsWasted: w.qty_wasted,     // for weight: grams; for packet: packet count
        wastageLoss: w.loss_value,
        reason: w.reason,
        wasted_at: w.wasted_at
      })));
    } catch (err) {
      console.error('Error fetching data from server:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { localStorage.setItem('freshTrack_darkMode', isDarkMode); }, [isDarkMode]);

  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

  const menuItems = [
    { key: '1', icon: <LineChartOutlined />,   label: 'Dashboard' },
    { key: '2', icon: <AppstoreOutlined />,    label: 'Products' },
    { key: '3', icon: <ShoppingCartOutlined />,label: 'Sales Entry' },
    { key: '4', icon: <ExperimentOutlined />,  label: 'Wastage' },
    { key: '5', icon: <CalculatorOutlined />,  label: 'P&L Calculator' },
  ];

  const renderContent = () => {
    if (loading) return <div style={{ textAlign: 'center', marginTop: 50, color: isDarkMode ? '#fff' : '#000' }}>Loading data from server...</div>;

    switch (selectedKey) {
      case '1': return <Dashboard products={products} sales={sales} wastage={wastage} />;
      case '2': return <ProductManagement products={products} setProducts={setProducts} reloadData={loadData} />;
      case '3': return <SalesEntry products={products} setProducts={setProducts} sales={sales} setSales={setSales} wastage={wastage} setWastage={setWastage} reloadData={loadData} />;
      case '4': return <Wastage products={products} setProducts={setProducts} wastage={wastage} setWastage={setWastage} reloadData={loadData} />;
      case '5': return <ProfitCalculator products={products} />;
      default:  return <Dashboard products={products} sales={sales} wastage={wastage} />;
    }
  };

  return (
    <ConfigProvider theme={{ algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="lg" theme="dark">
          <div className="logo-container">
            <ShoppingOutlined style={{ fontSize: 24 }} />
            {!collapsed && <span>FreshTrack</span>}
          </div>

          <LiveClock collapsed={collapsed} />

          <div style={{ padding: collapsed ? '8px 4px' : '8px 16px', textAlign: 'center' }}>
            <Switch
              checked={isDarkMode}
              onChange={setIsDarkMode}
              checkedChildren={<BulbOutlined />}
              unCheckedChildren={<BulbFilled />}
            />
          </div>

          <Menu
            theme="dark"
            defaultSelectedKeys={['1']}
            mode="inline"
            items={menuItems}
            onSelect={({ key }) => setSelectedKey(key)}
          />
        </Sider>

        <Layout>
          <Header style={{
            padding: '0 24px',
            background: isDarkMode ? '#141414' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              All timestamps stored in UTC · Displayed in IST (Asia/Kolkata)
            </Text>
          </Header>
          <Content style={{ margin: 16 }}>
            <div style={{ padding: 24, minHeight: 360, background: isDarkMode ? '#141414' : '#fff', borderRadius: borderRadiusLG }}>
              {renderContent()}
            </div>
          </Content>
          <Footer style={{ textAlign: 'center' }}>
            FreshTrack ©{new Date().getFullYear()} — Grocery POS
          </Footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
