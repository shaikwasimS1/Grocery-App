import React, { useState, useMemo, useEffect } from 'react';
import { Select, Button, Drawer } from 'antd';
import { SearchOutlined, CloseOutlined } from '@ant-design/icons';
import { fetchInventory, fetchSuppliers, fetchCustomers } from '../api';

export default function GlobalSearch({ onNavigate, isDarkMode }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ products: [], suppliers: [], customers: [] });
  const [searchText, setSearchText] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);

  const loadData = async () => {
    if (dataFetched) return;
    setLoading(true);
    try {
      const [invRes, supRes, cusRes] = await Promise.all([
        fetchInventory(),
        fetchSuppliers(),
        fetchCustomers(),
      ]);
      setData({
        products: invRes.data || [],
        suppliers: supRes.data || [],
        customers: cusRes.data || [],
      });
      setDataFetched(true);
    } catch (err) {
      console.error('Error fetching data for global search:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refetch data when mobile drawer opens just in case
  useEffect(() => {
    if (isMobileSearchOpen && !dataFetched) {
      loadData();
    }
  }, [isMobileSearchOpen, dataFetched]);

  const options = useMemo(() => {
    if (!searchText) return [];
    const q = searchText.toLowerCase();
    
    const matchedProducts = data.products
      .filter(p => p.item_name?.toLowerCase().includes(q))
      .map(p => ({ label: p.item_name, value: `product:${p.item_id || p._id}`, rawName: p.item_name }));

    const matchedSuppliers = data.suppliers
      .filter(s => s.supplier_name?.toLowerCase().includes(q) || s.phone_number?.toLowerCase().includes(q))
      .map(s => ({ label: `${s.supplier_name} ${s.phone_number ? `(${s.phone_number})` : ''}`, value: `supplier:${s._id}`, rawName: s.supplier_name }));
      
    const matchedCustomers = data.customers
      .filter(c => c.customer_name?.toLowerCase().includes(q) || c.phone_number?.toLowerCase().includes(q))
      .map(c => ({ label: `${c.customer_name} ${c.phone_number ? `(${c.phone_number})` : ''}`, value: `customer:${c._id}`, rawName: c.customer_name }));

    const result = [];
    if (matchedProducts.length) result.push({ label: '📦 Products', options: matchedProducts.slice(0, 10) });
    if (matchedSuppliers.length) result.push({ label: '🏢 Suppliers', options: matchedSuppliers.slice(0, 10) });
    if (matchedCustomers.length) result.push({ label: '👥 Customers', options: matchedCustomers.slice(0, 10) });
    
    return result;
  }, [data, searchText]);

  const onSelect = (val, option) => {
    setSearchText('');
    setIsMobileSearchOpen(false);
    
    // Navigate to the correct page
    if (val.startsWith('product:')) {
      onNavigate('2');
    } else if (val.startsWith('supplier:')) {
      onNavigate('9');
    } else if (val.startsWith('customer:')) {
      onNavigate('10');
    }

    // Fire event to auto-fill the search box on that page
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('global-search', { detail: { text: option.rawName } }));
    }, 150);
  };

  const searchUI = (
    <Select
      showSearch
      allowClear
      value={searchText || undefined}
      placeholder="Search products, suppliers..."
      loading={loading}
      onFocus={loadData}
      onSearch={setSearchText}
      onSelect={onSelect}
      options={options}
      filterOption={false}
      notFoundContent={loading ? 'Loading...' : (searchText ? 'No results found' : null)}
      suffixIcon={<SearchOutlined />}
      style={{ width: '100%' }}
      className="global-search-select"
    />
  );

  return (
    <>
      <style>{`
        .desktop-search { display: block; width: 280px; }
        .mobile-search-btn { display: none; }
        @media (max-width: 768px) {
          .desktop-search { display: none; }
          .mobile-search-btn { display: block; }
        }
        .global-search-select .ant-select-selector {
          border-radius: 20px !important;
          background: ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'} !important;
          border: none !important;
          height: 36px !important;
          align-items: center;
        }
        .global-search-select .ant-select-selection-search-input {
          height: 36px !important;
        }
      `}</style>
      
      <div className="desktop-search">
        {searchUI}
      </div>

      <Button
        className="mobile-search-btn"
        type="text"
        icon={<SearchOutlined style={{ fontSize: '18px', color: isDarkMode ? '#fff' : '#000' }} />}
        onClick={() => setIsMobileSearchOpen(true)}
      />

      <Drawer
        placement="top"
        closable={false}
        onClose={() => setIsMobileSearchOpen(false)}
        open={isMobileSearchOpen}
        height={72}
        styles={{ body: { padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' } }}
      >
        <div style={{ flex: 1 }}>{searchUI}</div>
        <Button type="text" icon={<CloseOutlined />} onClick={() => setIsMobileSearchOpen(false)} />
      </Drawer>
    </>
  );
}
