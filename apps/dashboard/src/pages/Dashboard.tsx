
import { Card, CardContent, Typography } from '@mui/material';
export default function Dashboard() {
  const stats = [
    { label: 'Record totali', value: '—', trend: '' },
    { label: 'Novità', value: '—', trend: '' },
    { label: 'Errori', value: '0', trend: '' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stats.map((s) => (
        <Card key={s.label} className="shadow-card">
          <CardContent>
            <Typography variant="body2" color="text.secondary">{s.label}</Typography>
            <Typography variant="h5" className="mt-1">{s.value}</Typography>
            <Typography variant="caption" color="success.main">{s.trend}</Typography>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
