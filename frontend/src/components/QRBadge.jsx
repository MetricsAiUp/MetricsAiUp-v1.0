import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Printer, X } from 'lucide-react';

export default function QRBadge({ sessionId, plateNumber, entryTime, onClose }) {
  const { t } = useTranslation();
  const printRef = useRef(null);

  const sessionUrl = `${window.location.origin}${window.location.pathname}#/sessions?id=${sessionId}`;
  const formattedTime = entryTime
    ? new Date(entryTime).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : '';

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>QR - ${plateNumber}</title>
      <style>
        body { font-family: monospace; text-align: center; padding: 20px; }
        .plate { font-size: 28px; font-weight: bold; margin: 12px 0; letter-spacing: 2px;
          border: 3px solid #000; padding: 6px 16px; display: inline-block; border-radius: 6px; }
        .time { color: #666; font-size: 14px; margin-bottom: 16px; }
        svg { margin: 0 auto; }
      </style></head><body>
        <div class="plate">${plateNumber || '---'}</div>
        <div class="time">${formattedTime}</div>
        ${content.querySelector('svg')?.outerHTML || ''}
        <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="glass rounded-2xl p-6 max-w-xs w-full mx-4 shadow-2xl text-center"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('qr.title')}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="font-mono text-2xl font-bold mb-2 px-3 py-1.5 rounded-lg inline-block"
          style={{ background: 'var(--accent-light)', color: 'var(--text-primary)', border: '2px solid var(--accent)' }}>
          {plateNumber || '---'}
        </div>

        {formattedTime && (
          <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            {formattedTime}
          </div>
        )}

        <div ref={printRef} className="flex justify-center mb-4 p-3 rounded-xl"
          style={{ background: '#fff' }}>
          <QRCodeSVG
            value={sessionUrl}
            size={180}
            level="M"
            includeMargin={false}
          />
        </div>

        <button onClick={handlePrint}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <Printer size={16} />
          {t('qr.print')}
        </button>
      </div>
    </div>
  );
}
