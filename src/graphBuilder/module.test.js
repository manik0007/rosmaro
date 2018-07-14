import assert from 'assert';
import {view, set, lensProp} from 'ramda';
import expand from './api';

const testLens = ({
  lens, 
  zoomInInput, 
  zoomInOutput,
  zoomOutInput,
  zoomOutOutput,
}) => {
  assert.deepEqual(
    zoomInOutput,
    view(lens, zoomInInput)
  );
  assert.deepEqual(
    zoomOutOutput,
    set(lens, zoomOutInput, zoomInInput)
  );
};

// TODO: move this to some kind of a test utilities library
const assertIdentityLens = lens => testLens({
  lens, 
  zoomInInput: {a: 123, b: 456}, 
  zoomInOutput: {a: 123, b: 456},
  zoomOutInput: {z: 456, x: 678},
  zoomOutOutput: {z: 456, x: 678},
});

// TODO: rename this test suite
describe('the new graph builder', () => {

  it('expands dynamic composites and segregates graphs, handlers, nodes and lenses', () => {
    const modelDescription = {
      graph: {

        'main': {
          type: 'graph',
          nodes: ['main:A', 'main:B'],
          parent: null,
          arrows: {
            'main:A': {
              'x': {target: 'main:B', entryPoint: 'start'},
            },
            'main:B': {},
          },
          entryPoints: {
            start: {target: 'main:A', entryPoint: 'start'},
          },
        },

        'main:A': {
          type: 'graph',
          nodes: ['main:A:A', 'main:A:B'],
          parent: 'main',
          arrows: {
            'main:A:A': {
              'x': {target: 'main:A:B', entryPoint: 'start'},
            },
            'main:A:B': {},
          },
          entryPoints: {
            start: {target: 'main:A:A', entryPoint: 'start'},
          },
        },

        'main:A:A': {type: 'leaf', parent: 'main:A'},
        'main:A:B': {type: 'leaf', parent: 'main:A'},

        'main:B': {
          type: 'composite', 
          parent: 'main',
          nodes: ['main:B:OrthogonalA', 'main:B:OrthogonalB']
        },

        'main:B:OrthogonalA': {type: 'leaf', parent: 'main:B'},

        'main:B:OrthogonalB': {
          type: 'dynamicComposite', 
          parent: 'main:B',
        },

        'main:B:OrthogonalB:template': {
          type: 'graph',
          nodes: ['main:B:OrthogonalB:template:A'],
          parent: 'main:B:OrthogonalB',
          arrows: {
            'main:B:OrthogonalB:template:A': {
              'loop': {target: 'main:B:OrthogonalB:template:A', entryPoint: 'start'},
            },
          },
          entryPoints: {
            start: {target: 'main:B:OrthogonalB:template:A', entryPoint: 'start'},
          },
        },

        'main:B:OrthogonalB:template:A': {
          type: 'leaf',
          parent: 'main:B:OrthogonalB:template',
        }

      },

      handlers: {
        'main': {
          lens: () => lensProp('first'),
          handler: function () {},
        },
        'main:A': {
          handler: function () {},
        },
        'main:A:A': {
          handler: function () {},
        },
        'main:A:B': {
          handler: function () {},
        },
        'main:B': {
          lens: ({localNodeName}) => lensProp(localNodeName),
          handler: function () {},
        },
        'main:B:OrthogonalA': {
          handler: function () {},
        },
        'main:B:OrthogonalB': {
          lens: ({localNodeName}) => lensProp(localNodeName),
          nodes: (ctx) => ctx['main:B:OrthogonalB nodes'],
          handler: function () {},
        },
        'main:B:OrthogonalB:template': {
          handler: function () {},
        },
        'main:B:OrthogonalB:template:A': {
          handler: function () {},
        },
      },

    };

    const ctx = {
      first: {
        B: {
          OrthogonalB: {
            'main:B:OrthogonalB nodes': ['DynamicChildA', 'DynamicChildB']
          }
        }
      }
    };

    const expectedGraphExpansion = {
        'main': {
          type: 'graph',
          nodes: ['main:A', 'main:B'],
          parent: null,
          arrows: {
            'main:A': {
              'x': {target: 'main:B', entryPoint: 'start'},
            },
            'main:B': {},
          },
          entryPoints: {
            start: {target: 'main:A', entryPoint: 'start'},
          },
        },

        'main:A': {
          type: 'graph',
          nodes: ['main:A:A', 'main:A:B'],
          parent: 'main',
          arrows: {
            'main:A:A': {
              'x': {target: 'main:A:B', entryPoint: 'start'},
            },
            'main:A:B': {},
          },
          entryPoints: {
            start: {target: 'main:A:A', entryPoint: 'start'},
          },
        },

        'main:A:A': {type: 'leaf', parent: 'main:A'},
        'main:A:B': {type: 'leaf', parent: 'main:A'},

        'main:B': {
          type: 'composite', 
          parent: 'main',
          nodes: ['main:B:OrthogonalA', 'main:B:OrthogonalB']
        },

        'main:B:OrthogonalA': {type: 'leaf', parent: 'main:B'},

        'main:B:OrthogonalB': {
          type: 'composite',
          nodes: [
            'main:B:OrthogonalB:DynamicChildA', 
            'main:B:OrthogonalB:DynamicChildB',
          ],
          parent: 'main:B',
        },

        'main:B:OrthogonalB:DynamicChildA': {
          type: 'graph',
          nodes: ['main:B:OrthogonalB:DynamicChildA:A'],
          parent: 'main:B:OrthogonalB',
          arrows: {
            'main:B:OrthogonalB:DynamicChildA:A': {
              'loop': {target: 'main:B:OrthogonalB:DynamicChildA:A', entryPoint: 'start'},
            },
          },
          entryPoints: {
            start: {target: 'main:B:OrthogonalB:DynamicChildA:A', entryPoint: 'start'},
          },
        },

        'main:B:OrthogonalB:DynamicChildA:A': {
          type: 'leaf',
          parent: 'main:B:OrthogonalB:DynamicChildA',
        },

        'main:B:OrthogonalB:DynamicChildB': {
          type: 'graph',
          nodes: ['main:B:OrthogonalB:DynamicChildB:A'],
          parent: 'main:B:OrthogonalB',
          arrows: {
            'main:B:OrthogonalB:DynamicChildB:A': {
              'loop': {target: 'main:B:OrthogonalB:DynamicChildB:A', entryPoint: 'start'},
            },
          },
          entryPoints: {
            start: {target: 'main:B:OrthogonalB:DynamicChildB:A', entryPoint: 'start'},
          },
        },

        'main:B:OrthogonalB:DynamicChildB:A': {
          type: 'leaf',
          parent: 'main:B:OrthogonalB:DynamicChildB',
        },
    };

    const expectedHandlersExpansion = {
      'main': modelDescription.handlers['main'].handler,
      'main:A': modelDescription.handlers['main:A'].handler,
      'main:A:A': modelDescription.handlers['main:A:A'].handler,
      'main:A:B': modelDescription.handlers['main:A:B'].handler,
      'main:B': modelDescription.handlers['main:B'].handler,
      'main:B:OrthogonalA': modelDescription.handlers['main:B:OrthogonalA'].handler,
      'main:B:OrthogonalB': modelDescription.handlers['main:B:OrthogonalB'].handler,
      'main:B:OrthogonalB:DynamicChildA': modelDescription.handlers['main:B:OrthogonalB:template'].handler,
      'main:B:OrthogonalB:DynamicChildA:A': modelDescription.handlers['main:B:OrthogonalB:template:A'].handler,
      'main:B:OrthogonalB:DynamicChildB': modelDescription.handlers['main:B:OrthogonalB:template'].handler,
      'main:B:OrthogonalB:DynamicChildB:A': modelDescription.handlers['main:B:OrthogonalB:template:A'].handler,
    };

    const expanded = expand({plan: modelDescription, ctx});
    assert.deepEqual(expanded.handlers, expectedHandlersExpansion);
    assert.deepEqual(expanded.graph, expectedGraphExpansion);

    testLens({
      lens: expanded.lenses['main'](), 
      zoomInInput: {a: 42, first: 7}, 
      zoomInOutput: 7,
      zoomOutInput: 9,
      zoomOutOutput: {a: 42, first: 9},
    });

    testLens({
      lens: expanded.lenses['main:B']({localNodeName: 'b'}), 
      zoomInInput: {a: 42, b: 7}, 
      zoomInOutput: 7,
      zoomOutInput: 9,
      zoomOutOutput: {a: 42, b: 9},
    });

    testLens({
      lens: expanded.lenses['main:B:OrthogonalB']({localNodeName: 'c'}), 
      zoomInInput: {a: 42, c: 7}, 
      zoomInOutput: 7,
      zoomOutInput: 9,
      zoomOutOutput: {a: 42, c: 9},
    });

    assertIdentityLens(expanded.lenses['main:A']());
    assertIdentityLens(expanded.lenses['main:A:A']());
    assertIdentityLens(expanded.lenses['main:A:B']());
    assertIdentityLens(expanded.lenses['main:B:OrthogonalA']());
    assertIdentityLens(expanded.lenses['main:B:OrthogonalB:DynamicChildA']());
    assertIdentityLens(expanded.lenses['main:B:OrthogonalB:DynamicChildA:A']());
    assertIdentityLens(expanded.lenses['main:B:OrthogonalB:DynamicChildB']());
    assertIdentityLens(expanded.lenses['main:B:OrthogonalB:DynamicChildB:A']());

  });

});