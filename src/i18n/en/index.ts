import { common } from "./common";
import { weather } from "./weather";
import { advice } from "./advice";
import { flood } from "./flood";
import { dams } from "./dams";

/** English strings keyed by Thai source text. */
export const en: Record<string, string> = { ...common, ...weather, ...advice, ...flood, ...dams };
