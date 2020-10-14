export function mapToArray<T>(map: { [key: string]: T }): T[] {
  return Object.keys(map).map((k) => map[k]);
}
