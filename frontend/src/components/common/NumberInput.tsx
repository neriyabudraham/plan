import { useState, useEffect } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
  allowDecimal?: boolean;
}

export default function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder = '0',
  className = 'input',
  prefix,
  suffix,
  allowDecimal = false,
}: NumberInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(value ? value.toString() : '');

  useEffect(() => {
    if (value === 0 || value === null || value === undefined) {
      setDisplayValue('');
    } else {
      setDisplayValue(value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Remove leading zeros (but keep "0." for decimals)
    if (inputValue.length > 1 && inputValue.startsWith('0') && !inputValue.startsWith('0.')) {
      inputValue = inputValue.replace(/^0+/, '');
    }
    
    // Only allow numbers and optionally decimal point
    const regex = allowDecimal ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/;
    if (!regex.test(inputValue)) return;
    
    setDisplayValue(inputValue);
    
    const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
    
    if (!isNaN(numValue)) {
      if (min !== undefined && numValue < min) return;
      if (max !== undefined && numValue > max) return;
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    if (displayValue === '' || displayValue === '.') {
      setDisplayValue('');
      onChange(0);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all on focus for easier editing
    e.target.select();
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={`${className} ${prefix ? 'pr-8' : ''} ${suffix ? 'pl-8' : ''}`}
        min={min}
        max={max}
        step={step}
      />
      {suffix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}
