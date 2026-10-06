import { sheet } from "./sheet";
import { common } from "./common";
import { weather } from "./weather";
import { advice } from "./advice";
import { flood } from "./flood";
import { rain } from "./rain";
import { dams } from "./dams";

/** English strings keyed by Thai source text. */
export const en: Record<string, string> = { ...sheet, ...common, ...weather, ...advice, ...flood, ...dams, ...rain };
