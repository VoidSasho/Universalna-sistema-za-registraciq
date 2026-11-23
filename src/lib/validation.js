// Валидация на резервация преди запис. Връща обект { поле: съобщение }.
// Празен обект = валидна резервация.

import { getBucket } from './reservationIndex.js';
import {
  checkResource,
  fitsWorkingHours,
  getWorkingPeriods,
  isInPast,
  serviceFitsResource,
} from './availability.js';
import { formatMinutes } from './time.js';

const PHONE_RE = /^\+?[0-9 ]{7,15}$/;

export function validateReservation(business, index, draft, { allowPast = false } = {}) {
  const errors = {};

  if (!draft.customer || draft.customer.trim().length < 2) errors.customer = 'Въведете име (поне 2 символа).';
  if (!draft.phone || !PHONE_RE.test(draft.phone.trim())) errors.phone = 'Невалиден телефон (7–15 цифри).';

  const service = business.services.find((s) => s.id === draft.serviceId);
  if (!service) errors.serviceId = 'Изберете услуга.';

  const resource = business.resources.find((r) => r.id === draft.resourceId);
  if (!resource) errors.resourceId = 'Изберете ресурс.';

  const partySize = Number(draft.partySize);
  if (!Number.isInteger(partySize) || partySize < 1) errors.partySize = 'Броят трябва да е цяло число ≥ 1.';
  else if (partySize > business.maxPartySize) errors.partySize = `Максимум ${business.maxPartySize} за този бизнес.`;

  if (!draft.date) errors.date = 'Изберете дата.';
  if (draft.start == null || draft.start === '') errors.start = 'Изберете начален час.';

  if (Object.keys(errors).length) return errors;

  if (!serviceFitsResource(service, resource)) {
    errors.resourceId = `„${resource.name}“ не предлага „${service.name}“.`;
    return errors;
  }

  const start = Number(draft.start);
  const end = start + service.duration;

  if (start % business.slotMinutes !== 0) {
    errors.start = `Началото трябва да е кратно на ${business.slotMinutes} мин.`;
    return errors;
  }

  const periods = getWorkingPeriods(business, draft.date);
  if (!fitsWorkingHours(periods, start, end)) {
    errors.start =
      periods.length === 0
        ? 'В този ден не се работи.'
        : `${formatMinutes(start)}–${formatMinutes(end)} е извън работното време.`;
    return errors;
  }

  if (!allowPast && isInPast(draft.date, start)) {
    errors.start = 'Не може да се резервира в миналото.';
    return errors;
  }

  const res = checkResource(business, resource, getBucket(index, resource.id, draft.date), {
    start,
    end,
    partySize,
    excludeId: draft.id,
  });
  if (!res.ok) {
    if (res.reason === 'capacity') errors.partySize = `Капацитетът на „${resource.name}“ е ${resource.capacity}.`;
    else if (res.reason === 'full') errors.start = 'Няма достатъчно свободни места в този интервал.';
    else errors.start = 'Припокриване с друга резервация за този ресурс.';
  }
  return errors;
}
