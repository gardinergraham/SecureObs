module.exports = ({ config }) => {
  const isDemo = process.env.EXPO_PUBLIC_APP_VARIANT === "demo";
  return {
    ...config,
    name: isDemo ? "SecureObs Demo" : config.name,
    android: {
      ...config.android,
      package: isDemo ? "com.geckostudios.secureobs.demo" : config.android.package
    },
    ios: {
      ...config.ios,
      bundleIdentifier: isDemo ? "geckostudios.SecureSolutions.demo" : config.ios.bundleIdentifier
    },
    extra: {
      ...config.extra,
      appVariant: isDemo ? "demo" : "production"
    }
  };
};
