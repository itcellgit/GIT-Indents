import React from 'react';

// Native <input type="time"> / "datetime-local" follow the OS region setting in Chrome
// (the lang attribute is ignored), so on 24-hour locales AM/PM never shows.
// These pickers always render 12-hour hour/minute/AM-PM selects while keeping the
// same value formats: "HH:mm" (24h) and "YYYY-MM-DDTHH:mm".

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const parseTime = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { hour: '', minute: '', period: 'AM' };
  const h24 = Number(match[1]);
  return {
    hour: String(h24 % 12 === 0 ? 12 : h24 % 12),
    minute: match[2],
    period: h24 >= 12 ? 'PM' : 'AM',
  };
};

const toTime24 = ({ hour, minute, period }) => {
  if (!hour) return '';
  let h = Number(hour) % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute || '00'}`;
};

const selectClass = 'rounded-lg border border-slate-300 px-2 py-2.5 text-sm bg-white';

export const TimeInput12h = ({ value, onChange, required = false, className = '' }) => {
  const parts = parseTime(value);
  const update = (patch) => onChange(toTime24({ ...parts, ...patch }));

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select aria-label="Hour" value={parts.hour} onChange={(e) => update({ hour: e.target.value })} required={required} className={selectClass}>
        <option value="">--</option>
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-slate-500">:</span>
      <select aria-label="Minute" value={parts.minute} onChange={(e) => update({ minute: e.target.value, hour: parts.hour || '12' })} required={required} className={selectClass}>
        <option value="">--</option>
        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select aria-label="AM/PM" value={parts.period} onChange={(e) => update({ period: e.target.value, hour: parts.hour || '12' })} className={selectClass}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export const DateTimeInput12h = ({ value, onChange, required = false }) => {
  const [datePart = '', timePart = ''] = String(value || '').split('T');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={datePart}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}T${timePart || '09:00'}` : '')}
        required={required}
        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
      />
      <TimeInput12h
        value={timePart}
        onChange={(t) => onChange(datePart || t ? `${datePart}T${t}` : '')}
        required={required}
      />
    </div>
  );
};

export default TimeInput12h;
