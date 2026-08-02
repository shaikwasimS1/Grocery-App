import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, theme, ConfigProvider, Switch, Typography, Button } from 'antd';
import {
  AppstoreOutlined,
  CalculatorOutlined,
  ShoppingCartOutlined,
  LineChartOutlined,
  ShoppingOutlined,
  BulbOutlined,
  BulbFilled,
  ExperimentOutlined,
  WalletOutlined,
  TeamOutlined,
  BookOutlined,
  CreditCardOutlined,
  MenuOutlined
} from '@ant-design/icons';
import './App.css';

import ProductManagement from './components/ProductManagement';
import ProfitCalculator from './components/ProfitCalculator';
import SalesEntry from './components/SalesEntry';
import Wastage from './components/Wastage';
import ProfitOverview from './components/ProfitOverview';
import Dashboard from './components/Dashboard';
import InventoryPurchases from './components/InventoryPurchases';
import CashInHand from './components/CashInHand';
import Suppliers from './components/Suppliers';
import CreditBook from './components/CreditBook';
import Expenses from './components/Expenses';
import GlobalSearch from './components/GlobalSearch';
import { fetchInventory, fetchSales, fetchWastage } from './api';

const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;



// ---------------------------------------------------------------------------
// NavbarClock — shows in the top header bar on all pages
// ---------------------------------------------------------------------------
function NavbarClock({ isDarkMode }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const SHOP_TIMEZONE = 'Asia/Kolkata';
  const timeStr = now.toLocaleTimeString('en-IN', { timeZone: SHOP_TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-IN', { timeZone: SHOP_TIMEZONE, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: isDarkMode ? '#52c41a' : '#1677ff', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
        {timeStr}
      </div>
      <div style={{ fontSize: 11, color: isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
        {dateStr} · IST
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NexoraLogo
// ---------------------------------------------------------------------------
function NexoraLogo({ isDarkMode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        background: 'linear-gradient(135deg, #818cf8 0%, #06b6d4 100%)',
        color: '#fff',
        width: 32,
        height: 32,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 20,
        fontFamily: "'Outfit', sans-serif",
        boxShadow: '0 2px 8px rgba(6, 182, 212, 0.4)'
      }}>
        A
      </div>
      <div style={{
        fontWeight: 700,
        fontSize: 24,
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: -0.5,
        color: isDarkMode ? '#ffffff' : '#1e1b4b'
      }}>
        Nex<span style={{ color: '#06b6d4' }}>ora</span>
      </div>
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

  // Sync body class for CSS scoping
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
    }
  }, [isDarkMode]);

  const loadData = async (showFullScreenLoader = true) => {
    if (showFullScreenLoader) {
      setLoading(true);
    }
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
          manually_edited: p.manually_edited || false,
          supplier_id: p.supplier_id,
          low_stock_threshold: p.low_stock_threshold,
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
      if (showFullScreenLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { localStorage.setItem('freshTrack_darkMode', isDarkMode); }, [isDarkMode]);

  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

  const menuItems = [
    { key: '1',  icon: <LineChartOutlined />,   label: 'Dashboard' },
    { key: '6',  icon: <WalletOutlined />,      label: 'Profit Overview' },
    { key: '7',  icon: <ShoppingOutlined />,    label: 'Inventory Purchases' },
    { key: '8',  icon: <WalletOutlined />,      label: 'Cash in Hand' },
    { key: '2',  icon: <AppstoreOutlined />,    label: 'Products' },
    { key: '3',  icon: <ShoppingCartOutlined />,label: 'Sales Entry' },
    { key: '4',  icon: <ExperimentOutlined />,  label: 'Wastage' },
    { key: '5',  icon: <CalculatorOutlined />,  label: 'P&L Calculator' },
    { key: '9',  icon: <TeamOutlined />,        label: 'Suppliers' },
    { key: '10', icon: <BookOutlined />,        label: 'Udhaar / Credit' },
    { key: '11', icon: <CreditCardOutlined />,  label: 'Expenses' },
  ];

  const renderContent = () => {
    if (loading) return <div style={{ textAlign: 'center', marginTop: 50, color: isDarkMode ? '#fff' : '#000' }}>Loading data from server...</div>;

    switch (selectedKey) {
      case '1':  return <Dashboard products={products} sales={sales} wastage={wastage} />;
      case '6':  return <ProfitOverview products={products} sales={sales} wastage={wastage} />;
      case '7':  return <InventoryPurchases products={products} />;
      case '8':  return <CashInHand sales={sales} />;
      case '2':  return <ProductManagement products={products} setProducts={setProducts} reloadData={loadData} />;
      case '3':  return <SalesEntry products={products} setProducts={setProducts} sales={sales} setSales={setSales} wastage={wastage} setWastage={setWastage} reloadData={loadData} />;
      case '4':  return <Wastage products={products} setProducts={setProducts} wastage={wastage} setWastage={setWastage} sales={sales} reloadData={loadData} />;
      case '5':  return <ProfitCalculator products={products} />;
      case '9':  return <Suppliers />;
      case '10': return <CreditBook />;
      case '11': return <Expenses />;
      default:   return <Dashboard products={products} sales={sales} wastage={wastage} />;
    }
  };

  return (
    <ConfigProvider theme={{
      algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: isDarkMode ? {} : {
        colorPrimary: '#4f46e5',
        colorSuccess: '#059669',
        colorWarning: '#d97706',
        colorError: '#dc2626',
        colorInfo: '#0284c7',
        borderRadius: 12,
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 14,
        colorBgContainer: '#ffffff',
        colorBgLayout: '#f5f6fa',
        colorTextBase: '#1e1b4b',
        colorText: '#1e1b4b',
        colorTextSecondary: '#6b7280',
        colorBorder: '#e0e2f0',
      }
    }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider 
          collapsible 
          collapsed={collapsed} 
          onCollapse={setCollapsed} 
          breakpoint="md" 
          collapsedWidth="0" 
          theme="dark"
          style={{ zIndex: 101, position: 'relative' }}
        >
          <div className="logo-container">
            <ShoppingOutlined style={{ fontSize: 24 }} />
            {!collapsed && <span>FreshTrack</span>}
          </div>


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
            padding: '0 28px',
            background: isDarkMode ? '#141414' : 'rgba(255,255,255,0.70)',
            backdropFilter: isDarkMode ? 'none' : 'blur(16px)',
            WebkitBackdropFilter: isDarkMode ? 'none' : 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between', // Changed to space-between
            gap: 16,
            height: 56,
            lineHeight: '56px',
            borderBottom: isDarkMode ? '1px solid #303030' : '1px solid rgba(199,210,254,0.5)',
            boxShadow: isDarkMode ? 'none' : '0 2px 16px rgba(79,70,229,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                type="text"
                icon={<MenuOutlined style={{ fontSize: '18px', color: isDarkMode ? '#fff' : '#000' }} />}
                onClick={() => setCollapsed(!collapsed)}
                className="mobile-menu-btn"
                style={{ display: 'none' }} // we'll control display via css, or just show it if innerWidth < 768. Better yet, let CSS handle it.
              />
              <style>{`@media (max-width: 768px) { .mobile-menu-btn { display: block !important; } }`}</style>
              <NexoraLogo isDarkMode={isDarkMode} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <GlobalSearch onNavigate={setSelectedKey} isDarkMode={isDarkMode} />
              <NavbarClock isDarkMode={isDarkMode} />
            </div>
          </Header>
          <Content style={{ margin: 16 }}>
            <div style={{ padding: 24, minHeight: 360, background: 'transparent', borderRadius: borderRadiusLG }}>
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
