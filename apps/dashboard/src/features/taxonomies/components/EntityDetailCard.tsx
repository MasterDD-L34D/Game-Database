import { Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type SummaryItem = {
  label: string;
  value: string;
};

export function EntityDetailCard({
  title,
  subtitle,
  summary,
}: {
  title: string;
  subtitle?: string;
  summary: SummaryItem[];
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h4">{title}</Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
          <Grid container spacing={2}>
            {summary.map((item) => (
              <Grid item xs={12} sm={6} md={3} key={item.label}>
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.value}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function RelationListCard({
  title,
  emptyLabel,
  children,
}: {
  title: string;
  emptyLabel: string;
  children: ReactNode[];
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">{title}</Typography>
          {children.length === 0 ? (
            <Typography color="text.secondary">{emptyLabel}</Typography>
          ) : (
            children
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
