// Конфигурации на бизнесите. Цялата разлика между бизнесите е ТУК —
// кодът на логиката и интерфейса е общ. Нов бизнес = нов обект в масива.
//
// Схема:
//   id, name, icon, description
//   slotMinutes    — стъпка на мрежата (и на началните часове)
//   bufferMinutes  — задължителна пауза след всяка резервация (почистване, подготовка)
//   maxPartySize   — максимален брой хора в една резервация
//   labels         — текстове, специфични за бизнеса (как се казва "ресурс", "клиент"...)
//   workingHours   — { [ден 0..6]: [["09:00","13:00"], ["14:00","18:00"]] }, 0 = неделя
//   closedDates    — почивни дни ["2026-12-25", ...]
//   resources      — [{ id, name, type, capacity, mode: 'exclusive' | 'shared', tags? }]
//   resourceTypes  — { [type]: "етикет" }
//   services       — [{ id, name, duration, resourceTypes: [...], price? }]

import { validateAllBusinesses, validateBusinessConfig } from './validateConfig.js';

const weekdays = (periods) => ({ 1: periods, 2: periods, 3: periods, 4: periods, 5: periods });

const allBusinesses = [
  {
    id: 'clinic',
    name: 'Лекарски кабинет „Здраве“',
    icon: '🩺',
    description: 'Часове при лични лекари и медицинска сестра. Един пациент наведнъж, обедна почивка.',
    slotMinutes: 15,
    bufferMinutes: 0,
    maxPartySize: 1,
    labels: { resource: 'Специалист', customer: 'Пациент', party: 'Пациенти' },
    workingHours: {
      ...weekdays([
        ['08:00', '12:00'],
        ['13:00', '17:00'],
      ]),
      6: [['09:00', '12:00']],
    },
    closedDates: ['2026-12-24', '2026-12-25', '2026-12-26'],
    resourceTypes: { doctor: 'Лекар', nurse: 'Медицинска сестра' },
    resources: [
      { id: 'dr-ivanova', name: 'Д-р Иванова', type: 'doctor', capacity: 1, mode: 'exclusive' },
      { id: 'dr-petrov', name: 'Д-р Петров', type: 'doctor', capacity: 1, mode: 'exclusive' },
      { id: 'dr-georgieva', name: 'Д-р Георгиева', type: 'doctor', capacity: 1, mode: 'exclusive' },
      { id: 'nurse-koleva', name: 'Сестра Колева', type: 'nurse', capacity: 1, mode: 'exclusive' },
    ],
    services: [
      { id: 'checkup', name: 'Преглед', duration: 15, resourceTypes: ['doctor'], price: 30 },
      { id: 'prevention', name: 'Профилактичен преглед', duration: 30, resourceTypes: ['doctor'], price: 0 },
      { id: 'results', name: 'Консултация с резултати', duration: 15, resourceTypes: ['doctor'], price: 20 },
      { id: 'blood', name: 'Вземане на кръв', duration: 15, resourceTypes: ['nurse'], price: 10 },
      { id: 'ecg', name: 'ЕКГ', duration: 30, resourceTypes: ['nurse'], price: 25 },
    ],
  },
  {
    id: 'salon',
    name: 'Салон за красота „Бела“',
    icon: '💇',
    description: 'Фризьори и маникюристи, 15-минутни слотове и 15 мин. подготовка след всеки клиент.',
    slotMinutes: 15,
    bufferMinutes: 15,
    maxPartySize: 1,
    labels: { resource: 'Служител', customer: 'Клиент', party: 'Клиенти' },
    workingHours: {
      ...weekdays([['10:00', '20:00']]),
      6: [['10:00', '18:00']],
    },
    closedDates: [],
    resourceTypes: { hair: 'Фризьор', nails: 'Маникюр/педикюр' },
    resources: [
      { id: 'st-elena', name: 'Елена', type: 'hair', capacity: 1, mode: 'exclusive' },
      { id: 'st-nikol', name: 'Никол', type: 'hair', capacity: 1, mode: 'exclusive' },
      { id: 'st-dimitar', name: 'Димитър', type: 'hair', capacity: 1, mode: 'exclusive' },
      { id: 'nl-vesela', name: 'Весела', type: 'nails', capacity: 1, mode: 'exclusive' },
      { id: 'nl-ani', name: 'Ани', type: 'nails', capacity: 1, mode: 'exclusive' },
    ],
    services: [
      { id: 'haircut', name: 'Подстригване', duration: 45, resourceTypes: ['hair'], price: 30 },
      { id: 'coloring', name: 'Боядисване', duration: 120, resourceTypes: ['hair'], price: 85 },
      { id: 'styling', name: 'Прическа', duration: 60, resourceTypes: ['hair'], price: 45 },
      { id: 'manicure', name: 'Маникюр', duration: 60, resourceTypes: ['nails'], price: 35 },
      { id: 'pedicure', name: 'Педикюр', duration: 75, resourceTypes: ['nails'], price: 45 },
    ],
  },
  {
    id: 'restaurant',
    name: 'Ресторант „Старата лоза“',
    icon: '🍽️',
    description: 'Маси с различен капацитет. Автоматичен избор на най-подходящата маса (best-fit).',
    slotMinutes: 30,
    bufferMinutes: 0,
    maxPartySize: 10,
    labels: { resource: 'Маса', customer: 'Гост', party: 'Гости' },
    workingHours: {
      0: [['12:00', '22:00']],
      ...weekdays([['12:00', '23:00']]),
      6: [['12:00', '23:30']],
    },
    closedDates: ['2026-12-31'],
    resourceTypes: { indoor: 'Салон', terrace: 'Тераса' },
    resources: [
      { id: 't1', name: 'Маса 1', type: 'indoor', capacity: 2, mode: 'exclusive' },
      { id: 't2', name: 'Маса 2', type: 'indoor', capacity: 2, mode: 'exclusive' },
      { id: 't3', name: 'Маса 3', type: 'indoor', capacity: 4, mode: 'exclusive' },
      { id: 't4', name: 'Маса 4', type: 'indoor', capacity: 4, mode: 'exclusive' },
      { id: 't5', name: 'Маса 5', type: 'indoor', capacity: 6, mode: 'exclusive' },
      { id: 't6', name: 'Маса 6 (VIP)', type: 'indoor', capacity: 10, mode: 'exclusive' },
      { id: 't7', name: 'Тераса 1', type: 'terrace', capacity: 2, mode: 'exclusive' },
      { id: 't8', name: 'Тераса 2', type: 'terrace', capacity: 4, mode: 'exclusive' },
      { id: 't9', name: 'Тераса 3', type: 'terrace', capacity: 6, mode: 'exclusive' },
    ],
    services: [
      { id: 'lunch', name: 'Обяд (1 ч.)', duration: 60, resourceTypes: ['indoor', 'terrace'] },
      { id: 'dinner', name: 'Вечеря (2 ч.)', duration: 120, resourceTypes: ['indoor', 'terrace'] },
      { id: 'event', name: 'Празненство (3 ч.)', duration: 180, resourceTypes: ['indoor'] },
    ],
  },
  {
    id: 'sport',
    name: 'Спортен център „Енергия“',
    icon: '🏋️',
    description: 'Споделени зали с капацитет (много хора едновременно) и ексклузивни кортове.',
    slotMinutes: 30,
    bufferMinutes: 0,
    maxPartySize: 6,
    labels: { resource: 'Зала/корт', customer: 'Клиент', party: 'Участници' },
    workingHours: {
      0: [['09:00', '18:00']],
      ...weekdays([['07:00', '22:00']]),
      6: [['08:00', '20:00']],
    },
    closedDates: [],
    resourceTypes: { gym: 'Фитнес зала', studio: 'Студио', court: 'Корт' },
    resources: [
      { id: 'gym', name: 'Фитнес зала', type: 'gym', capacity: 25, mode: 'shared' },
      { id: 'yoga', name: 'Йога студио', type: 'studio', capacity: 12, mode: 'shared' },
      { id: 'court-1', name: 'Тенис корт 1', type: 'court', capacity: 4, mode: 'exclusive' },
      { id: 'court-2', name: 'Тенис корт 2', type: 'court', capacity: 4, mode: 'exclusive' },
      { id: 'squash', name: 'Скуош корт', type: 'court', capacity: 2, mode: 'exclusive' },
    ],
    services: [
      { id: 'workout', name: 'Тренировка (1 ч.)', duration: 60, resourceTypes: ['gym'] },
      { id: 'workout-long', name: 'Тренировка (1.5 ч.)', duration: 90, resourceTypes: ['gym'] },
      { id: 'yoga-class', name: 'Йога (1 ч.)', duration: 60, resourceTypes: ['studio'] },
      { id: 'court-1h', name: 'Корт – 1 ч.', duration: 60, resourceTypes: ['court'] },
      { id: 'court-2h', name: 'Корт – 2 ч.', duration: 120, resourceTypes: ['court'] },
    ],
  },
  createParking(),
];

