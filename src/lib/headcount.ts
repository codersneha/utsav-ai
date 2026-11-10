/**
 * "How many guests will actually come?" — a turnout forecast for any catered function.
 *
 * In India an invitation usually covers a whole family and few people send a formal reply, so the
 * host guesses the headcount and the caterer is paid for a guaranteed number of plates whoever
 * turns up. This turns what the host already knows about each family (how close, how far, what
 * they said on the phone) into a likely range and a number to guarantee.
 *
 * The chances below are rules of thumb, not measured data. They are shown to the user and are
 * meant to be replaced by real turnout figures as events report back.
 */

export const OCCASIONS = ['wedding', 'family-function', 'birthday', 'community', 'corporate'] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const CLOSENESS = ['family', 'close', 'extended', 'colleague', 'acquaintance'] as const;
export type Closeness = (typeof CLOSENESS)[number];

export const DISTANCES = ['local', 'nearby', 'far'] as const;
export type Distance = (typeof DISTANCES)[number];

export const REPLIES = ['not-asked', 'yes', 'maybe', 'no'] as const;
export type Reply = (typeof REPLIES)[number];

/** One family, or a batch of similar guests such as "Dad's office". */
export interface GuestGroup {
  id: string;
  name: string;
  /** Everyone the invitation covers. */
  people: number;
  closeness: Closeness;
  distance: Distance;
  reply: Reply;
}

/** Share of each kind of guest who usually comes when they live in the same city. */
export const TURNOUT_BY_CLOSENESS: Record<Closeness, number> = {
  family: 0.95,
  close: 0.85,
  extended: 0.7,
  colleague: 0.6,
  acquaintance: 0.5,
};

/** How much travel cuts turnout. */
export const TURNOUT_BY_DISTANCE: Record<Distance, number> = {
  local: 1,
  nearby: 0.85,
  far: 0.6,
};

/** What a phone reply is worth; a "maybe" halves the usual chance, and no reply leaves it as it is. */
const CHANCE_IF_YES = 0.95;
const CHANCE_IF_NO = 0.03;
const MAYBE_FACTOR = 0.6;

/** Up to this size a group is one household that comes, or stays home, together. */
export const HOUSEHOLD_MAX = 8;
/** The range covers about 8 in 10 outcomes (±1.28 standard deviations). */
const RANGE_Z = 1.28;
const ROUND_TO = 5;
export const LIMITS = { peopleMax: 2000, groupsMax: 300, nameMax: 60, plateMax: 20_000 } as const;

/** The chance that the people in a group turn up. */
export function turnoutChance(group: Pick<GuestGroup, 'closeness' | 'distance' | 'reply'>): number {
  if (group.reply === 'yes') return CHANCE_IF_YES;
  if (group.reply === 'no') return CHANCE_IF_NO;
  const usual = TURNOUT_BY_CLOSENESS[group.closeness] * TURNOUT_BY_DISTANCE[group.distance];
  return group.reply === 'maybe' ? usual * MAYBE_FACTOR : usual;
}

/**
 * How uncertain a group's turnout is. A household moves together (all come or none), so its
 * spread grows with the square of its size; a large batch of separate guests averages out.
 */
function variance(group: GuestGroup): number {
  const p = turnoutChance(group);
  const spread = p * (1 - p);
  return group.people <= HOUSEHOLD_MAX ? group.people ** 2 * spread : group.people * spread;
}

export interface HeadcountForecast {
  invited: number;
  /** The single most likely turnout. */
  expected: number;
  /** About 8 in 10 events like this land between low and high. */
  low: number;
  high: number;
  /** The number to commit to the caterer: you pay for these plates whoever comes. */
  guarantee: number;
  /** Plates to ask the caterer to be ready for on top of the guarantee. */
  standby: number;
  /** People in groups who have not given a clear yes or no. */
  undecided: number;
  /** Money that goes on empty plates if the whole invite list is guaranteed. */
  wastedIfFullList: number;
  /** Money kept by guaranteeing the recommended number instead of the whole list. */
  saved: number;
  /** What the standby plates cost if every one of them is needed. */
  standbyCost: number;
  /** The groups whose answer would narrow the range most, biggest first. */
  callFirst: GuestGroup[];
}

