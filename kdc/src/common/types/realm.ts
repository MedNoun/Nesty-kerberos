export interface LifetimeInterval {
  min: number;
  max: number;
}

export interface RealmConfig {
  lifetimeInterval: LifetimeInterval;
  /** Keyed by `<principal>@<realm>`, valued with 32 bytes of hex. */
  principals: Record<string, string>;
}

export type RealmsConfig = Record<string, RealmConfig>;
