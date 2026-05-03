import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

// Аварийный баннер: данные с CV-системы не поступают дольше порога
// (порог приходит с бэкенда — STALE_DATA_MS, по умолчанию 1 час).
// Показываем над страницами, которые ведут расчёты по live-данным
// (Дашборд постов, Посты-детализация и т.п.), чтобы пользователь
// не принимал замороженные метрики за актуальные.
export default function StaleDataBanner({ stale, dataAsOf, dataAgeMs }) {
  const { t } = useTranslation();
  if (!stale) return null;

  let agoText = '';
  if (dataAgeMs && Number.isFinite(dataAgeMs) && dataAgeMs > 0) {
    const totalMin = Math.floor(dataAgeMs / 60000);
    if (totalMin >= 60) {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      agoText = t('common.agoHours', { n: h, m });
    } else {
      agoText = t('common.agoMinutes', { n: Math.max(1, totalMin) });
    }
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.45)',
        color: 'var(--text-primary)',
      }}
    >
      <AlertTriangle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
          {t('common.dataStaleTitle')}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {dataAsOf
            ? t('common.dataStaleBody', { ago: agoText })
            : t('common.dataStaleNoData')}
        </div>
      </div>
    </div>
  );
}
