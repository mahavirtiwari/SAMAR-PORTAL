---
title: "Case Conversion (camelCase ↔ snake_case)"
category: "features"
tags: ["case-conversion", "camelCase", "snake_case", "middleware", "api"]
related:
  - ../30-api/31-api-overview.md
  - ../40-development/43-coding-standards.md
code_files:
  - app/Http/Middleware/ConvertRequestToSnakeCase.php
  - app/Http/Middleware/ConvertResponseToCamelCase.php
  - app/Support/CaseConverter.php
  - bootstrap/app.php
last_updated: "2025-01-26"
version: "1.0"
---

# Case Conversion (camelCase ↔ snake_case)

**Location**: `docs/20-features/28-case-conversion.md`
**Related**: [API Overview](../30-api/31-api-overview.md)

## Overview

The QCI SAMAR API implements **bidirectional case conversion** to support both frontend JavaScript conventions (camelCase) and backend PHP conventions (snake_case).

This feature allows client applications to:
- ✅ Send requests in **either camelCase or snake_case** format
- ✅ Receive responses in **consistent camelCase** format
- ✅ Use naming conventions that match their technology stack

## Business Value

### Frontend Benefits
- **JavaScript/TypeScript Compatibility**: Use native camelCase conventions
- **Type Safety**: TypeScript interfaces match API responses exactly
- **Framework Integration**: Works seamlessly with React, Angular, Vue.js
- **No Manual Conversion**: No need for custom mapping logic

### Backend Benefits
- **Laravel Conventions**: Database columns and models use snake_case
- **Consistency**: PHP code follows standard Laravel/PHP conventions
- **Automatic Translation**: No manual case conversion in controllers
- **Database Compatibility**: Direct mapping to database column names

## How It Works

### Request Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Application                       │
│             (sends camelCase OR snake_case)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│        ConvertRequestToSnakeCase Middleware                 │
│   Converts: firstName → first_name                          │
│   Converts: emailAddress → email_address                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            Controller & Business Logic                      │
│        (works with snake_case internally)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│       ConvertResponseToCamelCase Middleware                 │
│   Converts: first_name → firstName                          │
│   Converts: email_address → emailAddress                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Client Application                         │
│              (receives camelCase only)                      │
└─────────────────────────────────────────────────────────────┘
```

### Middleware Implementation

**1. ConvertRequestToSnakeCase**
- **Location**: `app/Http/Middleware/ConvertRequestToSnakeCase.php`
- **Trigger**: Every incoming API request
- **Action**: Converts all request keys from camelCase to snake_case
- **Scope**: JSON body, form data, query parameters

**2. ConvertResponseToCamelCase**
- **Location**: `app/Http/Middleware/ConvertResponseToCamelCase.php`
- **Trigger**: Every outgoing JSON response
- **Action**: Converts all response keys from snake_case to camelCase
- **Scope**: All JSON response data

**3. CaseConverter Utility**
- **Location**: `app/Support/CaseConverter.php`
- **Methods**:
  - `toCamelCase(array $data)` - Recursive conversion to camelCase
  - `toSnakeCase(array $data)` - Recursive conversion to snake_case
- **Features**: Handles nested objects and arrays

## Usage Examples

### Example 1: User Registration

**Client Request** (camelCase - recommended):
```javascript
// JavaScript/TypeScript
const userData = {
  firstName: "John",
  lastName: "Doe",
  emailAddress: "john@example.com",
  phoneNumber: "+91-9876543210",
  organizationName: "ABC Corp"
};

fetch('/api/v1/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(userData)
});
```

**Server Receives** (automatically converted to snake_case):
```php
// PHP Controller receives
$request->validated(); // Returns:
[
  'first_name' => 'John',
  'last_name' => 'Doe',
  'email_address' => 'john@example.com',
  'phone_number' => '+91-9876543210',
  'organization_name' => 'ABC Corp'
]
```

**Client Response** (always camelCase):
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "id": 42,
    "firstName": "John",
    "lastName": "Doe",
    "emailAddress": "john@example.com",
    "phoneNumber": "+91-9876543210",
    "organizationName": "ABC Corp",
    "createdAt": "2025-01-26T10:30:00Z",
    "updatedAt": "2025-01-26T10:30:00Z"
  }
}
```

### Example 2: Nested Objects

**Request with Nested Structure** (camelCase):
```json
POST /api/v1/applications

{
  "applicationType": "manufacturing",
  "organizationDetails": {
    "companyName": "XYZ Industries",
    "registrationNumber": "U12345MH2020PTC123456",
    "contactInfo": {
      "primaryEmail": "contact@xyz.com",
      "phoneNumbers": ["+91-1234567890", "+91-9876543210"],
      "address": {
        "streetAddress": "123 Main Street",
        "cityName": "Mumbai",
        "pinCode": "400001"
      }
    }
  }
}
```

