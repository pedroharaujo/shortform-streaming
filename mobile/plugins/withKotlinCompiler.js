const { withProjectBuildGradle } = require('expo/config-plugins');

// Expo 57's property override updates the version catalog, but its generated
// root classpath still inherits React Native's older Kotlin Gradle plugin.
module.exports = function withKotlinCompiler(config) {
  return withProjectBuildGradle(config, (config) => {
    const original = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')";
    const replacement =
      'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${findProperty(\'android.kotlinVersion\')}")';
    const { modResults } = config;
    if (
      modResults.language !== 'groovy' ||
      (!modResults.contents.includes(original) && !modResults.contents.includes(replacement))
    ) {
      throw new Error('Android build template changed; review the Kotlin compiler override.');
    }
    modResults.contents = modResults.contents.replace(original, replacement);
    return config;
  });
};
