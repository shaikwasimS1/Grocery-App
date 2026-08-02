import React, { useState, useEffect, useRef } from 'react';
import { Input } from 'antd';
import { SearchOutlined, CloseCircleFilled } from '@ant-design/icons';

/**
 * Reusable SearchBar with debounce.
 * Props:
 *   placeholder  – string
 *   onSearch     – callback(searchTerm: string)
 *   debounce     – ms to wait before firing onSearch (default 300)
 *   style        – extra style object
 */
export default function SearchBar({ placeholder = 'Search...', onSearch, debounce = 300, style = {}, value: propValue }) {
  const [value, setValue] = useState(propValue || '');
  const timer = useRef(null);

  useEffect(() => {
    if (propValue !== undefined) {
      setValue(propValue);
    }
  }, [propValue]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSearch?.(value.trim());
    }, debounce);
    return () => clearTimeout(timer.current);
  }, [value]);

  const clear = () => {
    setValue('');
    onSearch?.('');
  };

  return (
    <Input
      value={value}
      onChange={e => setValue(e.target.value)}
      placeholder={placeholder}
      prefix={<SearchOutlined style={{ color: '#a5b4fc' }} />}
      suffix={
        value
          ? <CloseCircleFilled
              style={{ color: '#9ca3af', cursor: 'pointer' }}
              onClick={clear}
            />
          : null
      }
      allowClear={false}
      style={{
        borderRadius: 10,
        minHeight: 44,
        fontSize: 14,
        width: '100%',
        maxWidth: 380,
        ...style,
      }}
    />
  );
}