// Голям бизнес за демонстрация на производителността: ~100 паркоместа,
// генерирани програмно (конфигурацията може да идва и от API).
function createParking() {
  const resources = [];
  for (let level = 1; level <= 3; level++) {
    for (let n = 1; n <= 30; n++) {
      resources.push({
        id: `p-${level}-${n}`,
        name: `Място ${level}-${String(n).padStart(2, '0')}`,
        type: 'car',
        capacity: 1,
        mode: 'exclusive',
      });
    }
  }
  for (let n = 1; n <= 8; n++) {
    resources.push({ id: `ev-${n}`, name: `Зарядна ${n}`, type: 'ev', capacity: 1, mode: 'exclusive' });
  }
  return {
    id: 'parking',
    name: 'Паркинг „Център“',
    icon: '🅿️',
    description: '98 паркоместа на 3 нива + зарядни станции — показва, че системата е бърза и при много ресурси.',
    slotMinutes: 60,
    bufferMinutes: 0,
    maxPartySize: 1,
    labels: { resource: 'Място', customer: 'Шофьор', party: 'Автомобили' },
    workingHours: {
      0: [['07:00', '23:00']],
      ...weekdays([['07:00', '23:00']]),
      6: [['07:00', '23:00']],
    },
    closedDates: [],
    resourceTypes: { car: 'Паркомясто', ev: 'Зарядна станция' },
    resources,
    services: [
      { id: 'hour', name: '1 час', duration: 60, resourceTypes: ['car', 'ev'], price: 3 },
      { id: 'two-hours', name: '2 часа', duration: 120, resourceTypes: ['car', 'ev'], price: 5 },
      { id: 'half-day', name: 'Половин ден (4 ч.)', duration: 240, resourceTypes: ['car'], price: 8 },
      { id: 'full-day', name: 'Цял ден (16 ч.)', duration: 960, resourceTypes: ['car'], price: 15 },
    ],
  };
}

// Проверка при стартиране: бизнес с грешна конфигурация се пропуска,
// а грешките се показват в приложението (вместо то да се счупи).
export const configReport = validateAllBusinesses(allBusinesses);
export const businesses = allBusinesses.filter((b) => validateBusinessConfig(b).errors.length === 0);
export const businessById = Object.fromEntries(businesses.map((b) => [b.id, b]));
