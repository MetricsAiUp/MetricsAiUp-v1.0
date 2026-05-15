// Список IANA-таймзон для UI-селектора: Минск + основные пояса РФ + UTC.
// Подпись (city) — i18n-ключ `timezones.<key>`; в скобках показываем UTC-смещение
// без DST, так как ни Москва, ни Минск, ни остальные перечисленные пояса
// не переходят на летнее время.
export const TIMEZONE_OPTIONS = [
  { value: 'UTC',                key: 'utc',          offset: '+0'  },
  { value: 'Europe/Kaliningrad', key: 'kaliningrad',  offset: '+2'  },
  { value: 'Europe/Minsk',       key: 'minsk',        offset: '+3'  },
  { value: 'Europe/Moscow',      key: 'moscow',       offset: '+3'  },
  { value: 'Europe/Samara',      key: 'samara',       offset: '+4'  },
  { value: 'Asia/Yekaterinburg', key: 'yekaterinburg',offset: '+5'  },
  { value: 'Asia/Omsk',          key: 'omsk',         offset: '+6'  },
  { value: 'Asia/Krasnoyarsk',   key: 'krasnoyarsk',  offset: '+7'  },
  { value: 'Asia/Irkutsk',       key: 'irkutsk',      offset: '+8'  },
  { value: 'Asia/Yakutsk',       key: 'yakutsk',      offset: '+9'  },
  { value: 'Asia/Vladivostok',   key: 'vladivostok',  offset: '+10' },
  { value: 'Asia/Magadan',       key: 'magadan',      offset: '+11' },
  { value: 'Asia/Kamchatka',     key: 'kamchatka',    offset: '+12' },
];
