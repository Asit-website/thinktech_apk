const { withAndroidManifest } = require('@expo/config-plugins');

function withAndroidHardwareFeatures(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    const featuresToAddOrUpdate = [
      { name: 'android.hardware.screen.portrait', required: 'false' },
      { name: 'android.hardware.screen.landscape', required: 'false' },
      { name: 'android.hardware.wifi', required: 'false' },
      { name: 'android.hardware.camera', required: 'false' },
      { name: 'android.hardware.camera.autofocus', required: 'false' },
      { name: 'android.hardware.telephony', required: 'false' },
      { name: 'android.hardware.location', required: 'false' },
      { name: 'android.hardware.location.gps', required: 'false' },
      { name: 'android.hardware.microphone', required: 'false' },
    ];

    featuresToAddOrUpdate.forEach(({ name, required }) => {
      const existingIdx = manifest['uses-feature'].findIndex(
        (item) => item.$ && item.$['android:name'] === name
      );

      if (existingIdx >= 0) {
        manifest['uses-feature'][existingIdx].$['android:required'] = required;
      } else {
        manifest['uses-feature'].push({
          $: {
            'android:name': name,
            'android:required': required,
          },
        });
      }
    });

    return config;
  });
}

module.exports = withAndroidHardwareFeatures;
