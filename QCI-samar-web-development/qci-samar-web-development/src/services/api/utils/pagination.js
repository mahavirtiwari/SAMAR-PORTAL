// Utility to build pagination query string
export const buildPaginationParams = data => {
  const queryParams = [];
  if (data?.search) {
    queryParams.push(`search=${encodeURIComponent(data.search)}`);
  }
  if (data?.samarId) {
    queryParams.push(`samarId=${encodeURIComponent(data.samarId)}`);
  }
  if (data?.domainId) {
    queryParams.push(`domainId=${encodeURIComponent(data.domainId)}`);
  }
  if (data?.perPage) {
    queryParams.push(`perPage=${data.perPage}`);
  }
  if (data?.page) {
    queryParams.push(`page=${data.page}`);
  }
  if (data?.status) {
    queryParams.push(`status=${encodeURIComponent(data.status)}`);
  }
  if (data?.all) {
    queryParams.push(`all=${encodeURIComponent(data.all)}`);
  }
  if (data?.isActive !== undefined) {
    queryParams.push(`isActive=${data.isActive}`);
  }
  if (data?.sector) {
    queryParams.push(`sector=${encodeURIComponent(data.sector)}`);
  }
  if (data?.serviceProviderType) {
    queryParams.push(`serviceProviderType=${encodeURIComponent(data.serviceProviderType)}`);
  }
  if (data?.enterpriseSize) {
    queryParams.push(`enterpriseSize=${encodeURIComponent(data.enterpriseSize)}`);
  }

  if (data?.isMandatory !== undefined) {
    queryParams.push(`isMandatory=${data.isMandatory}`);
  }
  if (data?.vendorCategoryId) {
    queryParams.push(`vendorCategoryId=${encodeURIComponent(data.vendorCategoryId)}`);
  }
  if (data?.disciplineId) {
    queryParams.push(`disciplineId=${encodeURIComponent(data.disciplineId)}`);
  }
  if (data?.unitId) {
    queryParams.push(`unitId=${encodeURIComponent(data.unitId)}`);
  }
  if (data?.organizationId) {
    queryParams.push(`organizationId=${encodeURIComponent(data.organizationId)}`);
  }
  if (data?.unitAdmin) {
    queryParams.push(`unitAdmin=${encodeURIComponent(data.unitAdmin)}`);
  }
  if (data?.isVerified !== undefined) {
    queryParams.push(`isVerified=${data.isVerified}`);
  }
  if (data?.isProfileCompleted !== undefined) {
    queryParams.push(`isProfileCompleted=${data.isProfileCompleted}`);
  }
  if (data?.certificationStatus) {
    queryParams.push(`certificationStatus=${encodeURIComponent(data.certificationStatus)}`);
  }
  if (data?.state) {
    queryParams.push(`state=${encodeURIComponent(data.state)}`);
  }
  if (data?.fromDate) {
    queryParams.push(`fromDate=${encodeURIComponent(data.fromDate)}`);
  }
  if (data?.toDate) {
    queryParams.push(`toDate=${encodeURIComponent(data.toDate)}`);
  }
  if (data?.sortBy) {
    queryParams.push(`sortBy=${encodeURIComponent(data.sortBy)}`);
  }
  if (data?.sortOrder) {
    queryParams.push(`sortOrder=${encodeURIComponent(data.sortOrder)}`);
  }
  if (data?.role) {
    queryParams.push(`role=${data.role}`);
  }
  if (data?.assignedState) {
    queryParams.push(`assignedState=${encodeURIComponent(data.assignedState)}`);
  }

  if (data?.type) {
    queryParams.push(`type=${encodeURIComponent(data.type)}`);
  }
  // Application Type filter (Fresh = 'new' / Renewal = 'renewal') is sent to the backend as `type`.
  if (data?.applicationType) {
    queryParams.push(`type=${encodeURIComponent(data.applicationType)}`);
  }
  if (data?.q) {
    queryParams.push(`q=${encodeURIComponent(data.q)}`);
  }

  if (data?.applicantStatus) {
    queryParams.push(`applicantStatus=${encodeURIComponent(data.applicantStatus)}`);
  }

  if (data?.classification) {
    queryParams.push(`enterpriseClassification=${encodeURIComponent(data.classification)}`);
  }
  if (data?.excludeStatus) {
    queryParams.push(`excludeStatus=${encodeURIComponent(data.excludeStatus)}`);
  }
  if (data?.event) {
    queryParams.push(`event=${encodeURIComponent(data.event)}`);
  }
  if (data?.category) {
    queryParams.push(`category=${encodeURIComponent(data.category)}`);
  }
  if (data?.entityType) {
    queryParams.push(`entityType=${encodeURIComponent(data.entityType)}`);
  }
  if (data?.dateFrom) {
    queryParams.push(`dateFrom=${encodeURIComponent(data.dateFrom)}`);
  }
  if (data?.dateTo) {
    queryParams.push(`dateTo=${encodeURIComponent(data.dateTo)}`);
  }
  if (data?.severity) {
    queryParams.push(`severity=${encodeURIComponent(data.severity)}`);
  }
  if (data?.source) {
    queryParams.push(`source=${encodeURIComponent(data.source)}`);
  }
  if (data?.startDate) {
    queryParams.push(`startDate=${encodeURIComponent(data.startDate)}`);
  }
  if (data?.endDate) {
    queryParams.push(`endDate=${encodeURIComponent(data.endDate)}`);
  }
  return queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
};

/**
 * Walks every page of a paginated list endpoint and returns the concatenated rows.
 * The API caps perPage at 100, so a single request silently truncates longer lists.
 * `maxPages` is only a runaway guard (10,000 rows at the default page size).
 * @param {(params: {perPage: number, page: number}) => Promise<Object>} fetchPage
 */
export const fetchAllPages = async (fetchPage, { perPage = 100, maxPages = 100 } = {}) => {
  const rows = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchPage({ perPage, page });
    rows.push(...(response?.data || []));
    if (page >= (response?.pagination?.lastPage ?? 1)) {
      break;
    }
  }
  return rows;
};