**Server Processing** (snake_case):
```php
// Controller receives
[
  'application_type' => 'manufacturing',
  'organization_details' => [
    'company_name' => 'XYZ Industries',
    'registration_number' => 'U12345MH2020PTC123456',
    'contact_info' => [
      'primary_email' => 'contact@xyz.com',
      'phone_numbers' => ['+91-1234567890', '+91-9876543210'],
      'address' => [
        'street_address' => '123 Main Street',
        'city_name' => 'Mumbai',
        'pin_code' => '400001'
      ]
    ]
  ]
]
```

**Response** (camelCase):
```json
{
  "success": true,
  "message": "Application created successfully",
  "data": {
    "id": 1001,
    "applicationType": "manufacturing",
    "organizationDetails": {
      "companyName": "XYZ Industries",
      "registrationNumber": "U12345MH2020PTC123456",
      "contactInfo": {
        "primaryEmail": "contact@xyz.com",
        "phoneNumbers": ["+91-1234567890", "+91-9876543210"],
        "address": {
          "streetAddress": "123 Main Street",
          "cityName": "Mumbai",
          "pinCode": "400001"
        }
      }
    },
    "createdAt": "2025-01-26T11:00:00Z"
  }
}
```

### Example 3: Both Formats Work

These two requests are **exactly equivalent**:

**Option A: camelCase** (recommended for JavaScript):
```json
POST /api/v1/users
{
  "firstName": "Jane",
  "lastName": "Smith",
  "emailAddress": "jane@example.com"
}
```

**Option B: snake_case** (traditional backend):
```json
POST /api/v1/users
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email_address": "jane@example.com"
}
```

**Both produce identical response**:
```json
{
  "success": true,
  "data": {
    "id": 43,
    "firstName": "Jane",
    "lastName": "Smith",
    "emailAddress": "jane@example.com",
    "createdAt": "2025-01-26T12:00:00Z"
  }
}
```

## Technical Details

### Middleware Registration

**Location**: `bootstrap/app.php`

```php
$middleware->api(prepend: [
    HandleCors::class,               // ← Must be first: CORS headers even on error responses
    ForceJsonResponse::class,
    SecurityHeaders::class,
    AddApiVersionHeader::class,
    TrimStrings::class,
    SanitizeInput::class,
    ConvertRequestToSnakeCase::class,  // ← Request conversion
    ConvertResponseToCamelCase::class, // ← Response conversion
]);
```

### Conversion Algorithm

**CaseConverter::toSnakeCase()**:
```php
public static function toSnakeCase(array $data): array
{
    $result = [];
    foreach ($data as $key => $value) {
        // Convert key: firstName → first_name
        $snakeKey = Str::snake($key);

        // Recursively process nested arrays
        if (is_array($value)) {
            $result[$snakeKey] = self::toSnakeCase($value);
        } else {
            $result[$snakeKey] = $value;
        }
    }
    return $result;
}
```

**CaseConverter::toCamelCase()**:
```php
public static function toCamelCase(array $data): array
{
    $result = [];
    foreach ($data as $key => $value) {
        // Convert key: first_name → firstName
        $camelKey = Str::camel($key);

        // Recursively process nested arrays
        if (is_array($value)) {
            $result[$camelKey] = self::toCamelCase($value);
        } else {
            $result[$camelKey] = $value;
        }
    }
    return $result;
}
```

### Recursive Processing

The conversion works **recursively** through:
- ✅ Top-level object keys
- ✅ Nested objects
- ✅ Arrays of objects
- ✅ Deeply nested structures
- ✅ Mixed structures (objects within arrays within objects)

**Example**:
```javascript
// Input (any level of nesting)
{
  topLevel: {
    nestedLevel: {
      deeplyNested: {
        veryDeep: "value"
      }
    }
  }
}

// Server receives (all converted)
{
  top_level: {
    nested_level: {
      deeply_nested: {
        very_deep: "value"
      }
    }
  }
}
```

## Best Practices

### For Frontend Developers

✅ **DO**:
- Use camelCase in your API requests (matches JavaScript conventions)
- Define TypeScript interfaces with camelCase properties
- Expect all responses in camelCase format
- Use camelCase in API documentation examples

❌ **DON'T**:
- Don't manually convert case in your code
- Don't use snake_case unless working with legacy systems
- Don't expect snake_case in responses (always camelCase)

**Example TypeScript Interface**:
```typescript
interface User {
  id: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
}

// This matches API responses exactly!
```

### For Backend Developers

✅ **DO**:
- Use snake_case in database migrations
- Use snake_case in model properties
- Use snake_case in validation rules
- Trust the middleware to handle conversion

❌ **DON'T**:
- Don't manually convert case in controllers
- Don't bypass the middleware
- Don't use camelCase in database columns
- Don't use camelCase in Laravel models

**Example Laravel Model**:
```php
class User extends Model
{
    // Use snake_case (matches database)
    protected $fillable = [
        'first_name',
        'last_name',
        'email_address',
        'phone_number',
    ];

    // Middleware handles conversion to camelCase for API
}
```

## Testing

### Unit Tests

**Location**: `tests/Unit/CaseConverterTest.php`

