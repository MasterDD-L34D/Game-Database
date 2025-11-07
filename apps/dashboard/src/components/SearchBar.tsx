
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
export default function SearchBar() {
  return (
    <TextField placeholder="Cerca" fullWidth inputProps={{ 'aria-label': 'Cerca' }} sx={{ maxWidth: { md: 480 } }}
      InputProps={{ startAdornment: (<InputAdornment position="start"><MagnifyingGlassIcon className="h-5 w-5 text-gray-400" /></InputAdornment>) }} />
  );
}
