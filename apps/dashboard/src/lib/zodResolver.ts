import type { Resolver, ResolverResult } from 'react-hook-form';
import type { z } from 'zod';

export function createZodResolver<TSchema extends z.ZodTypeAny>(schema: TSchema): Resolver<z.infer<TSchema>> {
  return async (values, _context, _options): Promise<ResolverResult<z.infer<TSchema>>> => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      return {
        values: parsed.data as Record<string, unknown>,
        errors: {},
      };
    }

    const formErrors: Record<string, any> = {};

    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      if (!path) continue;
      formErrors[path] = {
        type: issue.code,
        message: issue.message,
      };
    }

    return {
      values: {},
      errors: formErrors,
    };
  };
}
