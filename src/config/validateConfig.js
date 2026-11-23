// Проверка на конфигурациите на бизнесите. Пуска се при стартиране:
// ако нещо в businesses.js е сгрешено, приложението показва ясно съобщение
// вместо да се счупи някъде в интерфейса.
//
// errors   — сериозни проблеми (бизнесът няма да работи правилно)
// warnings — работи, но вероятно не е това, което искате

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function validateBusinessConfig(b) {
  const errors = [];
  const warnings = [];
  const where = `Бизнес "${b.id ?? b.name ?? '?'}"`;

  if (!b.id) errors.push(`${where}: липсва id.`);
  if (!b.name) errors.push(`${where}: липсва name.`);
  if (!Number.isInteger(b.slotMinutes) || b.slotMinutes <= 0) errors.push(`${where}: slotMinutes трябва да е цяло число > 0.`);
  if (!Number.isInteger(b.maxPartySize) || b.maxPartySize < 1) errors.push(`${where}: maxPartySize трябва да е цяло число ≥ 1.`);
  for (const key of ['resource', 'customer', 'party']) {
    if (!b.labels?.[key]) errors.push(`${where}: липсва labels.${key}.`);
  }

  const types = b.resourceTypes ?? {};
  if (!Object.keys(types).length) errors.push(`${where}: resourceTypes е празно.`);

  // ресурси
  const resources = b.resources ?? [];
  if (!resources.length) errors.push(`${where}: няма нито един ресурс.`);
  const resIds = new Set();
  for (const r of resources) {
    if (resIds.has(r.id)) errors.push(`${where}: повтарящо се id на ресурс „${r.id}“.`);
    resIds.add(r.id);
    if (!types[r.type]) errors.push(`${where}: ресурс „${r.name}“ има тип „${r.type}“, който не е в resourceTypes.`);
    if (!Number.isInteger(r.capacity) || r.capacity < 1) errors.push(`${where}: ресурс „${r.name}“ — capacity трябва да е ≥ 1.`);
    if (r.mode !== 'exclusive' && r.mode !== 'shared') errors.push(`${where}: ресурс „${r.name}“ — mode трябва да е 'exclusive' или 'shared'.`);
  }

  // услуги
  const services = b.services ?? [];
  if (!services.length) errors.push(`${where}: няма нито една услуга.`);
  const srvIds = new Set();
  for (const s of services) {
    if (srvIds.has(s.id)) errors.push(`${where}: повтарящо се id на услуга „${s.id}“.`);
    srvIds.add(s.id);
    if (!Number.isInteger(s.duration) || s.duration <= 0) errors.push(`${where}: услуга „${s.name}“ — duration трябва да е > 0 минути.`);
    else if (b.slotMinutes && s.duration % b.slotMinutes !== 0)
      warnings.push(`${where}: „${s.name}“ (${s.duration} мин) не е кратна на слота (${b.slotMinutes} мин).`);
    if (!s.resourceTypes?.length) errors.push(`${where}: услуга „${s.name}“ няма resourceTypes.`);
    for (const t of s.resourceTypes ?? []) {
      if (!types[t]) errors.push(`${where}: услуга „${s.name}“ сочи към непознат тип „${t}“.`);
    }
    if (!resources.some((r) => s.resourceTypes?.includes(r.type)))
      warnings.push(`${where}: за услуга „${s.name}“ няма нито един подходящ ресурс.`);
  }

  // работно време
  const wh = b.workingHours ?? {};
  if (!Object.keys(wh).length) errors.push(`${where}: workingHours е празно.`);
  for (const [day, periods] of Object.entries(wh)) {
    if (!/^[0-6]$/.test(day)) errors.push(`${where}: ден „${day}“ в workingHours трябва да е 0–6 (0 = неделя).`);
    let prevEnd = -1;
    for (const p of periods) {
      const [from, to] = p ?? [];
      if (!TIME_RE.test(from ?? '') || !TIME_RE.test(to ?? '')) {
        errors.push(`${where}: ден ${day} — часът трябва да е във формат "ЧЧ:ММ" (напр. "09:00").`);
        continue;
      }
      const a = toMin(from);
      const z = toMin(to);
      if (a >= z) errors.push(`${where}: ден ${day} — ${from} е след ${to}.`);
      if (a < prevEnd) errors.push(`${where}: ден ${day} — периодите се припокриват или не са подредени.`);
      prevEnd = z;
      if (b.slotMinutes && (a % b.slotMinutes || z % b.slotMinutes))
        warnings.push(`${where}: ден ${day} — ${from}–${to} не е подравнено към слота от ${b.slotMinutes} мин.`);
    }
  }

  for (const d of b.closedDates ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`${where}: closedDates „${d}“ трябва да е "ГГГГ-ММ-ДД".`);
  }

  return { errors, warnings };
}

export function validateAllBusinesses(list) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  for (const b of list) {
    if (ids.has(b.id)) errors.push(`Повтарящо се id на бизнес „${b.id}“.`);
    ids.add(b.id);
    const r = validateBusinessConfig(b);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  return { errors, warnings };
}
