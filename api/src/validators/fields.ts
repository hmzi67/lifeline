import { z } from 'zod';

// Building blocks for request-body schemas used with validateBody(). Fields are optional
// and nullable unless a schema says otherwise: required-field checks stay in the handlers,
// these cap types and sizes. Numbers also accept numeric strings, which multipart forms
// and some app versions send.

export const text = (max = 255) => z.string().max(max, `Must be at most ${max} characters`).nullish();
export const id = z.string().max(64).nullish();
export const dateText = z.string().max(40).nullish();
export const timeText = z.string().max(20).nullish();
export const url = z.string().max(2048).nullish();
export const numeric = z.union([z.number(), z.string().max(32)]).nullish();
export const flag = z.union([z.boolean(), z.enum(['true', 'false'])]).nullish();
export const idList = z.array(z.string().max(64)).max(500).nullish();
export const textList = (max = 255, items = 100) => z.array(z.string().max(max)).max(items).nullish();
export const jsonObject = z.record(z.string(), z.unknown()).nullish();
