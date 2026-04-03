import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CollapsibleSection({ icon: Icon, title, count, color, children, extra }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 mb-1.5 w-full text-left hover:opacity-80 transition-opacity">
        <Icon size={14} style={{ color: color || 'var(--accent)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {title} {count != null && `(${count})`}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 'auto' }} />
        {extra && <div className="ml-auto mr-4" onClick={e => e.stopPropagation()}>{extra}</div>}
      </button>
      {open && children}
    </div>
  );
}
