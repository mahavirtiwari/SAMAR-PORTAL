import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS } from '../../../assets/theme/Theme';
import {
  getBoughtOutPart,
  getKeyProcessesAction,
  getKeyResourcesAction,
  getServiceKeyProcessesAction,
  getServiceKeyResourcesAction,
  thirdPartyCertificationsAction
} from '../../../redux/action/basicInformationAction';
import {
  resetBoughtOutPartState,
  resetKeyProcessesState,
  resetKeyResourcesState,
  resetServiceKeyProcessesState,
  resetServiceKeyResourcesState,
  resetThirdPartyCertificationsState
} from '../../../redux/slices/basicInformationSlice';
import { capitalizeFirstLetter, Logger } from '../../../utils';

const AutoCompleteInput = ({
  apiUrl,
  placeholder,
  onSelect,
  onSubmit,
  onChangeText,
  value,
  name,
  onDropdownOpen,
  excludeValues = [],
  // Service masters carry a serviceProviderType; when set, suggestions are
  // filtered to the selected provider type (manufacturing callers omit it).
  providerType = null
}) => {
  const dispatch = useDispatch();
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [_loading, _setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const justSelected = useRef(false);
  // Dropdown visibility follows input focus, NOT keyboard visibility. On iOS,
  // scrolling the suggestions can dismiss the keyboard; tying the list to the
  // keyboard made both vanish mid-scroll. The blur delay lets a suggestion tap
  // land before the list closes (and rides out a transient scroll blur).
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeout = useRef(null);
  // True while the suggestions list is being dragged. On iOS that drag blurs the
  // field; the blur handler checks this so it doesn't close the list mid-scroll.
  const isScrollingRef = useRef(false);
  useEffect(
    () => () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
      }
    },
    []
  );
  const {
    getKeyProcessesData,
    getThirdPartyCertificationsData,
    getKeyResourcesData,
    getBoughtOutPartData,
    getServiceKeyProcessesData,
    getServiceKeyResourcesData
  } = useSelector((state) => state.basicInformation);

  // Dropdown positioning state
  const [_dropdownAbove, _setDropdownAbove] = useState(false);
  const inputRef = useRef(null);
  const [_inputLayout, setInputLayout] = useState(null);

  // Sync query with value prop (for controlled input in modals)
  useEffect(() => {
    if (typeof value === 'string' && value !== query) {
      Logger.info('AutoCompleteInput sync value to query', value);
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (justSelected.current) {
        justSelected.current = false;
        return;
      }
      if (name === 'boughtOutPart') {
        if ((query || '').length >= 1) {
          try {
            await dispatch(getBoughtOutPart(query));
          } catch (_e) {
            setSuggestions([]);
          }
        } else {
          // Do not set suggestions here, handled onFocus
          setSuggestions([]);
        }
      } else if ((query || '').length >= 1) {
        if (name === 'keyProcess') {
          try {
            await dispatch(getKeyProcessesAction(query));
          } catch (_e) {
            setSuggestions([]);
          }
        } else if (name === 'certificate') {
          try {
            await dispatch(thirdPartyCertificationsAction(query));
          } catch (_e) {
            setSuggestions([]);
          }
        } else if (name === 'keyResource') {
          try {
            await dispatch(getKeyResourcesAction(query));
          } catch (_e) {
            setSuggestions([]);
          }
        } else if (name === 'serviceKeyProcess') {
          try {
            await dispatch(getServiceKeyProcessesAction(query));
          } catch (_e) {
            setSuggestions([]);
          }
        } else if (name === 'serviceKeyResource') {
          try {
            await dispatch(getServiceKeyResourcesAction(query));
          } catch (_e) {
            setSuggestions([]);
          }
        } else {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [query, name, dispatch]);

  useEffect(() => {
    if (name === 'keyProcess') {
      setSuggestions(Array.isArray(getKeyProcessesData) ? getKeyProcessesData : []);
    }
    if (name === 'certificate') {
      setSuggestions(
        Array.isArray(getThirdPartyCertificationsData?.data)
          ? getThirdPartyCertificationsData.data
          : []
      );
    }
    if (name === 'keyResource') {
      setSuggestions(Array.isArray(getKeyResourcesData) ? getKeyResourcesData : []);
    }
    if (name === 'serviceKeyProcess') {
      setSuggestions(Array.isArray(getServiceKeyProcessesData) ? getServiceKeyProcessesData : []);
    }
    if (name === 'serviceKeyResource') {
      setSuggestions(Array.isArray(getServiceKeyResourcesData) ? getServiceKeyResourcesData : []);
    }
    if (name === 'boughtOutPart' && (query || '').length >= 1) {
      setSuggestions(Array.isArray(getBoughtOutPartData) ? getBoughtOutPartData : []);
    }
  }, [
    getKeyProcessesData,
    getThirdPartyCertificationsData,
    getKeyResourcesData,
    getBoughtOutPartData,
    getServiceKeyProcessesData,
    getServiceKeyResourcesData,
    name,
    query
  ]);

  // Always show dropdown below input. Remove dropdownAbove logic.

  const handleSelect = (item) => {
    // Prefer processName, certificationName, materialName, partName, name (in order)
    const displayValue =
      item?.processName ||
      item?.certificationName ||
      item?.materialName ||
      item?.partName ||
      item?.resourceName ||
      item?.labName ||
      item?.name ||
      '';
    setQuery(displayValue);
    setSelectedItem(item);
    if (onSelect) {
      onSelect(displayValue, item);
    }
    // Prevent suggestions from re-fetching after select
    justSelected.current = true;
    // Hide suggestions after select
    setSuggestions([]);
    setTimeout(() => {
      dispatch(resetKeyProcessesState());
      dispatch(resetKeyResourcesState());
      dispatch(resetThirdPartyCertificationsState());
      dispatch(resetBoughtOutPartState());
      dispatch(resetServiceKeyProcessesState());
      dispatch(resetServiceKeyResourcesState());
    }, 200);
  };

  const handleSubmit = () => {
    // If selectedItem exists, submit it
    if (selectedItem && onSubmit) {
      onSubmit(selectedItem);
    } else if (suggestions.length === 1 && onSubmit) {
      handleSelect(suggestions[0]);
      setTimeout(() => onSubmit(suggestions[0]), 0);
    } else if (suggestions.length > 0 && onSubmit) {
      const match = suggestions.find((s) =>
        typeof s.name === 'string' && typeof query === 'string'
          ? s.name.toLowerCase() === query.toLowerCase()
          : false
      );
      if (match) {
        handleSelect(match);
        setTimeout(() => onSubmit(match), 0);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={[[styles.input], {}]}>
        <TextInput
          numberOfLines={1}
          ref={inputRef}
          value={query}
          maxLength={150}
          onChangeText={(text) => {
            const capitalized = capitalizeFirstLetter(text || '');
            setQuery(capitalized);
            setSelectedItem(null);
            if (onChangeText) {
              onChangeText(capitalized);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={COLORS.text.placeholder}
          autoCapitalize="sentences"
          onSubmitEditing={handleSubmit}
          style={{ paddingRight: 20, width: '88%' }}
          onBlur={() => {
            // Scrolling the suggestions on iOS blurs the field; keep the list
            // open in that case. A genuine tap-away closes it after a short
            // delay (which also lets a suggestion tap land first).
            if (isScrollingRef.current) {
              return;
            }
            blurTimeout.current = setTimeout(() => {
              setIsFocused(false);
              if (onDropdownOpen) {
                onDropdownOpen(false);
              }
            }, 150);
          }}
          onFocus={() => {
            if (blurTimeout.current) {
              clearTimeout(blurTimeout.current);
            }
            setIsFocused(true);
            if (onDropdownOpen) {
              onDropdownOpen(true);
            }
            if (name === 'boughtOutPart' && (!query || query.length === 0)) {
              setSuggestions(Array.isArray(getBoughtOutPartData) ? getBoughtOutPartData : []);
            }
          }}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            // measureInWindow for absolute position
            if (inputRef.current && inputRef.current.measureInWindow) {
              inputRef.current.measureInWindow((x, pageY, w, h) => {
                setInputLayout({ x, pageY, width: w, height: h });
              });
            } else {
              setInputLayout({ x: 0, pageY: y, width: '100%', height });
            }
          }}
        />
      </View>
      {
        // filter suggestions by excludeValues (case-insensitive match against display text)
        (() => {
          const filtered = (suggestions || []).filter((item) => {
            const display =
              item?.processName ||
              item?.certificationName ||
              item?.materialName ||
              item?.partName ||
              item?.resourceName ||
              item?.labName ||
              item?.name ||
              '';
            if (!display) {
              return false;
            }
            // Service masters are shared across provider types; only surface the
            // options for the selected type (items missing the field pass through).
            if (
              providerType &&
              item?.serviceProviderType != null &&
              item.serviceProviderType !== providerType
            ) {
              return false;
            }
            if (!Array.isArray(excludeValues) || excludeValues.length === 0) {
              return true;
            }
            return !excludeValues.some(
              (ev) =>
                typeof ev === 'string' && ev.trim().toLowerCase() === display.trim().toLowerCase()
            );
          });
          if (filtered.length > 0 && isFocused) {
            return (
              <View style={[styles.dropdown]}>
                <ScrollView
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="none"
                  onScrollBeginDrag={() => {
                    isScrollingRef.current = true;
                    // Cancel a hide that an earlier blur may have scheduled.
                    if (blurTimeout.current) {
                      clearTimeout(blurTimeout.current);
                    }
                  }}
                  onScrollEndDrag={() => {
                    setTimeout(() => {
                      isScrollingRef.current = false;
                    }, 100);
                  }}
                  onMomentumScrollEnd={() => {
                    isScrollingRef.current = false;
                  }}
                  contentContainerStyle={{ flexGrow: 1 }}>
                  {filtered.map((item, i) => (
                    <TouchableOpacity
                      key={String(item.id || i)}
                      style={styles.item}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}>
                      <Text>
                        {item?.processName ||
                          item?.certificationName ||
                          item?.materialName ||
                          item?.partName ||
                          item?.resourceName ||
                          item?.labName ||
                          item?.name ||
                          ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
          }
          return null;
        })()
      }
    </View>
  );
};

export default AutoCompleteInput;

const styles = StyleSheet.create({
  container: {
    // backgroundColor: COLORS.background.secondary,
    height: 'auto',
    width: '100%',
    zIndex: 100
  },
  input: {
    borderWidth: 1,
    borderColor: '#EBEDF3',
    paddingHorizontal: 10,
    paddingVertical: 0,
    height: 45,
    borderRadius: 8,
    color: COLORS.text.primary,
    justifyContent: 'center'
  },
  dropdown: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 8,
    zIndex: 99,
    maxHeight: 200
    // top or bottom will be set dynamically
  },
  item: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  }
});
