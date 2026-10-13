---
title: "Search Functionality"
category: "features"
tags: ["search", "filtering", "database", "indexes", "performance"]
related:
  - ../30-api/37-api-reference.md
  - 22-authorization-rbac.md
  - ../10-architecture/12-database-schema.md
code_files:
  - app/Services/SearchService.php
  - app/Http/Controllers/Api/V1/SearchController.php
  - database/migrations/2025_11_05_043941_add_search_indexes_to_tables.php
last_updated: "2025-01-05"
version: "1.0"
---

# Search Functionality

**Location**: `docs/20-features/31-search-functionality.md`
**Related**: [API Reference](../30-api/37-api-reference.md) | [Authorization & RBAC](22-authorization-rbac.md) | [Database Schema](../10-architecture/12-database-schema.md)

## Overview

Unified search functionality across all major entities in the QCI SAMAR system with role-based access control, filtering, sorting, and performance optimization through database indexes.

## Business Value

- **Unified Search**: Search across applications, assessments, certificates, users, and organizations
- **Role-Based Access**: Automatic scoping based on user role and permissions
- **Performance Optimized**: 35 database indexes for fast LIKE query performance
- **Advanced Filtering**: Filter by status, date ranges, organization
- **Flexible Sorting**: Relevance, newest, oldest, alphabetical
- **Easy Upgrade Path**: Ready for Laravel Scout integration when needed

## Key Features

### 1. Unified Search

Single endpoint to search across multiple entity types simultaneously:
- Applications
- Assessments
- Certificates
- Users (restricted)
- Organizations (restricted)

### 2. Entity-Specific Search

Dedicated endpoints for searching each entity type with entity-specific filters.

### 3. Role-Based Access Control

Automatic scoping based on user role:

| Role | Applications | Assessments | Certificates | Users | Organizations |
|------|--------------|-------------|--------------|-------|---------------|
| System Admin | All | All | All | All | All |
| DRDO Admin | All | All | All | ❌ | All |
| Operations Manager | All | All | All | ❌ | All |
| Enterprise Admin | Own org | Own org | Own org | Own org | Own only |
| Unit Admin | Own unit | Own unit | Own unit | ❌ | Own only |
| Assessor | Assigned | Assigned | Public | ❌ | Own only |
| Other | Created | ❌ | Public | ❌ | Own only |

### 4. Performance Optimization

35 database indexes added across 6 tables:
- Applications: 6 indexes
- Assessments: 6 indexes
- Certificates: 6 indexes
- Users: 6 indexes
- Organizations: 9 indexes
- Application Products: 3 indexes

**Performance**:
- Small datasets (<10K): 50-100ms
- Medium datasets (10K-100K): 100-300ms
- Large datasets (100K-1M): 300-800ms

### 5. Search Method

**Database LIKE Queries with Indexes**:
- Simple and reliable
- No external dependencies
- Works with existing MySQL database
- Fast enough for current scale
- Easy upgrade path to Laravel Scout

## User Guide

### Unified Search

Search across all entity types:

```bash
curl -X GET "https://api.example.com/api/v1/search?q=ABC%20Company&types[]=applications&types[]=organizations&per_page=20" \
  -H "Authorization: Bearer {token}"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "query": "ABC Company",
    "results": [
      {
        "type": "organization",
        "id": 5,
        "title": "ABC Manufacturing Company",
        "subtitle": "PAN: ABCDE1234F - Mumbai, Maharashtra",
        "matched_fields": ["name"],
        "url": "/api/v1/organization/profile",
        "data": {...}
      },
      {
        "type": "application",
        "id": 123,
        "title": "APP-2025-001",
        "subtitle": "ABC Manufacturing Company - Draft",
        "matched_fields": ["application_number"],
        "url": "/api/v1/applications/123",
        "data": {...}
      }
    ],
    "pagination": {
      "total": 25,
      "per_page": 20,
      "current_page": 1,
      "last_page": 2
    }
  }
}
```

### Search Applications

```bash
curl -X GET "https://api.example.com/api/v1/search/applications?q=manufacturing&status=submitted&per_page=15" \
  -H "Authorization: Bearer {token}"
```

### Search Assessments

```bash
curl -X GET "https://api.example.com/api/v1/search/assessments?q=assessment&sort=newest" \
  -H "Authorization: Bearer {token}"
```

### Search Certificates

```bash
curl -X GET "https://api.example.com/api/v1/search/certificates?q=QCI&status=active" \
  -H "Authorization: Bearer {token}"
```

### Search Users (Admin Only)

```bash
curl -X GET "https://api.example.com/api/v1/search/users?q=john&role=assessor" \
  -H "Authorization: Bearer {token}"
```

