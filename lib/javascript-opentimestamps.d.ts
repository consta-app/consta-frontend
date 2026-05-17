declare module "javascript-opentimestamps" {
  export class DetachedTimestampFile {
    static deserialize(bytes: Uint8Array): DetachedTimestampFile;
    static fromHash(op: unknown, hash: Uint8Array): DetachedTimestampFile;
    serializeToBytes(): Uint8Array;
  }

  export const Ops: {
    OpSHA256: new () => unknown;
  };

  export function upgrade(detached: DetachedTimestampFile): Promise<unknown>;
  export function verify(
    detached: DetachedTimestampFile,
    op: unknown,
    hash: Uint8Array,
  ): Promise<Record<string, { height: number; timestamp: number } | number>>;
  export function stamp(detached: DetachedTimestampFile): Promise<void>;

  const _default: {
    DetachedTimestampFile: typeof DetachedTimestampFile;
    Ops: typeof Ops;
    upgrade: typeof upgrade;
    verify: typeof verify;
    stamp: typeof stamp;
  };
  export default _default;
}
