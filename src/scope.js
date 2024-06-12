var _ = require('lodash')
function Scope () {
  // 前缀——$$表示这个变量仅用于 Angular 框架内部，不允许在应用代码中进行访问。
  this.$$watchers = []
}

Scope.prototype.$watch = function (watchFn, listenerFn) {
  var watcher = {
    watchFn,
    listenerFn
  }
  this.$$watchers.push(watcher);
}

Scope.prototype.$digest = function () {
  _.forEach(this.$$watchers, function(wather) {
    wather.listenerFn()
  })
}

module.exports = Scope;