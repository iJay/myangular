var _ = require('lodash')
function Scope () {
  // 前缀——$$表示这个变量仅用于 Angular 框架内部，不允许在应用代码中进行访问。
  this.$$watchers = [];
  // `$$lastDirtyWatch` 指向的应该都是根作用域上的 `$$lastDirtyWatch`。
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$applyAsyncQueue = [];
  this.$$applyAsyncId = null;
  this.$$postDigestQueue = [];
  /**
   * 实际上，AngularJS 的作用域上并没有 `$$children` 属性。
   * 如果查看源码，你能发现它把子作用域放到一组定制的、链表形式的变量中：
   * `$$nextSibling`，`$$prevSibling`，`$$childHead` 和 `$$childTail`。
   * 这样处理后，新增和移除作用域时的开销要比使用常规数组操作成本更低。
   * 它能实现与 `$$children` 数组同样的效果。
   */
  this.$$children = [];
  this.$root = this;
  this.$$phase = null;
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
  // 在 digest 的过程中有 watcher 被移除时，已经执行的 watcher 就会填满空出来的数组空间，这样不会对剩余的 watcher 产生影响
  self.$$watchers.unshift(watcher);
  // 在注册 watcher 后重置 $$lastDirtyWatch来解决这个问题(在 listener 函数中注册另一个 watcher)，这样就能显式地禁用短路优化
  self.$$lastDirtyWatch = null;

  return function () {
    var index = self.$$watchers.indexOf(watcher);
    if (index >= 0) {
      self.$$watchers.splice(index, 1);
    }
    // 在移除 watcher 的同时取消短路优化
    self.$root.$$lastDirtyWatch = null;
  }
}

Scope.prototype.$watchGroup = function (watchFns, listenerFn) {
  var self = this;
  var newValues = new Array(watchFns.length);
  var oldValues = new Array(watchFns.length);
  var changeReactionScheduled = false;
  var firstRun = true;

  /**
   * 如果为空，我们就设定一个调用 listener 函数的延时任务，
   * 然后下面的代码就没有必要继续执行了，直接退出就可以。
   */
  if (watchFns.length === 0) {
    /**
     * watch 数组为空的情况，我们需要保证在这种情况下也会生成一个销毁 watcher 的函数。
     * listener 在这种情况下只会被调用一次，但我们依然可以在第一次 digest 启动之前调用注销函数，
     * 在这种情况下，即使是一次调用也需要跳过。在代码中加入一个布尔值标识，
     * 然后在调用 listener 函数之前检查一下这个布尔值标识的值就可以
     */
    var shouldCall = true
    self.$evalAsync(function () {
      if (shouldCall) {
        listenerFn(newValues, oldValues, self);
      }
    });
    return function () {
      shouldCall = false;
    }
  }

  function watchGroupListener() {
    if (firstRun) {
      firstRun = false
      listenerFn(newValues, newValues, self);
    } else {
      listenerFn(newValues, oldValues, self);
    }
    changeReactionScheduled = false;
  }

  var destroyFunctions = _.map(watchFns, function (watchFn, i) {
    return self.$watch(watchFn, function (newValue, oldValue) {
      newValues[i] = newValue;
        oldValues[i] = oldValue;
        if (!changeReactionScheduled) {
          changeReactionScheduled = true;
          self.$evalAsync(watchGroupListener);
        }
    });
  });

  return function () {
    _.forEach(destroyFunctions, function(destroyFunction) {
      destroyFunction();
    });
  }

  /**
   * 由于每个 watcher 调用后本来就会返回用于销毁该 watcher 的函数，
   * 我们要做的就是将它们收集起来，然后创建一个新的销毁函数，
   * 这个销毁函数会逐个调用每个 watch 的销毁函数
   */

}

