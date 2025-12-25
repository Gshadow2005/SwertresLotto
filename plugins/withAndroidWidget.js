const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAndroidWidget(config) {
  // Add widget receiver to AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    // Check if receiver already exists
    const receiverExists = application.receiver?.some(
      (receiver) => receiver.$['android:name'] === '.SwertresWidgetProvider'
    );

    if (!receiverExists) {
      if (!application.receiver) {
        application.receiver = [];
      }

      application.receiver.push({
        $: {
          'android:name': '.SwertresWidgetProvider',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/widget_info',
            },
          },
        ],
      });
    }

    return config;
  });

  // Copy native files to android directory
  config = withMainActivity(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const androidPath = path.join(projectRoot, 'android', 'app', 'src', 'main');

    // Ensure directories exist
    const javaPath = path.join(androidPath, 'java', 'com', 'gshad', 'swertreslotto');
    const resPath = path.join(androidPath, 'res');
    const xmlPath = path.join(resPath, 'xml');
    const layoutPath = path.join(resPath, 'layout');
    const drawablePath = path.join(resPath, 'drawable');

    [javaPath, xmlPath, layoutPath, drawablePath].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Copy Kotlin file
    const ktSource = path.join(projectRoot, 'app', 'src', 'main', 'java', 'com', 'gshad', 'swertreslotto', 'SwertresWidgetProvider.kt');
    const ktDest = path.join(javaPath, 'SwertresWidgetProvider.kt');
    if (fs.existsSync(ktSource)) {
      fs.copyFileSync(ktSource, ktDest);
    }

    // Copy XML files
    const xmlFiles = ['widget_info.xml'];
    xmlFiles.forEach((file) => {
      const source = path.join(projectRoot, 'app', 'src', 'main', 'res', 'xml', file);
      const dest = path.join(xmlPath, file);
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, dest);
      }
    });

    // Copy layout files
    const layoutFiles = ['widget_layout.xml'];
    layoutFiles.forEach((file) => {
      const source = path.join(projectRoot, 'app', 'src', 'main', 'res', 'layout', file);
      const dest = path.join(layoutPath, file);
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, dest);
      }
    });

    // Copy drawable files
    const drawableFiles = ['widget_background.xml'];
    drawableFiles.forEach((file) => {
      const source = path.join(projectRoot, 'app', 'src', 'main', 'res', 'drawable', file);
      const dest = path.join(drawablePath, file);
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, dest);
      }
    });

    return config;
  });

  return config;
}

module.exports = withAndroidWidget;