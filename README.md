## roo

roo is a (work in progress) simplistic programming language for fun and reminiscence.

![](https://github.com/ziord/roo/blob/master/examples/roo-test.mov)

### Example
```rust
import Sequence from collections.sequence;
import * as io from io;

derive Consumer -> Sequence {
  fn __init__(start=1, end=4, step=1) {
    ref.current = ref.start = start;
    ref.end = end;
    ref.step = step;
  }

  fn __iter__() {
    ref;
  }

  fn __next__() {
    if ref.current > ref.end {
      return !{done: true, value: ref.end};
    }
    let const res = !{done: false, value: ref.current};
    ref.current += ref.step;
    res;
  }
}

Consumer(1, 5).reduce((x, y) => x + y ) |> io.println;
```

### Playground

[Try it live here.](https://roo-playground.herokuapp.com/)


### License
[MIT](https://github.com/ziord/roo/blob/master/LICENSE.txt)
