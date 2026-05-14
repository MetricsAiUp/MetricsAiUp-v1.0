// Маска темы письма для IMAP-фильтрации (Imap1CConfig.subjectMask).
//
// Синтаксис (для пользователя):
//   • Литеральный текст     — совпадает посимвольно
//   • {DD.MM.YYYY}          — дата ДД.ММ.ГГГГ (с ведущими нулями)
//   • {D.M.YYYY}            — дата Д.М.ГГГГ (1–2 цифры в дне/месяце)
//   • {YYYY-MM-DD}          — дата ISO
//   • *                     — произвольная подстрока (в т.ч. пустая)
//
// Под капотом:
//   compileSubjectMask(mask) → { isEmpty, literalForImap, regex }
//     literalForImap — самая длинная литеральная часть (для IMAP SEARCH SUBJECT,
//                       чтобы сузить выборку на стороне сервера). Может быть null,
//                       если маска состоит только из плейсхолдеров.
//     regex          — строгая проверка темы после получения письма.
//
//   matchSubject(mask, subject) → bool
//     Удобный шорткат: компилирует и проверяет за один вызов.
//
// Если mask пустая/null — фильтрация выключена (пропускаем всё).

const TOKEN_MAP = {
  '{DD.MM.YYYY}': '\\d{2}\\.\\d{2}\\.\\d{4}',
  '{D.M.YYYY}': '\\d{1,2}\\.\\d{1,2}\\.\\d{4}',
  '{YYYY-MM-DD}': '\\d{4}-\\d{2}-\\d{2}',
};

// Один RE для split: захватываем плейсхолдер целиком или '*'.
const TOKEN_RE = /(\{(?:DD\.MM\.YYYY|D\.M\.YYYY|YYYY-MM-DD)\}|\*)/g;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileSubjectMask(rawMask) {
  const mask = (rawMask == null ? '' : String(rawMask)).trim();
  if (!mask) return { isEmpty: true, literalForImap: null, regex: null };

  // Разбиваем строку на куски: токены и литералы между ними.
  const parts = mask.split(TOKEN_RE).filter((p) => p !== '');

  let regexBody = '';
  const literalChunks = [];

  for (const p of parts) {
    if (p === '*') {
      regexBody += '.*';
    } else if (Object.prototype.hasOwnProperty.call(TOKEN_MAP, p)) {
      regexBody += TOKEN_MAP[p];
    } else {
      regexBody += escapeRegex(p);
      literalChunks.push(p);
    }
  }

  // Берём самый длинный литерал — это даёт максимальное сужение IMAP-выборки.
  const literalForImap = literalChunks.length
    ? literalChunks.reduce((a, b) => (b.length > a.length ? b : a))
    : null;

  const regex = new RegExp('^' + regexBody + '$', 'u');
  return { isEmpty: false, literalForImap, regex };
}

function matchSubject(rawMask, subject) {
  const compiled = compileSubjectMask(rawMask);
  if (compiled.isEmpty) return true;
  if (subject == null) return false;
  return compiled.regex.test(String(subject).trim());
}

module.exports = { compileSubjectMask, matchSubject };
