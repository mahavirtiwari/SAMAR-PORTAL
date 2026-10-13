// A renewal keeps its tag at every lifecycle stage (incl. after certified); callers gate on this alone, never on status.
export const isRenewalApplication = app => Boolean(app?.applicationType === 'renewal' || app?.previousApplicationId);
