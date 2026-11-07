// Shared by the help panel and the HUD so a first voyage never promises a deadline.
export function voyageLimit(firstVoyage) {
  return firstVoyage ? "no deadline" : "of 10";
}

export function helpLines(firstVoyage, touch) {
  const key = (desktop, phone) => touch ? phone : desktop;
  return [
    firstVoyage
      ? "<b>Goal:</b> fix four boat parts. First voyage: cheaper parts and no deadline. Take your time."
      : "<b>Goal:</b> fix four boat parts before the tenth night.",
    "<b>Gold trail:</b> always leads to your next step. Follow the gold marker to the pier, villagers, then shipyard.",
    `<b>Move:</b> ${key("WASD to walk. Drag to turn the view.", "Drag the circle to walk. Drag the island to turn the view.")}`,
    `<b>Fish:</b> at a pier, ${key("hold Space", "hold Cast")} and let go in the gold. When the fish pulls, press the other way. ${key("Press Q", "Tap Stop fishing")} to leave the pier and follow the trail to swap.`,
    `<b>Swap:</b> a green bubble means that villager can swap with you. ${key("Press E", "Tap Swap")}.`,
    "<b>Pay:</b> the shipyard only takes what the whole town takes. The gold slot in your bag shows which good. That can change.",
    `<b>Storm:</b> after day 6 it soaks what people hoard. Spend or swap it first. ${key("R rides your duck, Q honks.", "The Duck button rides your duck.")}`,
  ];
}
