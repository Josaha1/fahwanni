import data from "../../../public/data/river-systems.json";
import type { RiverSystem } from "./types";

export const riverSystems: RiverSystem[] = data.systems;
export const mainRiverSystems = riverSystems.filter((system) => system.id !== "other");

export function riverSystemForDam(damId: string) {
  return riverSystems.find((system) => system.nodes.some((node) => node.damId === damId));
}
