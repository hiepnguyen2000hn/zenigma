'use client';

import { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar, X } from 'lucide-react';

interface DateTimeRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onClear?: () => void;
}

// Custom input component - defined outside to avoid re-renders
interface CustomInputProps {
  value?: string;
  onClick?: () => void;
}

const CustomInput = forwardRef<HTMLButtonElement, CustomInputProps>(
  ({ value, onClick }, ref) => (
    <button
      type="button"
      onClick={onClick}
      ref={ref}
      className={`flex items-center gap-2 px-4 py-2 bg-black border rounded-lg text-sm transition-colors ${
        value
          ? 'border-gray-600 text-white'
          : 'border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
      }`}
    >
      <span className="min-w-[140px] text-left">{value || 'Select date'}</span>
      <Calendar size={16} />
    </button>
  )
);
CustomInput.displayName = 'CustomInput';

const DateTimeRangePicker = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: DateTimeRangePickerProps) => {
  return (
    <div className="flex items-center gap-2">
      {/* Start Date Picker */}
      <DatePicker
        selected={startDate}
        onChange={onStartDateChange}
        dateFormat="MMM d, yyyy"
        maxDate={endDate || undefined}
        customInput={<CustomInput />}
        popperClassName="react-datepicker-popper"
        popperPlacement="bottom-start"
        showPopperArrow={false}
      />

      {/* End Date Picker */}
      <DatePicker
        selected={endDate}
        onChange={onEndDateChange}
        dateFormat="MMM d, yyyy"
        minDate={startDate || undefined}
        customInput={<CustomInput />}
        popperClassName="react-datepicker-popper"
        popperPlacement="bottom-start"
        showPopperArrow={false}
      />

      {/* Clear Button */}
      {(startDate || endDate) && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Clear dates"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default DateTimeRangePicker;
