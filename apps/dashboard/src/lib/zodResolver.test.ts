import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createZodResolver } from './zodResolver';

describe('createZodResolver', () => {
  it('returns parsed values and no errors for valid input', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const resolver = createZodResolver(schema);
    const result = await resolver({ name: 'Test User', age: 30 }, undefined as any, undefined as any);

    expect(result).toEqual({
      values: { name: 'Test User', age: 30 },
      errors: {},
    });
  });

  it('returns formatted errors and empty values for invalid input', async () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    const resolver = createZodResolver(schema);
    const result = await resolver({ user: { name: 123 } }, undefined as any, undefined as any);

    expect(result).toEqual({
      values: {},
      errors: {
        'user.name': {
          type: 'invalid_type',
          message: 'Expected string, received number',
        },
        'user.age': {
          type: 'invalid_type',
          message: 'Required',
        },
      },
    });
  });
});
