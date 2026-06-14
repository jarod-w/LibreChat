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
};

export type ServerRequest = Request<unknown, unknown, RequestBody> & {
  user?: IUser;
  config?: AppConfig;
};
