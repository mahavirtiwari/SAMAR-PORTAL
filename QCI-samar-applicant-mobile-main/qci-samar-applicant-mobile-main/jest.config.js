module.exports = {
  preset: '@react-native/jest-preset',
  // react-redux / redux-toolkit ship ESM that the default preset leaves
  // untransformed, which breaks the App smoke test once the Provider is mounted.
  // Whitelist them (and the other RN native modules) so Babel transpiles them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-redux|@reduxjs/toolkit|redux|reselect|immer|react-native-keychain|@react-native-async-storage|@react-native-community/netinfo))'
  ]
};