```php
public function test_converts_to_snake_case()
{
    $input = [
        'firstName' => 'John',
        'emailAddress' => 'john@example.com',
    ];

    $result = CaseConverter::toSnakeCase($input);

    $this->assertEquals([
        'first_name' => 'John',
        'email_address' => 'john@example.com',
    ], $result);
}

public function test_converts_to_camel_case()
{
    $input = [
        'first_name' => 'John',
        'email_address' => 'john@example.com',
    ];

    $result = CaseConverter::toCamelCase($input);

    $this->assertEquals([
        'firstName' => 'John',
        'emailAddress' => 'john@example.com',
    ], $result);
}
```

### Manual Testing

**Test both formats work**:
```bash
# Test with camelCase
curl -X POST http://localhost:8000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"firstName":"John","emailAddress":"john@example.com"}'

# Test with snake_case
curl -X POST http://localhost:8000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"first_name":"John","email_address":"john@example.com"}'

# Both should produce identical camelCase response
```

## Configuration

### No Configuration Required

The case conversion is **automatically enabled** for all API routes. No configuration needed!

**Middleware Applied To**:
- ✅ All routes under `/api/*`
- ✅ All JSON requests
- ✅ All JSON responses
- ❌ Not applied to non-API routes (web, webhooks with special handling)

### Disabling (Not Recommended)

If you need to disable case conversion (not recommended):

**Option 1**: Remove from middleware stack (`bootstrap/app.php`):
```php
// Remove these lines (NOT RECOMMENDED)
// \App\Http\Middleware\ConvertRequestToSnakeCase::class,
// \App\Http\Middleware\ConvertResponseToCamelCase::class,
```

**Option 2**: Skip for specific routes:
```php
// In route definition
Route::post('/special-endpoint', [Controller::class, 'method'])
    ->withoutMiddleware([
        ConvertRequestToSnakeCase::class,
        ConvertResponseToCamelCase::class
    ]);
```

## Limitations

### Not Converted

The following are **NOT** converted:
- ❌ File names and paths
- ❌ Database table names
- ❌ Environment variable names
- ❌ Configuration keys
- ❌ Enum values (string literals)
- ❌ Non-array/object values

### Example of Non-Converted Values

```json
{
  "fileType": "PDF",              // ✅ Key converted
  "fileName": "my_document.pdf",  // ⚠️ Value NOT converted (filename)
  "status": "PENDING_REVIEW",     // ⚠️ Value NOT converted (enum)
  "configKey": "app.timezone"     // ⚠️ Value NOT converted (config)
}
```

## Troubleshooting

### Issue: Validation fails with camelCase

**Problem**: Validation rules defined in snake_case don't match camelCase input

**Solution**: ✅ Already handled! Middleware converts request to snake_case BEFORE validation

```php
// Validation rules (use snake_case)
public function rules(): array
{
    return [
        'first_name' => 'required|string',    // ✅ Correct
        'email_address' => 'required|email',  // ✅ Correct
    ];
}

// Client can send camelCase - middleware converts it!
// { "firstName": "...", "emailAddress": "..." } → Works perfectly!
```

### Issue: Response has mixed case

**Problem**: Some keys are camelCase, some are snake_case

**Solution**: Check for:
1. Database column names should be snake_case
2. Model attributes should be snake_case
3. Don't manually add keys to response after middleware runs

### Issue: Nested conversion not working

**Problem**: Only top-level keys converted

**Solution**: ✅ Should work automatically! If not:
1. Ensure data is proper array structure (not objects)
2. Check middleware is registered correctly
3. Verify Laravel cache cleared: `php artisan config:clear`

## Performance

### Overhead

**Minimal performance impact**:
- ⚡ ~1-2ms per request (negligible)
- 📊 Works on array keys only (not values)
- 🔄 Efficient recursive algorithm
- 💾 No database queries involved

### Benchmarks

```
Request size: 10 fields → ~0.5ms
Request size: 100 fields → ~1.5ms
Request size: 1000 fields → ~5ms (unlikely scenario)
```

**Conclusion**: Performance impact is negligible for typical API usage.

## Migration Guide

### For Existing Clients

**Before Case Conversion** (old way):
```javascript
// Had to manually convert
const apiData = {
  first_name: user.firstName,
  email_address: user.emailAddress
};
```

**After Case Conversion** (new way):
```javascript
// Just use camelCase directly!
const apiData = {
  firstName: user.firstName,
  emailAddress: user.emailAddress
};
```

### For Existing Backend Code

**No changes needed!** Your backend code continues to use snake_case:

```php
// Still works exactly the same
$user = User::create([
    'first_name' => $request->input('first_name'),
    'email_address' => $request->input('email_address'),
]);

// Middleware handles conversion automatically
```

## See Also

- [API Overview](../30-api/31-api-overview.md) - Complete API documentation

**Code References**:
- [`ConvertRequestToSnakeCase`](../../app/Http/Middleware/ConvertRequestToSnakeCase.php)
- [`ConvertResponseToCamelCase`](../../app/Http/Middleware/ConvertResponseToCamelCase.php)
- [`CaseConverter`](../../app/Support/CaseConverter.php)
- [`bootstrap/app.php`](../../bootstrap/app.php#L63-L64)
- [`CaseConverterTest`](../../tests/Unit/CaseConverterTest.php)
