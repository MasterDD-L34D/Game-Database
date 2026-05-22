import { MenuItem, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listTaxonomyVersions } from '../../../lib/taxonomy';

type Props = { value: string; onChange: (tag: string) => void };

export default function VersionPicker({ value, onChange }: Props) {
  const { t } = useTranslation('versions');
  const { data } = useQuery({
    queryKey: ['taxonomy-versions', 'picker'],
    queryFn: () => listTaxonomyVersions(true),
  });
  const options = (data?.versions ?? []).filter((v) => v.status !== 'draft');
  return (
    <TextField
      select
      size="small"
      label={t('versions.picker.label')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 200 }}
    >
      <MenuItem value="">{t('versions.picker.live')}</MenuItem>
      {options.map((v) => (
        <MenuItem key={v.id} value={v.tag}>{v.tag}</MenuItem>
      ))}
    </TextField>
  );
}
