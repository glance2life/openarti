declare module "plantuml-encoder" {
  export function encode(content: string): string;
  export function decode(encoded: string): string;
  export default { encode, decode };
}
