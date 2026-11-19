import React from 'react';

// Year dropdown used with the useYearFilter hook.
export default function YearFilter({ value, onChange, options, className = '' }) {
  return (
    <label className={`flex items-center gap-2 text-sm text-slate-500 ${className}`}>
      Year
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="All">All Years</option>
        {options.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </label>
  );
}
