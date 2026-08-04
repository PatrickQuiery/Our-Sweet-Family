module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|expo-modules-core|@clerk/.*|react-navigation|@react-navigation/.*|react-native-.*))',
  ],
  // RNTL v14 auto-registers its jest matchers; no separate extend-expect needed.
};
