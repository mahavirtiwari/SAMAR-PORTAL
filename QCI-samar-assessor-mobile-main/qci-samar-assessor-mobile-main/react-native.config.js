module.exports = {
  dependencies: {
    'react-native-compressor': {
      platforms: {
        android: {
          libraryName: null,
          cmakeListsPath: null
        }
      }
    },
    // Legacy ReactPackage module with no codegenConfig. RN 0.85 New Arch
    // autolinking still emits a react_codegen_ImageMarker CMake target with no
    // generated C++ to build, which breaks the ninja step. Nulling these treats
    // it as a plain native module (registered via PackageList), which works on
    // New Arch through the interop layer.
    'react-native-image-marker': {
      platforms: {
        android: {
          libraryName: null,
          cmakeListsPath: null
        }
      }
    }
  }
};