// 这个函数能把所有 watcher 都执行一次，最终返回一个标识本轮是否发生了变化的布尔值
Scope.prototype.$digestOnce = function () {
  var dirty;
  var continueLoop = true;
  this.$$everyScope(function (scope) {
    var newValue, oldValue;
    // 从后往前遍历 防止watchFn中删除当前watcher 导致跳过未遍历的watcher
    // 这里如果是从前往后遍历，删除其中一个watcher 数组自动进行shift操作，后面的watcher会替代被删除watcher的位置
    _.forEachRight(scope.$$watchers, function(watcher) {
      try { // 在Angular中 它实际上会把异常处理交由一个叫 $exceptionHandler 的服务来处理
        if (watcher) {
          // 在内层循环中，我们把 `this` 换成当前 `scope`。
          // watch 函数传入的必须是它所挂载的 scope 上，
          // 而不是调用 `$digest` 方法的那个 scope 对象
          newValue = watcher.watchFn(scope);
          oldValue = watcher.last;
          if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            scope.$root.$$lastDirtyWatch = watcher
            watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
            watcher.listenerFn(newValue, (oldValue === initWatchValue ? newValue : oldValue), scope);
            dirty = true;
          // `$$lastDirtyWatch` 属性总是指向最顶层的那个作用域。
          // 短路优化需要考虑作用域所在树结构范围内的所有 watcher。
          } else if (scope.$root.$$lastDirtyWatch === watcher) {
            continueLoop = false;
            // 在 lodash的 _.forEach 循环中显式地返回 false 会让循环提前结束
            return false;
          }
        }
      } catch (e) {
        console.error(e);
      }
    });
    return continueLoop;
  });
  return dirty;
}

Scope.prototype.$$everyScope = function (fn) {
  if (fn(this)) {
    return this.$$children.every(function (child) {
      return child.$$everyScope(fn);
    });
  } else {
    return false;
  }
}

// $digest 至少会对所有 watcher 进行一轮遍历
// 只要发现值发生了变化就一直调用 $$digestOnce
Scope.prototype.$digest = function () {
  var ttl = 10;
  var dirty;
  // 只要 digest 启动，就把这个实例属性$$lastDirtyWatc重置为null
  this.$root.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');

  // 判断如果当前已经有定时器处于待触发状态，就取消这个定时器并立即开始遍历异步任务队列
  if (this.$root.$$applyAsyncId) {
    clearTimeout(this.$root.$$applyAsyncId);
    this.$$flushApplyAsync()
  }
  do {
    while(this.$$asyncQueue.length) {
     try {
      var asyncTask = this.$$asyncQueue.shift();
      asyncTask.scope.$eval(asyncTask.expression);
     } catch (error) {
      console.error(error);
     }
    }
    dirty = this.$digestOnce()
    // 保证无论是因为 watch 函数 变“脏”，还是因为异步任务队列还有任务存在，
    // 我们都能确保 digest 周期会在达到迭代上限时被终止。
    if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
      this.$clearPhase()
      throw '10 digest iterations reached'
    }
  } while (dirty || this.$$asyncQueue.length)
  while(this.$$postDigestQueue.length) {
    try {
      this.$$postDigestQueue.shift()();
    } catch (error) {
      console.error(error);
    }
  }
  this.$clearPhase()
}

// 这里借助lodash工具函数实现值的比较
Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue || ( // 对NaN的比较做特殊处理
      typeof newValue === 'number' && 
      typeof oldValue === 'number' && 
      isNaN(newValue) && 
      isNaN(oldValue)
    );
  }
}

// 为什么调用函数还要这样绕圈子呢? $eval 真正有趣的地方要到后面介绍表达式时才能展现出来
// 们用原生函数形式的 $eval 还看不出来。到那时，$eval 跟 $watch 一样，可以直接传入一个字符串表达式，
// $eval 会对这个表达式进行编译，然后再在给定的作用域语境中执行它
Scope.prototype.$eval = function (expr, locals) {
  return expr(this, locals);
}

