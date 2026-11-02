import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X } from 'lucide-react';

interface BirthDateInputProps {
  value?: string; // Formato ISO esperado por la app y backend: YYYY-MM-DD
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

/**
 * Convierte YYYY-MM-DD a DD/MM/AAAA para presentación amigable
 */
function isoToDisplay(iso: string): string {
  if (!iso || !iso.includes('-')) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  if (!y || !m || !d) return '';
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

/**
 * Valida y convierte DD/MM/AAAA o dígitos a YYYY-MM-DD
 */
function parseAndValidate(displayStr: string): {
  iso: string;
  isValid: boolean;
  isComplete: boolean;
  error?: string;
} {
  const digits = displayStr.replace(/\D/g, '');
  if (!digits) {
    return { iso: '', isValid: true, isComplete: false };
  }

  if (digits.length < 8) {
    return { iso: '', isValid: false, isComplete: false };
  }

  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);

  const currentYear = new Date().getFullYear();

  if (month < 1 || month > 12) {
    return { iso: '', isValid: false, isComplete: true, error: 'Mes inválido (01-12)' };
  }

  if (year < 1910) {
    return { iso: '', isValid: false, isComplete: true, error: 'Año debe ser mayor a 1910' };
  }

  if (year > currentYear) {
    return { iso: '', isValid: false, isComplete: true, error: 'El año no puede ser futuro' };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      iso: '',
      isValid: false,
      isComplete: true,
      error: `Día inválido para el mes (01-${daysInMonth})`,
    };
  }

  const parsedDate = new Date(year, month - 1, day);
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  if (parsedDate > now) {
    return { iso: '', isValid: false, isComplete: true, error: 'La fecha no puede ser futura' };
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    iso: `${year}-${mm}-${dd}`,
    isValid: true,
    isComplete: true,
  };
}

export const BirthDateInput: React.FC<BirthDateInputProps> = ({
  value = '',
  onChange,
  id,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(() => isoToDisplay(value));
  const [error, setError] = useState<string | null>(null);
  const nativePickerRef = useRef<HTMLInputElement>(null);

  // Fecha máxima permitida (hoy en formato ISO YYYY-MM-DD)
  const maxDateISO = new Date().toISOString().split('T')[0];

  // Sincronizar cuando el prop 'value' cambie externamente (ej: cambio de socio o reset)
  useEffect(() => {
    const currentParsed = parseAndValidate(displayValue);
    if (value !== currentParsed.iso) {
      setDisplayValue(isoToDisplay(value));
      setError(null);
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const isDeleting = inputVal.length < displayValue.length;
    let cleanDigits = inputVal.replace(/\D/g, '').slice(0, 8);

    // Si el usuario borra una barra, retroceder también el dígito anterior
    if (isDeleting && displayValue.endsWith('/') && inputVal === displayValue.slice(0, -1)) {
      cleanDigits = cleanDigits.slice(0, -1);
    }

    let formatted = '';
    if (cleanDigits.length === 0) {
      formatted = '';
    } else if (cleanDigits.length <= 2) {
      formatted = cleanDigits;
      if (cleanDigits.length === 2 && !isDeleting) {
        formatted += '/';
      }
    } else if (cleanDigits.length <= 4) {
      formatted = `${cleanDigits.slice(0, 2)}/${cleanDigits.slice(2)}`;
      if (cleanDigits.length === 4 && !isDeleting) {
        formatted += '/';
      }
    } else {
      formatted = `${cleanDigits.slice(0, 2)}/${cleanDigits.slice(2, 4)}/${cleanDigits.slice(4)}`;
    }

    setDisplayValue(formatted);

    const validation = parseAndValidate(formatted);
    if (validation.isValid && validation.isComplete) {
      setError(null);
      onChange(validation.iso);
    } else if (validation.isComplete && validation.error) {
      setError(validation.error);
      onChange('');
    } else {
      setError(null);
      onChange('');
    }
  };

  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedIso = e.target.value;
    if (!selectedIso) {
      setDisplayValue('');
      setError(null);
      onChange('');
      return;
    }
    const [y, m, d] = selectedIso.split('-');
    if (y && m && d) {
      setDisplayValue(`${d}/${m}/${y}`);
      setError(null);
      onChange(selectedIso);
    }
  };

  const handleClear = () => {
    setDisplayValue('');
    setError(null);
    onChange('');
    if (nativePickerRef.current) {
      nativePickerRef.current.value = '';
    }
  };

  const triggerNativePicker = () => {
    try {
      if (nativePickerRef.current) {
        if (typeof nativePickerRef.current.showPicker === 'function') {
          nativePickerRef.current.showPicker();
        } else {
          nativePickerRef.current.focus();
          nativePickerRef.current.click();
        }
      }
    } catch {
      // Ignorar fallback si la política de permisos del navegador prefiere click directo
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`relative flex items-center bg-black border rounded-lg transition-colors ${
          error
            ? 'border-red-500/80 focus-within:border-red-400'
            : 'border-neutral-800 focus-within:border-white'
        }`}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/AAAA"
          value={displayValue}
          onChange={handleTextChange}
          className="w-full bg-transparent px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none font-mono min-h-[38px]"
        />

        <div className="flex items-center pr-1.5 shrink-0 gap-0.5">
          {displayValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded text-neutral-500 hover:text-white transition-colors"
              title="Borrar fecha"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Botón y disparador de calendario nativo */}
          <div className="relative w-7 h-7 flex items-center justify-center">
            <button
              type="button"
              onClick={triggerNativePicker}
              className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Abrir calendario"
              tabIndex={-1}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
            <input
              ref={nativePickerRef}
              type="date"
              tabIndex={-1}
              value={value || ''}
              max={maxDateISO}
              min="1910-01-01"
              onChange={handleNativePickerChange}
              style={{ colorScheme: 'dark' }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Seleccionar fecha de nacimiento en calendario"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-[10px] text-red-400 mt-1 font-mono tracking-tight">{error}</p>
      )}
    </div>
  );
};
