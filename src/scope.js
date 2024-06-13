var _ = require('lodash')
function Scope () {
  // 前缀——$$表示这个变量仅用于 Angular 框架内部，不允许在应用代码中进行访问。
  this.$$watchers = []
  this.$$lastDirtyWatch = null;
}

// 保证初始值的唯一性，以此来保证listener函数在第一次时可以被调用
function initWatchValue () {}
Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
  var self = this;
  var watcher = {
    watchFn,
    listenerFn: listenerFn || function () {},
    last: initWatchValue,
    valueEq: !!valueEq
  }
  self.$$watchers.push(watcher);
  // 在注册 watcher 后重置 $$lastDirtyWatch来解决这个问题(在 listener 函数中注册另一个 watcher)，这样就能显式地禁用短路优化
  self.$$lastDirtyWatch = null;

  return function () {
    var index = self.$$watchers.indexOf(watcher);
    if (index >= 0) {
      self.$$watchers.splice(index, 1);
    }
  }

}

// 这个函数能把所有 watcher 都执行一次，最终返回一个标识本轮是否发生了变化的布尔值
Scope.prototype.$digestOnce = function () {
  var self = this;
  var newValue, oldValue, dirty;
  _.forEach(this.$$watchers, function(watcher) {
    try { // 在Angular中 它实际上会把异常处理交由一个叫 $exceptionHandler 的服务来处理
      newValue = watcher.watchFn(self);
      oldValue = watcher.last;
      if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
        self.$$lastDirtyWatch = watcher
        watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
        watcher.listenerFn(newValue, (oldValue === initWatchValue ? newValue : oldValue), self);
        dirty = true;
      } else if (self.$$lastDirtyWatch === watcher) {
        // 在 lodash的 _.forEach 循环中显式地返回 false 会让循环提前结束
        return false;
      }
    } catch (e) {
      console.error(e);
    }
  });
  return dirty;
}

// $digest 至少会对所有 watcher 进行一轮遍历
// 只要发现值发生了变化就一直调用 $$digestOnce
Scope.prototype.$digest = function () {
  var ttl = 10;
  var dirty;
  // 只要 digest 启动，就把这个实例属性$$lastDirtyWatc重置为null
  this.$$lastDirtyWatch = null;
  do {
    dirty = this.$digestOnce()
    if (dirty && !(ttl--)) {
      throw '10 digest iterations reached'
    }
  } while (dirty)
}

// 这里借助lodash工具函数实现值的比较
Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue || ( // 对NaN的比较做特殊处理
      typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue)
    );
  }
}

module.exports = Scope;