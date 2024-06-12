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
  });
});
