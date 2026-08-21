/** Une clases ignorando las vacías. Sin dependencias: no hace falta más. */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}