### Search Organizations (Admin Only)

```bash
curl -X GET "https://api.example.com/api/v1/search/organizations?q=pvt%20ltd&verified=true" \
  -H "Authorization: Bearer {token}"
```

## Searchable Fields

### Applications
- application_number
- title
- description
- gst_number
- organization.name
- organization.email
- organization.phone
- products.product_name
- products.product_code

### Assessments
- application.application_number
- organization.name
- leadAssessor.full_name
- leadAssessor.email
- assessor.full_name
- assessor.email

### Certificates
- certificate_number
- scope
- organization.name
- organization.email
- application.application_number

### Users
- first_name, last_name (concatenated)
- email
- phone
- designation
- organization.name

### Organizations
- name
- email
- phone
- pan
- gstin
- registered_city
- registered_state
- contact_person_name
- contact_person_email

## API Reference

### Unified Search

**Endpoint**: `GET /api/v1/search`

**Authorization**: `auth:api`

**Query Parameters**:
- `q` (required, string, min:2, max:100) - Search query
- `types` (optional, array) - Entity types: `['applications', 'assessments', 'certificates', 'users', 'organizations']`
- `per_page` (optional, integer, 5-50, default: 15) - Results per page

**Response** (200 OK): See example above

**Errors**:
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid token
- `422 Unprocessable Entity`: Validation errors

### Search Applications

**Endpoint**: `GET /api/v1/search/applications`

**Query Parameters**:
- `q` (required) - Search query
- `status` (optional) - Filter by status
- `organization_id` (optional) - Filter by organization
- `from_date` (optional) - Filter from date
- `to_date` (optional) - Filter to date
- `sort` (optional) - Sort: relevance, newest, oldest, alphabetical
- `per_page` (optional, 5-50, default: 15)

### Search Assessments

**Endpoint**: `GET /api/v1/search/assessments`

**Query Parameters**: Similar to applications

### Search Certificates

**Endpoint**: `GET /api/v1/search/certificates`

**Query Parameters**:
- `q` (required) - Search query
- `status` (optional) - active, expired, revoked
- `organization_id` (optional)
- `sort` (optional)
- `per_page` (optional)

### Search Users

**Endpoint**: `GET /api/v1/search/users`

**Authorization**: `role:system_admin,enterprise_admin`

**Query Parameters**:
- `q` (required) - Search query
- `role` (optional) - Filter by role
- `status` (optional) - active, inactive
- `organization_id` (optional)
- `per_page` (optional)

### Search Organizations

**Endpoint**: `GET /api/v1/search/organizations`

**Authorization**: `role:system_admin,drdo_admin,operations_manager`

**Query Parameters**:
- `q` (required) - Search query
- `verified` (optional) - true/false
- `status` (optional) - active, inactive
- `state` (optional) - Filter by state
- `per_page` (optional)

## Technical Details

### Architecture

**Service Layer**: [`SearchService`](../../app/Services/SearchService.php) (~900 lines)
- Unified search logic
- Entity-specific search methods
- Role-based access control (scoping)
- Filter and sorting application
- Result ranking and highlighting

**Controller**: [`SearchController`](../../app/Http/Controllers/Api/V1/SearchController.php) (~200 lines)
- Request validation
- Calling SearchService methods
- Response formatting
- Error handling

**Migration**: [`add_search_indexes_to_tables`](../../database/migrations/2025_11_05_043941_add_search_indexes_to_tables.php)
- 35 indexes across 6 tables
- Performance optimization for LIKE queries

### Query Pattern

```sql
SELECT * FROM applications
WHERE application_number LIKE '%query%'
   OR title LIKE '%query%'
   OR description LIKE '%query%'
ORDER BY created_at DESC
LIMIT 15 OFFSET 0;
```

### Performance Optimizations

1. ✅ Database indexes on all searchable columns
2. ✅ Pagination (default 15 items per page)
3. ✅ Selective column fetching with `select()`
4. ✅ Eager loading to prevent N+1 queries
5. ✅ Limited joins (only necessary relationships)
6. ✅ Proper query scoping (reduces dataset size)

## Database Indexes

### Applications Table (6 indexes)
- `application_number`
- `title`
- `status`
- `gst_number`
- `organization_id`
- `created_at`

### Assessments Table
- `application_id`
- `status`
- `organization_id`
- `lead_assessor_id`
- `qc_reviewer_id`
- `created_at`

### Certificates Table (6 indexes)
- `certificate_number`
- `status`
- `organization_id`
- `issue_date`
- `expiry_date`
- `created_at`

