const build_leaving_transitions_mapping_fn = map => from => map[from];

/*

given: "abc"
gives {
  next_state_name: "abc",
  before_transition: fn,
  after_transition: fn
}

given: [fn, fn, next_state_name, fn]
gives: {
  next_state_name: next_state_name,
  before_transition: fn,
  after_transition: fn
}

*/
const flatten_transition_desc = transition_desc => {
  if (typeof transition_desc === 'string') {
    return {
      next_state_name: transition_desc,
      before_transition: async () => {},
      after_transition: async () => {}
    }
  }

  //if it's just a string, then
  return transition_desc.reduce((flat_transition_desc, part) => {
    //it's the name of the next state
    if (typeof part === 'string') {
      return Object.assign({}, flat_transition_desc, {
        next_state_name: part
      })
    //it's some transition action
    } else if (typeof part === 'function') {
      const get_with_merged_fn = fn_name => Object.assign({}, flat_transition_desc, {
        [fn_name]: async () => {
          await flat_transition_desc[fn_name]()
          return part()
        }
      })
      //it's a before transition action
      if (!flat_transition_desc["next_state_name"]) {
        return get_with_merged_fn("before_transition")
      //it's an after transition action
      } else {
        return get_with_merged_fn("after_transition")
      }
    }
  }, {
    before_transition: () => {},
    after_transition: () => {},
  })
}

const append_node = (parents, next_node) => parents
  ? parents + ":" + next_node
  : next_node

const flatten = (
  desc,
  parent = '',
  name = '',
  map_ctx_in = a => a,
  map_ctx_out = a => a
) => {
  switch(desc.type) {

    case undefined: //leaf
      return {
        [name]: {
          type: "leaf",
          prototype: desc,
          parent,
          map_ctx_in,
          map_ctx_out,
          transitions: {},
          map_leaving_arrows: a => a
        }
      }
    break

    case 'adapter':

      const desc_defaults = {
        map_entering_context: a => a,
        map_leaving_context: a => a,
        rename_leaving_arrows: {}
      }
      const desc_with_defaults = Object.assign({}, desc_defaults, desc)
      const arrow_mapping_fn = arrow => desc_with_defaults.rename_leaving_arrows[arrow]
          ? desc_with_defaults.rename_leaving_arrows[arrow]
          : arrow;


      const map_ctx_in_adapter = ctx => desc_with_defaults.map_entering_context(map_ctx_in(ctx))
      const map_ctx_out_adapter = ctx => map_ctx_out(desc_with_defaults.map_leaving_context(ctx))

      const adapted_name = append_node(name, "adapted")

      const flat_adapter = {
        [name]: {
          type: "adapter",
          adapted: adapted_name,
          parent,
          transitions: {},
          map_ctx_in_adapter,
          map_ctx_out_adapter,
          map_leaving_arrows: arrow_mapping_fn
        }
      }

      const adapted = flatten(
        desc.adapted,
        name,
        adapted_name,
        map_ctx_in_adapter,
        map_ctx_out_adapter
      )

      return Object.assign(flat_adapter, adapted)

    break

    case 'graph':

      const flat_graph = {
        [name]: {
          type: "graph",
          initial_node: append_node(name, desc.start),
          parent,
          transitions: {},
          map_ctx_in,
          map_ctx_out,
          map_leaving_arrows: a => a
        }
      }

      var flat_children = Object.keys(desc.nodes).map(node => {
        const composed_node = append_node(name, node)

        const flat_children = flatten(
          desc.nodes[node],
          name,
          composed_node,
          map_ctx_in,
          map_ctx_out
        )

        const flat_direct_child = flat_children[composed_node]

        const transitions_of_direct_child = {
          transitions: get_transitions_for_node(desc.arrows, node, name)
        }

        const flat_direct_child_with_transitions = {
          [composed_node]: Object.assign({}, flat_direct_child, transitions_of_direct_child)
        }

        return Object.assign({}, flat_children, flat_direct_child_with_transitions)
      })

      return Object.assign({}, flat_graph, ...flat_children)
    break

    case 'composite':

      const names_of_child_nodes = desc.nodes
        .map(name_and_desc => append_node(name, name_and_desc[0]))

      const flat_composite = {
        [name]: {
          type: "composite",
          parent,
          map_ctx_in,
          map_ctx_out,
          transitions: {},
          map_leaving_arrows: a => a,
          children: names_of_child_nodes
        }
      }

      var flat_children = desc.nodes.map(name_and_desc => {

        const [child_name, child_desc] = name_and_desc
        const composed_node = append_node(name, child_name)
        const flat_child = flatten(
          child_desc,
          name,
          composed_node,
          map_ctx_in,
          map_ctx_out
        )

        return flat_child
      })

      return Object.assign({}, flat_composite, ...flat_children)

    break

  }
}

/*
res:
{ arrow:
   { next_state_name: ':parent:node',
     before_transition: [Function: before_transition],
     after_transition: [Function: after_transition] },
*/
const get_transitions_for_node = (all_arrows, node, node_with_parent) => {
  const arrows = all_arrows[node]
  if (!arrows) return {}

  return Object.keys(arrows).reduce(
    (transitions, arrow) => {
      const transition = arrows[arrow]
      const flatten_transition = flatten_transition_desc(transition)
      const with_parent = Object.assign({}, flatten_transition, {
        next_state_name: append_node(node_with_parent, flatten_transition['next_state_name'])
      })
      return Object.assign(
        {},
        transitions,
        { [arrow]: with_parent }
      )
    },
    {}
  )
}

