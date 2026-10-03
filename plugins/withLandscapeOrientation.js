const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const TABLET_COMPAT_PROPERTY = 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY';

function setLandscapeOrientation(androidManifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);
  activity.$['android:screenOrientation'] = 'landscape';

  // Android 16 otherwise ignores orientation restrictions on large screens.
  // This compatibility opt-out stops working when targeting API 37; revisit
  // tablet layout policy before upgrading the Android target SDK.
  const properties = activity.property || [];
  activity.property = properties.filter((property) => property.$['android:name'] !== TABLET_COMPAT_PROPERTY);
  activity.property.push({
    $: { 'android:name': TABLET_COMPAT_PROPERTY, 'android:value': 'true' },
  });
  return androidManifest;
}

module.exports = function withLandscapeOrientation(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = setLandscapeOrientation(config.modResults);
    return config;
  });
};

module.exports.setLandscapeOrientation = setLandscapeOrientation;
