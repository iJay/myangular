module.exports = function(config) {
  config.set({
    frameworks: ['browserify', 'jasmine'],
    files: [
      'src/**/*.js',
      'test/**/*.spec.js'
    ],
    preprocessors: {
      'test/**/*.js': ['browserify'],
      'src/**/*.js': ['browserify']
    },
    browsers: ['Chrome', 'ChromeHeadless'],
    plugins: [
      'karma-jasmine',
      'karma-browserify',
      'karma-chrome-launcher',
    ],
    browserify: {
      debug: true
    }
  })
}