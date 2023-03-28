export type TMEventAttribute = {
  key: string;
  value: string;
};

export type TMEvent = {
  type: string;
  attributes: TMEventAttribute[];
};

export type TMLog = {
  events: TMEvent[];
};
