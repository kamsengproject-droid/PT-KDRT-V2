import React, { useState, useEffect, useRef } from 'react';

interface CurrencyInputProps {
  prefix?: string;
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  'data-testid'?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = "Rp 0",
  className = "",
  disabled = false,
  prefix = 'Rp',
  required = false,
  'data-testid': testId,
}) => {
  const [displayValue, setDisplayValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    
    if (value === '' || value === 0) {
      setDisplayValue("");
    } else if (typeof value === 'number') {
      setDisplayValue(value.toLocaleString('id-ID'));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    // Strip out leading zeros
    val = val.replace(/^0+/, '');

    if (val === '') {
      setDisplayValue('');
      onChange('');
    } else {
      const num = parseInt(val, 10);
      setDisplayValue(num.toLocaleString('id-ID'));
      onChange(num);
    }
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        required={required}
        disabled={disabled}
        data-testid={testId}
        className={`${prefix ? 'pl-9' : 'pl-3'} ${className}`}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
      />
    </div>
  );
};