//turns a nested description into a flat one
const flatten_old = desc => {
  let flat = {};
  let transitions = {};
  let mapping_fns = {};
  var i = 0;

  const visit = (name, desc, so_far, depth, map_ctx_in, map_ctx_out, map_leaving_arrows) => {
    let common_part = so_far.filter(a => a);
    let composed_name = common_part.concat([name]).join(":");
    let composed_parent_name = common_part.join(":");
    composed_parent_name = composed_parent_name ? composed_parent_name : '';
    switch(desc.type) {

      case undefined: //a leaf
        flat[composed_name] = {
          depth: depth,
          type: "leaf",
          prototype: desc,
          parent: composed_parent_name,
          transitions: {},
          map_ctx_in,
          map_ctx_out,
          map_leaving_arrows
        }
      break;

      case "adapter":
        const desc_defaults = {
          map_entering_context: a => a,
          map_leaving_context: a => a,
          rename_leaving_arrows: {}
        }
        const desc_with_defaults = Object.assign({}, desc_defaults, desc)
        var arrow_mapping_fn = arrow => desc_with_defaults.rename_leaving_arrows[arrow]
            ? desc_with_defaults.rename_leaving_arrows[arrow]
            : arrow

        var arrow_mapping_fn = arrow => {
          const res = desc_with_defaults.rename_leaving_arrows[arrow]
              ? desc_with_defaults.rename_leaving_arrows[arrow]
              : arrow

          return res

        }

        flat[composed_name] = {
          depth: depth,
          type: "adapter",
          parent: name,
          adapted: name + ":adapted",
          transitions: {},
          map_ctx_in,
          map_ctx_out,
          map_leaving_arrows: arrow_mapping_fn
        }

        visit(
          "adapted",
          desc_with_defaults.adapted,
          [...so_far, name],
          depth + 1,
          ctx => desc_with_defaults.map_entering_context(map_ctx_in(ctx)),
          ctx => map_ctx_out(desc_with_defaults.map_leaving_context(ctx)),
          arrow_mapping_fn
        );

      break;

      case "graph":

        initial_node = common_part.concat([name, desc.start]).filter(a => a).join(":");

        flat[composed_name] = {
          map_ctx_in,
          map_ctx_out,
          map_leaving_arrows,
          depth: depth,
          type: "graph",
          transitions: {},
          parent: composed_parent_name,
          initial_node
        }

        for (const child_name in desc.nodes) {
          const child_desc = desc.nodes[child_name]
          const child_transitions = desc.arrows[child_name]

          const full_name = common_part.concat([name, child_name]).filter(a => a).join(":")

          transitions[full_name] = {};
          for (const ev in child_transitions) {
            const child_transition = flatten_transition_desc(child_transitions[ev])

            const full_target_name = common_part
            .concat([name, child_transition.next_state_name])
            .filter(a => a)
            .join(":")

            transitions[full_name][ev] = Object.assign({}, child_transition, {
              next_state_name: full_target_name
            })
          }

          visit(
            child_name,
            child_desc,
            so_far.concat([name]),
            depth + 1,
            map_ctx_in,
            map_ctx_out,
            map_leaving_arrows
          )
        }

      break;

      case "composite":

        let common = so_far.filter(a => a).concat([name]);

        flat[composed_name] = {
          map_ctx_in,
          map_ctx_out,
          map_leaving_arrows,
          depth: depth,
          transitions: {},
          type: "composite",
          parent: composed_parent_name,
          children: desc.nodes.map(name_and_model => common.concat([name_and_model[0]]).filter(a => a).join(":"))
        }

        for (const [child_name, child_desc] of desc.nodes) {
          visit(
            child_name,
            child_desc,
            so_far.concat([name]),
            depth + 1,
            map_ctx_in,
            map_ctx_out,
            a => a
          );
        }

      break;
    }

  };

  visit(undefined, desc, [], -1, a => a, a => a, a => a);
  for (const node in transitions) {
    flat[node]["transitions"] = transitions[node];
  }

  return flat;
};

const get_initial_nodes_as_array = desc => {
  switch (desc.type) {
    case undefined: //it's a leaf
      return [[]]
      break
    case 'adapter':
      const adapted = get_initial_nodes_as_array(desc.adapted)
      return adapted.map(nodes => ['adapted', ...nodes])
    case 'graph':
      const default_node = desc.start
      const initial_nodes_of_default_node = get_initial_nodes_as_array(desc.nodes[desc.start])
      return initial_nodes_of_default_node.map(nodes => [default_node, ...nodes])
    case 'composite':
      return desc.nodes.map(child_node => {
        return get_initial_nodes_as_array(child_node[1]).map(nodes => [child_node[0], ...nodes])
      })
      .reduce((so_far, part) => [...so_far, ...part], [])
      break
  }
}

const get_initial_nodes = desc =>
  get_initial_nodes_as_array(desc)
  .map(nodes => nodes.join(':'))

module.exports = { flatten, get_initial_nodes, get_transitions_for_node }
