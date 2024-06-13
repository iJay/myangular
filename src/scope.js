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
    listenerFn: listenerFn || function () {},
    last: initWatchValue
  }
  this.$$watchers.push(watcher);
}

// 这个函数能把所有 watcher 都执行一次，最终返回一个标识本轮是否发生了变化的布尔值
Scope.prototype.$digestOnce = function () {
  var self = this;
  var newValue, oldValue, dirty;
  _.forEach(this.$$watchers, function(watcher) {
    newValue = watcher.watchFn(self);
    oldValue = watcher.last;
    if (newValue !== oldValue) {
      watcher.last = newValue;
      watcher.listenerFn(newValue, (oldValue === initWatchValue ? newValue : oldValue), self);
      dirty = true;
    }
  })
  return dirty;
}

// $digest 至少会对所有 watcher 进行一轮遍历
// 只要发现值发生了变化就一直调用 $$digestOnce
Scope.prototype.$digest = function () {
  var dirty;
  do {
    dirty = this.$digestOnce()
  } while (dirty)
}

module.exports = Scope;