Scope.prototype.$evalAsync = function (expr) {
  var self = this;
  if (!self.$$phase && !self.$$asyncQueue.length) {
    setTimeout(function () {
      if (self.$$asyncQueue.length) {
        self.$root.$digest();
      }
    }, 0)
  }
  // 这里把当前作用域也保存到任务队列是有原因的
  this.$$asyncQueue.push({
    scope: this,
    expression: expr
  })
}

/**
 * 推荐使用 $apply 而不是$digest
 * 因为我们不清楚哪些作用域与即将发生的变更有关，
 * 那可以对所有作用域进行脏值检测
 */
Scope.prototype.$apply = function (func) {
  // 在 `finally` 代码块中调用 `$digest`，这样才能保证即使执行函数时发生了异常，依然会启动 digest 周期。
  try {
    // 这里的 `$eval` 方法依旧是在当前作用域上下文内执行的，而不是根作用域。
    // 我们只是希望 digest 能从根作用域一路运行下来而已。
    this.$beginPhase('$apply');
    return this.$eval(func);
  } finally {
    this.$clearPhase();
    this.$root.$digest();
  }
}

// `$applyAsync` 的核心要点是对一小段时间内多次进行的操作进行优化，
// 这样运行一次 digest 就能对这些操作带来的变化进行统一处理。
// 合并 `$apply` 调用
Scope.prototype.$applyAsync = function (func) {
  var self = this;
  // 将applyAsync单独维护到一个队列中
  self.$$applyAsyncQueue.push(function () {
    self.$eval(func);
  });
  // 我们不需要分别对队列中的每一个元素调用一次 `$apply`。
  // 我们只需要在循环以外调用一次 `$apply` 就可以了，我们只希望程序启动一次 digest。
  if (self.$root.$$applyAsyncId === null) { // 先判断一下这个$$applyAsyncId是否为空
    self.$root.$$applyAsyncId = setTimeout(function () {
      self.$apply(_.bind(self.$$flushApplyAsync, self));
    }, 0);
  }
}

// 把 `$applyAsync` 中用于遍历执行异步任务队列的代码抽取成一个内部函数
Scope.prototype.$$flushApplyAsync = function () {
  while(this.$$applyAsyncQueue.length) {
    try {
      this.$$applyAsyncQueue.shift()()
    } catch (error) {
      console.error(error);
    }
  }
  this.$root.$$applyAsyncId = null;
}

Scope.prototype.$beginPhase = function (phase) {
  if (this.$$phase) {
    throw this.$$phase + 'already in progress'
  }
  this.$$phase = phase;
}

Scope.prototype.$clearPhase = function () {
  this.$$phase = null;
}

Scope.prototype.$$postDigest = function (func) {
  this.$$postDigestQueue.push(func);
}

Scope.prototype.$new = function (isIsolated, parent) {
  var childScope;
  /**
   * 隔离作用域一般不会完全与自己的父作用域割裂开来的。
   * 相反，我们会根据需要从父作用域中获取的数据，明确定义出一个属性映射。
   */
  parent = parent || this
  if (!isIsolated) {
    var childScopeCtor = function () {};
    childScopeCtor.prototype = this;
    childScope = new childScopeCtor();
  } else {
    childScope = new Scope();
    // 无论是用 `this` 还是用 `parent` 访问都可以，但为了清晰起见，我们还是统一使用后者访问
    childScope.$$asyncQueue = parent.$$asyncQueue;
    childScope.$$postDigestQueue = parent.$$postDigestQueue;
    childScope.$root = parent.$root;
    childScope.$$applyAsyncQueue = parent.$$applyAsyncQueue;
  }
  parent.$$children.push(childScope);
  // 为了保证digest只遍历当前scope的$$watchers 
  // 需要为每个作用域都初始化一个$$watchers数组
  // 这里实际借助了js原型链的属性屏蔽特性
  childScope.$$watchers = [];
  childScope.$$children = [];
  return childScope;
}

module.exports = Scope;