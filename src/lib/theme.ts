export function resolveTheme(choice: string | null, hour: number, prefersDark: boolean) {
  const selected = choice === "light" || choice === "dark" ? choice : "auto";
  return {
    choice: selected,
    theme: selected === "auto"
      ? (hour >= 21 || hour < 6 ? "night" : prefersDark ? "dark" : "light")
      : selected,
  };
}
