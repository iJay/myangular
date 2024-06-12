var _ = require('lodash')
function Scope () {
  // 前缀——$$表示这个变量仅用于 Angular 框架内部，不允许在应用代码中进行访问。
  this.$$watchers = []
}

// 保证初始值的唯一性，以此来保证listener函数在第一次时可以被调用
function initWatchValue () {}
Scope.prototype.$watch = function (watchFn, listenerFn) {
  var watcher = {
    watchFn,
    listenerFn,
    last: initWatchValue
  }
  this.$$watchers.push(watcher);
}

Scope.prototype.$digest = function () {
  var self = this;
  var newValue, oldValue
  _.forEach(this.$$watchers, function(watcher) {
    newValue = watcher.watchFn(self);
    oldValue = watcher.last;
    if (newValue !== oldValue) {
      watcher.last = newValue;
      watcher.listenerFn(newValue, (oldValue === initWatchValue ? newValue : oldValue), self);
    }
    
  })
}

module.exports = Scope;