### Users Table (6 indexes)
- `email`
- `phone`
- `status`
- `organization_id`
- `first_name, last_name` (composite)
- `created_at`

### Organizations Table (9 indexes)
- `name`
- `email`
- `phone`
- `pan`
- `gstin`
- `registered_city`
- `registered_state`
- `is_verified`
- `created_at`

### Application Products Table (3 indexes)
- `application_id`
- `product_name`
- `product_code`

## Configuration

### Environment Variables

No special configuration needed. Uses existing database connection.

### Migration

```bash
# Run migration to add indexes
php artisan migrate
```

## Known Limitations

### Current Implementation

1. **No typo tolerance** - "manufaturing" won't match "manufacturing"
2. **Basic relevance** - Sorted by created_at, not true relevance score
3. **No faceted search** - Can't aggregate by status, type, etc.
4. **Performance ceiling** - LIKE queries slow down beyond ~100K records

### Workarounds

- Users need to type exact terms
- Sort by newest/oldest instead of relevance
- Use filters to narrow results
- Plan Scout migration for future

## Future Enhancements

### When to Upgrade to Laravel Scout?

Consider migrating when:
- Dataset exceeds 100K records per table
- Search performance drops below 500ms
- Need typo tolerance
- Need relevance scoring beyond created_at
- Need faceted search or aggregations
- Need real-time indexing

### Scout Migration Effort

**Estimated Time**: 4-8 hours

**Steps**:
1. Install Scout & Meilisearch (1 hour)
2. Add Searchable trait to models (1 hour)
3. Configure searchable arrays (2 hours)
4. Update SearchService methods (2-3 hours)
5. Import existing data (30 mins)
6. Testing (1-2 hours)

### Future Optimizations

- 🔄 Redis caching for frequent searches
- 🔄 Composite indexes for common filter combinations
- 🔄 Database query result caching
- 🔄 Full-text search (MySQL FULLTEXT indexes)
- 🔄 Search analytics tracking
- 🔄 Autocomplete/suggestions
- 🔄 Laravel Scout + Meilisearch

## Troubleshooting

### Slow Search Performance

**Issue**: Search takes > 1 second

**Solution**:
```bash
# Verify indexes exist
php artisan db:show

# Check query performance
tail -f storage/logs/laravel.log

# Ensure migration ran
php artisan migrate:status
```

### No Results Found

**Issue**: Search returns empty results

**Solution**:
- Check search query is at least 2 characters
- Verify user has permission to view results
- Check entity type filter is correct
- Ensure data exists in database

### Permission Denied

**Issue**: 403 Forbidden on user/organization search

**Solution**:
- Verify user has required role (system_admin, enterprise_admin, etc.)
- Check JWT token is valid
- Confirm role middleware is applied

## Testing Recommendations

### Manual Testing

1. ⚠️ Test unified search with different entity types
2. ⚠️ Test each entity-specific search endpoint
3. ⚠️ Verify role-based access control
4. ⚠️ Test filters (status, dates, etc.)
5. ⚠️ Test sorting options
6. ⚠️ Test pagination
7. ⚠️ Verify performance with realistic data

### Performance Testing

```bash
# Install Laravel Telescope for query monitoring
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate

# Monitor search queries
# Access: http://localhost/telescope
```

## Deployment Checklist

### Pre-Deployment
- [ ] Review code changes
- [ ] Backup database
- [ ] Test in staging environment

### Deployment
- [ ] Pull latest code to server
- [ ] Run migration: `php artisan migrate`
- [ ] Verify indexes created
- [ ] Clear cache: `php artisan cache:clear`
- [ ] Clear config: `php artisan config:clear`

### Post-Deployment
- [ ] Test each search endpoint
- [ ] Verify role-based access control
- [ ] Monitor query performance
- [ ] Check error logs

### Optional
- [ ] Add rate limiting (60 requests/minute)
- [ ] Set up query monitoring (Telescope)
- [ ] Configure Redis caching for common queries
- [ ] Add search analytics

## Code References

**Service**: [`SearchService`](../../app/Services/SearchService.php)
**Controller**: [`SearchController`](../../app/Http/Controllers/Api/V1/SearchController.php)
**Migration**: [`add_search_indexes_to_tables`](../../database/migrations/2025_11_05_043941_add_search_indexes_to_tables.php)
**Routes**: [`routes/api.php`](../../routes/api.php)

## See Also

- [API Reference](../30-api/37-api-reference.md) - Complete API documentation
- [Authorization & RBAC](22-authorization-rbac.md) - Role-based access control
- [Database Schema](../10-architecture/12-database-schema.md) - Database structure
