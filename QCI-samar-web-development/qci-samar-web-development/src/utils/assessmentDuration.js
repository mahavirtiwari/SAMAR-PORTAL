// On-site assessment duration is fixed by the enterprise classification, so the
// operations team shouldn't be hand-picking an end date. Manufacturing scales
// with unit size; service is always a single day (typically remote).
//   Manufacturing: start-up / micro / small -> 1, medium -> 2, large -> 3
//   Service: any size -> 1
// Returns the duration in whole days, or null when the classification is unknown
// (in which case the caller should leave the end date for the user to pick).

const MANUFACTURING_DAYS_BY_SIZE = {
  startup: 1,
  micro: 1,
  small: 1,
  medium: 2,
  large: 3,
};

export const getAssessmentDurationDays = (sector, enterpriseClassification) => {
  const normalizedSector = String(sector || '').toLowerCase();
  const normalizedSize = String(enterpriseClassification || '').toLowerCase();

  if (normalizedSector === 'service') {
    return 1;
  }
  if (normalizedSector === 'manufacturing') {
    return MANUFACTURING_DAYS_BY_SIZE[normalizedSize] ?? null;
  }
  return null;
};
