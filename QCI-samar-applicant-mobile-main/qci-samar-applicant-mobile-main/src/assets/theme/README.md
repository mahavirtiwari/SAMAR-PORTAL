# WeborityOS Mobile Theme System

This document provides guidelines for using the standardized theme system in the WeborityOS Mobile app. The theme system is designed to ensure consistent visual styling throughout the application.

## Theme Structure

The theme system consists of three main files:

1. **Theme.js**: Defines colors, fonts, spacing, border radii, and shadows
2. **Styles.js**: Contains reusable styles organized by purpose
3. **Layout.js**: Handles responsive sizing for different screen dimensions

## Using Colors

Always use the semantic color system rather than hard-coded hex values:

```javascript
// ❌ Don't do this
<View style={{ backgroundColor: '#7880FF' }} />;

// ✅ Do this instead
import { COLORS } from '../assets/theme/Theme';

<View style={{ backgroundColor: COLORS.primary.main }} />;
```

The color system is organized by purpose:

- `COLORS.background`: App backgrounds (primary, secondary, card, etc.)
- `COLORS.primary`: Brand colors
- `COLORS.text`: Text colors
- `COLORS.button`: Button-specific colors
- `COLORS.border`: Border colors
- `COLORS.status`: Status/feedback colors (success, error, etc.)
- `COLORS.badge`: Badge colors
- `COLORS.lead`: Lead and task status colors
- `COLORS.modal`: Modal-specific colors
- `COLORS.misc`: Miscellaneous colors

## Typography

Use the typography styles from `commonStyles` for consistent text styling:

```javascript
// ❌ Don't do this
<Text style={{ fontFamily: 'Gilroy-Bold', fontSize: 16, color: '#3F4254' }} />;

// ✅ Do this instead
import { commonStyles } from '../assets/theme/Styles';

<Text style={commonStyles.bodyMedium} />;
```

Typography styles are organized by purpose:

- Headings: `h1`, `h2`, `h3`
- Body text: `bodyLarge`, `bodyMedium`, `bodySmall`, `bodyXSmall`
- Labels: `labelLarge`, `labelMedium`, `labelSmall`, `labelXSmall`
- Button text: `buttonLarge`, `buttonMedium`, `buttonSmall`
- Error messages: `error`

## Spacing and Layout

Use the standardized spacing values for margins and padding:

```javascript
// ❌ Don't do this
<View style={{ margin: 16, padding: 8 }} />;

// ✅ Do this instead
import { SPACING } from '../assets/theme/Theme';

<View style={{ margin: SPACING.md, padding: SPACING.sm }} />;
```

For common layout patterns, use the layout styles:

```javascript
import { commonStyles } from '../assets/theme/Styles';

<View style={commonStyles.rowSpaceBetween} />;
```

## Border Radius

Use standardized border radius values:

```javascript
// ❌ Don't do this
<View style={{ borderRadius: 20 }} />;

// ✅ Do this instead
import { BORDER_RADIUS } from '../assets/theme/Theme';

<View style={{ borderRadius: BORDER_RADIUS.xl }} />;
```

## Shadows

Apply consistent shadow styles:

```javascript
// ❌ Don't do this
<View
  style={{
    elevation: 6,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { height: 2, width: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  }}
/>;

// ✅ Do this instead
import { SHADOWS } from '../assets/theme/Theme';

<View style={SHADOWS.md} />;
```

## Components

Use the component styles for common UI elements:

```javascript
import { commonStyles } from '../assets/theme/Styles';

<View style={commonStyles.card} />
<TouchableOpacity style={commonStyles.buttonPrimary} />
<TextInput style={commonStyles.input} />
```

## Responsive Sizing

For responsive sizing, use the Responsive utility:

```javascript
import { Responsive } from '../assets/theme/Layout';

<View
  style={{
    width: Responsive.width(100),
    height: Responsive.height(50)
  }}
/>;
```

## Legacy Support

The theme system includes legacy styles for backward compatibility. These will be deprecated in future versions as components are updated to use the new theme system.

## Best Practices

1. **Always use semantic colors** instead of hex values
2. **Reuse common styles** from `commonStyles` when possible
3. **Use standardized spacing** for consistent layouts
4. **Keep component-specific styles** in the component's file
5. **Extract repeated styles** into `Styles.js` if used across multiple components

## Migrating Existing Components

When updating existing components:

1. Replace direct hex colors with `COLORS` constants
2. Replace direct font styles with typography styles from `commonStyles`
3. Replace custom spacing with `SPACING` constants
4. Replace repeated layout patterns with layout styles from `commonStyles`
5. Move component-specific styles to the component's StyleSheet
