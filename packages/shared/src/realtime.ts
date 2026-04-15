export type Unsubscribe = () => void;

export interface CollectionRef {
  owner: string;
  name: string;
}

export interface FileRef extends CollectionRef {
  path: string;
}

export interface RealtimeAdapter {
  subscribeCollection(ref: CollectionRef, onChange: () => void): Unsubscribe;
  subscribeFile(ref: FileRef, onChange: () => void): Unsubscribe;
}
