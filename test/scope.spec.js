var Scope = require('../src/scope');

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
        function (newValue, oldValue, sope) {
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
  });
});
