var Scope = require('../src/scope');
var _ = require('lodash');

describe('Scope', function () {
  it('can be constructed and used as an object', function () {
    var scope = new Scope();
    scope.aProperty = 1;
    expect(scope.aProperty).toBe(1)
  })

  describe('digest', function (){
    var scope;
    beforeEach(function () {
      scope = new Scope();
    })
    it('calls the listener function of a watch on first $digest', function () {
      var watchFn = function () { return 'wat';}
      var listenerFn = jasmine.createSpy();
      scope.$watch(watchFn, listenerFn);

      scope.$digest()

      expect(listenerFn).toHaveBeenCalled();
    });

    // watch 函数应该要返回要侦听的数据。通常这个数据是来源于作用域（scope）
    // 为了更方便访问作用域，我们直接把作用域作为参数传入到watch函数中，这样，watch函数要访问或者返回作用域中的数据就方便了。
    it('calls the watch function with scope as the argument', function () {
      var watchFn = jasmine.createSpy();
      var listenerFn = function() {};
      scope.$watch(watchFn, listenerFn);

      scope.$digest();
     
      expect(watchFn).toHaveBeenCalledWith(scope);
    })

    // 调用$digest函数的时候。把它的返回值与这个函数上一次返回值进行比较
    // 如果返回值变化了，说明wather变“脏”了，这时才需要调用它的listener函数
    it('call the lietener function when the watched value changes', function () {
      scope.someValue = 'a';
      scope.counter = 0;

      scope.$watch(
        function (scope) {return scope.someValue;},
        function (newValue, oldValue, scope) {
          scope.counter++;
        }
      )

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.someValue = 'b';
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(2);
    })

    // 当被侦听的变量恰好是undefined，第一次运行watch函数，listener函数就不会被调用
    // 我们希望第一次watch函数执行，listener无论如何都会被调用
    it('calls listener when watch value is first undefined', function () {
      scope.counter = 0;
      scope.$watch(
        function (scope) {return scope.someValue},
        function (newValue, oldValue, scope) {
          scope.counter++;
        }
      )

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    // initWatchVal 也会作为 watcher 最初的旧值被传递到 listener 函数中。但我们并不希望这个特殊函数能在 scope.js 以外的地方被访问到。
    // 要实现这个目的，我们只需要在注册 watcher 后，把新值当作 listener 旧值就可以了
    it('calls listener with new value as old value the firts time', function () {
      scope.someValue = 123;
      var oldValueGiven;

      scope.$watch(
        function (scope) { return scope.someValue; },
        function (newValue, oldValue, scope) {
          oldValueGiven = oldValue;
        }
      )

      scope.$digest();
      expect(oldValueGiven).toBe(123);
    })

    // Getting Notified Of Digests
    it('may have watchers that omit the listener function', function () {
      var watchFn = jasmine.createSpy().and.returnValue('something');

      scope.$watch(watchFn);

      scope.$digest();

      expect(watchFn).toHaveBeenCalled();
    })

    it('triggers chained watchers in the same digest', function () {
      scope.name = 'Jane';

      scope.$watch(
        function (scope) { return scope.nameUpper; },
        function (newValue, oldValue, scope) {
          if (newValue) {
            scope.initial = newValue.substring(0, 1) + '.'
          }
        }
      )

      scope.$watch(
        function (scope) {return scope.name; },
        function (newValue, oldValue, scope) {
          if (newValue) {
            scope.nameUpper = newValue.toUpperCase();
          }
        }
      )

      scope.$digest();
      expect(scope.initial).toBe('J.');

      scope.name = 'Bob';
      scope.$digest();
      expect(scope.initial).toBe('B.');
    })

    // 两个 watcher 都在监听着会被对方更改的值
    it('gives up on the watchers after 10 iterations', function () {
      scope.counterA = 0;
      scope.counterB = 0;

      scope.$watch(
        function (scope) { return scope.counterA; },
        function (newValue, oldValue, scope) {
          scope.counterB++;
        }
      )

      scope.$watch(
        function (scope) { return scope.counterB; },
        function (newValue, oldValue, scope) {
          scope.counterA++;
        }
      )

      expect(function() { scope.$digest(); }).toThrow();
    })

    // Short-Circuiting The Digest When The Last Watch Is Clean
    it('ends the digest when the last watch is clean', function () {
      scope.array = _.range(100);
      var watchExecutions = 0;

      _.times(100, function(i) {
        scope.$watch(
          function (scope) {
            watchExecutions++;
            return scope.array[i];
          },
          function() {}
        )
      });

      scope.$digest();
      expect(watchExecutions).toBe(200);

      scope.array[0] = 420;
      scope.$digest();
      expect(watchExecutions).toBe(301);
    });

    // 一种特殊情况——在 listener 函数中注册另一个 watcher
    it('does not end digest so that new watchers are not run', function () {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function (scope) { return scope.aValue; },
        function (newValue, oldValue, scope) {
          scope.$watch(
            function (scope) { return scope.aValue; },
            function (newValue, oldValue, scope) {
              scope.counter++;
            }
          )
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    // 之前比较都是基于引用的比较，对于对象或数组内元素或者属性的改变，无法做出合理判断
    it('compares based on value if enabled', function () {
      scope.aProperty = [1, 2, 3]
      scope.counter = 0;

      scope.$watch(
        function (scope) {return scope.aProperty; },
        function (newLvaue, oldValue, scope) {
          scope.counter++;
        },
        true
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aProperty.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    // NaN特殊处理
    it('correctly handles NaNs', function () {
      scope.number = 0 / 0 // NaN
      scope.counter = 0;

      scope.$watch(
        function (scope) { return scope.number; },
        function (newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    // 异常处理
    it('catches exceptions in watch functions and continues', function () {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function (scope) {throw 'Error'},
        function (newValue, oldValue, scope) {}
      );

      scope.$watch(
        function(scope) { return scope.aValue;},
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    })

    it('catches exceptions in listener functions and continues', function () {
      scope.aValue = 'abc';
      scope.counter = 0;
      scope.$watch(
        function (scope) {return scope.aValue;},
        function (newValue, oldValue, scope) {
          throw 'Error'
        }
      );

      scope.$watch(
        function(scope) { return scope.aValue;},
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    // Angular 实现移除 watcher 的方式十分聪明：Angular 中的 $watch 函数会有一个返回值。
    // 这个值就是一个函数，当它被调用的时候就会销毁对应的 watcher。
    it('allows desrtrying a $watch with a removal function', function () {
      scope.aValue = 'abc';
      scope.counter = 0;

      var destroyWatch = scope.$watch(
        function (scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue = 'def';
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.aValue = 'ghi';
      destroyWatch();
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    // watcher 可能会在自己的 watch 或 listener 函数移除自身
    it('allows detroying a $watch during digest', function () {
      scope.aValue = 'abc';
      var watchCalls = [];

      scope.$watch(
        function (scope) {
          watchCalls.push('first');
          return scope.aValue;
        }
      );

      var destroyWatch = scope.$watch(
        function(scope) {
          watchCalls.push('second');
          destroyWatch();
        }
      );

      scope.$watch(
        function (scope) {
          watchCalls.push('third');
          return scope.aValue;
        }
      );

      scope.$digest();
      expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third']); 
    });
    it('allows a $watch tp destroy another during digest', function () {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function (scope) { return scope.aValue; },
        function (newValue, oldValue, scope) {
          destroyWatch();
        }
      );

      var destroyWatch = scope.$watch(
        function (scope) {},
        function (newValue, oldValue, scope) {}
      );

      scope.$watch(
        function(scope) { return scope.aValue; },
        function (newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('allows dettroying serval $watches during digest', function () {
      scope.aValue = 'abc';
      scope.counter = 0;

      var destroyWatch1 = scope.$watch(
        function () {
          destroyWatch1();
          destroyWatch2();
        }
      );

      var destroyWatch2 = scope.$watch(
        function (scope) { return scope.aValue;},
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(0);
    })
  });
});

describe('$eval', function () {
  var scope;

  beforeEach(function () {
    scope = new Scope();
  });

  it("executes $evaled function and retuns result", function () {
    scope.aValue = 42;

    var result = scope.$eval(function(scope) {
      return scope.aValue;
    });

    expect(result).toBe(42);
  });

  it("passes the second $eval arguments straight through", function () {
    scope.aValue = 42;

    var result = scope.$eval(function(scope, arg) {
      return scope.aValue + arg;
    }, 2)

    expect(result).toBe(44);
  });
});

describe("$apply", function () {
  var scope;

  beforeEach(function () {
    scope = new Scope();
  });

  it("executes the given function and starts the digest", function () {
    scope.aValue = "someValue";
    scope.counter = 0;

    scope.$watch(
      function (scope) {
        return scope.aValue;
      },
      function (newValue, oldValue, scope) {
        scope.counter++;
      }
    );

    scope.$digest();
    expect(scope.counter).toBe(1);

    scope.$apply(function (scope) {
      scope.aValue = "someOtherValue";
    });
    expect(scope.counter).toBe(2);
  });
});

describe("$evalAsync", function () {
  var scope;

  beforeEach(function () {
    scope = new Scope();
  });

  it("exectues given function later in the same cycle digest", function () {
    scope.aValue = [1, 2, 3];
    scope.asyncEvaluated = false;
    scope.asyncEvaluatedImmediately = false;

    scope.$watch(
      function (scope) {
        return scope.aValue;
      },
      function (newValue, oldValue, scope) {
        scope.$evalAsync(function (scope) {
          scope.asyncEvaluated = true;
        });
        scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
      }
    );

    scope.$digest();
    expect(scope.asyncEvaluated).toBe(true);
    expect(scope.asyncEvaluatedImmediately).toBe(false);

  });

  it("executes $evalAsynced functions even when not dirty", function () {
    scope.aValue = [1, 2, 3]
    scope.asyncEvaluated = false;

    scope.$watch(
      function (scope) {
        if (!scope.asyncEvaluated) {
          // 不推荐这样做，因为我们认为 watch 函数不应该产生任何的副作用。
          // 但在 Angular 中这种做法也是被允许的，所以我们要保证这种操作下不会对 digset 产生不良的影响。
          scope.$evalAsync(function (scope) {
            scope.asyncEvaluated = true;
          })
        }
        return scope.aValue;
      },
      function () {}
    );

    scope.$digest();

    expect(scope.asyncEvaluated).toBe(true);
  });

  it("executes $evalAsync functions even then not dirty", function() {
    scope.aValue = [1, 2, 3];
    scope.asyncEvaluatedTimes = 0;

    scope.$watch(
      function (scope) {
        if (scope.asyncEvaluatedTimes < 2) {
          scope.$evalAsync(function (scope) {
            scope.asyncEvaluatedTimes++;
          });
        }
        return scope.aValue;
      },
      function () {}
    );
    scope.$digest();

    expect(scope.asyncEvaluatedTimes).toBe(2);
  });

  it("eventually halts $evalAsyncs added by watches", function () {
    scope.aValue = [1, 2, 3];
    scope.$watch(
      function (scope) {
        scope.$evalAsync(function (scope) {});
        return scope.aValue;
      }
    );

    expect(function () {scope.$digest();}).toThrow();
  });

  it("has a $$phase field whose value is the current digest phase", function () {
    scope.aValue = [1, 2, 3];
    scope.phaseInWatchFunction = null;
    scope.phaseInListenerFunction = null;
    scope.phaseInAllpyFunction = null;

    scope.$watch(
      function (scope) {
        scope.phaseInWatchFunction = scope.$$phase;
        return scope.aValue;
      },
      function (newValue, oldValue, scope) {
        scope.phaseInListenerFunction = scope.$$phase;
      }
    );

    scope.$apply(function (scope) {
      scope.phaseInAllpyFunction = scope.$$phase;
    });

    expect(scope.phaseInWatchFunction).toBe('$digest');
    expect(scope.phaseInListenerFunction).toBe('$digest');
    expect(scope.phaseInAllpyFunction).toBe('$apply');
  });

  it("schedules a digest in $evalAsync", function (done) {
    scope.aValue = 'abc';
    scope.counter = 0;

    scope.$watch(
      function (scope) { return scope.aValue;},
      function (newValue, oldValue, scope) {
        scope.counter++;
      }
    );

    scope.$evalAsync(function(scope){});

    // 要在 Jasmine 中使用 `setTimeout`，我们就要用到它对异步测试的支持：
    // 测试用例对应的函数可以传入一个名为 `done` 的回调函数参数，
    // 只有调用回调函数才会真正结束这个单元测试进程。我们会在 timeout 函数的最后调用这个回调函数。
    expect(scope.counter).toBe(0);
    setTimeout(function () {
      expect(scope.counter).toBe(1);
      done();
    }, 50)
  });
});

describe("$applyAsync", function () {
  var scope;

  beforeEach(function () {
    scope = new Scope();
  });

  it("allows async $apply with $applyAsync", function (done) {
    scope.counter = 0;
    scope.aValue = undefined

    scope.$watch(
      function () { return scope.aValue;},
      function (newValue, oldValue, scope) {
        scope.counter++;
      },
    );

    scope.$digest();
    expect(scope.counter).toBe(1);

    scope.$applyAsync(function (scope) {
      scope.aValue = 'abc';
    })

    expect(scope.counter).toBe(1);

    setTimeout(function () {
      expect(scope.counter).toBe(2);
      done();
    }, 50);
  });

  it("coalesces many calls to $applyAsync", function (done) {
    scope.counter = 0;
    scope.aValue = null;

    scope.$watch(
      function (scope) {
        scope.counter++;
        return scope.aValue;
      },
      function (newValue, oldValue, scope) {}
    );

    scope.$applyAsync(function(scope) {
      scope.aValue = 'abc';
    });

    scope.$applyAsync(function(scope) {
      scope.aValue = 'def';
    });

    setTimeout(function () {
      expect(scope.counter).toBe(2);
      expect(scope.aValue).toEqual('def');
      done();
    }, 50)
  });

  // applyAsync` 的另一个特性是，如果在它设定的 timeout 定时器触发之前由于其他某些原因已经启动了一个 digest，
  // 那定时器中的 digest 就无需启动了。
  it("cancels ans flushed $applyAsync if digested first", function (done) {
    scope.counter = 0;
    scope.aValue = null;

    scope.$watch(
      function (scope) {
        scope.counter++;
        return scope.aValue;
      },
      function(newValue, oldValue, scope) {}
    );

    scope.$applyAsync(function(scope) {
      scope.aValue = 'abc';
    });

    scope.$applyAsync(function(scope) {
      scope.aValue = 'def';
    });

    scope.$digest();
    expect(scope.counter).toBe(2);
    expect(scope.aValue).toEqual('def');

    setTimeout(function () {
      expect(scope.counter).toBe(2);
      done();
    }, 50);
  });
});
