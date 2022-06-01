const path = require('path');

module.exports = ({ onGetWebpackConfig }) => {
  onGetWebpackConfig((config) => {
    ['jsx', 'tsx'].forEach((rule) => {
      config.module
        .rule(rule)
        .use('babel-loader')
        .tap((options) => {
          options.presets.splice(2, 1, require.resolve('@vue/babel-preset-app'));
          return options;
        });
    });
    config.resolve.alias.set('@', path.resolve(__dirname, 'src'));
  });
};
