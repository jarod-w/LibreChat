import type { IUser, AppConfig } from '@librechat/data-schemas';
import type { TEndpointOption } from 'librechat-data-provider';
import type { Request } from 'express';

/**
 * LibreChat-specific request body type that extends Express Request body
 * (have to use type alias because you can't extend indexed access types like Request['body'])
 */
export type RequestBody = {
  messageId?: string;
  fileTokenLimit?: number;
  conversationId?: string;
  parentMessageId?: string;
  endpoint?: string;
  endpointType?: string;
  model?: string;
  key?: string;
  endpointOption?: Partial<TEndpointOption>;
  /** Nucleant: selected brand profile id, forwarded to KotlerAPI as X-Brand-Id */
  brandId?: number;
  /** Nucleant: selected product profile id, forwarded to KotlerAPI as X-Product-Id */
  productId?: number;
  /** Nucleant: selected intent key (intent selector), forwarded to KotlerAPI as X-Intent */
  intent?: string;
  /** Nucleant: selected intent-function keys, comma-joined, forwarded as X-Intent-Functions */
  intentFunctions?: string;
  /** Nucleant: confirmed execution-speed plan id, forwarded as X-Execution-Speed-Plan-Id */
  executionSpeedPlanId?: string;
};

export type ServerRequest = Request<unknown, unknown, RequestBody> & {
  user?: IUser;
  config?: AppConfig;
};
