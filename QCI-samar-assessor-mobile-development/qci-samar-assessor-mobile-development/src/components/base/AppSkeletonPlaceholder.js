import MaskedView from '@react-native-masked-view/masked-view';
import * as React from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../../assets/theme/Theme';

const WINDOW_WIDTH = Dimensions.get('window').width;

const transformToPlaceholder = (rootElement, backgroundColor, radius) => {
  if (!rootElement) {
    return null;
  }

  return React.Children.map(rootElement, (child, index) => {
    if (!React.isValidElement(child)) {
      // Skip invalid React elements
      return null;
    }

    if (child.type === React.Fragment) {
      return <>{transformToPlaceholder(child.props?.children, backgroundColor, radius)}</>;
    }

    const isPlaceholder =
      !child.props?.children ||
      typeof child.props.children === 'string' ||
      (Array.isArray(child.props.children) &&
        child.props.children.every((x) => x == null || typeof x === 'string'));
    const { style, ...otherProps } = child.props;

    const borderRadius = otherProps?.borderRadius ?? style?.borderRadius ?? radius;
    const width = otherProps?.width ?? style?.width;
    const height =
      otherProps?.height ??
      style?.height ??
      otherProps?.lineHeight ??
      style?.lineHeight ??
      otherProps?.fontSize ??
      style?.fontSize;

    const finalStyle = [
      style || {}, // Ensure style is always an object
      isPlaceholder ? [styles.placeholder, { backgroundColor }] : styles.placeholderContainer,
      {
        height,
        width,
        borderRadius
      }
    ];

    return (
      <View key={index} style={finalStyle}>
        {!isPlaceholder &&
          transformToPlaceholder(child.props.children, backgroundColor, borderRadius)}
      </View>
    );
  });
};

const AppSkeletonPlaceholder = ({
  children,
  enabled = true,
  backgroundColor = '#C4CADA',
  highlightColor = COLORS.background.primary,
  speed = 800,
  direction = 'right',
  borderRadius,
  shimmerWidth
}) => {
  const [layout, setLayout] = React.useState();
  const animatedValueRef = React.useRef(new Animated.Value(0));
  const isAnimationReady = Boolean(speed && layout?.width && layout?.height);

  React.useEffect(() => {
    if (!isAnimationReady) {
      return;
    }

    const loop = Animated.loop(
      Animated.timing(animatedValueRef.current, {
        toValue: 1,
        duration: speed,
        easing: Easing.ease,
        useNativeDriver: true
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isAnimationReady, speed]);

  const animatedGradientStyle = React.useMemo(() => {
    const animationWidth = WINDOW_WIDTH + (shimmerWidth ?? 0);
    return {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      transform: [
        {
          translateX: animatedValueRef.current.interpolate({
            inputRange: [0, 1],
            outputRange:
              direction === 'right'
                ? [-animationWidth, animationWidth]
                : [animationWidth, -animationWidth]
          })
        }
      ]
    };
  }, [direction, WINDOW_WIDTH, shimmerWidth]);

  const placeholders = React.useMemo(() => {
    if (!enabled) {
      return null;
    }

    return (
      <View style={styles.placeholderContainer}>
        {transformToPlaceholder(children, backgroundColor, borderRadius)}
      </View>
    );
  }, [backgroundColor, children, borderRadius, enabled]);

  const transparentColor = React.useMemo(
    () => getTransparentColor(highlightColor.replace(/ /g, '')),
    [highlightColor]
  );

  if (!enabled || !placeholders) {
    return children;
  }

  if (!layout?.width || !layout.height) {
    return <View onLayout={(event) => setLayout(event.nativeEvent.layout)}>{placeholders}</View>;
  }

  return (
    <MaskedView style={{ height: layout.height, width: layout.width }} maskElement={placeholders}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
      {isAnimationReady && highlightColor !== undefined && transparentColor !== undefined && (
        <Animated.View style={animatedGradientStyle}>
          <LinearGradient
            {...getGradientProps(shimmerWidth)}
            colors={[transparentColor, highlightColor, transparentColor]}
          />
        </Animated.View>
      )}
    </MaskedView>
  );
};

AppSkeletonPlaceholder.Item = (props) => {
  const { style, ...restProps } = props;

  const getItemStyle = ({ style = {}, ...otherProps }) => {
    return style ? [style, otherProps] : otherProps;
  };

  return <View style={getItemStyle(restProps)}>{props.children}</View>;
};
AppSkeletonPlaceholder.Item.displayName = 'SkeletonPlaceholderItem';

const getGradientProps = (width) => ({
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0 },
  style: { ...StyleSheet.absoluteFillObject, width }
});

const getTransparentColor = (color) => {
  const type = getColorType(color);

  if (type === 'hex') {
    return color.length < 6 ? `${color.substring(0, 4)}0` : `${color.substring(0, 7)}00`;
  }
  const [r, g, b] = color.match(/\d+/g);
  return `rgba(${r},${g},${b},0)`;
};

const getColorType = (color) => {
  if (/^rgba?\(/.test(color)) {
    return color.startsWith('rgba') ? 'rgba' : 'rgb';
  }
  if (/^#([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(color)) {
    return 'hex';
  }
  throw new Error(`The provided color ${color} is not a valid (hex | rgb | rgba) color`);
};

export default AppSkeletonPlaceholder;

const styles = StyleSheet.create({
  placeholder: {
    overflow: 'hidden'
  },
  placeholderContainer: {
    backgroundColor: 'transparent'
  }
});
