export const INITIAL_RACK_TRANSITION = {
  displayed: null,
  requested: null,
  phase: "closed",
};

/** Keep the outgoing panel mounted until its exit finishes. Last click wins. */
export function rackTransitionReducer(state, action) {
  switch (action.type) {
    case "select": {
      if (action.rack !== "mgx" && action.rack !== "advanced-sx") return state;
      if (state.phase === "closed") {
        return { displayed: action.rack, requested: action.rack, phase: "entering" };
      }
      if (state.phase === "exiting") return { ...state, requested: action.rack };
      if (state.displayed === action.rack) return state;
      return { ...state, requested: action.rack, phase: "exiting" };
    }
    case "entered":
      return state.phase === "entering" && state.displayed === action.rack
        ? { ...state, phase: "entered" }
        : state;
    case "exited":
      return state.phase === "exiting" && state.displayed === action.rack
        ? { displayed: state.requested, requested: state.requested, phase: "entering" }
        : state;
    default:
      return state;
  }
}