const roundDown = (n: number) => Math.floor(n / ROUND_TO) * ROUND_TO;
const roundUp = (n: number) => Math.ceil(n / ROUND_TO) * ROUND_TO;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Groups still waiting for a clear answer, ordered by how much a phone call would settle. */
function groupsToCall(groups: GuestGroup[], max = 3): GuestGroup[] {
  return groups
    .filter((g) => g.reply === 'not-asked' || g.reply === 'maybe')
    .sort((a, b) => variance(b) - variance(a))
    .slice(0, max);
}

/** The likely turnout, the number to guarantee, and the money at stake at `platePrice` a plate. */
export function forecastHeadcount(groups: GuestGroup[], platePrice: number): HeadcountForecast {
  const invited = groups.reduce((sum, g) => sum + g.people, 0);
  const mean = groups.reduce((sum, g) => sum + g.people * turnoutChance(g), 0);
  const deviation = Math.sqrt(groups.reduce((sum, g) => sum + variance(g), 0));
  const expected = Math.round(mean);

  // Small lists are not rounded to fives: rounding 12 guests down to 10 would hide two people.
  const fine = invited < 40;
  const low = clamp(
    fine ? Math.floor(mean - RANGE_Z * deviation) : roundDown(mean - RANGE_Z * deviation),
    0,
    invited,
  );
  const high = clamp(
    fine ? Math.ceil(mean + RANGE_Z * deviation) : roundUp(mean + RANGE_Z * deviation),
    low,
    invited,
  );
  const guarantee = low;
  const standby = high - guarantee;
  const price = Math.max(0, platePrice);

  return {
    invited,
    expected,
    low,
    high,
    guarantee,
    standby,
    undecided: groups
      .filter((g) => g.reply === 'not-asked' || g.reply === 'maybe')
      .reduce((sum, g) => sum + g.people, 0),
    wastedIfFullList: Math.max(0, invited - expected) * price,
    saved: (invited - guarantee) * price,
    standbyCost: standby * price,
    callFirst: groupsToCall(groups),
  };
}

const isOneOf =
  <T extends string>(options: readonly T[]) =>
  (v: unknown): v is T =>
    options.includes(v as T);
const isCloseness = isOneOf(CLOSENESS);
const isDistance = isOneOf(DISTANCES);
const isReply = isOneOf(REPLIES);
export const isOccasion = isOneOf(OCCASIONS);

/** A stored group that is safe to use (saved lists come from the browser and may be edited). */
export function isGuestGroup(v: unknown): v is GuestGroup {
  if (typeof v !== 'object' || v === null) return false;
  const g = v as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    typeof g.name === 'string' &&
    g.name.length <= LIMITS.nameMax &&
    Number.isInteger(g.people) &&
    (g.people as number) >= 1 &&
    (g.people as number) <= LIMITS.peopleMax &&
    isCloseness(g.closeness) &&
    isDistance(g.distance) &&
    isReply(g.reply)
  );
}

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** A short message for the family group: the forecast and what to tell the caterer. */
export function forecastMessage(forecast: HeadcountForecast, occasionLabel: string, link: string): string {
  const lines = [
    `Headcount for our ${occasionLabel}:`,
    `Invited: ${forecast.invited}`,
    `Likely to come: ${forecast.low}–${forecast.high} (most likely ${forecast.expected})`,
    `Guarantee to the caterer: ${forecast.guarantee} plates, with ${forecast.standby} more on standby`,
  ];
  if (forecast.saved > 0)
    lines.push(`Saves up to ${rupees(forecast.saved)} against paying for everyone invited`);
  lines.push('', `Worked out with UtsavAI: ${link}`);
  return lines.join('\n');
}
