const round = (value) => Math.round(value * 10) / 10;

export function percentile(values, fraction) {
  if (!values.length || fraction < 0 || fraction > 1) throw new Error("Invalid percentile input");
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

export function windowContains(day, center, radius = 15) {
  const distance = Math.abs(day - center);
  return Math.min(distance, 366 - distance) <= radius;
}

export function chooseSnap(cells) {
  const eligible = cells.filter((cell) => Number.isFinite(cell.meanDischarge));
  if (!eligible.length) throw new Error("No snap cell has a finite mean discharge");
  return eligible.reduce((best, cell) => cell.meanDischarge > best.meanDischarge ? cell : best);
}

export function buildClimatology(history) {
  const daily = history.flatMap(({ year, values }) => values.map(({ doy, value }) => ({ year, doy, value })));
  const valid = daily.filter(({ value }) => Number.isFinite(value) && value >= 0);
  if (!valid.length) throw new Error("No valid river discharge history");

  const doy = {};
  for (let day = 1; day <= 366; day++) {
    const sample = valid.filter((row) => windowContains(row.doy, day)).map((row) => row.value);
    if (!sample.length) throw new Error(`No climatology samples for day ${day}`);
    doy[day] = {
      p25: round(percentile(sample, 0.25)),
      p50: round(percentile(sample, 0.5)),
      p75: round(percentile(sample, 0.75)),
      p90: round(percentile(sample, 0.9)),
    };
  }

  const maxima = history.map(({ values }) => Math.max(...values.map(({ value }) =>
    Number.isFinite(value) && value >= 0 ? value : -Infinity)));
  if (maxima.some((value) => !Number.isFinite(value))) throw new Error("A year has no valid discharge values");
  const year2554 = history.find(({ year }) => year === 2011);
  if (!year2554) throw new Error("Missing 2011 river discharge history");
  const value2554 = Object.fromEntries(year2554.values.map(({ doy: day, value }) =>
    [day, Number.isFinite(value) && value >= 0 ? round(value) : null]));
  return {
    doy,
    annualMax: { p50: round(percentile(maxima, 0.5)), p80: round(percentile(maxima, 0.8)) },
    value2554,
  };
}
